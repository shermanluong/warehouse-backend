const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userName: { type: String, required: true, unique: true },
  realName: { type: String },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['picker', 'packer', 'admin'],
    default: null // role assigned by admin
  },
  active: { type: Boolean, default: false }, // controlled by admin
  stats: {
    ordersPicked: { type: Number, default: 0 },
    ordersPacked: { type: Number, default: 0 },
    accuracyScore: { type: Number, default: 100 },
    currentLineItemsAssigned: {type: Number, default: 0},
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
