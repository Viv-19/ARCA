const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartmentById,
  getDepartmentMaps
} = require('../controllers/departmentController');

router.get('/', getDepartments);
router.get('/:id', getDepartmentById);
router.get('/:id/maps', getDepartmentMaps);

module.exports = router;
