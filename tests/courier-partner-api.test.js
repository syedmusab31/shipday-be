const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePartnerQuoteInput } = require('../controller/courierPartnerApi');

const validRequest = {
  serviceType: 'express',
  senderDetails: {
    fullName: 'Sender Name',
    mobile: '+27123456789',
    email: 'sender@example.com',
  },
  collectionDetails: {
    address: {
      street: '1 Collection Road',
      city: 'Johannesburg',
      province: 'Gauteng',
      postalCode: '2000',
    },
  },
  deliveryDetails: {
    receiverName: 'Receiver Name',
    mobile: '+27987654321',
    address: {
      street: '2 Delivery Road',
      city: 'Cape Town',
      province: 'Western Cape',
      postalCode: '8000',
    },
  },
  parcels: [{ length: 40, width: 30, height: 20, weight: 8 }],
};

test('requires a payer email and normalizes third-party courier quote input', () => {
  const input = normalizePartnerQuoteInput(validRequest);
  assert.equal(input.senderDetails.email, 'sender@example.com');
  assert.equal(input.parcels[0].length, 40);

  assert.throws(
    () => normalizePartnerQuoteInput({
      ...validRequest,
      senderDetails: { fullName: 'Sender Name', mobile: '+27123456789' },
    }),
    /senderDetails.email must be a valid email address/
  );
});
