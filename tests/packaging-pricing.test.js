const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePackagingTotal,
  normalizePackagingOptions,
  resolvePackagingSelection,
  calculateShipmentBasePrice,
} = require('../utils/packagingPricing');

test('normalizes packaging option list', () => {
  const normalized = normalizePackagingOptions([
    { name: 'Boxing', price: 35 },
    { name: 'Bubble Wrap', price: 20 },
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].name, 'Boxing');
  assert.equal(normalized[0].price, 35);
});

test('sums selected packaging costs', () => {
  const selected = [
    { id: 'boxing', price: 0.01 },
    { id: 'bubble-wrap', price: 0.01 },
  ];
  const options = [
    { id: 'boxing', name: 'Boxing', price: 35 },
    { id: 'bubble-wrap', name: 'Bubble Wrap', price: 20 },
  ];

  assert.equal(calculatePackagingTotal(selected, options), 55);
});

test('uses configured prices and names for shipment storage', () => {
  const resolved = resolvePackagingSelection(
    [{ id: 'boxing', name: 'Free', price: 0 }],
    [{ id: 'boxing', name: 'Boxing', price: 35 }]
  );

  assert.deepEqual(resolved, [{ id: 'boxing', name: 'Boxing', price: 35 }]);
});

test('rejects removed or disabled packaging options', () => {
  assert.throws(
    () => resolvePackagingSelection([{ id: 'bubble-wrap' }], []),
    /unavailable/
  );
  assert.throws(
    () => resolvePackagingSelection([{ id: 'boxing' }], [{ id: 'boxing', name: 'Boxing', price: 35, active: false }]),
    /unavailable/
  );
});

test('calculates server-side base cost from configured rates', () => {
  const base = calculateShipmentBasePrice({
    serviceType: 'economy',
    parcelType: 'custom',
    dimensions: [{ length: 10, width: 10, height: 10, weight: 2 }],
  }, {
    economy: { baseAmount: 20, divisor: 5000, rate: 1.2 },
  });

  assert.equal(base, 22.4);
});
