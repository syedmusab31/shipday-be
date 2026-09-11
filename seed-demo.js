/**
 * Seed demo data for ShipDay - 50 shipments, all tables, real SA coords
 * Covers: Users (all roles), Drivers (all statuses), Shipments (all statuses + barcode + lat/lng),
 *         Wallet, Transactions, Notifications, Earnings-ready Delivered dates
 * Run: node seed-demo.js
 * Reset: node seed-demo.js --clean
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Driver = require('./models/Driver');
const Shipment = require('./models/Shipment');
const Wallet = require('./models/Wallet');
const Transaction = require('./models/Transaction');
const Notification = require('./models/Notification');

const DEMO_LOCATIONS = [
  { city: 'Johannesburg CBD', suburb: 'Braamfontein', street: '123 Jorissen St', province: 'Gauteng', postalCode: '2001', lat: -26.2041, lng: 28.0473 },
  { city: 'Sandton', suburb: 'Sandton Central', street: '5th St 50', province: 'Gauteng', postalCode: '2196', lat: -26.1072, lng: 28.0567 },
  { city: 'Pretoria', suburb: 'Hatfield', street: '1122 Burnett St', province: 'Gauteng', postalCode: '0083', lat: -25.7479, lng: 28.2293 },
  { city: 'Soweto', suburb: 'Orlando', street: 'Vilakazi St 10', province: 'Gauteng', postalCode: '1804', lat: -26.2676, lng: 27.8657 },
  { city: 'Midrand', suburb: 'Halfway House', street: '16th Rd 100', province: 'Gauteng', postalCode: '1685', lat: -26.0014, lng: 28.1211 },
  { city: 'Roodepoort', suburb: 'Florida', street: 'Gold Reef Rd 20', province: 'Gauteng', postalCode: '1709', lat: -26.1625, lng: 27.8720 },
  { city: 'Centurion', suburb: 'Centurion Central', street: 'Embankment Rd 64', province: 'Gauteng', postalCode: '0157', lat: -25.8603, lng: 28.1867 },
  { city: 'Kempton Park', suburb: 'Kempton Central', street: 'Long St 45', province: 'Gauteng', postalCode: '1619', lat: -26.0968, lng: 28.2330 },
  { city: 'Benoni', suburb: 'Benoni Central', street: 'Tom Jones St 12', province: 'Gauteng', postalCode: '1501', lat: -26.1880, lng: 28.3208 },
  { city: 'Alberton', suburb: 'Alberton North', street: 'Voortrekker Rd 88', province: 'Gauteng', postalCode: '1449', lat: -26.2670, lng: 28.1217 },
  { city: 'Boksburg', suburb: 'Boksburg Lake', street: 'Leeuwpoort St 30', province: 'Gauteng', postalCode: '1459', lat: -26.2112, lng: 28.2593 },
  { city: 'Randburg', suburb: 'Randburg CBD', street: 'Bram Fischer Dr 1', province: 'Gauteng', postalCode: '2194', lat: -26.0943, lng: 28.0068 },
  { city: 'Cape Town', suburb: 'City Centre', street: 'Long St 80', province: 'Western Cape', postalCode: '8001', lat: -33.9249, lng: 18.4241 },
  { city: 'Durban', suburb: 'Central', street: 'West St 100', province: 'KwaZulu-Natal', postalCode: '4001', lat: -29.8587, lng: 31.0218 },
  { city: 'Bloemfontein', suburb: 'Willows', street: 'Zastron St 20', province: 'Free State', postalCode: '9301', lat: -29.0852, lng: 26.1596 },
  { city: 'Port Elizabeth', suburb: 'Central', street: 'Govan Mbeki Ave 100', province: 'Eastern Cape', postalCode: '6001', lat: -33.9608, lng: 25.6022 },
];

const SHIPMENT_STATUSES = [
  'Order Created','Pending Collection','Pending Delivery','Driver Assigned','Picked Up',
  'In Transit','Inter Hub','Arrived at Hub','Out For Delivery','Delivered',
  'Failed Delivery','Failed Collection','Collected','Cancelled','Reschedule',
  'Inter branch Transit','Delivery Failed','Rescheduled','Return to Sender','Returning to hub',
  'Delivery cancelled','At Warehouse','Parcel in Sorting Facility','Out for Delivery','On Hold','Awaiting Payment'
];

const DRIVER_STATUSES = ['pending','approved','rejected','suspended'];

async function ensureUser(email, opts) {
  let u = await User.findOne({ email: email.toLowerCase() });
  if (u) {
    Object.assign(u, opts.update || {});
    if (opts.role) u.role = opts.role;
    await u.save();
    return u;
  }
  // avoid duplicate customerId (e.g. CUST002 already taken by real user)
  let customerId = opts.customerId;
  if (customerId) {
    const clash = await User.findOne({ customerId });
    if (clash) {
      const cnt = await User.countDocuments();
      customerId = `CUST${String(9000 + cnt).padStart(4,'0')}`;
      console.log(`customerId ${opts.customerId} taken, using ${customerId} for ${email}`);
    }
  }
  try {
    u = await User.create({
      email: email.toLowerCase(),
      password: await bcrypt.hash(opts.password, 10),
      fullName: opts.fullName,
      role: opts.role,
      customerId,
      phone: opts.phone || '0820000000',
      companyName: opts.companyName || '',
      status: 'Active',
    });
  } catch (e) {
    if (e.code === 11000 && e.keyPattern?.customerId) {
      const cnt = await User.countDocuments();
      customerId = `CUST${String(9100 + cnt).padStart(4,'0')}`;
      console.log(`Retry with ${customerId} for ${email}`);
      u = await User.create({
        email: email.toLowerCase(),
        password: await bcrypt.hash(opts.password, 10),
        fullName: opts.fullName,
        role: opts.role,
        customerId,
        phone: opts.phone || '0820000000',
        companyName: opts.companyName || '',
        status: 'Active',
      });
    } else throw e;
  }
  return u;
}

async function ensureDriver(email, opts) {
  let d = await Driver.findOne({ email: email.toLowerCase() });
  if (d) {
    if (opts.status) { d.status = opts.status; await d.save(); }
    return d;
  }
  const count = await Driver.countDocuments();
  const driverId = `DRV${String(800 + count).padStart(3, '0')}`;
  d = await Driver.create({
    driverId,
    username: opts.username,
    email: email.toLowerCase(),
    phone: opts.phone,
    password: await bcrypt.hash(opts.password, 10),
    vehicleType: opts.vehicleType || 'van',
    vehicleNumber: opts.vehicleNumber || `DEMO-${Date.now().toString().slice(-5)}-${Math.floor(Math.random()*99)}`,
    idProof: 'demo-seed',
    status: opts.status || 'approved',
  });
  return d;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to', process.env.MONGO_URI);

  const clean = process.argv.includes('--clean');
  if (clean) {
    console.log('Cleaning demo data...');
    await Shipment.deleteMany({ shipmentId: /^SHP9\d{4}$/ });
    await Shipment.deleteMany({ notes: 'DEMO_SEED' });
    await Notification.deleteMany({ title: /DEMO/ });
    await Transaction.deleteMany({ orderId: /^SHP9/ });
    // keep users/drivers wallets - not deleting demo users to preserve login
    console.log('Cleaned shipments/notifications/transactions');
  }

  // 1) Users - all roles (use high 8xx/9xx IDs to avoid colliding with real sequential CUST002 etc.)
  const usersToSeed = [
    { email: 'admin@admin.com', password: 'Admin@123', fullName: 'Super Admin User', role: 'Super Admin', customerId: 'CUST001' },
    { email: 'manager@shipday.co.za', password: 'Manager@123', fullName: 'Manager Demo', role: 'Manager', customerId: 'CUST800' },
    { email: 'customer@shipday.co.za', password: 'Customer@123', fullName: 'Thabo Nkosi', role: 'Customer', customerId: 'CUST900', companyName: 'Demo Retail Hub', phone: '0821112233' },
    { email: 'customer2@shipday.co.za', password: 'Customer@123', fullName: 'Sarah van Wyk', role: 'Customer', customerId: 'CUST901', companyName: 'Cape Traders', phone: '0822223344' },
    { email: 'retail@shipday.co.za', password: 'Retail@123', fullName: 'Retail Hub Demo', role: 'Retail Hub', customerId: 'CUST902' },
  ];
  const customers = [];
  for (const u of usersToSeed) {
    const user = await ensureUser(u.email, u);
    console.log(`User ${user.email} [${user.role}]`);
    if (user.role === 'Customer') customers.push(user);
  }

  // Ensure primary customer wallet with history
  let wallet = await Wallet.findOne({ userId: customers[0]._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: customers[0]._id,
      balance: 7500,
      transactions: [
        { type: 'credit', amount: 5000, description: 'Demo seed top-up Jan' },
        { type: 'credit', amount: 3000, description: 'Demo seed top-up Feb' },
        { type: 'debit', amount: 500, description: 'Shipment SHP91xxx' },
      ]
    });
  } else {
    wallet.balance = 7500;
    await wallet.save();
  }
  console.log('Wallet ready:', wallet.balance);

  // 2) Drivers - all statuses + vehicle types
  const demoDriver = await ensureDriver('admin@admin.com', {
    username: 'Test Driver',
    password: 'Admin@123',
    phone: '0710000001',
    vehicleType: 'van',
    vehicleNumber: 'DEMO-VAN-001',
    status: 'approved',
  });
  console.log('Primary driver (LOGIN):', demoDriver.driverId, demoDriver.email, demoDriver.status);

  const driverSeeds = [
    { email: 'driver.pending@shipday.co.za', username: 'Pending Driver', status: 'pending', vehicleType: 'bike', vehicleNumber: 'DEMO-BIKE-002' },
    { email: 'driver.approved2@shipday.co.za', username: 'Approved Bike', status: 'approved', vehicleType: 'bike', vehicleNumber: 'DEMO-BIKE-003' },
    { email: 'driver.rejected@shipday.co.za', username: 'Rejected Driver', status: 'rejected', vehicleType: 'truck', vehicleNumber: 'DEMO-TRK-004' },
    { email: 'driver.suspended@shipday.co.za', username: 'Suspended Van', status: 'suspended', vehicleType: 'van', vehicleNumber: 'DEMO-VAN-005' },
    { email: 'driver.car@shipday.co.za', username: 'Car Driver', status: 'approved', vehicleType: 'car', vehicleNumber: 'DEMO-CAR-006' },
  ];
  for (const d of driverSeeds) {
    const drv = await ensureDriver(d.email, { ...d, password: 'Driver@123', phone: '0710000002' });
    console.log(`Driver ${drv.email} [${drv.status}/${drv.vehicleType}]`);
  }

  // 3) Shipments - 50 with real coords, all statuses, earnings-ready
  // First 26 cover every shipment status once, remaining 24 weighted for tabs/earnings/maps
  const extraStatuses = ['Delivered','Delivered','Delivered','Pending Delivery','Pending Delivery','Pending Collection','Pending Collection','Out For Delivery','Out For Delivery','In Transit','Failed Delivery','Failed Collection'];
  const paymentMethods = ['cod','payfast','ewallet','gateway','fulfillment'];
  let created = 0, patched = 0, skipped = 0;
  const now = Date.now();

  for (let i = 0; i < 50; i++) {
    const loc = DEMO_LOCATIONS[i % DEMO_LOCATIONS.length];
    // jitter 0.005 deg ~ 500m to avoid stacking pins
    const jitterLat = loc.lat + (Math.random() - 0.5) * 0.01;
    const jitterLng = loc.lng + (Math.random() - 0.5) * 0.01;
    const shipmentId = `SHP9${String(1000 + i).padStart(4, '0')}`; // SHP91000..SHP91049
    const status = i < SHIPMENT_STATUSES.length ? SHIPMENT_STATUSES[i] : extraStatuses[(i - SHIPMENT_STATUSES.length) % extraStatuses.length];
    const isDelivered = status === 'Delivered';
    const isUnassigned = i >= 45; // last 5 claimable via scan/barcode
    const exists = await Shipment.findOne({ shipmentId });
    if (exists) {
      let touched = false;
      if (!exists.barcode) { exists.barcode = shipmentId; touched = true; }
      if (!exists.deliveryDetails?.address?.latitude || Math.abs(exists.latitude) < 0.01) {
        exists.deliveryDetails = exists.deliveryDetails || {};
        exists.deliveryDetails.address = exists.deliveryDetails.address || {};
        exists.deliveryDetails.address.latitude = jitterLat;
        exists.deliveryDetails.address.longitude = jitterLng;
        exists.deliveryDetails.address.city = loc.city;
        exists.deliveryDetails.address.street = loc.street;
        exists.deliveryDetails.address.suburb = loc.suburb;
        exists.deliveryDetails.address.province = loc.province;
        exists.deliveryDetails.address.postalCode = loc.postalCode;
        exists.latitude = jitterLat;
        exists.longitude = jitterLng;
        exists.barcode = exists.barcode || shipmentId;
        touched = true;
      }
      if (status !== exists.status) {
        // keep original status for idempotency, but patch a few to ensure coverage
        // don't overwrite if already set
      }
      if (touched) { await exists.save(); patched++; }
      else skipped++;
      continue;
    }

    // Spread delivered dates across last 30 days for earnings charts
    let deliveredAt = undefined;
    let dateShipped = new Date(now - Math.floor(Math.random() * 30) * 86400000);
    if (isDelivered) {
      // last 0-14 days, with 4 today, 6 this week, rest older
      const daysAgo = i < 4 ? 0 : i < 10 ? Math.floor(Math.random()*7) : Math.floor(Math.random()*30);
      deliveredAt = new Date(now - daysAgo * 86400000 - Math.floor(Math.random()*86400000));
      dateShipped = new Date(deliveredAt.getTime() - 86400000);
    }

    const cust = customers[i % customers.length];
    const s = new Shipment({
      shipmentId,
      barcode: shipmentId,
      customer: cust._id,
      senderDetails: {
        fullName: 'ShipDay Warehouse',
        company: 'ShipDay HQ',
        email: 'warehouse@shipday.co.za',
        mobile: '0111000000',
        address: { street: '10 Commerce Rd', suburb: 'Isando', city: 'Johannesburg', province: 'Gauteng', postalCode: '1600', latitude: -26.1367, longitude: 28.1511 },
      },
      collectionDetails: {
        dispatcherName: 'ShipDay Warehouse',
        company: 'ShipDay HQ',
        mobile: '0111000000',
        address: { street: '10 Commerce Rd', suburb: 'Isando', city: 'Johannesburg', province: 'Gauteng', postalCode: '1600', latitude: -26.1367, longitude: 28.1511 },
      },
      deliveryDetails: {
        receiverName: `Customer ${i + 1}`,
        company: `Receiver Co ${i + 1}`,
        mobile: `082000${String(10 + i).padStart(4,'0')}`,
        email: `receiver${i + 1}@example.com`,
        address: {
          street: loc.street,
          suburb: loc.suburb,
          city: loc.city,
          province: loc.province,
          postalCode: loc.postalCode,
          latitude: jitterLat,
          longitude: jitterLng,
        },
      },
      parcelDetails: {
        serviceType: i % 2 === 0 ? 'express' : 'economy',
        parcelType: ['parcel','document','satchel'][i % 3],
        dimensions: { length: 30 + (i % 10), width: 20 + (i % 8), height: 15 + (i % 6), weight: 1 + (i % 5) + 0.5 },
        specialInstructions: i % 7 === 0 ? 'Handle with care - fragile' : 'Leave at reception',
      },
      payment: { method: paymentMethods[i % paymentMethods.length], status: isDelivered ? 'paid' : (i % 3 === 0 ? 'paid' : 'pending'), amount: 120 + i * 18 + (i % 7)*10 },
      orderNumber: `ORD-DEMO-${1000 + i}`,
      marketplaceName: ['Takealot','Amazon','Demo Hub','Shopify'][i % 4],
      numberOfBoxes: 1 + (i % 3),
      senderName: 'ShipDay Warehouse',
      senderPhone: '0111000000',
      receiverName: `Customer ${i + 1}`,
      receiverPhone: `082000${String(10 + i).padStart(4,'0')}`,
      start: 'Johannesburg',
      end: loc.city,
      parcelWeight: 1 + (i % 5),
      packageType: 'parcel',
      cost: 120 + i * 18,
      notes: 'DEMO_SEED',
      status,
      driver: isUnassigned ? null : demoDriver._id,
      driverName: isUnassigned ? 'Unassigned' : demoDriver.username,
      latitude: jitterLat,
      longitude: jitterLng,
      trackingNumber: shipmentId,
      dateShipped,
      deliveredAt,
      podCompleted: isDelivered && i % 2 === 0,
      podMethod: isDelivered && i % 2 === 0 ? 'signature' : undefined,
    });

    await s.save();
    created++;

    const method = s.payment.method.toUpperCase() === 'COD' ? 'COD' : s.payment.method === 'payfast' ? 'PayFast' : s.payment.method === 'ewallet' ? 'Wallet' : 'Card';
    await Transaction.create({
      txnId: `TXN-DEMO-${1000 + i}-${Date.now().toString().slice(-3)}`,
      customer: `Customer ${i + 1}`,
      userId: cust._id,
      type: 'Debit',
      amount: s.cost,
      method,
      status: s.payment.status === 'paid' ? 'Completed' : (i % 4 === 0 ? 'Failed' : 'Pending'),
      orderId: shipmentId,
    });

    if (!isUnassigned) {
      const notifTypes = ['shipment_assigned','status_update','order'];
      await Notification.create({
        userId: demoDriver._id,
        title: i % 5 === 0 ? 'DEMO Status Update' : 'DEMO Shipment Assigned',
        message: `Shipment ${shipmentId} → ${loc.city} [${status}] DEMO parcel ${i + 1}`,
        type: notifTypes[i % 3],
      });
    }
  }
  console.log(`Shipments — created: ${created}, patched: ${patched}, skipped: ${skipped} (total 50)`);
  const counts = await Shipment.aggregate([{ $match: { notes: 'DEMO_SEED' } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log('Demo status coverage:', counts.map(c => `${c._id}:${c.count}`).join(', '));
  console.log('\n=== Demo data ready (50) ===');
  console.log('Login driver: admin@admin.com / Admin@123  (approved, van)');
  console.log('Other drivers: driver.pending@... / pending, driver.rejected@... / rejected etc — test status filters');
  console.log('Earnings: Delivered shipments with deliveredAt spread 0-30 days → weekly/monthly charts populated');
  console.log('Map: 45 assigned (real lat/lng jittered Gauteng) + 5 unassigned SHP91045-49 for scan/claim test');
  console.log('Live navigation test: /live-navigation?shipmentId=SHP91003 (has coords)');
  console.log('Barcode scan test: scan SHP91045 (unassigned) with driver app → should link');

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
