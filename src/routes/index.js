const express = require('express');
const router = express.Router();

const shopifyRoutes = require('./shopify.routes');
const pickerRoutes = require('./picker.routes');
const packerRoutes = require('./packer.routes');
const adminRoutes = require('./admin.routes');
const webhookRoutes = require('./webhook.routes');
const substitutionRoutes = require('./substitution.routes');
const orderRoutes = require('./order.routes');

router.use('/shopify', shopifyRoutes);
router.use('/picker', pickerRoutes);
router.use('/packer', packerRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/substitutions', substitutionRoutes);
router.use('/orders', orderRoutes);

module.exports = router;
