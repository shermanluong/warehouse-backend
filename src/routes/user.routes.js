// src/routes/admin.routes.js
const express = require('express');
const {
  getUsers,
  getUser,
  upsertUser,
  deleteUser
} = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', getUsers);             // Fetch all users
router.get('/getUser',  auth(['admin', 'picker', 'packer']), getUser);
router.post('/', upsertUser);     // Update user info
router.delete('/:id', deleteUser);    // Delete user

module.exports = router;
