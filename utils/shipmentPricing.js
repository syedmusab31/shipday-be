const {
  resolvePackagingSelection,
  calculatePackagingTotal,
  calculateShipmentBasePrice,
  roundMoney,
} = require('./packagingPricing');
const {
  normalizeInterProvinceFees,
  getInterProvinceFee,
} = require('./interProvincePricing');

function calculateShipmentPricing({
  parcelDetails,
  collectionDetails,
  deliveryDetails,
  pricing,
  selectedPackaging = [],
  fulfillmentAmount,
}) {
  const packagingOptions = pricing.packagingOptions || [];
  const packaging = resolvePackagingSelection(selectedPackaging, packagingOptions);
  const packagingCost = calculatePackagingTotal(packaging, packagingOptions);
  const baseCost = fulfillmentAmount === undefined
    ? calculateShipmentBasePrice(parcelDetails, pricing)
    : roundMoney(Number(fulfillmentAmount) || 0);
  const provinceFees = normalizeInterProvinceFees(pricing.interProvinceFees || []);
  const interProvinceFee = getInterProvinceFee(
    collectionDetails?.address?.province,
    deliveryDetails?.address?.province,
    provinceFees
  );
  const total = roundMoney(baseCost + packagingCost + interProvinceFee);

  return {
    packaging,
    baseCost,
    packagingCost,
    interProvinceFee,
    total,
  };
}

module.exports = { calculateShipmentPricing };