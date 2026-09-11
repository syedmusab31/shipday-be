require('dotenv').config();
const mongoose = require('mongoose');
const Shipment = require('./models/Shipment');

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing in backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to', process.env.MONGO_URI);

  const missing = await Shipment.find({ $or: [{ barcode: null }, { barcode: { $exists: false } }, { barcode: '' }] });
  console.log(`Found ${missing.length} shipments without barcode`);

  let updated = 0;
  let skipped = 0;

  for (const s of missing) {
    const barcode = s.shipmentId;
    if (!barcode) { skipped++; continue; }
    const exists = await Shipment.findOne({ barcode });
    if (exists && exists._id.toString() !== s._id.toString()) {
      console.warn(`Skip ${s.shipmentId}: barcode ${barcode} already taken by ${exists.shipmentId}`);
      skipped++;
      continue;
    }
    // Normalize legacy invalid status that blocks validation
    if (s.status === 'Shipping') s.status = 'Driver Assigned';
    if (s.status === 'Assigned') s.status = 'Driver Assigned';
    if (s.status === 'Pending') s.status = 'Order Created';
    s.barcode = barcode;
    try {
      await s.save({ validateBeforeSave: false });
      updated++;
      console.log(`Updated ${s.shipmentId} -> ${barcode} [status:${s.status}]`);
    } catch (e) {
      // Fallback to raw collection update bypassing Mongoose validation
      try {
        await Shipment.collection.updateOne({ _id: s._id }, { $set: { barcode, status: s.status } });
        updated++;
        console.log(`Updated (raw) ${s.shipmentId} -> ${barcode}`);
      } catch (e2) {
        console.error(`Failed ${s.shipmentId}:`, e2.message);
        skipped++;
      }
    }
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
