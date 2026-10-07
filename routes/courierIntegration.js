const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/roleMiddleware');
const {
  getRates,
  bookShipment,
  getBooking,
  trackShipment,
} = require('../controller/courierIntegration');

router.use(authMiddleware, verifyAdmin);
router.post('/shipments/:shipmentId/rates', getRates);
router.post('/shipments/:shipmentId/book', bookShipment);
router.get('/shipments/:shipmentId', getBooking);
router.get('/shipments/:shipmentId/tracking', trackShipment);

module.exports = router;
