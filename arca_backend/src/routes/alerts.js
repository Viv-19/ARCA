const express = require('express');
const router = express.Router();
const {
  getRiskDashboard,
  getAlerts,
  markAlertAsRead,
  triggerScan
} = require('../controllers/alertController');

router.get('/dashboard', getRiskDashboard);
router.get('/', getAlerts);
router.put('/:id/read', markAlertAsRead);
router.post('/scan', triggerScan);

module.exports = router;
