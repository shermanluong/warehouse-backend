const express = require('express');
const auth = require('../middleware/auth.middleware');
const { getPickedOrders,
        getPackingOrder,
        startPacking,
        packItem,
        packPlusItem,
        packMinusItem,
        finalisePack } = require('../controllers/packer.controller');
const router = express.Router();

router.get('/orders', auth(['packer']), getPickedOrders);
router.get('/order/:id', auth(['packer']), getPackingOrder);
router.patch('/order/:id/pack-item', auth(['packer']), packItem);
router.patch('/order/:id/pack-plus', auth(['packer']), packPlusItem);
router.patch('/order/:id/pack-minus', auth(['packer']), packMinusItem);
router.post('/startPacking/:orderId', auth(['packer']), startPacking);
router.post('/finalise', auth(['packer']), finalisePack);

module.exports = router;
