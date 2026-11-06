const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/login', authController.login);
router.post('/register', authController.register); // Đăng ký (validate pass mạnh)

router.get('/profile', authMiddleware, authController.getProfile);
router.post('/logout', authMiddleware, authController.logout);
router.post('/change-password', authMiddleware, authController.changePassword); // Khách tự đổi mật khẩu

module.exports = router;