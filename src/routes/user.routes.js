// src/routes/admin.routes.js
const express = require('express');
const {
  getUsers,
  upsertUser,
  deleteUser,
  getProfile,
  saveProfile,
  changePassword
} = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', getUsers);             // Fetch all users
router.post('/', upsertUser);     // Update user info
router.delete('/:id', deleteUser);    // Delete user
router.get('/getProfile',  auth(['admin', 'picker', 'packer']), getProfile);
router.put('/saveProfile',  auth(['admin', 'picker', 'packer']), saveProfile);
router.put('/changePassword',  auth(['admin', 'picker', 'packer']), changePassword);

module.exports = router;
