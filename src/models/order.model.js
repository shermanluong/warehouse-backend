const mongoose = require('mongoose');
const { Schema, Types } = mongoose;
const User = require('./user.model');

const pickingStatusSchema = new mongoose.Schema(
  {
    verified: {
      quantity: { type: Number, default: 0 },
    },
    damaged: {
      quantity: { type: Number, default: 0 },
      subbed: {
        productId: { type: String, required: false },
        variantId: { type: String, required: false },
      },
    },
    outOfStock: {  // Renamed to `outOfStock` for clarity
      quantity: { type: Number, default: 0 },
      subbed: {
        productId: { type: String, required: false },
        variantId: { type: String, required: false },
      },
    },
  },
  { _id: false } // This disables the creation of an _id field in subdocuments
);

const lineItemSchema = new mongoose.Schema({
  shopifyLineItemId: String, // <-- Add this
  productId: String,
  variantId: String,
  quantity: Number,
  picked: { type: Boolean, default: false },
  packed: { type: Boolean, default: false },
  pickedStatus: pickingStatusSchema,
  packedStatus: pickingStatusSchema,
  adminNote: String,
  customerNote: String,
  refund: {type: Boolean, default: false},
  subbed: {type: Boolean, default: false},
  approved: {type: Boolean, default: false},
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
  stopId: String,
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
  totes: [{ type: Schema.Types.ObjectId, ref: 'Tote' }],
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
  },
  boxCount: { type: Number, default: 0},
  approved: {type: Boolean, default: false},
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);