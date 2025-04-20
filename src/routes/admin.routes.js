// src/routes/admin.routes.js
const express = require('express');
const {
  getLogs,
  getDashboardStats,
  getOrders,
  getProducts,
  getUsers,
  updateUser,
  deleteUser
} = require('../controllers/admin.controller');

const router = express.Router();

// Admin logs & dashboard stats
router.get('/logs', getLogs);
router.get('/stats', getDashboardStats); 
router.get('/getOrders', getOrders); 
router.get('/getProducts', getProducts); 

// Admin user management
router.get('/users', getUsers);             // Fetch all users
router.put('/users/:id', updateUser);       // Update user info
router.delete('/users/:id', deleteUser);    // Delete user

module.exports = router;
