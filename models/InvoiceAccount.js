const mongoose = require('mongoose');

const invoiceAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['approved', 'revoked'], required: true, default: 'revoked' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('InvoiceAccount', invoiceAccountSchema);
