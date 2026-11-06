const User = require('../models/User');
const Invoice = require('../models/Invoice');

// POST /api/admin/pos/checkout (Thanh toán hóa đơn quầy POS)
exports.posCheckout = async (req, res, next) => {
  try {
    const { customerId, items, discountAmount, paymentMethod, isDraft } = req.body;

    const count = await Invoice.countDocuments();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceCode = `INV-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    let totalAmount = 0;
    if (Array.isArray(items)) {
      items.forEach(item => { totalAmount += item.quantity * item.unitPrice; });
    }
    const finalDiscount = discountAmount || 0;
    const paidAmount = totalAmount - finalDiscount;

    if (paymentMethod === 'prepaid_wallet') {
      const customer = await User.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin khách hàng!',
          data: null
        });
      }

      if (customer.prepaidBalance < paidAmount) {
        return res.status(400).json({
          success: false,
          message: `Số dư ví không đủ! (Hiện có: ${customer.prepaidBalance.toLocaleString()} VNĐ)`,
          data: null
        });
      }
      customer.prepaidBalance -= paidAmount;
      await customer.save();
    }

    const invoice = await Invoice.create({
      invoiceCode,
      customerId,
      items,
      totalAmount,
      discountAmount: finalDiscount,
      paidAmount,
      debtAmount: 0,
      paymentMethod,
      status: isDraft ? 'draft' : 'paid'
    });

    return res.status(201).json({
      success: true,
      message: 'Thanh toán thành công!',
      data: invoice
    });
  } catch (error) {
    next(error);
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

    const customer = await User.findById(customerId);
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
