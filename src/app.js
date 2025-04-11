// src/app.js
const express = require('express');
const morgan = require('morgan');
const shopifyRoutes = require('./routes/shopify.routes');

const app = express();

app.use(express.json());
app.use(morgan('dev'));

// All Shopify-related routes
app.use('/api/shopify', shopifyRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('✅ Server is up!');
});

module.exports = app;
