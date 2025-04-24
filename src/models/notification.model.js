const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const notificationSchema = new mongoose.Schema({
    type: {
      type: String,
      enum: [
        'HIGH_VALUE_PACKED',
        'FREQUENT_FLAG',
        'Out Of Stock',
        'Damaged',
        'SUBSTITUTION',
        'REFUND',
      ],
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    userRoles: [{ type: String, enum: ['admin', 'picker', 'packer'] }],
    createdAt: { type: Date, default: Date.now },
    relatedOrderId: { type: Types.ObjectId, ref: 'Order' },
    relatedProductId: { type: String }, // optional
    relatedVariantId: { type: String }, // optional
  });

  module.exports = mongoose.model('Notification', notificationSchema);
  