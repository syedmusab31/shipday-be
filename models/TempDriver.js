const mongoose = require('mongoose');

const tempDriverSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ['bike', 'car', 'van', 'truck']
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  driverImage: {
    type: String,
    required: false
  },
  idProof: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Expires after 1 hour
  }
});

module.exports = mongoose.model('TempDriver', tempDriverSchema);