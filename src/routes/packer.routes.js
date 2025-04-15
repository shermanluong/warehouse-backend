const express = require('express');
const auth = require('../middleware/auth.middleware');
const { getPickedOrders,
        getPackingOrder,
        finalisePack } = require('../controllers/packer.controller');
const router = express.Router();

router.get('/orders', auth(['packer']), getPickedOrders);
router.get('/order/:id', auth(['packer']), getPackingOrder);
router.post('/finalise', auth(['packer']), finalisePack);

module.exports = router;
