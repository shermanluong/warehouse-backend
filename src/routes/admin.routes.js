// src/routes/admin.routes.js
const express = require('express');
const {
  getLogs,
  getDashboardStats,
  getOrders,
  getUsers,
  updateUser,
  deleteUser
} = require('../controllers/admin.controller');

const router = express.Router();

// Admin logs & dashboard stats
router.get('/logs', getLogs);
router.get('/stats', getDashboardStats); // Optional: dashboard overview
router.get('/getOrders', getOrders); // Optional: dashboard overview

// Admin user management
router.get('/users', getUsers);             // Fetch all users
router.put('/users/:id', updateUser);       // Update user info
router.delete('/users/:id', deleteUser);    // Delete user

module.exports = router;
