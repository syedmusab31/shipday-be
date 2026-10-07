const mongoose = require('mongoose');

const courierPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'revoked'], default: 'active', required: true },
  apiKeyHash: { type: String, required: true, unique: true, select: false },
  keyPrefix: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('CourierPartner', courierPartnerSchema);
