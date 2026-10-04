const mongoose = require('mongoose');

const marketingSettingsSchema = new mongoose.Schema({
  minimumTopUpAmount: { type: Number, min: 0, default: 500 },
  requiredSuccessfulShipments: { type: Number, min: 0, default: 3 },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MarketingSettings', marketingSettingsSchema);