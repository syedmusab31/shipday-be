const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBookingPayload,
  buildRatesPayload,
  mapAddress,
  mapContact,
  mapParcels,
  TheCourierGuyAdapter,
} = require('../services/couriers/theCourierGuyAdapter');

const shipment = {
  shipmentId: 'SHP123456',
  orderNumber: 'STORE-1001',
  packageType: 'custom',
  collectionDetails: {
    company: 'Sender Co',
    dispatcherName: 'Sender',
    email: 'sender@example.com',
    mobile: '+27111111111',
    address: {
      street: '1 Main Road',
      complex: 'Unit 4',
      suburb: 'Central',
      city: 'Johannesburg',
      province: 'Gauteng',
      postalCode: '2000',
      latitude: -26.2,
      longitude: 28.0,
    },
  },
  deliveryDetails: {
    receiverName: 'Receiver',
    email: 'receiver@example.com',
    mobile: '+27222222222',
    address: {
      street: '2 Other Road',
      suburb: 'CBD',
      city: 'Cape Town',
      province: 'Western Cape',
      postalCode: '8000',
    },
  },
  parcels: [{ length: 40, width: 30, height: 20, weight: 8 }],
};

test('maps Shipday addresses and parcel units to ShipLogic rate request fields', () => {
  const payload = buildRatesPayload(shipment, '12345');

  assert.equal(payload.account_id, 12345);
  assert.equal(payload.collection_address.street_address, '1 Main Road, Unit 4');
  assert.equal(payload.collection_address.zone, 'Gauteng');
  assert.equal(payload.collection_address.lat, -26.2);
  assert.equal(payload.delivery_address.country, 'ZA');
  assert.deepEqual(payload.parcels, [{
    submitted_length_cm: 40,
    submitted_width_cm: 30,
    submitted_height_cm: 20,
    submitted_weight_kg: 8,
    parcel_description: 'custom',
  }]);
});

test('maps contacts and selected service for shipment booking', () => {
  const payload = buildBookingPayload(shipment, 'ECO', '12345');

  assert.equal(payload.service_level_code, 'ECO');
  assert.equal(payload.custom_tracking_reference, shipment.shipmentId);
  assert.equal(payload.customer_reference, 'STORE-1001');
  assert.equal(payload.collection_contact.mobile_number, '+27111111111');
  assert.equal(payload.delivery_contact.email, 'receiver@example.com');
});

test('rejects missing addresses, contacts, or invalid parcels before calling provider', () => {
  assert.throws(() => buildRatesPayload({ ...shipment, parcels: [] }), /At least one parcel/);
  assert.throws(() => mapParcels([{ length: -1, width: 1, height: 1, weight: 1 }]), /invalid dimensions/);
  assert.throws(() => mapContact({}, ''), /contact email or mobile number/);
  assert.throws(() => buildRatesPayload({
    ...shipment,
    collectionDetails: { address: {} },
  }), /complete collection address/);
});

test('reports missing provider credentials instead of making an unauthenticated request', async () => {
  const adapter = new TheCourierGuyAdapter({ apiKey: '', authScheme: 'Token' });
  await assert.rejects(
    adapter.getRates(shipment),
    error => error.statusCode === 503 && /API key is not configured/.test(error.message)
  );
});

test('validates provider credentials before a booking attempt is created', () => {
  const adapter = new TheCourierGuyAdapter({ apiKey: '' });
  assert.throws(() => adapter.assertConfigured(), /API key is not configured/);
});

test('sends requests with the configured token scheme and ShipLogic endpoint', async () => {
  const adapter = new TheCourierGuyAdapter({
    apiKey: 'sandbox-key',
    authScheme: 'Token',
    baseURL: 'https://api.shiplogic.com/',
  });
  let request;
  adapter.client.request = async config => {
    request = config;
    return { data: { service_levels: [] } };
  };

  await adapter.getRates(shipment);

  assert.equal(request.url, '/rates');
  assert.equal(request.headers.Authorization, 'Token sandbox-key');
  assert.equal(request.data.collection_address.code, '2000');
});

test('maps provider address coordinates only when they are explicitly valid', () => {
  const address = mapAddress({ city: 'Cape Town', latitude: null, longitude: '' });
  assert.equal(Object.hasOwn(address, 'lat'), false);
  assert.equal(Object.hasOwn(address, 'lng'), false);
});
