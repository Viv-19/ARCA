const express = require('express');
const router = express.Router();
const {
  startPipeline,
  confirmMaps,
  finalizePipeline,
  publishPipeline
} = require('../controllers/pipelineController');

router.post('/start/:id', startPipeline);
router.post('/confirm-maps/:id', confirmMaps);
router.post('/finalize/:id', finalizePipeline);
router.post('/publish/:id', publishPipeline);

module.exports = router;
