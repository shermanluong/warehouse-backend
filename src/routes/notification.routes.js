// src/routes/shopify.routes.js
const express = require('express');
const router = express.Router();
const { 
    getNotifications, 
    markAsRead,
} = require('../controllers/notification.controller');
const auth = require('../middleware/auth.middleware');

router.get('/', auth(['admin', 'picker', 'packer']), getNotifications);
router.patch('/:id/read', auth(['admin', 'picker', 'packer']), markAsRead);

module.exports = router;
