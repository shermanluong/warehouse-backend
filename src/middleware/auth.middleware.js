// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

const auth = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient role' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};

module.exports = auth;
