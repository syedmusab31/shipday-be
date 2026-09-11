const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { verifyAdmin, verifySuperAdmin } = require("../middleware/roleMiddleware");
const { upload } = require('../middleware/upload');

const {
  getPendingDrivers,
  getAcceptedDrivers,
  getAllDrivers,
  updateDriverStatus,
  updateDriverDetails,
  createShipment,
  assignShipmentToDriver,
  getAssignedShipments,
  getAllShipments,
  getShipmentById,
  getDriversByVehicleType,
  updateShipment,
  deleteShipment,
  downloadWaybill,
  downloadPOD,
  createCustomer,
  deleteDriver,
  updateCustomerStatus,
  updateCustomerWallet,
  getOrderStatuses,
  updateOrderStatus,
  createCustomStatus,
  getAllStatuses,
  getStatusById,
  createStatus,
  updateStatus,
  deleteStatus,
  initializeDefaultStatuses
} = require('../controller/admin');

// Customer handling
router.post('/customers/create', authMiddleware, verifyAdmin, createCustomer);
router.patch('/customers/status', authMiddleware, verifySuperAdmin, updateCustomerStatus);
router.patch('/customers/wallet', authMiddleware, verifySuperAdmin, updateCustomerWallet);

// Driver routes
router.get('/drivers/all', authMiddleware, verifyAdmin, getAllDrivers);
router.get('/drivers/pending', authMiddleware, verifyAdmin, getPendingDrivers);
router.get('/drivers/approved', authMiddleware, verifyAdmin, getAcceptedDrivers);
router.get('/drivers/:vehicleType', authMiddleware, verifyAdmin, getDriversByVehicleType);
router.patch('/drivers/status', authMiddleware, verifySuperAdmin, updateDriverStatus);
router.patch('/drivers/details', authMiddleware, verifyAdmin, updateDriverDetails);
router.patch('/drivers/image', authMiddleware, verifyAdmin, upload.single('driverImage'), updateDriverDetails);
router.delete('/drivers/:driverId', authMiddleware, verifySuperAdmin, deleteDriver);

// Shipment routes
// Specific routes first
router.get('/shipments/assign', authMiddleware, verifyAdmin, getAssignedShipments);
router.post('/shipments/assign', authMiddleware, verifyAdmin, assignShipmentToDriver);

router.get('/shipments', authMiddleware, verifyAdmin, getAllShipments);
router.post('/shipments', authMiddleware, verifyAdmin, createShipment);
router.get('/shipments/:shipmentId', authMiddleware, verifyAdmin, getShipmentById);
router.delete('/shipments/:shipmentId', authMiddleware, verifyAdmin, deleteShipment);
router.get('/shipments/:shipmentId/waybill', downloadWaybill);
router.get('/shipments/:shipmentId/pod', downloadPOD);

// Order status management
router.get('/orders/statuses', authMiddleware, verifyAdmin, getOrderStatuses);
router.patch('/orders/status', authMiddleware, verifyAdmin, updateOrderStatus);
router.post('/orders/status/custom', authMiddleware, verifySuperAdmin, createCustomStatus);

// Dynamic status management CRUD
router.get('/statuses', authMiddleware, verifyAdmin, getAllStatuses);
router.get('/statuses/:id', authMiddleware, verifyAdmin, getStatusById);
router.post('/statuses', authMiddleware, verifySuperAdmin, createStatus);
router.patch('/statuses/:id', authMiddleware, verifySuperAdmin, updateStatus);
router.delete('/statuses/:id', authMiddleware, verifySuperAdmin, deleteStatus);
router.post('/statuses/initialize', authMiddleware, verifySuperAdmin, initializeDefaultStatuses);

module.exports = router;