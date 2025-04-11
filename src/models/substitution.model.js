const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  originalProductId: { type: String, required: true },
  substituteProductId: { type: String, required: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Substitution', substitutionSchema);
