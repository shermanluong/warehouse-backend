const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Allow frontend to access backend
app.use(cors({
  origin: '*', // or '*' for development
  credentials: true // if using cookies/auth headers
}));

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
