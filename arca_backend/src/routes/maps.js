const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getMaps,
  getPendingReview,
  getMapById,
  createMap,
  approveMap,
  editAndApproveMap,
  rejectMap,
  bulkApprove,
  uploadEvidence,
  overrideValidation,
  getMapEvidence,
  getMapValidationResult,
  getMapValidationScript,
  getMapAuditTrail
} = require('../controllers/mapController');

const { handleManualDispatch } = require('../controllers/dispatchController');

// Ensure evidence temp upload folder exists
const tempDir = path.join(__dirname, '../../uploads/evidence/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${path.basename(file.originalname, ext)}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB total limit for screenshots/logs/reports
});

// Routing endpoints mapping — static/named routes MUST come before /:id wildcards
router.get('/', getMaps);
router.post('/', createMap);
router.get('/pending-review', getPendingReview);
router.post('/approve-bulk', bulkApprove);

// Parameterized routes
router.get('/:id', getMapById);
router.put('/:id/approve', approveMap);
router.put('/:id/edit', editAndApproveMap);
router.put('/:id/reject', rejectMap);

// Dispatch
router.post('/:id/dispatch', handleManualDispatch);

// Evidence upload
router.post('/:id/evidence', upload.array('files', 10), uploadEvidence);

// Override validation
router.post('/:id/override', overrideValidation);

// Getters specific to a MAP for validation scripts, validation results, audit-trails, and evidence
router.get('/:id/evidence', getMapEvidence);
router.get('/:id/validation-result', getMapValidationResult);
router.get('/:id/validation-script', getMapValidationScript);
router.get('/:id/audit-trail', getMapAuditTrail);

module.exports = router;
