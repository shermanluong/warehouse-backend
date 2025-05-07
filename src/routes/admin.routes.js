// src/routes/admin.routes.js
const express = require('express');
const {
  getLogs,
  getDashboardStats,
  getOrders,
  getOrder,
  getProducts,
  getProductStatuses,
  getProductVendors,
  getDrivers,
  addOrderNote,
  addItemNote
} = require('../controllers/admin.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

// Admin logs & dashboard stats
router.get('/logs', auth(['admin']), getLogs);
router.get('/stats', auth(['admin']), getDashboardStats); 
router.get('/getOrders', auth(['admin']), getOrders);
router.get('/order/:id', auth(['admin']), getOrder);  
router.get('/getProducts', auth(['admin']), getProducts); 
router.get('/getProductVendors', auth(['admin']), getProductVendors); 
router.get('/getProductStatuses', auth(['admin']), getProductStatuses); 
router.get('/getDrivers', auth(['admin']), getDrivers); 
router.patch('/order/:orderId/add-order-note', auth(['admin']), addOrderNote); 
router.patch('/order/:orderId/add-item-note', auth(['admin']), addItemNote); 

module.exports = router;
