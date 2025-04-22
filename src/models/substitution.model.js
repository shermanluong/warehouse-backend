const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const substitutionRuleSchema = new mongoose.Schema({
  originalProductId: String,           // Shopify Product ID of the original item
  originalVariantId: String,           // Shopify Variant ID of the original item

  substitutes: [
    {
      substituteProductId: String,     // Shopify Product ID of the substitute
      substituteVariantId: String,     // Shopify Variant ID of the substitute
      reason: String,                  // Optional: why this is a good substitute
      priority: Number,                // Optional: order of preference
    }
  ],

  createdBy: String,                   // Admin who created the rule
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SubstitutionRule', substitutionRuleSchema);