const mongoose = require('mongoose');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Article = require('../models/Article');

// GET /api/public/services
exports.getServices = async (req, res, next) => {
  try {
    const { categoryGroup } = req.query;
    const filter = { status: 'active' };
    if (categoryGroup) filter.categoryGroup = categoryGroup;

    const services = await Service.find(filter);
    return res.json({
      success: true,
      message: 'Lấy danh sách dịch vụ thành công!',
      data: services
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/services/:id
exports.getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID dịch vụ không hợp lệ!',
        data: null
      });
    }

    const service = await Service.findOne({ _id: id, status: 'active' });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ!',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Lấy thông tin dịch vụ thành công!',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/professors
exports.getStaffs = async (req, res, next) => {
  try {
    const staffList = await Staff.find({ status: 'working' });
    return res.json({
      success: true,
      message: 'Lấy danh sách nhân viên thành công!',
      data: staffList
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfessors = exports.getStaffs;

// GET /api/public/articles
exports.getArticles = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { isPublished: true };
    if (category) filter.category = category;

    const articles = await Article.find(filter).populate('authorStaffId', 'staffName title avatar');
    return res.json({
      success: true,
      message: 'Lấy danh sách bài viết kiến thức thành công!',
      data: articles
    });
  } catch (error) {
    next(error);
  }
};