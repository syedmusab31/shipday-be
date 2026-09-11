require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const EMAIL = 'admin@admin.com';
const PASSWORD = 'Admin@123';
const FULL_NAME = 'Admin';
const ROLE = 'Super Admin';

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  let user = await User.findOne({ email: EMAIL.toLowerCase() });
  if (user) {
    user.password = hashedPassword;
    user.role = ROLE;
    user.fullName = FULL_NAME;
    user.status = 'Active';
    await user.save();
    console.log('Updated existing admin user:', user.email, user.role, user.status);
  } else {
    user = await User.create({
      email: EMAIL.toLowerCase(),
      password: hashedPassword,
      fullName: FULL_NAME,
      role: ROLE,
      status: 'Active',
    });
    console.log('Created admin user:', user.email, user.role, user.status);
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
