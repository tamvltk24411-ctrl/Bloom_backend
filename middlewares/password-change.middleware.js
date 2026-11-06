module.exports = (req, res, next) => {
  if (req.session?.user?.mustChangePassword) {
    return res.status(403).json({
      success: false,
      message: 'Vui lòng đổi mật khẩu tạm thời trước khi tiếp tục!',
      code: 'PASSWORD_CHANGE_REQUIRED',
      data: null
    });
  }

  return next();
};
