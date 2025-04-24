const express = require('express');
const { login, register } = require('../controllers/auth.controller');
const router = express.Router();
const Product = require('../models/product.model'); // adjust path if needed
router.post('/login', login);
router.post('/register', register);
  
module.exports = router;
