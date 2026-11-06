const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const User = require('../models/User');

// GET /api/admin/dashboard/stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Doanh thu hôm nay từ Invoice
    const todayInvoices = await Invoice.find({
      createdAt: { $gte: startOfDay },
      status: 'paid'
    });
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

    // 2. Thống kê lịch hẹn
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

    // 3. Tổng số khách hàng
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    return res.json({
      success: true,
      message: 'Lấy thống kê Dashboard thành công!',
      data: {
        todayRevenue,
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          completed: completedBookings,
          cancelled: cancelledBookings
        },
        totalCustomers
      }
    });
  } catch (error) {
    next(error);
  }
};