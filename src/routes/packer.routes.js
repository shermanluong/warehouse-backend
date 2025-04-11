const express = require('express');
const { getPickedOrders, finalisePack } = require('../controllers/packer.controller');
const router = express.Router();

// Get orders ready for packing
router.get('/orders', getPickedOrders);

// Finalize pack (photo upload, update status, trigger label print)
router.post('/finalise', finalisePack);

module.exports = router;
