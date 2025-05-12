const mongoose = require('mongoose');
const { Schema } = mongoose;

const ToteSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Optional: if tote names must be unique
    trim: true
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'in_packing'],
    default: 'available'
  },
  assignedToOrder: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ToteSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Tote', ToteSchema);
