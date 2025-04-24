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

// PATCH /api/notification/read-all
const markAllAsRead = async (req, res) => {
  try {
    const { role } = req.user;
    
    await Notification.updateMany(
      { userRoles: role, read: false },
      { $set: { read: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
};

module.exports = { 
  getNotifications,
  markAsRead,
  markAllAsRead
};
