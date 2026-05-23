const express = require('express');
const router = express.Router();
const {
  getAuditLogs,
  getAuditLogsByMapId
} = require('../controllers/auditLogController');

router.get('/', getAuditLogs);
router.get('/map/:mapId', getAuditLogsByMapId);

module.exports = router;
