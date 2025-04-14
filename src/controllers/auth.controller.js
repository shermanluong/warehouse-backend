const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user.model');

const login = async (req, res) => {
  const { userName, password } = req.body;

  const user = await User.findOne({ userName });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (!user.active) return res.status(401).json({ message: 'Wait approval' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
  
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { name: user.realName, userName: user.userName, role: user.role } });
};

const register = async (req, res) => {
  const { realName, userName, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  const existing = await User.findOne({ userName });
  if (existing) return res.status(400).json({ message: 'Username already registered' });

  const user = new User({
    realName,
    userName,
    passwordHash: hash,
    active: false // Admin must approve
  });

  await user.save();
  res.status(201).json({ message: 'Registered. Wait for admin approval.' });
};

module.exports = { login, register };
