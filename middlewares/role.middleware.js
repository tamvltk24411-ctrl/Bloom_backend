module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập chức năng này!',
        data: null
      });
    }
    next();
  };
};