const getErrorResponse = (error) => {
  if (error?.name === 'ValidationError') {
    return { status: 400, message: 'Dữ liệu gửi lên không hợp lệ!' };
  }

  if (error?.name === 'CastError') {
    return { status: 400, message: 'ID hoặc dữ liệu tham chiếu không hợp lệ!' };
  }

  if (error?.code === 11000) {
    return { status: 409, message: 'Dữ liệu đã tồn tại trong hệ thống!' };
  }

  if (error?.type === 'entity.parse.failed') {
    return { status: 400, message: 'JSON gửi lên không hợp lệ!' };
  }

  const status = Number(error?.status || error?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return {
      status,
      message: error.message || 'Yêu cầu không hợp lệ!'
    };
  }

  return { status: 500, message: 'Lỗi máy chủ nội bộ!' };
};

module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.status >= 500 || (!err?.status && err?.code !== 11000)) {
    console.error(`Lỗi hệ thống: ${err?.stack || err}`);
  }

  const { status, message } = getErrorResponse(err);
  return res.status(status).json({
    success: false,
    message,
    data: null
  });
};