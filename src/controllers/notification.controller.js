// src/controllers/shopify.controller.js
const Notification = require('../models/notification.model');

// GET /api/notification?role=admin
const getNotifications = async (req, res) => {
  const { role } = req.user;
  const notifications = await Notification.find({ userRoles: role }).sort({ createdAt: -1 });
  res.json(notifications);
};

// PATCH /api/notification/:id/read
const markAsRead = async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ message: 'Marked as read' });
};

module.exports = { 
  getNotifications,
  markAsRead
};
