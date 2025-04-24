// src/utils/createNotification.js
const Notification = require('../models/notification.model');

/**
 * Creates a notification for the given event.
 * @param {Object} options
 * @param {string} options.type - Type of notification (e.g., 'SUBSTITUTION')
 * @param {string} options.message - Text message for the notification
 * @param {string[]} options.userRoles - Array of roles to receive notification (e.g., ['admin'])
 * @param {ObjectId} [options.relatedOrderId] - Optional related order Mongo ID
 * @param {string} [options.relatedProductId] - Optional related Shopify product ID
 */
const createNotification = async ({ type, message, userRoles, relatedOrderId = null, relatedProductId = null, relatedVariantId = null }) => {
  try {
    await Notification.create({
      type,
      message,
      userRoles,
      relatedOrderId,
      relatedProductId,
      relatedVariantId
    });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

module.exports = createNotification;
