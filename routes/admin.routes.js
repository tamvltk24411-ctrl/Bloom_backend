const express = require('express');
const router = express.Router();
const adminBookingController = require('../controllers/admin-booking.controller');
const adminCatalogController = require('../controllers/admin-catalog.controller');
const adminCustomerController = require('../controllers/admin-customer.controller');
const adminDashboardController = require('../controllers/admin-dashboard.controller');
const adminPosController = require('../controllers/admin-pos.controller');
const adminStaffController = require('../controllers/admin-staff.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const passwordChangeMiddleware = require('../middlewares/password-change.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Áp dụng middleware kiểm tra đăng nhập & quyền admin cho toàn bộ route phía dưới
router.use(authMiddleware, roleMiddleware('admin'), passwordChangeMiddleware);

// --- BÁO CÁO DASHBOARD ---
router.get('/dashboard/stats', adminDashboardController.getDashboardStats);

// --- CÁC THAO TÁC QUẢN TRỊ (BOOKING, STAFF, POS, CUSTOMER) ---
router.get('/bookings', adminBookingController.getAllBookings);
router.patch('/bookings/:id/status', adminBookingController.updateBookingStatus);
router.get('/staffs', adminStaffController.getStaffs);
router.post('/schedules', adminStaffController.createSchedule);
router.post('/pos/checkout', adminPosController.posCheckout);
router.post('/pos/prepaid-wallet', adminPosController.topupPrepaidWallet);
router.post('/customers', adminCustomerController.createCustomer);

// --- CÁC ROUTE QUẢN LÝ DANH MỤC (CRUD CATALOG) ---
// Dịch vụ
router.post('/services', adminCatalogController.createService);
router.put('/services/:id', adminCatalogController.updateService);
router.delete('/services/:id', adminCatalogController.deleteService);

// Sản phẩm
router.post('/products', adminCatalogController.createProduct);
router.put('/products/:id', adminCatalogController.updateProduct);

// Nhân sự
router.post('/staffs', adminCatalogController.createStaff);
router.put('/staffs/:id', adminCatalogController.updateStaff);

module.exports = router;