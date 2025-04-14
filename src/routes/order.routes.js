// src/routes/order.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const { getOrdersByRole } = require('../controllers/order.controller');

router.get('/', auth(['admin', 'picker', 'packer']), getOrdersByRole);

module.exports = router;
