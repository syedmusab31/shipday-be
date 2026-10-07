const express = require('express');
const router = express.Router();
const authenticateCourierPartner = require('../middleware/courierPartnerApiKey');
const {
  createQuote,
  bookShipmentFromQuote,
  getShipment,
} = require('../controller/courierPartnerApi');

router.use(authenticateCourierPartner);
router.post('/quotes', createQuote);
router.post('/shipments', bookShipmentFromQuote);
router.get('/shipments/:shipmentId', getShipment);

module.exports = router;
