const mongoose = require('mongoose');

const courierRateQuoteSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  shipmentId: { type: String, required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerResponse: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('CourierRateQuote', courierRateQuoteSchema);
