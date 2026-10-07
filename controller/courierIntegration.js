const Shipment = require('../models/Shipment');
const CourierRateQuote = require('../models/CourierRateQuote');
const CourierBooking = require('../models/CourierBooking');
const InvoiceAccount = require('../models/InvoiceAccount');
const mongoose = require('mongoose');
const {
  PROVIDER,
  CourierProviderError,
  TheCourierGuyAdapter,
} = require('../services/couriers/theCourierGuyAdapter');

const RATE_QUOTE_LIFETIME_MS = 15 * 60 * 1000;

function respondWithProviderError(res, error) {
  if (error instanceof CourierProviderError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (error instanceof Error && /address|parcel|contact/i.test(error.message)) {
    return res.status(400).json({ message: error.message });
  }
  console.error('Courier integration request failed:', error.message);
  return res.status(500).json({ message: 'Courier integration request failed' });
}

exports.getRates = async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ shipmentId: req.params.shipmentId });
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    const adapter = new TheCourierGuyAdapter();
    const providerResponse = await adapter.getRates(shipment);
    const expiresAt = new Date(Date.now() + RATE_QUOTE_LIFETIME_MS);
    const rateQuote = await CourierRateQuote.create({
      provider: PROVIDER,
      shipmentId: shipment.shipmentId,
      requestedBy: req.user._id,
      providerResponse,
      expiresAt,
    });
    return res.status(201).json({
      rateQuoteId: rateQuote._id,
      provider: PROVIDER,
      expiresAt,
      rates: providerResponse,
    });
  } catch (error) {
    return respondWithProviderError(res, error);
  }
};

exports.bookShipment = async (req, res) => {
  const { rateQuoteId, serviceLevelCode } = req.body;
  if (!mongoose.isValidObjectId(rateQuoteId) || typeof serviceLevelCode !== 'string' || !serviceLevelCode.trim()) {
    return res.status(400).json({ message: 'rateQuoteId and serviceLevelCode are required' });
  }

  try {
    const shipment = await Shipment.findOne({ shipmentId: req.params.shipmentId });
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    const invoiceApproved = shipment.payment?.method === 'invoice' &&
      await InvoiceAccount.exists({ userId: shipment.customer, status: 'approved' });
    if (shipment.payment?.status !== 'paid' && !invoiceApproved) {
      return res.status(409).json({ message: 'Shipment must be paid or belong to an approved invoice account before carrier booking' });
    }
    if (shipment.status === 'Cancelled' || shipment.payment?.status === 'failed') {
      return res.status(409).json({ message: 'Cancelled or failed shipments cannot be booked with a courier' });
    }
    const rateQuote = await CourierRateQuote.findOne({
      _id: rateQuoteId,
      shipmentId: shipment.shipmentId,
      provider: PROVIDER,
      expiresAt: { $gt: new Date() },
    });
    if (!rateQuote) {
      return res.status(409).json({ message: 'Rate quote is invalid or expired; request new rates' });
    }

    let booking = await CourierBooking.findOne({
      provider: PROVIDER,
      shipmentId: shipment.shipmentId,
    });
    if (booking?.status === 'booked') {
      return res.status(200).json({ booking, idempotent: true });
    }
    if (booking && booking.status !== 'failed') {
      return res.status(409).json({
        message: booking.status === 'unknown'
          ? 'Provider booking outcome is unknown; reconcile with The Courier Guy before retrying'
          : 'A booking attempt already exists for this shipment',
      });
    }

    const adapter = new TheCourierGuyAdapter();
    adapter.assertConfigured();
    if (booking) {
      booking.rateQuoteId = rateQuote._id;
      booking.serviceLevelCode = serviceLevelCode.trim();
      booking.requestedBy = req.user._id;
      booking.status = 'submitting';
      booking.providerResponse = null;
      booking.providerErrorStatus = null;
      booking.lastError = null;
      await booking.save();
    } else {
      try {
        booking = await CourierBooking.create({
        provider: PROVIDER,
        shipmentId: shipment.shipmentId,
        rateQuoteId: rateQuote._id,
        serviceLevelCode: serviceLevelCode.trim(),
        requestedBy: req.user._id,
        status: 'submitting',
        });
      } catch (error) {
        if (error.code === 11000) {
          const existing = await CourierBooking.findOne({
            provider: PROVIDER,
            shipmentId: shipment.shipmentId,
          });
          if (existing?.status === 'booked') {
            return res.status(200).json({ booking: existing, idempotent: true });
          }
          return res.status(409).json({
            message: existing?.status === 'unknown'
              ? 'Provider booking outcome is unknown; reconcile with The Courier Guy before retrying'
              : 'A booking attempt already exists for this shipment',
          });
        }
        throw error;
      }
    }

    try {
      const providerResponse = await adapter.createShipment(shipment, booking.serviceLevelCode);
      booking.status = 'booked';
      booking.providerResponse = providerResponse;
      await booking.save();
      return res.status(201).json({ booking, idempotent: false });
    } catch (providerError) {
      booking.status = providerError.safeToRetry ? 'failed' : 'unknown';
      booking.providerErrorStatus = providerError.providerStatus || null;
      booking.lastError = providerError.message;
      await booking.save();
      return respondWithProviderError(res, providerError);
    }
  } catch (error) {
    return respondWithProviderError(res, error);
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await CourierBooking.findOne({
      shipmentId: req.params.shipmentId,
      provider: PROVIDER,
    });
    if (!booking) {
      return res.status(404).json({ message: 'Courier booking not found' });
    }
    return res.status(200).json({ booking });
  } catch (error) {
    return respondWithProviderError(res, error);
  }
};

exports.trackShipment = async (req, res) => {
  try {
    const booking = await CourierBooking.findOne({
      shipmentId: req.params.shipmentId,
      provider: PROVIDER,
      status: 'booked',
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booked courier shipment not found' });
    }
    const tracking = await new TheCourierGuyAdapter().trackShipment(req.params.shipmentId);
    return res.status(200).json({ provider: PROVIDER, shipmentId: req.params.shipmentId, tracking });
  } catch (error) {
    return respondWithProviderError(res, error);
  }
};
