const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateParcelSurcharges,
  normalizeParcelSurcharges,
} = require('../utils/parcelSurcharges');
const { calculateShipmentPricing } = require('../utils/shipmentPricing');
const { calculateShipmentBasePrice } = require('../utils/packagingPricing');

test('charges each box exceeding the configured maximum single dimension', () => {
  const result = calculateParcelSurcharges([
    { length: 50, width: 30, height: 20 },
    { length: 50.1, width: 30, height: 20 },
    { length: 20, width: 101, height: 20 },
  ], 3, {
    maxDimensionCm: 50,
    oversizeFeePerBox: 25.5,
  });

  assert.equal(result.oversizeBoxCount, 2);
  assert.equal(result.oversizeFee, 51);
  assert.deepEqual(result.oversizeBoxes.map(box => box.boxNumber), [2, 3]);
});

test('charges additional boxes only after the configured included quantity', () => {
  const rules = { includedBoxes: 2, additionalBoxFee: 12.25 };

  assert.equal(calculateParcelSurcharges([{ length: 10 }], 2, rules).additionalBoxFee, 0);
  assert.equal(calculateParcelSurcharges([{ length: 10 }], 4, rules).additionalBoxCount, 2);
  assert.equal(calculateParcelSurcharges([{ length: 10 }], 4, rules).additionalBoxFee, 24.5);
});

test('keeps all new charges disabled by default and validates configuration', () => {
  assert.deepEqual(normalizeParcelSurcharges(), {
    includedBoxes: 1,
    additionalBoxFee: 0,
    maxDimensionCm: null,
    oversizeFeePerBox: 0,
  });
  assert.throws(() => normalizeParcelSurcharges({ includedBoxes: 0 }), /positive integer/);
  assert.throws(() => normalizeParcelSurcharges({ maxDimensionCm: 0 }), /positive number or null/);
  assert.throws(() => normalizeParcelSurcharges({ oversizeFeePerBox: -1 }), /non-negative amount/);
  assert.throws(() => normalizeParcelSurcharges({ additionalBoxFee: Infinity }), /non-negative amount/);
});

test('includes parcel surcharges in the authoritative quote total', () => {
  const quote = calculateShipmentPricing({
    parcelDetails: {
      serviceType: 'economy',
      parcelType: 'custom',
      dimensions: [
        { length: 51, width: 30, height: 20, weight: 1 },
        { length: 30, width: 30, height: 20, weight: 2 },
      ],
    },
    collectionDetails: { address: { province: 'Gauteng' } },
    deliveryDetails: { address: { province: 'Gauteng' } },
    pricing: {
      economy: { baseAmount: 20, divisor: 5000, rate: 1.2 },
      parcelSurcharges: {
        includedBoxes: 1,
        additionalBoxFee: 10,
        maxDimensionCm: 50,
        oversizeFeePerBox: 25,
      },
    },
  });

  assert.equal(quote.baseCost, 51.66);
  assert.equal(quote.oversizeBoxCount, 1);
  assert.equal(quote.oversizeFee, 25);
  assert.equal(quote.additionalBoxCount, 1);
  assert.equal(quote.additionalBoxFee, 10);
  assert.equal(quote.total, 86.66);
});

test('applies satchel flat rates once per parcel on a multi-box waybill', () => {
  assert.equal(calculateShipmentBasePrice({
    serviceType: 'express',
    parcelType: 'satchel-a4',
    dimensions: [{}, {}],
  }, {
    satchel: { express: { a4: 110 } },
  }), 220);
});
