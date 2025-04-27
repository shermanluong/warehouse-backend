const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');
const { getLocate2uToken } = require('../services/locate2u.service');
const { default: axios } = require('axios');

const getToken = async (req, res) => {
  console.log("Requested locate2u token")
  try {
    const token = await getLocate2uToken();
    res.json({ access_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getLocate2uOrders = async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing "from" or "to" query parameter' });
  }

  // Validate that date range is <= 7 days
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  const dayDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
  if (dayDiff > 7) {
    return res.status(400).json({ error: 'Date range must not exceed 7 days' });
  }

  const token = await getLocate2uToken();

  try {
    const response = await axios.get(`${process.env.LOCATE2U_API_BASE_URL}/orders/created`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        FromDate: from,
        ToDate: to
      }
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch orders:', error.response?.data || error.message);
    res.status(500).json({ error: 'Locate2u orders fetch failed' });
  }
};

module.exports = {
  getToken,
  getLocate2uOrders
};
