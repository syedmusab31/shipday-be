const mongoose = require('mongoose');

const courierBookingSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  shipmentId: { type: String, required: true },
  rateQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourierRateQuote', required: true },
  serviceLevelCode: { type: String, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['submitting', 'booked', 'failed', 'unknown'],
    required: true,
    default: 'submitting',
  },
  providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  providerErrorStatus: { type: Number, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true });

courierBookingSchema.index({ shipmentId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('CourierBooking', courierBookingSchema);
