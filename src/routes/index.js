const express = require('express');
const router = express.Router();

const shopifyRoutes = require('./shopify.routes');
const pickerRoutes = require('./picker.routes');
const packerRoutes = require('./packer.routes');
const adminRoutes = require('./admin.routes');
const userRoutes = require('./user.routes');
const webhookRoutes = require('./webhook.routes');
const substitutionRoutes = require('./substitution.routes');
const orderRoutes = require('./order.routes');
const uploadRoutes = require('./upload.routes');
const notificationRoutes = require('./notification.routes');

router.use('/shopify', shopifyRoutes);
router.use('/picker', pickerRoutes);
router.use('/packer', packerRoutes);
router.use('/admin', adminRoutes);
router.use('/user', userRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/substitution', substitutionRoutes);
router.use('/orders', orderRoutes);
router.use('/upload', uploadRoutes);
router.use('/notification', notificationRoutes);

module.exports = router;
