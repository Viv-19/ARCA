const express = require('express');
const router = express.Router();
const { getRiskDashboard } = require('../controllers/alertController');

// Mapped exactly to GET /api/risk/dashboard
router.get('/dashboard', getRiskDashboard);

module.exports = router;
