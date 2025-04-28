const Driver = require('../models/driver.model');
const mongoose = require('mongoose');
const { 
  getLocate2uTokenService, 
  getLocate2uStopsService
} = require('../services/locate2u.service');
const { default: axios } = require('axios');

const getToken = async (req, res) => {
  console.log("Requested locate2u token")
  try {
    const token = await getLocate2uTokenService();
    res.json({ access_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getLocate2uMembers = async (req, res) => {
  const token = await getLocate2uTokenService();

  try {
    const response = await axios.get(`${process.env.LOCATE2U_API_BASE_URL}/team-members`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        includeStartTime: true,
        includeCurrentLocation: false,
      }
    });

    const drivers = response.data;
    for (const driver of drivers) {
      await Driver.findOneAndUpdate(
        { teamMemberId: driver.teamMemberId },
        { $set: driver },
        { upsert: true, new: true }
      );
    }

    return res.json({message: "Updated driver database successfully."});
  } catch (error) {
    console.error('Failed to fetch orders:', error.response?.data || error.message);
    res.status(500).json({ error: 'Locate2u orders fetch failed' });
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

  const token = await getLocate2uTokenService();

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

const getLocate2uStops = async (req, res) => {
  const { from, pageNumber = 1, pageSize = 10 } = req.query;

  if (!from) {
    return res.status(400).json({ error: 'Missing "from" query parameter' });
  }

  // Validate the 'from' date
  const fromDate = new Date(from);
  console.log(fromDate);
  if (isNaN(fromDate)) {
    return res.status(400).json({ error: '"from" parameter is not a valid date' });
  }

  const token = await getLocate2uTokenService();

  try {
    const response = await axios.get(`${process.env.LOCATE2U_API_BASE_URL}/stops/getStopsFromTimestamp`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        From: from,               // "From" query parameter as date-time string
        PageNumber: pageNumber,   // Optional "PageNumber" parameter, defaults to 1
        PageSize: pageSize        // Optional "PageSize" parameter, defaults to 10
      }
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch stops:', error.response?.data || error.message);
    res.status(500).json({ error: 'Locate2u stops fetch failed' });
  }
};

// Trying with a different date (today)
const getLocate2uTrips = async (req, res) => {
  const { tripDate } = req.params;

  if (!tripDate) {
    return res.status(400).json({ error: 'Missing "tripDate" query parameter' });
  }

  const date = new Date(tripDate);
  if (isNaN(date)) {
    return res.status(400).json({ error: '"tripDate" parameter is not a valid date' });
  }

  const token = await getLocate2uTokenService();
  try {
    const stopDetails = await getLocate2uStopsService(tripDate, token);
    return res.json(stopDetails);
  } catch (error) {
    console.error('Error fetching trip details:', error.message);
    return res.status(500).json({ error: 'Failed to fetch trip details' });
  }
};

module.exports = {
  getToken,
  getLocate2uOrders,
  getLocate2uStops,
  getLocate2uTrips,
  getLocate2uMembers
};
