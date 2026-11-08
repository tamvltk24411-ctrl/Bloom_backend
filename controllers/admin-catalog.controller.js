const Service = require('../models/Service');
const Product = require('../models/Product');
const Staff = require('../models/Staff');

// --- 1. QUẢN LÝ DỊCH VỤ ---
exports.createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    return res.status(201).json({ success: true, message: 'Tạo dịch vụ thành công!', data: service });
  } catch (error) { next(error); }
};

exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      req.body,
      { new: true, runValidators: true }
    );
    if (!service) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ!', data: null });
    }
    return res.json({ success: true, message: 'Cập nhật dịch vụ thành công!', data: service });
  } catch (error) { next(error); }
};

exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { status: 'inactive', deletedAt: new Date() } },
      { new: true }
    );
    if (!service) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ!', data: null });
    }
    return res.json({ success: true, message: 'Đã ẩn dịch vụ khỏi hệ thống!', data: null });
  } catch (error) { next(error); }
};

// --- 2. QUẢN LÝ SẢN PHẨM ---
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    return res.status(201).json({ success: true, message: 'Tạo sản phẩm mới thành công!', data: product });
  } catch (error) { next(error); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm!', data: null });
    }
    return res.json({ success: true, message: 'Cập nhật sản phẩm thành công!', data: product });
  } catch (error) { next(error); }
};

// --- 3. QUẢN LÝ NHÂN SỰ ---
exports.createStaff = async (req, res, next) => {
  try {
    const staff = await Staff.create(req.body);
    return res.status(201).json({ success: true, message: 'Thêm nhân viên thành công!', data: staff });
  } catch (error) { next(error); }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      req.body,
      { new: true, runValidators: true }
    );
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên!', data: null });
    }
    return res.json({ success: true, message: 'Cập nhật thông tin nhân viên thành công!', data: staff });
  } catch (error) { next(error); }
};