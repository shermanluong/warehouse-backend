const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user.model');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const login = async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email });
  if (!user || !user.active) return res.status(401).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
};

const register = async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const user = new User({
    name,
    email,
    passwordHash: hash,
    active: false // Admin must approve
  });

  await user.save();
  res.status(201).json({ message: 'Registered. Wait for admin approval.' });
};

module.exports = { login, register };
