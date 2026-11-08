const bcrypt = require('bcryptjs');
const User = require('../models/User');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const SALT_ROUNDS = 10;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value);

const verifyPassword = async (candidate, storedPassword) => {
  if (typeof storedPassword !== 'string') return false;
  return isBcryptHash(storedPassword)
    ? bcrypt.compare(candidate, storedPassword)
    : candidate === storedPassword;
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tài khoản và mật khẩu!',
        data: null
      });
    }

    const identifier = username.trim();
    const compactIdentifier = identifier.replace(/\s+/g, '');
    const spacingTolerantIdentifier = new RegExp(
      `^\\s*${Array.from(compactIdentifier, escapeRegex).join('\\s*')}\\s*$`
    );

    // Tìm user theo username, email hoặc phone
    const user = await User.findOne({
      deletedAt: null,
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() },
        { phone: identifier },
        { username: spacingTolerantIdentifier },
        { phone: spacingTolerantIdentifier }
      ]
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác!',
        data: null
      });
    }

    if (!isBcryptHash(user.password)) {
      user.password = await bcrypt.hash(password, SALT_ROUNDS);
      await user.save();
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa!',
        data: null
      });
    }

    // Lưu phiên làm việc vào Session
    req.session.user = {
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      membershipTier: user.membershipTier,
      prepaidBalance: user.prepaidBalance,
      mustChangePassword: user.mustChangePassword
    };

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        user: {
          id: user._id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          membershipTier: user.membershipTier,
          prepaidBalance: user.prepaidBalance,
          avatar: user.avatar,
          mustChangePassword: user.mustChangePassword
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/register (Khách hàng tự đăng ký)
exports.register = async (req, res, next) => {
  try {
    const { username, password, fullName, phone, email } = req.body;

    // Validate mật khẩu mạnh (8+ ký tự, 1 hoa, 1 thường, 1 số)
    if (typeof password !== 'string' || !PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!',
        data: null
      });
    }

    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập!',
        data: null
      });
    }

    const normalizedUsername = username.trim();
    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập đã tồn tại!',
        data: null
      });
    }

    // Bảo mật: Băm mật khẩu bằng bcrypt trước khi tạo user
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await User.create({
      username: normalizedUsername,
      password: hashedPassword,
      fullName: fullName || '',
      phone: phone || '',
      email: email || '',
      role: 'customer'
    });

    const userResponse = newUser.toObject();
    delete userResponse.password; // Không để lộ hash mật khẩu trong response

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      data: { user: userResponse }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.session.user._id,
      deletedAt: null
    }).select('-password');
    return res.json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công!',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Đăng xuất thất bại!', data: null });
    }
    res.clearCookie('connect.sid');
    return res.json({
      success: true,
      message: 'Đăng xuất thành công!',
      data: null
    });
  });
};

// POST /api/auth/change-password (Đổi mật khẩu)
exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session?.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Bạn chưa đăng nhập!',
        data: null
      });
    }

    if (typeof oldPassword !== 'string' || !oldPassword ||
        typeof newPassword !== 'string' || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu cũ và mật khẩu mới!',
        data: null
      });
    }

    // Validate mật khẩu mới theo quy tắc
    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!',
        data: null
      });
    }

    const user = await User.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại!',
        data: null
      });
    }

    // Kiểm tra mật khẩu cũ đã băm
    const isMatch = await verifyPassword(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác!',
        data: null
      });
    }

    // Băm mật khẩu mới và cập nhật
    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.mustChangePassword = false;
    await user.save();

    if (req.session?.user) {
      req.session.user.mustChangePassword = false;
    }

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
      data: null
    });
  } catch (error) {
    next(error);
  }
};