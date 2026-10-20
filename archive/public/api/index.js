const express = require('express');
const router = express.Router();

// Auth routes
router.use('/auth', require('./auth/login'));
router.use('/auth', require('./auth/logout'));
router.use('/auth', require('./auth/register'));
router.use('/auth', require('./auth/me'));

// Admin routes
router.use('/admin/projects', require('./admin/projects'));
router.use('/admin/equipment', require('./admin/equipment'));
router.use('/admin/employees', require('./admin/employees'));
router.use('/admin/audit-logs', require('./admin/audit-logs'));

// Customer routes
router.use('/customers/projects', require('./customers/projects'));
router.use('/customers/equipment', require('./customers/equipment'));
router.use('/customers/pm', require('./customers/pm'));
router.use('/customers/inspections', require('./customers/inspections'));
router.use('/customers/work-orders', require('./customers/work-orders'));
router.use('/customers/employees', require('./customers/employees'));

module.exports = router;
