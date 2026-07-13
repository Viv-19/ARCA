const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getDocuments,
  createDocument,
  getDocumentById,
  updateDocumentStatus,
  updateDocumentDraft,
  uploadDocument,
  triggerPipeline,
  downloadDocumentFile,
  deleteDocument,
  resetPipelineSession
} = require('../controllers/documentController');

// Ensure uploads/temp directory exists
const tempDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer storage engine configuration
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
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF documents are allowed!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Endpoint mappings
router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', getDocumentById);
router.put('/:id/status', updateDocumentStatus);
router.put('/:id/draft', updateDocumentDraft);
router.post('/upload', upload.single('file'), uploadDocument);
router.post('/:id/trigger-pipeline', triggerPipeline);
router.put('/:id/reset-pipeline', resetPipelineSession);
router.get('/:id/file', downloadDocumentFile);
router.delete('/:id', deleteDocument);

module.exports = router;
