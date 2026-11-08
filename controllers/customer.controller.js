const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const CustomerTreatment = require('../models/CustomerTreatment'); // Thêm model nếu có
const Schedule = require('../models/Schedule'); // Thêm model để check lịch nghỉ nhân viên

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_treatment'];

function getVietnamDateTime() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`
  };
}

// GET /api/customer/overview (Tổng quan thông tin cá nhân & lịch hẹn sắp tới)
exports.getOverview = async (req, res, next) => {
  try {
    const customerId = req.session.user._id;
    const user = await User.findOne({ _id: customerId, deletedAt: null })
      .select('fullName membershipTier prepaidBalance avatar');
    const upcomingBookings = await Booking.find({
      customerId,
      status: { $in: ['pending', 'confirmed'] }
    })
      .populate('serviceId', 'serviceName price image')
      .sort({ appointmentDate: 1 });

    return res.json({
      success: true,
      message: 'Lấy thông tin tổng quan thành công!',
      data: { user, upcomingBookings }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/customer/bookings (Đặt lịch hẹn mới)
exports.createBooking = async (req, res, next) => {
  try {
    const { serviceId, staffId, appointmentDate, appointmentTime, note } = req.body;
    const customerId = req.session.user._id;

    if (!serviceId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn đầy đủ dịch vụ, ngày và giờ hẹn!',
        data: null
      });
    }

    if (
      !mongoose.isObjectIdOrHexString(serviceId) ||
      (staffId && !mongoose.isObjectIdOrHexString(staffId))
    ) {
      return res.status(400).json({
        success: false,
        message: 'ID dịch vụ hoặc nhân viên không hợp lệ!',
        data: null
      });
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointmentDate);
    const timeMatch = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime);
    const parsedDate = dateMatch
      ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])))
      : null;
    if (
      !dateMatch ||
      parsedDate.toISOString().slice(0, 10) !== appointmentDate ||
      !timeMatch
    ) {
      return res.status(400).json({
        success: false,
        message: 'Ngày phải theo định dạng YYYY-MM-DD hợp lệ và giờ theo định dạng HH:mm!',
        data: null
      });
    }

    const { date: today, time: currentTime } = getVietnamDateTime();
    if (appointmentDate < today || (appointmentDate === today && appointmentTime <= currentTime)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể đặt lịch vào thời gian đã qua!',
        data: null
      });
    }

    const timeInMinutes = Number(appointmentTime.slice(0, 2)) * 60 + Number(appointmentTime.slice(3));
    const shift = timeInMinutes >= 540 && timeInMinutes < 720
      ? { name: 'sang', start: '09:00', end: '12:00' }
      : timeInMinutes >= 720 && timeInMinutes < 1020
        ? { name: 'chieu', start: '12:00', end: '17:00' }
        : timeInMinutes >= 1020 && timeInMinutes < 1320
          ? { name: 'toi', start: '17:00', end: '22:00' }
          : null;

    if (!shift) {
      return res.status(400).json({
        success: false,
        message: 'Giờ đặt lịch phải nằm trong khung hoạt động từ 09:00 đến trước 22:00!',
        data: null
      });
    }

    const user = await User.findOne({ _id: customerId, deletedAt: null });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin người dùng!', data: null });
    }

    const service = await Service.findOne({ _id: serviceId, status: 'active', deletedAt: null });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ đang hoạt động!',
        data: null
      });
    }
    if (!Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) {
      return res.status(409).json({
        success: false,
        message: 'Dịch vụ chưa được cấu hình thời lượng hợp lệ!',
        data: null
      });
    }

    const requestedStart = timeInMinutes;
    const requestedEnd = requestedStart + service.durationMinutes;
    if (requestedEnd > Number(shift.end.slice(0, 2)) * 60 + Number(shift.end.slice(3))) {
      return res.status(400).json({
        success: false,
        message: 'Thời lượng dịch vụ vượt quá giờ kết thúc ca làm việc!',
        data: null
      });
    }

    if (staffId) {
      const staff = await Staff.findOne({ _id: staffId, deletedAt: null });
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhân viên!',
          data: null
        });
      }
      if (staff.status !== 'working') {
        return res.status(400).json({
          success: false,
          message: 'Nhân viên bạn chọn hiện không làm việc!',
          data: null
        });
      }

      const schedule = await Schedule.findOne({
        staffId,
        date: appointmentDate,
        shift: shift.name
      });
      if (!schedule) {
        return res.status(400).json({
          success: false,
          message: 'Nhân viên chưa được xếp lịch làm việc cho ca đã chọn!',
          data: null
        });
      }
      if (schedule.isOff) {
        return res.status(400).json({
          success: false,
          message: 'Nhân viên bạn chọn được xếp nghỉ trong ca này!',
          data: null
        });
      }

      const activeBookings = await Booking.find({
        staffId,
        appointmentDate,
        status: { $in: ACTIVE_BOOKING_STATUSES }
      }).populate('serviceId', 'durationMinutes');
      const uncheckableBooking = activeBookings.find(booking => {
        return !booking.serviceId ||
          !Number.isFinite(booking.serviceId.durationMinutes) ||
          booking.serviceId.durationMinutes <= 0 ||
          typeof booking.appointmentTime !== 'string' ||
          !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(booking.appointmentTime);
      });
      if (uncheckableBooking) {
        return res.status(409).json({
          success: false,
          message: 'Không thể xác nhận lịch do một lịch hẹn hiện có thiếu thông tin dịch vụ hoặc giờ hẹn hợp lệ!',
          data: null
        });
      }
      if (!Number.isInteger(schedule.maxCapacity) || schedule.maxCapacity < 0) {
        return res.status(409).json({
          success: false,
          message: 'Lịch làm việc chưa được cấu hình capacity hợp lệ!',
          data: null
        });
      }

      const bookingsInShift = activeBookings.filter(booking =>
        booking.appointmentTime >= shift.start && booking.appointmentTime < shift.end
      );

      if (bookingsInShift.length >= schedule.maxCapacity) {
        return res.status(400).json({
          success: false,
          message: 'Ca làm việc này đã đạt số lượng lịch hẹn tối đa!',
          data: null
        });
      }

      const overlapsBooking = activeBookings.some(booking => {
        const [hour, minute] = booking.appointmentTime.split(':').map(Number);
        const existingStart = hour * 60 + minute;
        const existingDuration = booking.serviceId.durationMinutes;
        return requestedStart < existingStart + existingDuration &&
          existingStart < requestedEnd;
      });
      if (overlapsBooking) {
        return res.status(400).json({
          success: false,
          message: 'Khung giờ này của nhân viên đã có lịch hẹn. Vui lòng chọn khung giờ khác!',
          data: null
        });
      }
    }

    const newBooking = await Booking.create({
      customerId,
      customerName: user.fullName || user.username,
      customerPhone: user.phone || '',
      serviceId,
      staffId: staffId || null,
      appointmentDate,
      appointmentTime,
      note: note || '',
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Đặt lịch hẹn thành công!',
      data: newBooking
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/customer/bookings (Lấy danh sách lịch hẹn cá nhân)
exports.getMyBookings = async (req, res, next) => {
  try {
    const customerId = req.session.user._id;
    const { status } = req.query;

    let filter = { customerId };
    if (status === 'upcoming') {
      filter.status = { $in: ['pending', 'confirmed', 'in_treatment'] };
    } else if (status === 'history') {
      filter.status = { $in: ['completed', 'cancelled'] };
    }

    const bookings = await Booking.find(filter)
      .populate('serviceId', 'serviceName price durationMinutes image')
      .populate('staffId', 'staffName title avatar')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Lấy danh sách lịch hẹn thành công!',
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/customer/bookings/:id/cancel (Hủy lịch hẹn)
exports.cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const customerId = req.session.user._id;

    const booking = await Booking.findOne({ _id: id, customerId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn!', data: null });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã kết thúc hoặc đã hủy trước đó!', data: null });
    }

    booking.status = 'cancelled';
    booking.note = reason ? `${booking.note || ''} | Lý do hủy: ${reason}` : booking.note;
    await booking.save();

    return res.json({ success: true, message: 'Hủy lịch hẹn thành công!', data: booking });
  } catch (error) {
    next(error);
  }
};

// GET /api/customer/treatments (Lấy danh sách gói liệu trình cá nhân đã mua)
exports.getMyTreatments = async (req, res, next) => {
  try {
    const customerId = req.session.user._id;
    const treatments = await CustomerTreatment.find({ customerId })
      .populate('treatmentId', 'treatmentName totalSessions description')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Lấy danh sách liệu trình thành công!',
      data: treatments
    });
  } catch (error) {
    next(error);
  }
};