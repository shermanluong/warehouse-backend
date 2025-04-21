// src/routes/admin.routes.js
const express = require('express');
const {
  getLogs,
  getDashboardStats,
  getOrders,
  getOrder,
  getProducts,
  addOrderNote,
  addItemNote
} = require('../controllers/admin.controller');

const router = express.Router();

// Admin logs & dashboard stats
router.get('/logs', getLogs);
router.get('/stats', getDashboardStats); 
router.get('/getOrders', getOrders);
router.get('/order/:id', getOrder);  
router.get('/getProducts', getProducts); 
router.patch('/order/:orderId/add-order-note', addOrderNote); 
router.patch('/order/:orderId/add-item-note', addItemNote); 

module.exports = router;
