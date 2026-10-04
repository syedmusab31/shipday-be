const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateCustomerActivation,
  getTopUpUserId,
} = require('../utils/marketingActivation');

test('customer activates only after meeting both configured conditions', () => {
  const settings = { minimumTopUpAmount: 500, requiredSuccessfulShipments: 3 };

  assert.equal(evaluateCustomerActivation({ topUpAmount: 500, successfulShipments: 2, ...settings }).isActivated, false);
  assert.equal(evaluateCustomerActivation({ topUpAmount: 499.99, successfulShipments: 3, ...settings }).isActivated, false);
  assert.equal(evaluateCustomerActivation({ topUpAmount: 500, successfulShipments: 3, ...settings }).isActivated, true);
});

test('legacy top-up transaction IDs can identify their customer', () => {
  const userId = '64f000000000000000000001';
  assert.equal(getTopUpUserId({ orderId: `TOPUP-${userId}-1700000000000` }), userId);
  assert.equal(getTopUpUserId({ orderId: 'SHIPMENT-123' }), null);
});