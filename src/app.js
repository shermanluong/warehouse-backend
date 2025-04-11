const express = require('express');
const morgan = require('morgan');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(express.json());
app.use(morgan('dev'));

// Mount auth route
app.use('/api/auth', authRoutes);

// Mount all routes under /api
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.send('✅ Server is up!');
});

module.exports = app;
