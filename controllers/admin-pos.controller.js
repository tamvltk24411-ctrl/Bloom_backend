const mongoose = require('mongoose');
const User = require('../models/User');
const Service = require('../models/Service');
const Product = require('../models/Product');
const Deposit = require('../models/Deposit');
const Invoice = require('../models/Invoice');
const { dateParts, generateBusinessCode } = require('../utils/business-codes');

const PAYMENT_METHODS = ['cash', 'banking', 'card', 'prepaid_wallet'];

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// POST /api/admin/pos/checkout (Thanh toán hóa đơn quầy POS)
exports.posCheckout = async (req, res, next) => {
  let session;
  try {
    const {
      customerId,
      items,
      discountAmount = 0,
      depositId,
      paidAmount,
      paymentMethod = 'cash',
      isDraft = false
    } = req.body;

    if (!mongoose.isValidObjectId(customerId)) {
      throw requestError(400, 'ID khách hàng không hợp lệ!');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw requestError(400, 'Hóa đơn phải có ít nhất một sản phẩm hoặc dịch vụ!');
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw requestError(400, 'Phương thức thanh toán không hợp lệ!');
    }
    if (typeof isDraft !== 'boolean') {
      throw requestError(400, 'isDraft phải là giá trị boolean!');
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      throw requestError(400, 'Số tiền giảm giá không hợp lệ!');
    }
    if (paidAmount !== undefined && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
      throw requestError(400, 'Số tiền đã thu không hợp lệ!');
    }
    if (depositId && !mongoose.isValidObjectId(depositId)) {
      throw requestError(400, 'ID tiền cọc không hợp lệ!');
    }
    if (Object.hasOwn(req.body, 'depositDeduction')) {
      throw requestError(400, 'Số tiền cấn cọc được xác định từ khoản cọc đang giữ; hãy gửi depositId.');
    }
    if (isDraft && (depositId || (paidAmount !== undefined && paidAmount !== 0))) {
      throw requestError(400, 'Hóa đơn nháp không thể nhận thanh toán hoặc cấn trừ tiền cọc!');
    }

    const normalizedItems = items.map(item => {
      if (
        !item ||
        !mongoose.isValidObjectId(item.itemId) ||
        !['service', 'product'].includes(item.type) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw requestError(400, 'Mỗi dòng hóa đơn cần itemId, type và quantity hợp lệ!');
      }
      return { itemId: item.itemId, type: item.type, quantity: item.quantity };
    });

    const { year, month } = dateParts();
    const invoiceCode = await generateBusinessCode(
      Invoice,
      'invoiceCode',
      `invoice:${year}${month}`,
      sequence => `INV-${year}${month}-${String(sequence).padStart(3, '0')}`
    );

    session = await mongoose.startSession();
    let invoice;

    await session.withTransaction(async () => {
      const customer = await User.findOne({ _id: customerId, deletedAt: null }).session(session);
      if (!customer) {
        throw requestError(404, 'Không tìm thấy thông tin khách hàng!');
      }

      const invoiceItems = [];
      const productQuantities = new Map();
      for (const item of normalizedItems) {
        const Model = item.type === 'product' ? Product : Service;
        const filter = item.type === 'product'
          ? { _id: item.itemId, deletedAt: null }
          : { _id: item.itemId, status: 'active', deletedAt: null };
        const catalogItem = await Model.findOne(filter).session(session);
        if (!catalogItem) {
          throw requestError(404, `Không tìm thấy ${item.type === 'product' ? 'sản phẩm' : 'dịch vụ'} trong danh mục!`);
        }
        if (!Number.isFinite(catalogItem.price) || catalogItem.price < 0) {
          throw requestError(400, 'Giá trong danh mục không hợp lệ!');
        }

        const name = item.type === 'product' ? catalogItem.productName : catalogItem.serviceName;
        invoiceItems.push({
          itemId: catalogItem._id,
          name,
          type: item.type,
          quantity: item.quantity,
          unitPrice: catalogItem.price,
          amount: item.quantity * catalogItem.price
        });

        if (item.type === 'product') {
          productQuantities.set(
            String(catalogItem._id),
            (productQuantities.get(String(catalogItem._id)) || 0) + item.quantity
          );
        }
      }

      const totalAmount = invoiceItems.reduce((total, item) => total + item.amount, 0);
      if (discountAmount > totalAmount) {
        throw requestError(400, 'Số tiền giảm giá không được lớn hơn tổng hóa đơn!');
      }

      let depositDeduction = 0;
      let deposit = null;
      if (depositId) {
        deposit = await Deposit.findOne({
          _id: depositId,
          customerId,
          depositStatus: 'held'
        }).session(session);
        if (!deposit) {
          throw requestError(404, 'Không tìm thấy khoản cọc đang được giữ cho khách hàng này!');
        }
        depositDeduction = deposit.amount;
        if (!Number.isFinite(depositDeduction) || depositDeduction < 0) {
          throw requestError(400, 'Số tiền cọc không hợp lệ!');
        }
        if (depositDeduction > totalAmount - discountAmount) {
          throw requestError(400, 'Khoản cọc vượt quá số tiền còn phải thanh toán; không thể cấn trừ một phần khoản cọc này!');
        }
      }

      const finalAmount = Math.max(0, totalAmount - discountAmount - depositDeduction);
      const amountReceived = isDraft ? 0 : (paidAmount === undefined ? finalAmount : paidAmount);
      if (amountReceived > finalAmount) {
        throw requestError(400, 'Số tiền đã thu không được lớn hơn số tiền cuối cùng!');
      }
      const debtAmount = Math.max(0, finalAmount - amountReceived);
      const debtStatus = debtAmount === 0
        ? 'paid'
        : amountReceived === 0 ? 'unpaid' : 'partially_paid';
      const status = isDraft
        ? 'draft'
        : debtStatus === 'paid' ? 'paid'
          : debtStatus === 'unpaid' ? 'issued' : 'partially_paid';

      if (!isDraft) {
        for (const [productId, quantity] of productQuantities) {
          const result = await Product.updateOne(
            { _id: productId, stockQuantity: { $gte: quantity }, deletedAt: null },
            { $inc: { stockQuantity: -quantity } },
            { session }
          );
          if (result.modifiedCount !== 1) {
            throw requestError(400, 'Tồn kho sản phẩm không đủ để hoàn tất thanh toán!');
          }
        }

        if (deposit) {
          const result = await Deposit.updateOne(
            { _id: deposit._id, depositStatus: 'held' },
            { $set: { depositStatus: 'settled' } },
            { session }
          );
          if (result.modifiedCount !== 1) {
            throw requestError(409, 'Khoản cọc đã được xử lý trong một giao dịch khác!');
          }
        }

        if (paymentMethod === 'prepaid_wallet' && amountReceived > 0) {
          const updatedCustomer = await User.findOneAndUpdate(
            { _id: customerId, deletedAt: null, prepaidBalance: { $gte: amountReceived } },
            { $inc: { prepaidBalance: -amountReceived, totalSpent: amountReceived } },
            { new: true, session }
          );
          if (!updatedCustomer) {
            throw requestError(400, `Số dư ví không đủ! (Hiện có: ${customer.prepaidBalance.toLocaleString()} VNĐ)`);
          }
        }
      }

      [invoice] = await Invoice.create([{
        invoiceCode,
        customerId,
        items: invoiceItems,
        totalAmount,
        discountAmount,
        depositId: deposit ? deposit._id : null,
        depositDeduction,
        finalAmount,
        paidAmount: amountReceived,
        debtAmount,
        debtStatus,
        paymentMethod,
        status
      }], { session });
    });

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Lưu hóa đơn nháp thành công!' : 'Thanh toán thành công!',
      data: invoice
    });
  } catch (error) {
    next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// POST /api/admin/pos/prepaid-wallet (Nạp tiền ví trả trước)
exports.topupPrepaidWallet = async (req, res, next) => {
  try {
    const { customerId, topupAmount } = req.body;
    if (!topupAmount || topupAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền nạp không hợp lệ!',
        data: null
      });
    }

    const customer = await User.findOne({ _id: customerId, deletedAt: null });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng!',
        data: null
      });
    }

    customer.prepaidBalance += Number(topupAmount);
    await customer.save();

    return res.json({
      success: true,
      message: `Nạp thành công ${topupAmount.toLocaleString()} VNĐ vào ví!`,
      data: { customerId: customer._id, prepaidBalance: customer.prepaidBalance }
    });
  } catch (error) {
    next(error);
  }
};
