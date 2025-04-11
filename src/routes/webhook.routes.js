const express = require('express');
const { handleShopifyWebhook } = require('../controllers/webhook.controller');

const router = express.Router();

// Shopify POSTs here when events occur
router.post('/shopify', express.raw({ type: 'application/json' }), handleShopifyWebhook);

module.exports = router;
