const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeQuoteInput } = require('../controller/storeIntegration');

const validRequest = {
  serviceType: 'express',
  senderDetails: { fullName: 'Sender', mobile: '+27123456789' },
  collectionDetails: {
    address: {
      street: '1 Collection Road',
      city: 'Johannesburg',
      province: 'Gauteng',
      postalCode: '2000',
    },
  },
  deliveryDetails: {
    receiverName: 'Receiver',
    mobile: '+27987654321',
    address: {
      street: '2 Delivery Road',
      city: 'Cape Town',
      province: 'Western Cape',
      postalCode: '8000',
    },
  },
  parcels: [
    { length: '40', width: '30', height: '20', weight: '8' },
    { length: 110, width: 30, height: 20, weight: 4 },
  ],
  packaging: [{ id: 'boxing', price: 0 }],
};

test('normalizes store quote parcel data and ignores client-supplied packaging prices', () => {
  const input = normalizeQuoteInput(validRequest);

  assert.equal(input.serviceType, 'express');
  assert.equal(input.parcels.length, 2);
  assert.equal(input.parcels[0].length, 40);
  assert.equal(input.collectionDetails.numberOfItems, 2);
  assert.deepEqual(input.selectedPackaging, [{ id: 'boxing' }]);
});

test('rejects missing, invalid, or incomplete parcel and address data', () => {
  assert.throws(() => normalizeQuoteInput(null), /Request body must be an object/);
  assert.throws(() => normalizeQuoteInput({ ...validRequest, serviceType: 'overnight' }), /serviceType/);
  assert.throws(() => normalizeQuoteInput({ ...validRequest, parcels: [] }), /At least one parcel/);
  assert.throws(() => normalizeQuoteInput({
    ...validRequest,
    parcels: [{ length: 0, width: 30, height: 20, weight: 4 }],
  }), /Parcel 1 requires positive/);
  assert.throws(() => normalizeQuoteInput({
    ...validRequest,
    deliveryDetails: { ...validRequest.deliveryDetails, address: { city: 'Cape Town' } },
  }), /deliveryDetails.address.street is required/);
  assert.throws(() => normalizeQuoteInput({
    ...validRequest,
    packaging: [{ id: '' }],
  }), /packaging selection requires an id/);
});
