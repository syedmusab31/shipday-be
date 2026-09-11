const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
 orderId: {
    type: String,
    unique: true,
    required: true,
  },
  senderName: String,
  senderPhone: String,
  senderEmail: String,     
  customerId: String,       
  receiverName: String,
  receiverPhone: String,
  deliveryAddress: String,
  packageType: String,
  weight: Number,
  dimensions: String,
  deliveryType: {
    type: String,
    enum: ['standard', 'express'],
    default: 'standard',
  },
  
  pickupDate: String,
  totalAmount: Number,
  timeSlot: String,
  notes: String,
  cost: Number,
  status: {
    type: String,
    default: 'Pending'
    // Note: Status validation is now handled dynamically via the Status model
    // Removed enum constraint to allow dynamic statuses from database
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  location: {
  lat: Number,
  lon: Number,
},

  
});

module.exports = mongoose.model('Order', OrderSchema);
