const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  used: Boolean,
  originalProductId: String,
  substituteProductId: String
}, { _id: false });

const lineItemSchema = new mongoose.Schema({
  productId: String,
  variantId: String,
  name: String,
  quantity: Number,
  sku: String,
  barcode: String,
  photoImg: String,
  pickedQuantity: { type: Number, default: 0 },
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
  logs: [logSchema],
  customer: {
    id: String,
    email: String,
    first_name: String,
    last_name: String,
    phone: String,
    default_address: {
      address1: String,
      address2: String,
      city: String,
      province: String,
      country: String,
      zip: String
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
