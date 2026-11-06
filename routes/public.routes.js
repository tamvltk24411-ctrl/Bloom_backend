const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Trang công khai không cần authMiddleware
router.get('/services', publicController.getServices);
router.get('/services/:id', publicController.getServiceById);
router.get('/staffs', publicController.getStaffs);
router.get('/professors', publicController.getProfessors);
router.get('/articles', publicController.getArticles);

module.exports = router;