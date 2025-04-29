// src/routes/shopify.routes.js
const express = require('express');
const router = express.Router();
const { 
    fetchAndStoreOrders, 
    syncAllShopifyProducts,
} = require('../controllers/shopify.controller');

router.get('/sync-orders', fetchAndStoreOrders);
router.get('/sync-products', syncAllShopifyProducts);

module.exports = router;
