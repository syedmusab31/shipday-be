const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  shipmentId: { type: String, required: true, unique: true },
  barcode: { type: String, unique: true, sparse: true, index: true },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Sender Details
  senderDetails: {
    fullName: { type: String },
    company: String,
    email: { type: String },
    mobile: { type: String },
    telephone: String,
    address: {
      street: { type: String },
      suburb: { type: String },
      city: { type: String },
      complex: String,
      province: { type: String },
      postalCode: { type: String }
    }
  },

  // Collection Details
  collectionDetails: {
    dispatcherName: { type: String },
    company: String,
    mobile: { type: String },
    office: String,
    email: { type: String },
    address: {
      street: { type: String },
      suburb: { type: String },
      city: { type: String },
      complex: String,
      province: { type: String },
      postalCode: { type: String },
      latitude: Number,
      longitude: Number
    },
    numberOfItems: { type: Number, default: 1 }
  },

  // Delivery Details
  deliveryDetails: {
    receiverName: { type: String },
    company: String,
    mobile: { type: String },
    office: String,
    email: { type: String },
    address: {
      street: { type: String },
      suburb: { type: String },
      city: { type: String },
      complex: String,
      province: { type: String },
      postalCode: { type: String },
      latitude: Number,
      longitude: Number
    }
  },

  // Parcel Details
  parcelDetails: {
    serviceType: { type: String, enum: ['economy', 'express'] },
    parcelType: { type: String },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      weight: { type: Number }
    },
    specialInstructions: String,
    satchelSize: { type: String, enum: ['none', 'A4', 'A3'], default: 'none' }
  },

  // Payment Details
  payment: {
    method: { type: String, enum: ['ewallet', 'gateway', 'cod', 'payfast', 'fulfillment'], default: 'gateway' },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    amount: { type: Number },
    transactionId: String
  },

  // Fulfillment & Marketplace Details
  orderNumber: String,
  marketplaceName: String,
  numberOfBoxes: { type: Number, default: 1 },
  parcels: [{
    length: Number,
    width: Number,
    height: Number,
    weight: Number
  }],
  bookedBy: String,
  isFulfillment: { type: Boolean, default: false },

  // Legacy/Compatibility fields (populated from above by controller)
  // These are NOT required because controller auto-populates them
  // Added defaults to prevent validation errors
  senderName: { type: String, default: 'N/A' },
  senderPhone: { type: String, default: '0000000000' },
  receiverName: { type: String, default: 'N/A' },
  receiverPhone: { type: String, default: '0000000000' },
  start: { type: String, default: 'Unknown' },
  end: { type: String, default: 'Unknown' },
  parcelWeight: { type: Number, default: 1 },
  packageType: { type: String, default: 'parcel' },
  cost: { type: Number, default: 0 },
  eta: { type: Date, default: Date.now },
  notes: { type: String, default: '' },

  status: {
    type: String,
    enum: [
      'Order Created',
      'Pending Collection',
      'Pending Delivery',
      'Driver Assigned',
      'Picked Up',
      'In Transit',
      'Inter Hub',
      'Arrived at Hub',
      'Out For Delivery',
      'Delivered',
      'Failed Delivery',
      'Failed Collection',
      'Collected',
      'Cancelled',
      'Reschedule',
      'Inter branch Transit',
      'Delivery Failed',
      'Rescheduled',
      'Return to Sender',
      'Returning to hub',
      'Delivery cancelled',
      'At Warehouse',
      'Parcel in Sorting Facility',
      'Out for Delivery',
      'On Hold',
      'Awaiting Payment',
      'Shipping',
      'Assigned',
      'Pending'
    ],
    default: 'Order Created'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  dateShipped: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  routeId: { type: String },
  trackingNumber: { type: String },
  driverName: { type: String, default: "Unassigned" },

  // Proof of Delivery fields
  podSignature: { type: String },
  podPhoto: { type: String },
  podReceiverName: { type: String },
  podSignedAt: { type: Date },
  podCompleted: { type: Boolean, default: false },
  podMethod: { type: String },
  podLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  podData: { type: mongoose.Schema.Types.Mixed },
  
  // Additional fields for compatibility
  recipientName: { type: String },
  recipientPhone: { type: String },
  recipientAddress: { type: String },
  pickupAddress: { type: String },
  senderAddress: { type: String },
  estimatedDelivery: { type: String },
  deliveryDate: { type: String },
  specialInstructions: { type: String },
  description: { type: String },
  weight: { type: String },
  dimensions: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  trackingNumber: { type: String },
  customerName: { type: String },
  customerPhone: { type: String },
  address: { type: String }
},
  {
    timestamps: true
  });

module.exports = mongoose.model('Shipment', shipmentSchema);
