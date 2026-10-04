const MarketingSettings = require('../models/MarketingSettings');
const Shipment = require('../models/Shipment');
const Staff = require('../models/Staff');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { evaluateCustomerActivation, getTopUpUserId } = require('../utils/marketingActivation');

const TOP_UP_TRANSACTION_QUERY = {
  type: { $in: ['Credit', 'credit'] },
  status: { $in: ['Completed', 'completed'] },
  method: { $in: ['PayFast', 'payfast'] },
  orderId: /^TOPUP-/,
};

async function getSettings() {
  return (await MarketingSettings.findOne()) || new MarketingSettings();
}

function activationRecord(progress, previousActivation) {
  const wasActivated = previousActivation?.status === 'Activated';
  const activatedAt = progress.isActivated
    ? (wasActivated ? previousActivation.activatedAt : new Date())
    : null;

  return {
    status: progress.isActivated ? 'Activated' : 'Not Activated',
    topUpAmount: progress.topUpAmount,
    successfulShipments: progress.successfulShipments,
    activatedAt,
    topUpRequirementMet: progress.topUpMet,
    shipmentRequirementMet: progress.shipmentsMet,
  };
}

async function refreshCustomerActivation(userId) {
  const user = await User.findOne({ _id: userId, role: 'Customer' });
  if (!user) return null;

  const [settings, topUpTransactions, successfulShipments] = await Promise.all([
    getSettings(),
    Transaction.find({
      ...TOP_UP_TRANSACTION_QUERY,
      $or: [
        { userId: user._id },
        { orderId: new RegExp(`^TOPUP-${user._id}-`) },
      ],
    }).select('amount'),
    Shipment.countDocuments({
      status: 'Delivered',
      $or: [
        { customer: user._id },
        { 'senderDetails.email': user.email },
      ],
    }),
  ]);

  const topUpAmount = topUpTransactions.reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);
  const progress = evaluateCustomerActivation({
    topUpAmount,
    successfulShipments,
    minimumTopUpAmount: settings.minimumTopUpAmount,
    requiredSuccessfulShipments: settings.requiredSuccessfulShipments,
  });

  user.marketingActivation = activationRecord(progress, user.marketingActivation);
  await user.save();
  return user.marketingActivation;
}

async function refreshShipmentCustomerActivation(shipment) {
  const user = shipment.customer
    ? null
    : await User.findOne({ email: shipment.senderDetails?.email }).select('_id');
  const userId = shipment.customer || user?._id;
  return userId ? refreshCustomerActivation(userId) : null;
}

async function getMarketingOverview() {
  const [settings, customers, representatives, transactions, deliveredShipments] = await Promise.all([
    getSettings(),
    User.find({ role: 'Customer' })
      .select('customerId fullName companyName email phone salesRepresentative marketingActivation')
      .populate('salesRepresentative', 'fullName email staffId role'),
    Staff.find({ role: /^Sales Representative$/i }).select('fullName email staffId role'),
    Transaction.find(TOP_UP_TRANSACTION_QUERY).select('userId orderId amount'),
    Shipment.find({ status: 'Delivered' }).select('customer senderDetails.email'),
  ]);

  const topUpsByUser = new Map();
  transactions.forEach(transaction => {
    const userId = getTopUpUserId(transaction);
    if (!userId) return;
    topUpsByUser.set(userId, (topUpsByUser.get(userId) || 0) + (Number(transaction.amount) || 0));
  });

  const customersByEmail = new Map(customers.map(customer => [customer.email.toLowerCase(), customer._id.toString()]));
  const shipmentCounts = new Map();
  deliveredShipments.forEach(shipment => {
    const userId = shipment.customer?.toString() || customersByEmail.get(shipment.senderDetails?.email?.toLowerCase());
    if (userId) shipmentCounts.set(userId, (shipmentCounts.get(userId) || 0) + 1);
  });

  const activationUpdates = [];
  const customerRows = customers.map(customer => {
    const customerId = customer._id.toString();
    const previousActivation = customer.marketingActivation?.toObject?.() || customer.marketingActivation;
    const progress = evaluateCustomerActivation({
      topUpAmount: topUpsByUser.get(customerId) || 0,
      successfulShipments: shipmentCounts.get(customerId) || 0,
      minimumTopUpAmount: settings.minimumTopUpAmount,
      requiredSuccessfulShipments: settings.requiredSuccessfulShipments,
    });
    const marketingActivation = activationRecord(progress, previousActivation);

    activationUpdates.push({
      updateOne: {
        filter: { _id: customer._id },
        update: { $set: { marketingActivation } },
      },
    });

    return {
      ...customer.toObject(),
      marketingActivation,
      commissionEligible: Boolean(customer.salesRepresentative && progress.isActivated),
    };
  });

  if (activationUpdates.length) await User.bulkWrite(activationUpdates);

  return {
    settings: {
      minimumTopUpAmount: settings.minimumTopUpAmount,
      requiredSuccessfulShipments: settings.requiredSuccessfulShipments,
    },
    representatives,
    customers: customerRows,
  };
}

module.exports = {
  getMarketingOverview,
  refreshCustomerActivation,
  refreshShipmentCustomerActivation,
};