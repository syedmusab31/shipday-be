const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['order', 'driver'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: 'secondary',
    enum: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
statusSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Status', statusSchema);
