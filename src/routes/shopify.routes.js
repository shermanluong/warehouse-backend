// src/routes/shopify.routes.js
const express = require('express');
const router = express.Router();
const { fetchAndStoreOrders } = require('../controllers/shopify.controller');

router.get('/sync-orders', fetchAndStoreOrders);

module.exports = router;
