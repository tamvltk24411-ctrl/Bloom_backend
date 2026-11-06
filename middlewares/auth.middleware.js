module.exports = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn!',
    data: null
  });
};