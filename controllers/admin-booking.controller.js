const Booking = require('../models/Booking');

// GET /api/admin/bookings (Quản lý danh sách lịch hẹn)
exports.getAllBookings = async (req, res, next) => {
  try {
    const { date, status, staffId } = req.query;
    const filter = {};
    if (date) filter.appointmentDate = date;
    if (status) filter.status = status;
    if (staffId) filter.staffId = staffId;

    const bookings = await Booking.find(filter)
      .populate('customerId', 'fullName phone email membershipTier')
      .populate('serviceId', 'serviceName price durationMinutes')
      .populate('staffId', 'staffName title')
      .sort({ appointmentDate: 1 });

    return res.json({
      success: true,
      message: 'Lấy danh sách lịch hẹn thành công!',
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/bookings/:id/status (Cập nhật trạng thái lịch hẹn)
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await Booking.findByIdAndUpdate(id, { status }, { new: true });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn!',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công!',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};
