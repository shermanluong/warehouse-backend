const express = require('express');
const auth = require('../middleware/auth.middleware');
const { 
    getPickerOrders, 
    getPickingOrder, 
    pickItem,
    pickPlusItem,
    pickMinusItem,
    scanBarcode,
    completePicking,
 } = require('../controllers/picker.controller');
const router = express.Router();

router.get('/orders', auth(['picker']), getPickerOrders);
router.get('/order/:id', auth(['picker']), getPickingOrder);
router.patch('/order/:id/pick-item', auth(['picker']), pickItem);
router.patch('/order/:id/pick-plus', auth(['picker']), pickPlusItem);
router.patch('/order/:id/pick-minus', auth(['picker']), pickMinusItem);
router.patch('/order/:id/scan', auth(['picker']), scanBarcode);
router.post('/order/:id/complete-picking', auth(['picker']), completePicking);

module.exports = router;
