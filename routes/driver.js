const express = require('express');
const router = express.Router();
const {
  requestDriverVerificationCode,
  registerDriver,
  loginDriver,
  getDriverNotifications,
  getDriverShipments,
  getDriverShipmentDetails,
  updateShipmentStatus,
  updateShipmentStatusWithPOD,
  updateDriverFCMToken,
  testPushNotification,
  checkDriver,
  forgotPassword,
  resetPassword,
  createTestNotification,
  cleanupLoginNotifications,
  debugNotifications,
  getDriverEarnings,
  getUnallocatedShipments,
  claimShipment,
  linkShipmentWithBarcode,
  getDriverRoute,
  optimizeDriverRoute,
  getDriverReferences,
  getDriverNavigation,
  searchShipments,
} = require('../controller/driver');
const { upload, podUpload, driverRegistrationUpload } = require('../middleware/upload');

// Driver registration (collect details and send OTP)
router.post('/register', driverRegistrationUpload, registerDriver);

// Driver verification (confirm OTP and create account)
router.post('/request-verification', requestDriverVerificationCode);

// Driver login
router.post('/login', loginDriver);

// Get driver notifications
router.get('/notifications/:driverId', getDriverNotifications);

// Get driver's assigned shipments
router.get('/shipments/:driverId', getDriverShipments);

// Get specific shipment details
router.get('/shipments/:driverId/:shipmentId', getDriverShipmentDetails);

// Update shipment status
router.put('/update-shipment-status', updateShipmentStatus);

// Update shipment status with POD (signature + photo + location)
router.put('/update-shipment-status-pod', podUpload.fields([
  { name: 'signature', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), updateShipmentStatusWithPOD);

// Update driver FCM token
router.put('/fcm-token/:driverId', updateDriverFCMToken);

// Test push notification
router.post('/test-notification/:driverId', testPushNotification);

// Check if driver exists
router.get('/check/:driverId', checkDriver);

// Forgot password
router.post('/forgot-password', forgotPassword);

// Reset password
router.post('/reset-password', resetPassword);

// Create test notification
router.post('/create-test-notification/:driverId', createTestNotification);

// Cleanup login notifications
router.delete('/cleanup-login-notifications', cleanupLoginNotifications);

// Debug notifications
router.get('/debug-notifications/:driverId', debugNotifications);

// Get driver earnings
router.get('/earnings/:driverId', getDriverEarnings);

// Get unallocated shipments for claiming
router.get('/unallocated-shipments/:driverId', getUnallocatedShipments);

// Claim a shipment
router.post('/claim-shipment', claimShipment);

// Link shipment with barcode
router.post('/link-shipment', linkShipmentWithBarcode);

// Get driver route
router.get('/route/:driverId', getDriverRoute);

// Optimize driver route
router.post('/optimize-route/:driverId', optimizeDriverRoute);

// Get driver references
router.get('/references/:driverId', getDriverReferences);

// Get navigation data for a specific shipment
router.get('/navigation/:driverId/:shipmentId', getDriverNavigation);

// Search shipments (for claim screen global search)
router.get('/search-shipments/:driverId', searchShipments);

module.exports = router;