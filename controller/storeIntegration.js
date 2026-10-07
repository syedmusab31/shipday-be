const crypto = require('crypto');
const Pricing = require('../models/Pricing');
const Shipment = require('../models/Shipment');
const StoreQuote = require('../models/StoreQuote');
const InvoiceAccount = require('../models/InvoiceAccount');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const generateShipmentId = require('../utils/generateShipmentId');
const { calculateShipmentPricing } = require('../utils/shipmentPricing');

const QUOTE_LIFETIME_MS = 15 * 60 * 1000;
const BOOKING_LOCK_MS = 2 * 60 * 1000;

function normalizeParcelList(parcels) {
  if (!Array.isArray(parcels) || parcels.length === 0) {
    throw new Error('At least one parcel is required');
  }
  return parcels.map((parcel, index) => {
    const normalized = {
      length: Number(parcel?.length),
      width: Number(parcel?.width),
      height: Number(parcel?.height),
      weight: Number(parcel?.weight),
    };
    if (Object.values(normalized).some(value => !Number.isFinite(value) || value <= 0)) {
      throw new Error(`Parcel ${index + 1} requires positive length, width, height, and weight`);
    }
    return normalized;
  });
}

async function failInvoiceTransaction(shipmentId) {
  const result = await Transaction.updateOne(
    { orderId: shipmentId, method: 'Invoice', status: 'Pending' },
    { $set: { status: 'Failed' } }
  );
  if (result.matchedCount === 1) return true;
  return Boolean(await Transaction.exists({
    orderId: shipmentId,
    method: 'Invoice',
    status: 'Failed',
  }));
}

function normalizeQuoteInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be an object');
  }
  const { serviceType, senderDetails, collectionDetails, deliveryDetails } = body;
  if (!['economy', 'express'].includes(serviceType)) {
    throw new Error('serviceType must be economy or express');
  }
  const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
  if (
    !isRecord(senderDetails) ||
    !isRecord(collectionDetails) ||
    !isRecord(collectionDetails.address) ||
    !isRecord(deliveryDetails) ||
    !isRecord(deliveryDetails.address)
  ) {
    throw new Error('senderDetails, collectionDetails.address, and deliveryDetails.address are required');
  }
  const requiredFields = [
    [senderDetails.fullName, 'senderDetails.fullName'],
    [senderDetails.mobile, 'senderDetails.mobile'],
    [collectionDetails.address.street, 'collectionDetails.address.street'],
    [collectionDetails.address.city, 'collectionDetails.address.city'],
    [collectionDetails.address.province, 'collectionDetails.address.province'],
    [collectionDetails.address.postalCode, 'collectionDetails.address.postalCode'],
    [deliveryDetails.receiverName, 'deliveryDetails.receiverName'],
    [deliveryDetails.mobile, 'deliveryDetails.mobile'],
    [deliveryDetails.address.street, 'deliveryDetails.address.street'],
    [deliveryDetails.address.city, 'deliveryDetails.address.city'],
    [deliveryDetails.address.province, 'deliveryDetails.address.province'],
    [deliveryDetails.address.postalCode, 'deliveryDetails.address.postalCode'],
  ];
  const missingField = requiredFields.find(([value]) => !String(value || '').trim());
  if (missingField) {
    throw new Error(`${missingField[1]} is required`);
  }
  const parcels = normalizeParcelList(body.parcels);
  const normalizedCollectionDetails = {
    ...collectionDetails,
    numberOfItems: parcels.length,
  };
  const selectedPackaging = Array.isArray(body.packaging)
    ? body.packaging.map(item => ({ id: String(item?.id || '').trim() }))
    : [];
  if (selectedPackaging.some(item => !item.id)) {
    throw new Error('Each packaging selection requires an id');
  }

  return {
    serviceType,
    senderDetails,
    collectionDetails: normalizedCollectionDetails,
    deliveryDetails,
    parcelType: String(body.parcelType || 'parcel'),
    parcels,
    selectedPackaging,
    orderNumber: String(body.orderNumber || '').trim(),
    marketplaceName: String(body.marketplaceName || '').trim(),
  };
}

function makeLegacyShipmentFields(input, shipmentId, eta) {
  return {
    shipmentId,
    barcode: shipmentId,
    trackingNumber: shipmentId,
    customer: input.userId,
    senderDetails: input.senderDetails,
    collectionDetails: input.collectionDetails,
    deliveryDetails: input.deliveryDetails,
    parcelDetails: {
      serviceType: input.serviceType,
      parcelType: input.parcelType,
      dimensions: input.parcels[0],
      packaging: input.pricingBreakdown.packaging,
    },
    pricingSnapshot: input.pricingSnapshot,
    orderNumber: input.orderNumber,
    marketplaceName: input.marketplaceName,
    numberOfBoxes: input.parcels.length,
    parcels: input.parcels,
    bookedBy: input.credentialName,
    integrationCredential: input.credentialId,
    integrationQuoteId: input.quoteId,
    payment: {
      method: 'invoice',
      status: 'pending',
      amount: input.pricingBreakdown.total,
      transactionId: `INV-${input.shipmentId}`,
    },
    pricingBreakdown: {
      baseCost: input.pricingBreakdown.baseCost,
      packagingCost: input.pricingBreakdown.packagingCost,
      interProvinceFee: input.pricingBreakdown.interProvinceFee,
      oversizeBoxCount: input.pricingBreakdown.oversizeBoxCount,
      oversizeFee: input.pricingBreakdown.oversizeFee,
      additionalBoxCount: input.pricingBreakdown.additionalBoxCount,
      additionalBoxFee: input.pricingBreakdown.additionalBoxFee,
      total: input.pricingBreakdown.total,
    },
    senderName: input.senderDetails.fullName || 'N/A',
    senderPhone: input.senderDetails.mobile || '0000000000',
    receiverName: input.deliveryDetails.receiverName || 'N/A',
    receiverPhone: input.deliveryDetails.mobile || '0000000000',
    start: input.collectionDetails.address.city || 'Unknown',
    end: input.deliveryDetails.address.city || 'Unknown',
    parcelWeight: input.parcels.reduce((sum, parcel) => sum + parcel.weight, 0),
    packageType: input.parcelType,
    cost: input.pricingBreakdown.total,
    eta,
    status: 'Awaiting Payment',
  };
}

async function ensureInvoiceTransaction(shipment, userId) {
  const transactionId = `INV-${shipment.shipmentId}`;
  const account = await User.findById(userId).select('companyName fullName email');
  if (!account) {
    throw new Error('Invoice account owner no longer exists');
  }
  const transaction = await Transaction.findOneAndUpdate(
    { txnId: transactionId },
    {
      $setOnInsert: {
        txnId: transactionId,
        customer: account.companyName || account.fullName || account.email,
        userId,
        type: 'Debit',
        orderId: shipment.shipmentId,
        amount: shipment.payment.amount,
        method: 'Invoice',
        status: 'Pending',
      },
    },
    { new: true, upsert: true, runValidators: true }
  );
  return transaction;
}

async function syncInvoiceTransactionAmount(shipment) {
  const result = await Transaction.updateOne(
    { orderId: shipment.shipmentId, method: 'Invoice', status: 'Pending' },
    { $set: { amount: shipment.payment.amount } }
  );
  if (result.matchedCount !== 1) {
    throw new Error('Pending invoice transaction could not be found for shipment');
  }
}

async function syncInvoiceAmountIfPending(shipment) {
  if (shipment.status === 'Awaiting Payment' && shipment.payment?.status === 'pending') {
    await syncInvoiceTransactionAmount(shipment);
  }
}

function presentShipment(shipment) {
  return {
    shipmentId: shipment.shipmentId,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    orderNumber: shipment.orderNumber,
    numberOfBoxes: shipment.numberOfBoxes,
    parcels: shipment.parcels,
    payment: shipment.payment,
    pricingBreakdown: shipment.pricingBreakdown,
    eta: shipment.eta,
    createdAt: shipment.createdAt,
  };
}

exports.createQuote = async (req, res) => {
  try {
    let input;
    try {
      input = normalizeQuoteInput(req.body);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    const pricing = await Pricing.findOne() || new Pricing();
    const pricingSnapshot = typeof pricing.toObject === 'function' ? pricing.toObject() : pricing;
    let pricingBreakdown;
    try {
      pricingBreakdown = calculateShipmentPricing({
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
    } catch (pricingError) {
      return res.status(400).json({ message: pricingError.message });
    }

    const quoteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_LIFETIME_MS);
    await StoreQuote.create({
      quoteId,
      credentialId: req.integrationCredential._id,
      userId: req.integrationCredential.userId,
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
    console.error('Store quote creation failed:', error.message);
    return res.status(500).json({ message: 'Failed to create quote' });
  }
};

exports.createShipmentFromQuote = async (req, res) => {
  const { quoteId } = req.body;
  if (!quoteId) {
    return res.status(400).json({ message: 'quoteId is required' });
  }

  let quote;
  try {
    quote = await StoreQuote.findOne({
      quoteId,
      credentialId: req.integrationCredential._id,
      userId: req.integrationCredential.userId,
    });
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    const existingShipment = await Shipment.findOne({ integrationQuoteId: quote.quoteId });
    if (existingShipment) {
      await ensureInvoiceTransaction(existingShipment, quote.userId);
      await StoreQuote.updateOne({ _id: quote._id }, {
        $set: { status: 'booked', shipmentId: existingShipment.shipmentId },
      });
      return res.status(200).json({ shipment: presentShipment(existingShipment), idempotent: true });
    }

    if (quote.status === 'booked') {
      return res.status(409).json({ message: 'Quote is marked booked but its shipment could not be found' });
    }
    if (quote.status === 'booking') {
      if (quote.bookingStartedAt && Date.now() - quote.bookingStartedAt.getTime() < BOOKING_LOCK_MS) {
        return res.status(409).json({ message: 'Quote booking is already in progress; retry shortly' });
      }
      await StoreQuote.updateOne(
        { _id: quote._id, status: 'booking', bookingStartedAt: quote.bookingStartedAt },
        { $set: { status: 'quoted', bookingStartedAt: null } }
      );
    }
    if (quote.expiresAt <= new Date()) {
      return res.status(409).json({ message: 'Quote has expired; request a new quote' });
    }

    const invoiceAccount = await InvoiceAccount.findOne({
      userId: quote.userId,
      status: 'approved',
    });
    if (!invoiceAccount) {
      return res.status(403).json({ message: 'This customer is not approved for invoice bookings' });
    }

    const bookingStartedAt = new Date();
    const reservation = await StoreQuote.findOneAndUpdate(
      { _id: quote._id, status: 'quoted', expiresAt: { $gt: bookingStartedAt } },
      { $set: { status: 'booking', bookingStartedAt } },
      { new: true }
    );
    if (!reservation) {
      return res.status(409).json({ message: 'Quote is no longer available; retry with a fresh quote' });
    }

    try {
      const shipmentId = await generateShipmentId();
      const eta = new Date();
      eta.setDate(eta.getDate() + (quote.serviceType === 'express' ? 2 : 4));
      const shipment = await Shipment.create(makeLegacyShipmentFields({
        serviceType: quote.serviceType,
        senderDetails: quote.senderDetails,
        collectionDetails: quote.collectionDetails,
        deliveryDetails: quote.deliveryDetails,
        parcelType: quote.parcelType,
        parcels: quote.parcels,
        orderNumber: quote.orderNumber,
        marketplaceName: quote.marketplaceName,
        pricingBreakdown: quote.pricingBreakdown,
        pricingSnapshot: quote.pricingSnapshot,
        shipmentId,
        userId: quote.userId,
        credentialId: quote.credentialId,
        credentialName: req.integrationCredential.name,
        quoteId: quote.quoteId,
      }, shipmentId, eta));

      await ensureInvoiceTransaction(shipment, quote.userId);
      await StoreQuote.updateOne(
        { _id: quote._id, status: 'booking', bookingStartedAt },
        { $set: { status: 'booked', shipmentId } }
      );
      return res.status(201).json({ shipment: presentShipment(shipment), idempotent: false });
    } catch (bookingError) {
      await StoreQuote.updateOne(
        { _id: quote._id, status: 'booking', bookingStartedAt },
        { $set: { status: 'quoted', bookingStartedAt: null } }
      );
      throw bookingError;
    }
  } catch (error) {
    console.error('Store shipment booking failed:', error.message);
    return res.status(500).json({ message: 'Failed to book shipment' });
  }
};

exports.getShipment = async (req, res) => {
  try {
    const shipment = await Shipment.findOne({
      shipmentId: req.params.shipmentId,
      integrationCredential: req.integrationCredential._id,
    });
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    return res.status(200).json({ shipment: presentShipment(shipment) });
  } catch (error) {
    console.error('Store shipment lookup failed:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve shipment' });
  }
};

exports.normalizeQuoteInput = normalizeQuoteInput;

exports.addShipmentParcels = async (req, res) => {
  const rawIdempotencyKey = req.get('idempotency-key');
  if (!rawIdempotencyKey || !/^[a-zA-Z0-9._:-]{8,128}$/.test(rawIdempotencyKey)) {
    return res.status(400).json({ message: 'Idempotency-Key header must contain 8-128 safe characters' });
  }

  let parcels;
  try {
    parcels = normalizeParcelList(req.body?.parcels);
  } catch (validationError) {
    return res.status(400).json({ message: validationError.message });
  }

  try {
    const operationKey = crypto.createHash('sha256').update(rawIdempotencyKey).digest('hex');
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(parcels)).digest('hex');
    const shipmentFilter = {
      shipmentId: req.params.shipmentId,
      integrationCredential: req.integrationCredential._id,
    };
    const shipment = await Shipment.findOne(shipmentFilter);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const priorOperation = shipment.integrationParcelOperations.find(operation => operation.keyHash === operationKey);
    if (priorOperation) {
      if (priorOperation.requestHash !== requestHash) {
        return res.status(409).json({ message: 'Idempotency-Key was already used with a different parcel request' });
      }
      await syncInvoiceAmountIfPending(shipment);
      return res.status(200).json({ shipment: presentShipment(shipment), idempotent: true });
    }
    if (shipment.status !== 'Awaiting Payment' || shipment.payment?.status !== 'pending') {
      return res.status(409).json({ message: 'Boxes can only be added before invoice payment or shipment processing' });
    }
    if (!shipment.pricingSnapshot) {
      return res.status(409).json({ message: 'This shipment has no pricing snapshot and cannot be repriced safely' });
    }

    const updatedParcels = [...shipment.parcels, ...parcels];
    const pricingBreakdown = calculateShipmentPricing({
      parcelDetails: {
        serviceType: shipment.parcelDetails.serviceType,
        parcelType: shipment.parcelDetails.parcelType,
        dimensions: updatedParcels,
      },
      collectionDetails: shipment.collectionDetails,
      deliveryDetails: shipment.deliveryDetails,
      pricing: shipment.pricingSnapshot,
      selectedPackaging: shipment.parcelDetails.packaging.map(item => ({ id: item.id })),
      parcelCount: updatedParcels.length,
    });

    const version = shipment.__v || 0;
    const updatedShipment = await Shipment.findOneAndUpdate(
      {
        ...shipmentFilter,
        __v: version,
        status: 'Awaiting Payment',
        'payment.status': 'pending',
        integrationParcelOperations: {
          $not: { $elemMatch: { keyHash: operationKey } },
        },
      },
      {
        $set: {
          parcels: updatedParcels,
          numberOfBoxes: updatedParcels.length,
          'collectionDetails.numberOfItems': updatedParcels.length,
          'parcelDetails.dimensions': updatedParcels[0],
          pricingBreakdown: {
            baseCost: pricingBreakdown.baseCost,
            packagingCost: pricingBreakdown.packagingCost,
            interProvinceFee: pricingBreakdown.interProvinceFee,
            oversizeBoxCount: pricingBreakdown.oversizeBoxCount,
            oversizeFee: pricingBreakdown.oversizeFee,
            additionalBoxCount: pricingBreakdown.additionalBoxCount,
            additionalBoxFee: pricingBreakdown.additionalBoxFee,
            total: pricingBreakdown.total,
          },
          'payment.amount': pricingBreakdown.total,
          cost: pricingBreakdown.total,
        },
        $push: {
          integrationParcelOperations: {
            keyHash: operationKey,
            requestHash,
          },
        },
        $inc: { __v: 1 },
      },
      { new: true, runValidators: true }
    );

    if (!updatedShipment) {
      const latestShipment = await Shipment.findOne(shipmentFilter);
      const appliedOperation = latestShipment?.integrationParcelOperations.find(operation => operation.keyHash === operationKey);
      if (appliedOperation?.requestHash === requestHash) {
        await syncInvoiceAmountIfPending(latestShipment);
        return res.status(200).json({ shipment: presentShipment(latestShipment), idempotent: true });
      }
      if (appliedOperation) {
        return res.status(409).json({ message: 'Idempotency-Key was already used with a different parcel request' });
      }
      return res.status(409).json({ message: 'Shipment changed concurrently; retry with the same Idempotency-Key' });
    }

    await syncInvoiceTransactionAmount(updatedShipment);
    return res.status(200).json({ shipment: presentShipment(updatedShipment), idempotent: false });
  } catch (error) {
    console.error('Store shipment parcel update failed:', error.message);
    return res.status(500).json({ message: 'Failed to add parcels to shipment' });
  }
};

exports.cancelShipment = async (req, res) => {
  try {
    const filter = {
      shipmentId: req.params.shipmentId,
      integrationCredential: req.integrationCredential._id,
    };
    const shipment = await Shipment.findOne(filter);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    if (shipment.status === 'Cancelled') {
      if (!await failInvoiceTransaction(shipment.shipmentId)) {
        return res.status(409).json({ message: 'Cancelled shipment invoice transaction is not pending' });
      }
      return res.status(200).json({ shipment: presentShipment(shipment), idempotent: true });
    }
    if (shipment.status !== 'Awaiting Payment' || shipment.payment?.status !== 'pending') {
      return res.status(409).json({ message: 'Shipment can only be cancelled before payment or processing' });
    }

    const cancelledShipment = await Shipment.findOneAndUpdate(
      { ...filter, status: 'Awaiting Payment', 'payment.status': 'pending' },
      { $set: { status: 'Cancelled' } },
      { new: true }
    );
    if (!cancelledShipment) {
      return res.status(409).json({ message: 'Shipment changed while cancellation was being processed' });
    }

    if (!await failInvoiceTransaction(shipment.shipmentId)) {
      return res.status(500).json({ message: 'Shipment was cancelled but its invoice transaction could not be updated' });
    }
    return res.status(200).json({ shipment: presentShipment(cancelledShipment), idempotent: false });
  } catch (error) {
    console.error('Store shipment cancellation failed:', error.message);
    return res.status(500).json({ message: 'Failed to cancel shipment' });
  }
};
