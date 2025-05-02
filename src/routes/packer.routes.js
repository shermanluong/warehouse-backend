const express = require('express');
const auth = require('../middleware/auth.middleware');
const { getPickedOrders,
        getPackingOrder,
        startPacking,
        packItem,
        undoItem,
        cancelSubItem,
        confirmSubItem,
        refundLineItem,
        packPlusItem,
        packMinusItem,
        savePhoto,
        deletePhoto,
        completePacking 
} = require('../controllers/packer.controller');
const router = express.Router();

router.get('/orders', auth(['packer']), getPickedOrders);
router.get('/order/:id', auth(['packer']), getPackingOrder);
router.patch('/order/:id/pack-item', auth(['packer']), packItem);
router.patch('/order/:id/pack-plus', auth(['packer']), packPlusItem);
router.patch('/order/:id/pack-minus', auth(['packer']), packMinusItem);
router.patch('/order/:id/undo-item', auth(['packer']), undoItem);
router.patch('/order/:id/cancel-sub-item', auth(['packer']), cancelSubItem);
router.patch('/order/:id/confirm-sub-item', auth(['packer']), confirmSubItem);
router.patch('/order/:id/save-photo', auth(['packer']), savePhoto);
router.delete('/order/:id/delete-photo', auth(['packer']), deletePhoto);
router.post('/refund-item', auth(['packer']), refundLineItem);
router.post('/startPacking/:orderId', auth(['packer']), startPacking);
router.post('/order/:id/complete-packing', auth(['packer']), completePacking);

module.exports = router;
