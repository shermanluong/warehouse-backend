// src/routes/admin.routes.js
const express = require('express');
const {
  getToken,
  getLocate2uOrders
} = require('../controllers/locate2u.controller');

const router = express.Router();
router.get('/token', getToken);
router.get('/orders', getLocate2uOrders);

module.exports = router;
