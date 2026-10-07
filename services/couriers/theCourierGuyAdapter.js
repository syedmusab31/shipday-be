const axios = require('axios');

const PROVIDER = 'the-courier-guy';

class CourierProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CourierProviderError';
    this.statusCode = options.statusCode || 502;
    this.safeToRetry = options.safeToRetry === true;
    this.providerStatus = options.providerStatus;
  }
}

function mapAddress(address = {}, company = '') {
  const streetAddress = [address.street, address.complex].filter(Boolean).join(', ');
  const mapped = {
    type: company ? 'business' : 'residential',
    company: company || '',
    street_address: streetAddress,
    local_area: address.suburb || '',
    city: address.city || '',
    zone: address.province || '',
    country: address.countryCode || 'ZA',
    code: address.postalCode || '',
  };

  if (address.latitude !== undefined && address.latitude !== null && address.latitude !== '' && Number.isFinite(Number(address.latitude))) {
    mapped.lat = Number(address.latitude);
  }
  if (address.longitude !== undefined && address.longitude !== null && address.longitude !== '' && Number.isFinite(Number(address.longitude))) {
    mapped.lng = Number(address.longitude);
  }
  return mapped;
}

function mapContact(details = {}, name) {
  const contact = {
    name: name || details.fullName || details.dispatcherName || details.receiverName || '',
    mobile_number: details.mobile || '',
    email: details.email || '',
  };
  if (!contact.mobile_number && !contact.email) {
    throw new Error('The Courier Guy requires a contact email or mobile number');
  }
  return contact;
}

function mapParcels(parcels = [], description = 'Parcel') {
  if (!Array.isArray(parcels) || parcels.length === 0) {
    throw new Error('At least one parcel is required for courier integration');
  }
  return parcels.map((parcel, index) => {
    if (!parcel || typeof parcel !== 'object' || Array.isArray(parcel)) {
      throw new Error(`Parcel ${index + 1} must contain dimensions and weight`);
    }
    const normalized = {
      submitted_length_cm: Number(parcel.length),
      submitted_width_cm: Number(parcel.width),
      submitted_height_cm: Number(parcel.height),
      submitted_weight_kg: Number(parcel.weight),
      parcel_description: description,
    };
    if (Object.values(normalized).some(value => typeof value === 'number' && (!Number.isFinite(value) || value <= 0))) {
      throw new Error(`Parcel ${index + 1} has invalid dimensions or weight`);
    }
    return normalized;
  });
}

function buildRatesPayload(shipment, accountId) {
  const collectionAddress = shipment.collectionDetails?.address;
  const deliveryAddress = shipment.deliveryDetails?.address;
  if (!collectionAddress?.street || !collectionAddress?.city || !collectionAddress?.province || !collectionAddress?.postalCode) {
    throw new Error('Shipment is missing a complete collection address');
  }
  if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.province || !deliveryAddress?.postalCode) {
    throw new Error('Shipment is missing a complete delivery address');
  }

  const payload = {
    collection_address: mapAddress(collectionAddress, shipment.collectionDetails.company),
    delivery_address: mapAddress(deliveryAddress, shipment.deliveryDetails.company),
    parcels: mapParcels(
      shipment.parcels?.length
        ? shipment.parcels
        : shipment.parcelDetails?.dimensions
          ? [shipment.parcelDetails.dimensions]
          : [],
      shipment.packageType || 'Parcel'
    ),
  };
  if (accountId !== undefined && accountId !== null && accountId !== '') {
    const normalizedAccountId = Number(accountId);
    if (!Number.isInteger(normalizedAccountId) || normalizedAccountId <= 0) {
      throw new Error('The Courier Guy account ID must be a positive integer');
    }
    payload.account_id = normalizedAccountId;
  }
  return payload;
}

function buildBookingPayload(shipment, serviceLevelCode, accountId) {
  const payload = buildRatesPayload(shipment, accountId);
  const collectionAddress = shipment.collectionDetails.address;
  const deliveryAddress = shipment.deliveryDetails.address;
  payload.collection_contact = mapContact(shipment.collectionDetails, shipment.collectionDetails.dispatcherName);
  payload.delivery_contact = mapContact(shipment.deliveryDetails, shipment.deliveryDetails.receiverName);
  payload.service_level_code = serviceLevelCode;
  payload.custom_tracking_reference = shipment.shipmentId;
  payload.customer_reference_name = 'Shipday Reference';
  payload.customer_reference = shipment.orderNumber || shipment.shipmentId;
  payload.special_instructions_collection = shipment.parcelDetails?.specialInstructions || '';
  payload.special_instructions_delivery = shipment.parcelDetails?.specialInstructions || '';
  return payload;
}

class TheCourierGuyAdapter {
  constructor({ apiKey, authScheme, baseURL, accountId } = {}) {
    this.apiKey = apiKey ?? process.env.COURIER_TCG_API_KEY;
    this.authScheme = (authScheme ?? process.env.COURIER_TCG_AUTH_SCHEME ?? 'Token').trim();
    this.accountId = accountId ?? process.env.COURIER_TCG_ACCOUNT_ID;
    this.client = axios.create({
      baseURL: (baseURL ?? process.env.COURIER_TCG_BASE_URL ?? 'https://api.shiplogic.com').replace(/\/+$/, ''),
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  assertConfigured() {
    if (!this.apiKey) {
      throw new CourierProviderError('The Courier Guy API key is not configured', { statusCode: 503 });
    }
    if (!this.authScheme) {
      throw new CourierProviderError('The Courier Guy authorization scheme is not configured', { statusCode: 503 });
    }
  }

  async request(method, url, { data, params } = {}) {
    this.assertConfigured();
    try {
      const response = await this.client.request({
        method,
        url,
        data,
        params,
        headers: { Authorization: `${this.authScheme} ${this.apiKey}` },
      });
      return response.data;
    } catch (error) {
      const providerStatus = error.response?.status;
      throw new CourierProviderError(
        providerStatus
          ? `The Courier Guy rejected the request (HTTP ${providerStatus})`
          : 'The Courier Guy could not be reached; booking outcome may be unknown',
        {
          statusCode: 502,
          providerStatus,
          safeToRetry: providerStatus >= 400 && providerStatus < 500,
        }
      );
    }
  }

  getRates(shipment) {
    return this.request('post', '/rates', {
      data: buildRatesPayload(shipment, this.accountId),
    });
  }

  createShipment(shipment, serviceLevelCode) {
    return this.request('post', '/shipments', {
      data: buildBookingPayload(shipment, serviceLevelCode, this.accountId),
    });
  }

  trackShipment(trackingReference) {
    return this.request('get', '/tracking/shipments', {
      params: { tracking_reference: trackingReference },
    });
  }
}

module.exports = {
  PROVIDER,
  CourierProviderError,
  TheCourierGuyAdapter,
  mapAddress,
  mapContact,
  mapParcels,
  buildRatesPayload,
  buildBookingPayload,
};
