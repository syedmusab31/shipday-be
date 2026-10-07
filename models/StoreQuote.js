const mongoose = require('mongoose');

const storeQuoteSchema = new mongoose.Schema({
  quoteId: { type: String, required: true, unique: true },
  credentialId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationCredential', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceType: { type: String, enum: ['economy', 'express'], required: true },
  senderDetails: { type: mongoose.Schema.Types.Mixed, required: true },
  collectionDetails: { type: mongoose.Schema.Types.Mixed, required: true },
  deliveryDetails: { type: mongoose.Schema.Types.Mixed, required: true },
  parcelType: { type: String, required: true },
  parcels: [{
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    weight: { type: Number, required: true },
  }],
  selectedPackaging: [{ id: String }],
  orderNumber: { type: String, default: '' },
  marketplaceName: { type: String, default: '' },
  pricingBreakdown: { type: mongoose.Schema.Types.Mixed, required: true },
  pricingSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['quoted', 'booking', 'booked'], default: 'quoted' },
  bookingStartedAt: { type: Date, default: null },
  shipmentId: { type: String, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('StoreQuote', storeQuoteSchema);
