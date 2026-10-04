// controllers/paymentController.js
const Notification = require('../models/Notification');

const Stripe = require('stripe');
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;

if (!stripe) {
  console.warn('⚠️ STRIPE_SECRET_KEY is missing. Stripe payments will not work.');
}
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { refreshCustomerActivation } = require('../services/marketingActivationService');

exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, userId } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Amount is required and must be a number' });
    }

    const customer = await stripe.customers.create();

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2022-11-15' } // or latest Stripe version you're using
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe expects amount in paise (INR)
      currency: 'inr',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
    });

    console.log("🔁 Stripe Payment Init:", {
      customerId: customer.id,
      clientSecret: paymentIntent.client_secret,
      ephemeralKeySecret: ephemeralKey.secret,
    });
    await Notification.create({
      userId: userId || null,
      title: 'Payment Successful',
      message: `Your payment of ₹${amount} has been processed successfully.`,
      type: 'transactiom', // spelling fixed from 'transactiom'
    });

    res.status(200).json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error('Stripe Payment Error:', err);
    res.status(500).json({ error: 'Payment intent creation failed' });
  }
};

const { generatePaymentData, pfValidSignature } = require('../utils/payfast');

exports.initiatePayFastPayment = async (req, res) => {
  try {
    const { shipmentId } = req.body;

    if (!shipmentId) {
      return res.status(400).json({ message: 'Shipment ID is required' });
    }

    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const paymentInfo = generatePaymentData(shipment);

    // Construct Query String for GET redirect
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(paymentInfo.data)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    }

    const redirectUrl = `${paymentInfo.url}?${queryParams.toString()}`;

    res.status(200).json({
      redirectUrl,
      paymentData: paymentInfo.data // Sending data just in case frontend wants to use form POST later
    });

  } catch (error) {
    console.error('PayFast Init Error:', error);
    res.status(500).json({ message: 'Failed to initiate PayFast payment', error: error.message });
  }
};

exports.initiateWalletTopup = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ message: 'User ID and Amount are required' });
    }

    const user = await User.findById(userId);

    // Mocking shipment for PayFast generator
    const mockShipment = {
      shipmentId: `TOPUP-${userId}-${Date.now()}`,
      senderDetails: {
        fullName: user?.fullName || 'User',
        email: user?.email || 'user@example.com'
      },
      payment: { amount: parseFloat(amount) },
      parcelDetails: { serviceType: 'Wallet Top-up' }
    };

    const paymentInfo = generatePaymentData(mockShipment);

    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(paymentInfo.data)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    }

    res.status(200).json({
      redirectUrl: `${paymentInfo.url}?${queryParams.toString()}`
    });

  } catch (error) {
    console.error('Top-up Init Error:', error);
    res.status(500).json({ message: 'Failed to initiate top-up', error: error.message });
  }
};

exports.handlePayFastNotify = async (req, res) => {
  try {
    const pfData = req.body;


    const checkSignature = pfValidSignature(pfData, process.env.PAYFAST_PASSPHRASE);
    if (pfData.signature !== checkSignature) {
      console.error("❌ Invalid PayFast Signature");
      return res.status(400).send('Invalid Signature');
    }

    const mPaymentId = pfData.m_payment_id;
    const paymentStatus = pfData.payment_status;
    const amountGross = parseFloat(pfData.amount_gross);

    if (paymentStatus === 'COMPLETE') {
      if (mPaymentId.startsWith('TOPUP-')) {
        // WALLET TOPUP FLOW
        const parts = mPaymentId.split('-');
        const userId = parts[1];

        const existingTopUp = await Transaction.findOne({ txnId: pfData.pf_payment_id });
        if (existingTopUp) return res.status(200).send('OK');

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
          wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }

        wallet.balance += amountGross;
        wallet.transactions.push({
          type: 'credit',
          amount: amountGross,
          description: `Wallet Deposit via PayFast (Ref: ${pfData.pf_payment_id})`,
          date: new Date()
        });
        await wallet.save();

        await Transaction.create({
          txnId: pfData.pf_payment_id,
          customer: pfData.name_first + ' ' + pfData.name_last,
          userId: userId, // Link to user account
          type: 'Credit',
          orderId: mPaymentId,
          amount: amountGross,
          method: 'PayFast',
          status: 'Completed'
        });

        await Notification.create({
          userId: userId,
          title: 'Wallet Recharged',
          message: `R${amountGross} has been successfully credited to your wallet.`,
          type: 'transaction'
        });
        await refreshCustomerActivation(userId);

      } else {
        // SHIPMENT PAYMENT FLOW
        const shipment = await Shipment.findOne({ shipmentId: mPaymentId });
        if (shipment) {
          shipment.payment.status = 'paid';
          shipment.payment.transactionId = pfData.pf_payment_id;
          shipment.payment.amount = amountGross;
          await shipment.save();

          // Try to find the user by email to get their ObjectId for the notification
          const user = await User.findOne({ email: shipment.senderDetails.email });

          await Notification.create({
            userId: user ? user._id : null,
            title: 'Payment Received',
            message: `Payment of R${amountGross} received for Shipment ${mPaymentId}`,
            type: 'transaction'
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('PayFast Notify Error:', err);
    res.status(500).send('Server Error');
  }
};

// Helper to manually trigger notify logic for sandbox/local testing
exports.confirmSandboxPayment = async (req, res) => {
  try {
    const { mPaymentId, amount } = req.body;
    const numAmount = parseFloat(amount);
    const mongoose = require('mongoose');

    // Safety check - ONLY allow in sandbox mode
    const mode = (process.env.PAYFAST_MODE || 'sandbox').trim().toLowerCase();
    if (mode !== 'sandbox') {
      return res.status(403).json({ message: 'Manual confirmation only allowed in sandbox mode' });
    }



    // Check if already processed to prevent double-charging in Sandbox
    const existingTransaction = await Transaction.findOne({ orderId: mPaymentId, status: 'Completed' });
    if (existingTransaction) {

      return res.status(200).json({ message: 'Sandbox payment already synchronized' });
    }

    // Reuse notify logic but with deterministic pfData for idempotent sandbox sync
    const mockPfData = {
      m_payment_id: mPaymentId,
      payment_status: 'COMPLETE',
      amount_gross: amount,
      pf_payment_id: `MOCK-${mPaymentId}`, // Deterministic ID prevents duplicates via DB unique index
      name_first: 'Sandbox',
      name_last: 'Tester'
    };

    if (mPaymentId.startsWith('TOPUP-')) {
      const parts = mPaymentId.split('-');
      const userIdStr = parts[1];

      if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
        console.error('❌ Invalid User ID structure in mPaymentId:', userIdStr);
        return res.status(400).json({ message: 'Invalid User ID structure' });
      }

      const userId = new mongoose.Types.ObjectId(userIdStr);

      // Use findOneAndUpdate with $inc and $push for atomic safety
      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: numAmount },
          $push: {
            transactions: {
              type: 'credit',
              amount: numAmount,
              description: `Wallet Deposit (Auto-Sync Sandbox)`,
              date: new Date()
            }
          }
        },
        { new: true, upsert: true }
      );

      await Transaction.create({
        txnId: mockPfData.pf_payment_id,
        customer: 'Sandbox Tester',
        userId,
        type: 'Credit',
        orderId: mPaymentId,
        amount: numAmount,
        method: 'PayFast',
        status: 'Completed'
      });

      await refreshCustomerActivation(userId);

      await Notification.create({
        userId: userId,
        title: 'Wallet Recharged (Sandbox)',
        message: `R${numAmount} has been credited via sandbox auto-sync.`,
        type: 'transaction'
      });
    } else {
      const shipment = await Shipment.findOne({ shipmentId: mPaymentId });
      if (shipment) {
        shipment.payment.status = 'paid';
        shipment.payment.transactionId = mockPfData.pf_payment_id;
        shipment.payment.amount = parseFloat(amount);
        await shipment.save();

        const user = await User.findOne({ email: shipment.senderDetails.email });
        await Notification.create({
          userId: user ? user._id : null,
          title: 'Payment Received (Sandbox)',
          message: `Payment of R${amount} confirmed via sandbox auto-sync.`,
          type: 'transaction'
        });

        await Transaction.create({
          txnId: mockPfData.pf_payment_id,
          customer: shipment.senderDetails.fullName || 'Sandbox Tester',
          type: 'Debit',
          orderId: mPaymentId,
          amount: parseFloat(amount),
          method: 'PayFast',
          status: 'Completed'
        });
      }
    }

    res.status(200).json({ message: 'Sandbox payment synchronized successfully' });
  } catch (err) {
    console.error('❌ Sandbox Confirm Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.payWithWallet = async (req, res) => {
  try {
    const { shipmentId, userId } = req.body;

    if (!shipmentId || !userId) {
      return res.status(400).json({ message: 'Shipment ID and User ID are required' });
    }

    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    if (shipment.payment.status === 'paid') {
      return res.status(400).json({ message: 'This shipment is already paid' });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    const amount = shipment.payment.amount;

    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Atomic update to prevent race conditions
    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: -amount },
        $push: {
          transactions: {
            type: 'debit',
            amount,
            description: `Payment for Shipment ${shipment.shipmentId}`,
            date: new Date()
          }
        }
      },
      { new: true }
    );

    shipment.payment.status = 'paid';
    shipment.payment.method = 'ewallet';
    shipment.payment.transactionId = `WLT-${Date.now()}`;
    await shipment.save();

    const newTransaction = new Transaction({
      txnId: shipment.payment.transactionId,
      customer: shipment.senderDetails.fullName,
      userId: userId, // Link to user account
      type: 'Debit',
      orderId: shipment.shipmentId,
      amount: amount,
      method: 'Wallet',
      status: 'Completed'
    });
    await newTransaction.save();

    // Push notification/record - non-blocking
    Notification.create({
      userId: userId,
      title: 'Payment Successful',
      message: `Your payment of R${amount} for Shipment ${shipment.shipmentId} has been deducted from your wallet.`,
      type: 'transaction'
    }).catch(e => console.error("Async Notify Error:", e));

    res.status(200).json({
      message: 'Payment successful',
      transactionId: shipment.payment.transactionId,
      newBalance: updatedWallet.balance
    });

  } catch (error) {
    console.error('Wallet Payment Error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
