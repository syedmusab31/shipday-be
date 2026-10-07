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
const { calculateParcelSurcharges } = require('./parcelSurcharges');

function calculateShipmentPricing({
  parcelDetails,
  collectionDetails,
  deliveryDetails,
  pricing,
  selectedPackaging = [],
  fulfillmentAmount,
  parcelCount,
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
  const dimensions = Array.isArray(parcelDetails.dimensions)
    ? parcelDetails.dimensions
    : parcelDetails.dimensions && typeof parcelDetails.dimensions === 'object'
      ? [parcelDetails.dimensions]
      : [];
  const parcelSurcharges = calculateParcelSurcharges(
    dimensions,
    parcelCount ?? Math.max(dimensions.length, 1),
    pricing.parcelSurcharges
  );
  const total = roundMoney(
    baseCost + packagingCost + interProvinceFee + parcelSurcharges.total
  );

  return {
    packaging,
    baseCost,
    packagingCost,
    interProvinceFee,
    ...parcelSurcharges,
    total,
  };
}

module.exports = { calculateShipmentPricing };