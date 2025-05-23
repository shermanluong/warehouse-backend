const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  shopifyVariantId: String,
  title: String,
  sku: String,
  barcode: String,
  price: String,
  inventory_quantity: Number,
  image: String,
}, { _id: false });

const productSchema = new mongoose.Schema({
  shopifyProductId: { type: String, required: true, unique: true },
  title: String,
  handle: String,
  vendor: String,
  status: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'active',
  },
  image: String,
  variants: [variantSchema],
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
