const crypto = require('crypto');
const mongoose = require('mongoose');
const CourierPartner = require('../models/CourierPartner');

function makeApiKey() {
  const apiKey = `sd_courier_live_${crypto.randomBytes(32).toString('hex')}`;
  return {
    apiKey,
    apiKeyHash: crypto.createHash('sha256').update(apiKey).digest('hex'),
    keyPrefix: apiKey.slice(0, 22),
  };
}

exports.createCourierPartner = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 120) {
      return res.status(400).json({ message: 'name is required and must be at most 120 characters' });
    }

    const key = makeApiKey();
    const partner = await CourierPartner.create({
      name,
      createdBy: req.user._id,
      apiKeyHash: key.apiKeyHash,
      keyPrefix: key.keyPrefix,
    });
    return res.status(201).json({
      message: 'Courier partner created. Copy the API key now; it will not be shown again.',
      partner: {
        id: partner._id,
        name: partner.name,
        status: partner.status,
        keyPrefix: partner.keyPrefix,
        createdAt: partner.createdAt,
      },
      apiKey: key.apiKey,
    });
  } catch (error) {
    console.error('Failed to create courier partner:', error.message);
    return res.status(500).json({ message: 'Failed to create courier partner' });
  }
};

exports.listCourierPartners = async (req, res) => {
  try {
    const partners = await CourierPartner.find()
      .select('-apiKeyHash')
      .sort({ createdAt: -1 });
    return res.status(200).json({ partners });
  } catch (error) {
    console.error('Failed to list courier partners:', error.message);
    return res.status(500).json({ message: 'Failed to list courier partners' });
  }
};

exports.revokeCourierPartner = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.partnerId)) {
      return res.status(400).json({ message: 'Invalid courier partner ID' });
    }
    const partner = await CourierPartner.findByIdAndUpdate(
      req.params.partnerId,
      { status: 'revoked' },
      { new: true, runValidators: true }
    ).select('-apiKeyHash');
    if (!partner) {
      return res.status(404).json({ message: 'Courier partner not found' });
    }
    return res.status(200).json({ message: 'Courier partner revoked', partner });
  } catch (error) {
    console.error('Failed to revoke courier partner:', error.message);
    return res.status(500).json({ message: 'Failed to revoke courier partner' });
  }
};

exports.rotateCourierPartnerKey = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.partnerId)) {
      return res.status(400).json({ message: 'Invalid courier partner ID' });
    }
    const key = makeApiKey();
    const partner = await CourierPartner.findByIdAndUpdate(
      req.params.partnerId,
      {
        status: 'active',
        apiKeyHash: key.apiKeyHash,
        keyPrefix: key.keyPrefix,
      },
      { new: true, runValidators: true }
    ).select('-apiKeyHash');
    if (!partner) {
      return res.status(404).json({ message: 'Courier partner not found' });
    }
    return res.status(200).json({
      message: 'Courier partner key rotated. Copy the new API key now; it will not be shown again.',
      partner,
      apiKey: key.apiKey,
    });
  } catch (error) {
    console.error('Failed to rotate courier partner key:', error.message);
    return res.status(500).json({ message: 'Failed to rotate courier partner key' });
  }
};
