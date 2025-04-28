// src/routes/admin.routes.js
const express = require('express');
const {
  getToken,
  getLocate2uOrders,
  getLocate2uStops,
  getLocate2uTrips
} = require('../controllers/locate2u.controller');

const router = express.Router();
router.get('/token', getToken);
router.get('/orders', getLocate2uOrders);
router.get('/stops', getLocate2uStops);
router.get('/trips/:tripDate', getLocate2uTrips);

module.exports = router;
