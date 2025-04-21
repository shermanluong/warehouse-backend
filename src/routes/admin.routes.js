// src/routes/admin.routes.js
const express = require('express');
const {
  getLogs,
  getDashboardStats,
  getOrders,
  getOrder,
  getProducts,
} = require('../controllers/admin.controller');

const router = express.Router();

// Admin logs & dashboard stats
router.get('/logs', getLogs);
router.get('/stats', getDashboardStats); 
router.get('/getOrders', getOrders);
router.get('/order/:id', getOrder);  
router.get('/getProducts', getProducts); 

module.exports = router;
