const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const passwordChangeMiddleware = require('../middlewares/password-change.middleware');

// Tất cả route trong này bắt buộc khách hàng phải đăng nhập
router.use(authMiddleware, passwordChangeMiddleware);

router.get('/overview', customerController.getOverview);
router.post('/bookings', customerController.createBooking);
router.get('/bookings', customerController.getMyBookings);
router.put('/bookings/:id/cancel', customerController.cancelBooking);
router.get('/treatments', customerController.getMyTreatments);

module.exports = router;