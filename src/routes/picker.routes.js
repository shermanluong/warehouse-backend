const express = require('express');
const auth = require('../middleware/auth.middleware');
const { 
    getPickerOrders, 
    getPickingOrder, 
    pickItem,
    pickPlusItem,
    pickMinusItem,
    pickFlagItem,
    pickSubstituteItem,
    undoItem,
    scanBarcode,
    completePicking,
    getAvailableTotes,
    assignTote,
    removeTote,
    assignedTotes
 } = require('../controllers/picker.controller');
const router = express.Router();

router.get('/orders', auth(['picker']), getPickerOrders);
router.get('/order/:id', auth(['picker']), getPickingOrder);
router.patch('/order/:id/pick-item', auth(['picker']), pickItem);
router.patch('/order/:id/pick-plus', auth(['picker', 'packer']), pickPlusItem);
router.patch('/order/:id/pick-minus', auth(['picker', 'packer']), pickMinusItem);
router.patch('/order/:id/pick-flag', auth(['picker', 'packer']), pickFlagItem);
router.patch('/order/:id/pick-substitute', auth(['picker', 'packer']), pickSubstituteItem);
router.patch('/order/:id/undo-item', auth(['picker', 'packer']), undoItem);
router.patch('/order/:id/scan', auth(['picker']), scanBarcode);
router.post('/order/:id/complete-picking', auth(['picker']), completePicking);
router.get('/totes', auth(['picker']), getAvailableTotes);
router.post('/assign-tote', auth(['picker']), assignTote);
router.post('/remove-tote', auth(['picker']), removeTote);
router.get('/assigned-totes/:orderId', auth(['picker']), assignedTotes);

module.exports = router;
