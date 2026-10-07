const crypto = require('crypto');
const Pricing = require('../models/Pricing');
const Shipment = require('../models/Shipment');
const CourierPartnerQuote = require('../models/CourierPartnerQuote');
const generateShipmentId = require('../utils/generateShipmentId');
const { calculateShipmentPricing } = require('../utils/shipmentPricing');
const { generatePaymentData } = require('../utils/payfast');
const { normalizeQuoteInput } = require('./storeIntegration');

const QUOTE_LIFETIME_MS = 15 * 60 * 1000;
const BOOKING_LOCK_MS = 2 * 60 * 1000;

function normalizePartnerQuoteInput(body) {
  const input = normalizeQuoteInput(body);
  const email = String(input.senderDetails.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('senderDetails.email must be a valid email address for PayFast checkout');
  }
  input.senderDetails = { ...input.senderDetails, email };
  return input;
}

function presentShipment(shipment) {
  return {
    shipmentId: shipment.shipmentId,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    orderNumber: shipment.orderNumber,
    senderDetails: shipment.senderDetails,
    collectionDetails: shipment.collectionDetails,
    deliveryDetails: shipment.deliveryDetails,
    parcelType: shipment.parcelDetails?.parcelType,
    numberOfBoxes: shipment.numberOfBoxes,
    parcels: shipment.parcels,
    payment: shipment.payment,
    pricingBreakdown: shipment.pricingBreakdown,
    eta: shipment.eta,
    createdAt: shipment.createdAt,
  };
}

function makeCheckoutUrl(shipment) {
  const paymentInfo = generatePaymentData(shipment);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(paymentInfo.data)) {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  }
  return `${paymentInfo.url}?${query.toString()}`;
}

function makeShipmentFields(quote, partner, shipmentId, eta) {
  const total = quote.pricingBreakdown.total;
  return {
    shipmentId,
    barcode: shipmentId,
    trackingNumber: shipmentId,
    courierPartner: partner._id,
    courierPartnerQuoteId: quote.quoteId,
    senderDetails: quote.senderDetails,
    collectionDetails: quote.collectionDetails,
    deliveryDetails: quote.deliveryDetails,
    parcelDetails: {
      serviceType: quote.serviceType,
      parcelType: quote.parcelType,
      dimensions: quote.parcels[0],
      packaging: quote.pricingBreakdown.packaging,
    },
    pricingSnapshot: quote.pricingSnapshot,
    orderNumber: quote.orderNumber,
    marketplaceName: quote.marketplaceName,
    numberOfBoxes: quote.parcels.length,
    parcels: quote.parcels,
    bookedBy: partner.name,
    payment: {
      method: 'payfast',
      status: 'pending',
      amount: total,
      transactionId: null,
    },
    pricingBreakdown: {
      baseCost: quote.pricingBreakdown.baseCost,
      packagingCost: quote.pricingBreakdown.packagingCost,
      interProvinceFee: quote.pricingBreakdown.interProvinceFee,
      oversizeBoxCount: quote.pricingBreakdown.oversizeBoxCount,
      oversizeFee: quote.pricingBreakdown.oversizeFee,
      additionalBoxCount: quote.pricingBreakdown.additionalBoxCount,
      additionalBoxFee: quote.pricingBreakdown.additionalBoxFee,
      total,
    },
    senderName: quote.senderDetails.fullName || 'N/A',
    senderPhone: quote.senderDetails.mobile || '0000000000',
    receiverName: quote.deliveryDetails.receiverName || 'N/A',
    receiverPhone: quote.deliveryDetails.mobile || '0000000000',
    start: quote.collectionDetails.address.city || 'Unknown',
    end: quote.deliveryDetails.address.city || 'Unknown',
    parcelWeight: quote.parcels.reduce((sum, parcel) => sum + parcel.weight, 0),
    packageType: quote.parcelType,
    cost: total,
    eta,
    status: 'Awaiting Payment',
  };
}

function respondWithShipment(res, shipment, idempotent) {
  return res.status(idempotent ? 200 : 201).json({
    shipment: presentShipment(shipment),
    payment: {
      provider: 'payfast',
      checkoutUrl: shipment.payment?.status === 'pending' ? makeCheckoutUrl(shipment) : null,
    },
    idempotent,
  });
}

exports.normalizePartnerQuoteInput = normalizePartnerQuoteInput;

exports.createQuote = async (req, res) => {
  let input;
  try {
    input = normalizePartnerQuoteInput(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const pricing = await Pricing.findOne() || new Pricing();
    const pricingSnapshot = typeof pricing.toObject === 'function' ? pricing.toObject() : pricing;
    const pricingBreakdown = calculateShipmentPricing({
      parcelDetails: {
        serviceType: input.serviceType,
        parcelType: input.parcelType,
        dimensions: input.parcels,
      },
      collectionDetails: input.collectionDetails,
      deliveryDetails: input.deliveryDetails,
      pricing,
      selectedPackaging: input.selectedPackaging,
      parcelCount: input.parcels.length,
    });
    const quoteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_LIFETIME_MS);
    await CourierPartnerQuote.create({
      quoteId,
      courierPartnerId: req.courierPartner._id,
      ...input,
      pricingBreakdown,
      pricingSnapshot,
      expiresAt,
    });
    return res.status(201).json({
      quoteId,
      currency: 'ZAR',
      serviceType: input.serviceType,
      parcelCount: input.parcels.length,
      pricingBreakdown,
      total: pricingBreakdown.total,
      expiresAt,
    });
  } catch (error) {
    console.error('Courier partner quote creation failed:', error.message);
    return res.status(500).json({ message: 'Failed to create quote' });
  }
};

exports.bookShipmentFromQuote = async (req, res) => {
  const quoteId = String(req.body?.quoteId || '').trim();
  if (!quoteId || quoteId.length > 100) {
    return res.status(400).json({ message: 'A valid quoteId is required' });
  }

  try {
    let quote = await CourierPartnerQuote.findOne({
      quoteId,
      courierPartnerId: req.courierPartner._id,
    });
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    const shipmentFilter = {
      courierPartnerQuoteId: quote.quoteId,
      courierPartner: req.courierPartner._id,
    };
    let shipment = await Shipment.findOne(shipmentFilter);
    if (shipment) {
      await CourierPartnerQuote.updateOne(
        { _id: quote._id },
        { $set: { status: 'booked', shipmentId: shipment.shipmentId } }
      );
      return respondWithShipment(res, shipment, true);
    }

    if (quote.status === 'booked') {
      return res.status(409).json({ message: 'Quote is marked booked but its shipment could not be found' });
    }
    if (quote.status === 'booking') {
      if (quote.bookingStartedAt && Date.now() - quote.bookingStartedAt.getTime() < BOOKING_LOCK_MS) {
        return res.status(409).json({ message: 'Quote booking is already in progress; retry shortly' });
      }
      await CourierPartnerQuote.updateOne(
        { _id: quote._id, status: 'booking', bookingStartedAt: quote.bookingStartedAt },
        { $set: { status: 'quoted', bookingStartedAt: null } }
      );
    }
    const bookingStartedAt = new Date();
    const reservation = await CourierPartnerQuote.findOneAndUpdate(
      {
        _id: quote._id,
        courierPartnerId: req.courierPartner._id,
        status: 'quoted',
        expiresAt: { $gt: bookingStartedAt },
      },
      { $set: { status: 'booking', bookingStartedAt } },
      { new: true }
    );
    if (!reservation) {
      return res.status(409).json({ message: 'Quote is no longer available; request a fresh quote' });
    }
    quote = reservation;

    try {
      const shipmentId = await generateShipmentId();
      const eta = new Date();
      eta.setDate(eta.getDate() + (quote.serviceType === 'express' ? 2 : 4));
      shipment = await Shipment.create(makeShipmentFields(quote, req.courierPartner, shipmentId, eta));
      await CourierPartnerQuote.updateOne(
        { _id: quote._id, status: 'booking', bookingStartedAt },
        { $set: { status: 'booked', shipmentId } }
      );
    } catch (bookingError) {
      if (bookingError.code === 11000) {
        shipment = await Shipment.findOne(shipmentFilter);
        if (shipment) {
          await CourierPartnerQuote.updateOne(
            { _id: quote._id },
            { $set: { status: 'booked', shipmentId: shipment.shipmentId } }
          );
          return respondWithShipment(res, shipment, true);
        }
      }
      await CourierPartnerQuote.updateOne(
        { _id: quote._id, status: 'booking', bookingStartedAt },
        { $set: { status: 'quoted', bookingStartedAt: null } }
      );
      throw bookingError;
    }

    return respondWithShipment(res, shipment, false);
  } catch (error) {
    console.error('Courier partner shipment booking failed:', error.message);
    return res.status(500).json({ message: 'Failed to book shipment' });
  }
};

exports.getShipment = async (req, res) => {
  try {
    const shipment = await Shipment.findOne({
      shipmentId: req.params.shipmentId,
      courierPartner: req.courierPartner._id,
    });
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    return res.status(200).json({ shipment: presentShipment(shipment) });
  } catch (error) {
    console.error('Courier partner shipment lookup failed:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve shipment' });
  }
};
