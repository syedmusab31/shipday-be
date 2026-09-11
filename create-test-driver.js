require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Driver = require('./models/Driver');

const EMAIL = 'admin@admin.com';
const PASSWORD = 'Admin@123';
const PHONE = '0710000001';
const VEHICLE_NUMBER = 'TEST-DRV-001';

async function generateDriverId() {
  let counter = 1;
  while (true) {
    const driverId = `DRV${String(counter).padStart(3, '0')}`;
    const existing = await Driver.findOne({ driverId });
    if (!existing) return driverId;
    counter += 1;
  }
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in frontend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  let driver = await Driver.findOne({ email: EMAIL });
  if (driver) {
    driver.password = hashedPassword;
    driver.phone = PHONE;
    driver.status = 'approved';
    await driver.save();
    console.log('Updated existing driver:', driver.driverId, driver.email, driver.status);
  } else {
    const driverId = await generateDriverId();
    driver = await Driver.create({
      driverId,
      username: 'Test Driver',
      email: EMAIL,
      phone: PHONE,
      password: hashedPassword,
      vehicleType: 'car',
      vehicleNumber: VEHICLE_NUMBER,
      idProof: 'Terminal-Created',
      status: 'approved',
    });
    console.log('Created driver:', driver.driverId, driver.email, driver.status);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
