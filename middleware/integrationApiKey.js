const crypto = require('crypto');
const IntegrationCredential = require('../models/IntegrationCredential');
const User = require('../models/User');

function requireIntegrationScope(scope) {
  return async (req, res, next) => {
    const apiKey = req.get('x-api-key');
    if (!apiKey || !/^sd_live_[a-f0-9]{64}$/.test(apiKey)) {
      return res.status(401).json({ message: 'A valid X-API-Key is required' });
    }

    try {
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const credential = await IntegrationCredential.findOne({
        keyHash,
        revokedAt: null,
      }).select('+keyHash');

      if (!credential) {
        return res.status(401).json({ message: 'Invalid or revoked integration key' });
      }
      const owner = await User.findById(credential.userId).select('role status');
      if (!owner || owner.role !== 'Customer' || owner.status !== 'Active') {
        return res.status(403).json({ message: 'The integration customer account is not active' });
      }
      if (!credential.scopes.includes(scope)) {
        return res.status(403).json({ message: 'Integration key does not have the required scope' });
      }

      credential.lastUsedAt = new Date();
      await credential.save();
      req.integrationCredential = credential;
      return next();
    } catch (error) {
      console.error('Integration API key authentication failed:', error.message);
      return res.status(500).json({ message: 'Integration authentication failed' });
    }
  };
}

module.exports = requireIntegrationScope;
