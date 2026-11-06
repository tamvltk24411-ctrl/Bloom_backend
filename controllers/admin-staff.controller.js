const Staff = require('../models/Staff');
const Schedule = require('../models/Schedule');

// GET /api/admin/staffs (Danh sách nhân sự)
exports.getStaffs = async (req, res, next) => {
  try {
    const staffs = await Staff.find();
    return res.json({
      success: true,
      message: 'Lấy danh sách nhân viên thành công!',
      data: staffs
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/schedules (Tạo lịch làm việc nhân viên)
exports.createSchedule = async (req, res, next) => {
  try {
    const { staffId, date, shift, isOff, maxCapacity } = req.body;
    const schedule = await Schedule.create({
      staffId,
      date,
      shift,
      isOff: isOff || false,
      maxCapacity: maxCapacity || 5
    });

    return res.status(201).json({
      success: true,
      message: 'Cấu hình lịch thành công!',
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};
