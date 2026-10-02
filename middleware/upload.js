const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directories if they don't exist
const uploadDir = 'uploads/id-proofs';
const driverImageDir = 'uploads/driver-images';
const walletSupportDir = 'uploads/wallet-supporting-documents';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(driverImageDir)) {
  fs.mkdirSync(driverImageDir, { recursive: true });
}

if (!fs.existsSync(walletSupportDir)) {
  fs.mkdirSync(walletSupportDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'driverImage') {
      cb(null, driverImageDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    if (file.fieldname === 'driverImage') {
      cb(null, 'driver-image-' + uniqueSuffix + path.extname(file.originalname));
    } else {
      cb(null, 'id-proof-' + uniqueSuffix + path.extname(file.originalname));
    }
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const walletSupportFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  const isAllowed = allowedMimeTypes.some(type => file.mimetype.startsWith(type));
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Only image, PDF, Word, Excel, and text files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const walletSupportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, walletSupportDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'wallet-support-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const walletSupportUpload = multer({
  storage: walletSupportStorage,
  fileFilter: walletSupportFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for supporting documents
  }
});

// Upload configuration for driver registration (multiple fields)
const driverRegistrationUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
}).fields([
  { name: 'driverImage', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]);

// POD upload config
const podStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/pod';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pod-' + file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const podUpload = multer({
  storage: podStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for POD files
  }
});

module.exports = { upload, podUpload, driverRegistrationUpload, walletSupportUpload };