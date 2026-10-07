const mongoose = require('mongoose');

const integrationCredentialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  keyHash: { type: String, required: true, unique: true, select: false },
  keyPrefix: { type: String, required: true },
  scopes: {
    type: [String],
    enum: ['store:quotes:write', 'store:shipments:write', 'store:shipments:read'],
    required: true,
  },
  revokedAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('IntegrationCredential', integrationCredentialSchema);
