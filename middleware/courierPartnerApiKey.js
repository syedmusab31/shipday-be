const crypto = require('crypto');
const CourierPartner = require('../models/CourierPartner');

module.exports = async (req, res, next) => {
  const apiKey = req.get('x-api-key');
  if (!apiKey || !/^sd_courier_live_[a-f0-9]{64}$/.test(apiKey)) {
    return res.status(401).json({ message: 'A valid X-API-Key is required' });
  }

  try {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const partner = await CourierPartner.findOne({
      apiKeyHash,
      status: 'active',
    }).select('+apiKeyHash');
    if (!partner) {
      return res.status(401).json({ message: 'Invalid, revoked, or inactive courier partner key' });
    }

    partner.lastUsedAt = new Date();
    await partner.save();
    req.courierPartner = partner;
    return next();
  } catch (error) {
    console.error('Courier partner API key authentication failed:', error.message);
    return res.status(500).json({ message: 'Courier partner authentication failed' });
  }
};
