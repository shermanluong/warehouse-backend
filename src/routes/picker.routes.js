const express = require('express');
const { getPickerOrders, scanAndUpdateItem } = require('../controllers/picker.controller');
const router = express.Router();

// Get orders assigned to a picker
router.get('/orders', getPickerOrders);

// Scan item and update status
router.post('/scan', scanAndUpdateItem);

module.exports = router;
