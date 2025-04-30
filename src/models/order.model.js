const mongoose = require('mongoose');
const { Schema, Types } = mongoose;
const User = require('./user.model');

const substitutionSchema = new mongoose.Schema({
  used: Boolean,
  originalProductId: String,
  originalVariantId: String,
  substituteProductId: String,
  substituteVariantId: String
}, { _id: false });

const lineItemSchema = new mongoose.Schema({
  shopifyLineItemId: String, // <-- Add this
  productId: String,
  variantId: String,
  quantity: Number,
  pickedQuantity: { type: Number, default: 0 },
  packedQuantity: { type: Number, default: 0 },
  picked: { type: Boolean, default: false },
  packed: { type: Boolean, default: false },
  substitution: substitutionSchema,
  flags: {
    type: [String],
    enum: ['Out Of Stock', 'Damaged', 'Refunded', 'substitution requested'],
  },
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

const photoSchema = new mongoose.Schema({
  photoUrl: String,
  fileId: String,
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  driverName: String,
  tripId: String,
  tripDate: String,
  stopNumber: Number,
  driverMemberId: String,
  startTime: String,
  endTime: String,
}, { _id: false });

const orderSchema = new Schema({
  shopifyOrderId: { type: String, required: true, unique: true },
  name: String,
  orderNumber: Number,
  status: {
    type: String,
    enum: ['new', 'picking', 'picked', 'packing', 'packed', 'delivered'],
    default: 'new'
  },
  orderNote: String,
  adminNote: String,
  tags: String,
  pickerId: { type: Types.ObjectId, ref: 'User', default: null },
  packerId: { type: Types.ObjectId, ref: 'User', default: null },
  lineItems: [lineItemSchema],
  photos: [photoSchema], // <-- changed from photoUrl: String
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