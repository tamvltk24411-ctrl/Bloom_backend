const bcrypt = require('bcryptjs');
const User = require('../models/User');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const SALT_ROUNDS = 10;
const TEMPORARY_PASSWORD = '123456';

// POST /api/admin/customers (Admin khởi tạo tài khoản khách hàng)
exports.createCustomer = async (req, res, next) => {
  try {
    const { username, fullName, phone, email } = req.body;

    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập!',
        data: null
      });
    }
    if (
      (fullName !== undefined && typeof fullName !== 'string') ||
      (phone !== undefined && typeof phone !== 'string') ||
      (email !== undefined && typeof email !== 'string')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên, số điện thoại và email phải là chuỗi ký tự!',
        data: null
      });
    }

    const trimmedUsername = username.trim();
    const filterOr = [{ username: trimmedUsername }];
    if (email && email.trim()) filterOr.push({ email: email.trim().toLowerCase() });
    if (phone && phone.trim()) filterOr.push({ phone: phone.trim() });

    const existingUser = await User.findOne({ $or: filterOr });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập, email hoặc số điện thoại đã tồn tại trong hệ thống!',
        data: null
      });
    }

    const hashedPassword = await bcrypt.hash(TEMPORARY_PASSWORD, SALT_ROUNDS);

    const newUser = await User.create({
      username: trimmedUsername,
      password: hashedPassword,
      mustChangePassword: true,
      fullName: fullName ? fullName.trim() : '',
      phone: phone ? phone.trim() : '',
      email: email ? email.trim().toLowerCase() : '',
      role: 'customer'
    });

    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản khách hàng thành công. Khách hàng cần đổi mật khẩu sau khi đăng nhập lần đầu!',
      data: {
        user: userResponse,
        temporaryPassword: TEMPORARY_PASSWORD,
        mustChangePassword: true
      }
    });
  } catch (error) {
    next(error);
  }
};
