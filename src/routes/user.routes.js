// src/routes/admin.routes.js
const express = require('express');
const {
  getUsers,
  upsertUser,
  deleteUser
} = require('../controllers/user.controller');

const router = express.Router();

router.get('/', getUsers);             // Fetch all users
router.post('/', upsertUser);     // Update user info
router.delete('/:id', deleteUser);    // Delete user

module.exports = router;
