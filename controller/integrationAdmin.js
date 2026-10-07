const crypto = require('crypto');
const mongoose = require('mongoose');
const IntegrationCredential = require('../models/IntegrationCredential');
const InvoiceAccount = require('../models/InvoiceAccount');
const User = require('../models/User');

const STORE_SCOPES = [
  'store:quotes:write',
  'store:shipments:write',
  'store:shipments:read',
];

exports.createStoreCredential = async (req, res) => {
  try {
    const { name, userId, scopes } = req.body;
    const normalizedName = String(name || '').trim();
    if (!normalizedName || !mongoose.isValidObjectId(userId) || !Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ message: 'name, userId, and at least one scope are required' });
    }
    if (scopes.some(scope => !STORE_SCOPES.includes(scope)) || new Set(scopes).size !== scopes.length) {
      return res.status(400).json({ message: 'One or more scopes are invalid or duplicated' });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'Customer' || user.status !== 'Active') {
      return res.status(400).json({ message: 'An active customer account is required' });
    }

    const apiKey = `sd_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const credential = await IntegrationCredential.create({
      name: normalizedName,
      userId: user._id,
      keyHash,
      keyPrefix: apiKey.slice(0, 16),
      scopes,
    });

    return res.status(201).json({
      message: 'Store integration key created. Copy it now; it will not be shown again.',
      credential: {
        id: credential._id,
        name: credential.name,
        userId: credential.userId,
        keyPrefix: credential.keyPrefix,
        scopes: credential.scopes,
        createdAt: credential.createdAt,
      },
      apiKey,
    });
  } catch (error) {
    console.error('Failed to create store integration key:', error.message);
    return res.status(500).json({ message: 'Failed to create integration key' });
  }
};

exports.listStoreCredentials = async (req, res) => {
  try {
    const credentials = await IntegrationCredential.find()
      .select('-keyHash')
      .populate('userId', 'email companyName fullName')
      .sort({ createdAt: -1 });
    return res.status(200).json({ credentials });
  } catch (error) {
    console.error('Failed to list store integration keys:', error.message);
    return res.status(500).json({ message: 'Failed to list integration keys' });
  }
};

exports.revokeStoreCredential = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.credentialId)) {
      return res.status(400).json({ message: 'Invalid integration key ID' });
    }
    const credential = await IntegrationCredential.findByIdAndUpdate(
      req.params.credentialId,
      { revokedAt: new Date() },
      { new: true }
    ).select('-keyHash');
    if (!credential) {
      return res.status(404).json({ message: 'Integration key not found' });
    }
    return res.status(200).json({ message: 'Integration key revoked', credential });
  } catch (error) {
    console.error('Failed to revoke store integration key:', error.message);
    return res.status(500).json({ message: 'Failed to revoke integration key' });
  }
};

exports.listInvoiceAccounts = async (req, res) => {
  try {
    const accounts = await InvoiceAccount.find()
      .populate('userId', 'email companyName fullName role')
      .populate('approvedBy', 'email fullName')
      .sort({ updatedAt: -1 });
    return res.status(200).json({ accounts });
  } catch (error) {
    console.error('Failed to list invoice accounts:', error.message);
    return res.status(500).json({ message: 'Failed to list invoice accounts' });
  }
};

exports.setInvoiceAccountStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }
    if (!['approved', 'revoked'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or revoked' });
    }

    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'Customer' || (status === 'approved' && user.status !== 'Active')) {
      return res.status(404).json({ message: 'Customer account not eligible for this invoice action' });
    }

    const account = await InvoiceAccount.findOneAndUpdate(
      { userId: user._id },
      {
        status,
        approvedBy: status === 'approved' ? req.user._id : null,
        approvedAt: status === 'approved' ? new Date() : null,
      },
      { new: true, upsert: true, runValidators: true }
    );
    return res.status(200).json({ message: `Invoice account ${status}`, account });
  } catch (error) {
    console.error('Failed to update invoice account:', error.message);
    return res.status(500).json({ message: 'Failed to update invoice account' });
  }
};
