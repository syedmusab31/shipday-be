const MarketingSettings = require('../models/MarketingSettings');
const Staff = require('../models/Staff');
const User = require('../models/User');
const { getMarketingOverview } = require('../services/marketingActivationService');

exports.getMarketingDashboard = async (req, res) => {
  try {
    const overview = await getMarketingOverview();
    res.status(200).json(overview);
  } catch (error) {
    console.error('Marketing dashboard error:', error);
    res.status(500).json({ message: 'Failed to load marketing management data' });
  }
};

exports.updateMarketingSettings = async (req, res) => {
  const minimumTopUpAmount = Number(req.body.minimumTopUpAmount);
  const requiredSuccessfulShipments = Number(req.body.requiredSuccessfulShipments);

  if (!Number.isFinite(minimumTopUpAmount) || minimumTopUpAmount < 0) {
    return res.status(400).json({ message: 'Minimum top-up amount must be a non-negative number' });
  }
  if (!Number.isInteger(requiredSuccessfulShipments) || requiredSuccessfulShipments < 0) {
    return res.status(400).json({ message: 'Required successful shipments must be a non-negative whole number' });
  }

  try {
    let settings = await MarketingSettings.findOne();
    if (!settings) settings = new MarketingSettings();

    settings.minimumTopUpAmount = Math.round(minimumTopUpAmount * 100) / 100;
    settings.requiredSuccessfulShipments = requiredSuccessfulShipments;
    settings.updatedAt = new Date();
    await settings.save();

    const overview = await getMarketingOverview();
    res.status(200).json({ message: 'Marketing activation rules updated', ...overview });
  } catch (error) {
    console.error('Marketing settings update error:', error);
    res.status(500).json({ message: 'Failed to update marketing activation rules' });
  }
};

exports.assignSalesRepresentative = async (req, res) => {
  const { customerId } = req.params;
  const { representativeId } = req.body;

  try {
    const customer = await User.findOne({ _id: customerId, role: 'Customer' });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    if (!representativeId) {
      customer.salesRepresentative = null;
    } else {
      const representative = await Staff.findOne({
        _id: representativeId,
        role: /^Sales Representative$/i,
      });
      if (!representative) {
        return res.status(400).json({ message: 'Select a valid Sales Representative' });
      }
      customer.salesRepresentative = representative._id;
    }

    await customer.save();
    const updated = await User.findById(customer._id)
      .select('customerId fullName companyName email phone salesRepresentative marketingActivation')
      .populate('salesRepresentative', 'fullName email staffId role');

    res.status(200).json({
      message: 'Sales Representative assignment updated',
      customer: updated,
    });
  } catch (error) {
    console.error('Sales Representative assignment error:', error);
    res.status(500).json({ message: 'Failed to update Sales Representative assignment' });
  }
};