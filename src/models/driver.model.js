const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  timeZone: String,
  teamMemberId: String,
  vehicleType: String,
  role: String,
  startTime: {
    type: String,
    default: "08:00"
  }
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);
