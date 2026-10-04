const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getInterProvinceFee,
  normalizeInterProvinceFees,
} = require('../utils/interProvincePricing');
const { calculateShipmentPricing } = require('../utils/shipmentPricing');

test('applies a fee only to the configured province direction', () => {
  const fees = [{
    id: 'gauteng-western-cape',
    fromProvince: 'Gauteng',
    toProvince: 'Western Cape',
    fee: 85.5,
  }];

  assert.equal(getInterProvinceFee('Gauteng', 'Western Cape', fees), 85.5);
  assert.equal(getInterProvinceFee('Western Cape', 'Gauteng', fees), 0);
});

test('does not charge for the same province or an unconfigured route', () => {
  const fees = [{
    id: 'gauteng-western-cape',
    fromProvince: 'Gauteng',
    toProvince: 'Western Cape',
    fee: 85,
  }];

  assert.equal(getInterProvinceFee('Gauteng', 'Gauteng', fees), 0);
  assert.equal(getInterProvinceFee('Limpopo', 'Free State', fees), 0);
});

test('rejects same-province, invalid, negative, and duplicate fee routes', () => {
  assert.throws(
    () => normalizeInterProvinceFees([{ fromProvince: 'Gauteng', toProvince: 'Gauteng', fee: 10 }]),
    /two different valid provinces/
  );
  assert.throws(
    () => normalizeInterProvinceFees([{ fromProvince: 'Atlantis', toProvince: 'Gauteng', fee: 10 }]),
    /two different valid provinces/
  );
  assert.throws(
    () => normalizeInterProvinceFees([{ fromProvince: 'Gauteng', toProvince: 'Western Cape', fee: -1 }]),
    /non-negative fee/
  );
  assert.throws(
    () => normalizeInterProvinceFees([
      { fromProvince: 'Gauteng', toProvince: 'Western Cape', fee: 10 },
      { fromProvince: 'Gauteng', toProvince: 'Western Cape', fee: 15 },
    ]),
    /duplicated/
  );
});

test('includes configured route and packaging fees in the authoritative shipment total', () => {
  const quote = calculateShipmentPricing({
    parcelDetails: {
      serviceType: 'economy',
      parcelType: 'custom',
      dimensions: [{ length: 10, width: 10, height: 10, weight: 2 }],
      packaging: [{ id: 'boxing', name: 'Bogus name', price: 0 }],
    },
    collectionDetails: { address: { province: 'Gauteng' } },
    deliveryDetails: { address: { province: 'Western Cape' } },
    selectedPackaging: [{ id: 'boxing', price: 0 }],
    pricing: {
      economy: { baseAmount: 20, divisor: 5000, rate: 1.2 },
      packagingOptions: [{ id: 'boxing', name: 'Boxing', price: 35 }],
      interProvinceFees: [{
        id: 'gauteng-western-cape',
        fromProvince: 'Gauteng',
        toProvince: 'Western Cape',
        fee: 85,
      }],
    },
  });

  assert.deepEqual(quote.packaging, [{ id: 'boxing', name: 'Boxing', price: 35 }]);
  assert.equal(quote.baseCost, 22.4);
  assert.equal(quote.packagingCost, 35);
  assert.equal(quote.interProvinceFee, 85);
  assert.equal(quote.total, 142.4);
});