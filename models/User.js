// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['Super Admin', 'Admin', 'Manager', 'Admin Staff', 'Driver', 'Customer', 'Retail Hub'],
      default: 'Customer'
    },
    password: {
      type: String,
      required: true,
    },
    tokens: [{ type: String }], //  Multi-device support


    // Profile fields
    accountType: {
      type: String,
      enum: ['Personal', 'Business'],
      default: 'Personal',
    },
    companyName: String,
    fullName: String,
    idNumber: {
      type: String,
      unique: true,
      sparse: true,
      match: /^\d{3}$/,
    },
    accountOwnerIdNumber: {
      type: String,
      unique: true,
      sparse: true,
      match: /^\d{3}$/,
    },
    businessRegistrationNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    nickName: String,
    dob: String,
    phone: String,
    gender: String,
    image: String,

    // Detailed Address Fields
    address: {
      street: String,
      complexOrBusinessHub: String,
      city: String,
      province: String,
      postalCode: String,
      country: { type: String, default: 'South Africa' },
      // Legacy field for backward compatibility
      fullAddress: String,
      // GPS coordinates
      latitude: Number,
      longitude: Number,
    },

    // Legacy location field (deprecated, use address instead)
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    status: {
      type: String,
      enum: ['Active', 'Disabled'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
