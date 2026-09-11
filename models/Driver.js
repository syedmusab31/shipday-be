const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
    unique: true
  },
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
    unique: true,
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
  status: {
    type: String,
    default: 'pending'
    // Note: Status validation is now handled dynamically via the Status model
    // Removed enum constraint to allow dynamic statuses from database
  },
  fcmToken: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Driver', driverSchema);