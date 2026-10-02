const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const sendMail = require("../utils/mail");
const Token = require('../models/Token');
const Wallet = require('../models/Wallet');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Password strength regex
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

//  Email validator
const validateEmail = (email) => {
  const sanitized = String(email).toLowerCase().trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(sanitized) ? sanitized : null;
};

//  Customer ID validator
const validateCustomerId = (id) => {
  return /^CUST\d{3,}$/.test(id) ? id : null;
};

// Generate and send verification code
const sendVerificationCode = async (email) => {
  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

  await VerificationCode.findOneAndUpdate(
    { email },
    { code, expiresAt },
    { upsert: true, new: true }
  );

  const text = `Your verification code is: ${code}. It will expire in 15 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
      <h2 style="color: #0f172a; text-align: center;">Verification Code</h2>
      <p style="font-size: 16px; color: #4b5563;">Hello,</p>
      <p style="font-size: 16px; color: #4b5563;">Your verification code is:</p>
      <div style="font-size: 32px; font-weight: bold; color: #fabb05; text-align: center; padding: 20px; margin: 20px 0; background: #f8fafc; border-radius: 8px; letter-spacing: 5px;">
        ${code}
      </div>
      <p style="font-size: 14px; color: #9ca3af; text-align: center;">This code will expire in 15 minutes.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">If you didn't request this code, please ignore this email.</p>
    </div>
  `;

  await sendMail(email, "Your Verification Code - ShipDay", text, html);
};

// Helper to create notification
const createNotification = async (userId, title, message, type) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      type,
    });
    await notification.save();
  } catch (err) {
    console.error("Notification creation failed:", err);
  }
};

// Generate unique customerId
const generateCustomerId = async () => {
  const lastUser = await User.findOne({ customerId: /^CUST/ })
    .sort({ customerId: -1 })
    .collation({ locale: "en_US", numericOrdering: true });

  let nextNumber = 1;
  if (lastUser && lastUser.customerId) {
    const match = lastUser.customerId.match(/^CUST(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const padded = String(nextNumber).padStart(3, '0');
  return `CUST${padded}`;
};

// Generate unique Admin ID
const generateAdminId = async () => {
  const count = await User.countDocuments({ customerId: /^ADMIN/ });
  const nextNumber = count + 1; // e.g. if 1 exists (ADMIN001), next is 2
  const padded = String(nextNumber).padStart(3, '0');
  return `ADMIN${padded}`;
};

// Request verification code
const requestVerificationCode = async (req, res) => {
  const { email, source } = req.body;
  const sanitizedEmail = validateEmail(email);
  if (!sanitizedEmail) return res.status(400).json({ message: 'Valid email is required' });

  try {
    const userExists = await User.findOne({ email: sanitizedEmail });

    if (source === 'register' && userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    if (source === 'forgot' && !userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    await sendVerificationCode(sanitizedEmail);
    res.status(200).json({ message: 'Verification code sent' });
  } catch (err) {
    console.error('Email error:', err.message);

    // Check for development fallback
    if (err.message && err.message.startsWith('SMTP_FAIL_FALLBACK_OK')) {
      const code = err.message.split(':')[1];
      return res.status(200).json({
        message: 'Email service delayed. Code logged to console (DEV MODE).',
        dev_code: code // For easier testing in dev tools
      });
    }

    res.status(500).json({ message: 'Failed to send verification code. SMTP connect timed out.' });
  }
};

// Verify code
const verifyCode = async (req, res) => {
  const { email, code } = req.body;
  const sanitizedEmail = validateEmail(email);
  if (!sanitizedEmail || !code)
    return res.status(400).json({ message: 'Valid email and code are required' });

  try {
    const record = await VerificationCode.findOne({ email: sanitizedEmail });
    if (!record)
      return res.status(400).json({ message: 'Verification code not found' });

    if (record.expiresAt < new Date()) {
      await VerificationCode.deleteOne({ email: sanitizedEmail });
      return res.status(400).json({ message: 'Verification code expired' });
    }

    if (record.code !== code.toUpperCase())
      return res.status(400).json({ message: 'Invalid verification code' });

    await VerificationCode.deleteOne({ email: sanitizedEmail });
    res.status(200).json({ message: 'Verification successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register user
const registerUser = async (req, res) => {
  const { email, password, code } = req.body;
  const sanitizedEmail = validateEmail(email);

  if (!sanitizedEmail || !password || !code)
    return res.status(400).json({ message: 'Valid email, password, and code are required' });

  if (!strongPasswordRegex.test(password)) {
    return res.status(400).json({
      message:
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    });
  }

  try {
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser)
      return res.status(400).json({ message: 'User already exists' });

    const record = await VerificationCode.findOne({ email: sanitizedEmail });
    if (!record)
      return res.status(400).json({ message: 'Verification code not found' });

    if (record.expiresAt < new Date()) {
      await VerificationCode.deleteOne({ email: sanitizedEmail });
      return res.status(400).json({ message: 'Verification code expired' });
    }

    if (record.code !== code.toUpperCase()) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const customerId = await generateCustomerId();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email: sanitizedEmail,
      password: hashedPassword,
      customerId,
    });

    await user.save();

    // Now delete the verification code since the save was successful
    await VerificationCode.deleteOne({ email: sanitizedEmail });

    await createNotification(
      user._id,
      "Welcome to SwiftShip",
      `Your account (${sanitizedEmail}) has been successfully registered.`,
      "registration"
    );

    // Send notification to support (Wrap in try/catch to prevent failing the entire registration)
    try {
      await sendMail(
        "support@shipday.co.za",
        "New User Registration",
        `A new user has registered with email: ${sanitizedEmail}`
      );
    } catch (mailError) {
      console.error("Failed to send admin notification email:", mailError.message);
    }

    // Auto-login functionality
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || 'Customer' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const tokenDoc = await Token.create({ userId: user._id, token });
    tokenDoc.expiresAt = new Date(tokenDoc.createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    await tokenDoc.save();

    res.status(201).json({
      message: 'User registered successfully',
      customerId,
      token,
      user: { email: user.email, customerId: user.customerId, role: user.role || 'Customer' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const sanitizedEmail = validateEmail(email);

  if (!sanitizedEmail || !password)
    return res.status(400).json({ message: 'Valid email and password are required' });

  try {
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role || 'Customer' }, process.env.JWT_SECRET, { expiresIn: '2h' });

    // create Token document
    const tokenDoc = await Token.create({ userId: user._id, token });

    //  Set expiresAt relative to createdAt
    tokenDoc.expiresAt = new Date(tokenDoc.createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    await tokenDoc.save();



    res.status(200).json({
      message: 'Login successful',
      token,
      user: { email: user.email, customerId: user.customerId },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login error' });
  }
};

//  Logout user
const logoutUser = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  try {
    await Token.deleteOne({ token });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

//  Reset password
const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  const sanitizedEmail = validateEmail(email);

  if (!sanitizedEmail || !newPassword) {
    return res.status(400).json({ message: 'Valid email and new password are required' });
  }

  if (!strongPasswordRegex.test(newPassword)) {
    return res.status(400).json({
      message:
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    });
  }

  try {
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await Token.deleteMany({ userId: user._id });

    await createNotification(
      user._id,
      "Password Reset",
      `Your account password has been successfully reset.`,
      "forgot-password"
    );

    res.status(200).json({ message: 'Password reset successful. Please log in again.' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

//  Update user profile
const updateUserProfile = async (req, res) => {
  const { email, fullName, nickName, dob, phone, gender, image } = req.body;
  const sanitizedEmail = validateEmail(email);

  if (!sanitizedEmail) return res.status(400).json({ message: 'Valid email is required' });

  try {
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.fullName = fullName || user.fullName;
    user.nickName = nickName || user.nickName;
    user.dob = dob || user.dob;
    user.phone = phone || user.phone;
    user.gender = gender || user.gender;
    user.image = image || user.image;

    await user.save();
    await createNotification(
      user._id,
      "profile update",
      `Your account (${sanitizedEmail}) has been successfully updated.`,
      "registration"
    );
    res.status(200).json({ message: 'Profile updated', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// Save user location
const saveUserLocation = async (req, res) => {
  const { place } = req.body;
  if (!place) return res.status(400).json({ message: 'Place is required' });

  try {
    const user = await User.findOne().sort({ createdAt: -1 });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resGeo = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`
    );
    const data = await resGeo.json();

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No location found for the given place' });
    }

    const { lat, lon, display_name } = data[0];
    user.location = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      address: display_name || place,
    };

    await user.save();

    res.status(200).json({
      message: 'Location saved successfully',
      user: user.email,
      location: user.location,
    });
  } catch (err) {
    console.error('Save location error:', err);
    res.status(500).json({ message: 'Server error while saving location' });
  }
};

//  Get user by email
const getUserByEmail = async (req, res) => {
  const sanitizedEmail = validateEmail(req.query.email);
  if (!sanitizedEmail) return res.status(400).json({ message: 'Valid email is required' });

  try {
    const user = await User.findOne({ email: sanitizedEmail }).select('-password -__v');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Server error while fetching user' });
  }
};

//  Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const users = await User.find().select('customerId fullName email phone companyName status location address role idNumber accountOwnerIdNumber businessRegistrationNumber');
    const orders = await Order.find();
    const wallets = await Wallet.find();
    const requesterRole = (req.user?.role || '').toLowerCase().replace(/\s/g, '');
    const canSearchIdentity = requesterRole === 'admin' || requesterRole === 'superadmin';

    const enrichedUsers = users.map((user) => {
      const userOrders = orders.filter(
        (order) =>
          order.senderEmail === user.email || order.senderPhone === user.phone
      );

      const userWallet = wallets.find(w => w.userId && w.userId.toString() === user._id.toString());

      const customer = {
        id: user._id,
        customerId: user.customerId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        company: user.companyName || '',
        status: user.status || 'Active',
        location: user.location || {},
        address: user.address || {},
        role: user.role || 'Customer',
        totalOrders: userOrders.length,
        walletBalance: userWallet ? userWallet.balance : 0
      };

      if (canSearchIdentity) {
        customer.identityNumber = user.idNumber || user.accountOwnerIdNumber || '';
        customer.businessRegistrationNumber = user.businessRegistrationNumber || '';
      }

      return customer;
    });

    res.status(200).json({ customers: enrichedUsers });
  } catch (error) {
    console.error("Error fetching customers", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get User by ID
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select('-password -__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

//  Get single customer by ID
const getCustomerById = async (req, res) => {
  const id = validateCustomerId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid customer ID format" });

  try {
    const user = await User.findOne({ customerId: id });

    if (!user) return res.status(404).json({ message: "User not found" });

    const userOrders = await Order.find({ senderEmail: user.email });

    res.json({
      id: user.customerId,
      name: user.fullName,
      email: user.email,
      contact: user.phone,
      address: user.location?.address,
      orders: userOrders.map(order => ({
        orderId: order.orderId,
        date: order.createdAt,
        amount: order.totalAmount,
        status: order.status
      }))
    });
  } catch (err) {
    console.error("Get customer by ID error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Google Login
const googleLogin = async (req, res) => {
  const { email, fullName, image } = req.body;
  const sanitizedEmail = validateEmail(email);
  if (!sanitizedEmail) return res.status(400).json({ message: "Valid email is required" });

  try {
    let user = await User.findOne({ email: sanitizedEmail });

    const base64Image = await convertImageToBase64(image);

    if (!user) {
      const customerId = await generateCustomerId();
      user = new User({
        email: sanitizedEmail,
        fullName,
        image: base64Image,
        customerId,
        password: await bcrypt.hash(Math.random().toString(36), 10),
      });
      await user.save();
    } else {
      if (!user.image || !user.image.startsWith("data:image")) {
        user.image = base64Image;
        await user.save();
      }
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || 'Customer' },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    //  create Token with expiresAt relative to createdAt
    const tokenDoc = await Token.create({ userId: user._id, token });
    tokenDoc.expiresAt = new Date(tokenDoc.createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    await tokenDoc.save();

    res.status(200).json({
      message: "Google login successful",
      token,
      user: {
        email: user.email,
        fullName: user.fullName,
        customerId: user.customerId,
        image: user.image,
      },
    });
  } catch (err) {
    console.error("Google login error:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ message: "Google login failed", error: err.message });
  }
};

// 🔧 Helper to convert image to Base64
const convertImageToBase64 = async (url) => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("Failed to convert image:", err);
    return null;
  }
};

// Create Admin/Staff User (Super Admin only)
const createAdminUser = async (req, res) => {
  const { email, password, fullName, role } = req.body;
  const sanitizedEmail = validateEmail(email);

  if (!sanitizedEmail || !password || !fullName)
    return res.status(400).json({ message: 'Valid email, password, and name are required' });

  if (!['Admin', 'Manager', 'Admin Staff'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role for admin creation' });
  }

  try {
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser)
      return res.status(400).json({ message: 'User already exists' });

    const customerId = await generateAdminId();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create direct user with Role
    const user = new User({
      email: sanitizedEmail,
      password: hashedPassword,
      fullName: fullName,
      customerId,
      role: role // Explicitly set role
    });

    await user.save();

    res.status(201).json({ message: `${role} created successfully`, userId: user._id });
  } catch (err) {
    console.error('Create Admin Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete User (Super Admin only)
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "User not found" });

    // Optional: Clean up related data like Wallet, Tokens, etc.
    await Token.deleteMany({ userId: id });
    await Wallet.deleteOne({ userId: id });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update User (Super Admin only)
const updateUserByAdmin = async (req, res) => {
  const { id } = req.params;
  const { fullName, email, role, password } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (role) user.role = role;

    if (password && password.trim() !== "") {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//  Export all
module.exports = {
  requestVerificationCode,
  verifyCode,
  registerUser,
  createAdminUser,
  deleteUser,
  updateUserByAdmin, // Exported
  loginUser,
  logoutUser,
  resetPassword,
  updateUserProfile,
  saveUserLocation,
  getUserByEmail,
  getAllCustomers,
  getCustomerById, // Existing function
  getUserById, // New function by _id
  googleLogin,
  createNotification,
};