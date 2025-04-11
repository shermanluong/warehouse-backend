const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  used: Boolean,
  originalProductId: String,
  substituteProductId: String
}, { _id: false });

const lineItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  quantity: Number,
  barcode: String,
  picked: { type: Boolean, default: false },
  packed: { type: Boolean, default: false },
  substitution: substitutionSchema,
  flags: [String],
  adminNote: String,
  customerNote: String
}, { _id: false });

const logSchema = new mongoose.Schema({
  type: String,
  userId: String,
  itemId: String,
  message: String,
  reason: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  driverName: String,
  routeNumber: String,
  eta: Date
}, { _id: false });

const orderSchema = new mongoose.Schema({
  shopifyOrderId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['new', 'picking', 'picked', 'packing', 'packed', 'delivered'],
    default: 'new'
  },
  pickerId: String,
  packerId: String,
  lineItems: [lineItemSchema],
  photoUrl: String,
  delivery: deliverySchema,
  logs: [logSchema]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
