const express = require('express');
const router = express.Router();
const requireIntegrationScope = require('../middleware/integrationApiKey');
const {
  createQuote,
  createShipmentFromQuote,
  getShipment,
  addShipmentParcels,
  cancelShipment,
} = require('../controller/storeIntegration');

router.post('/quotes', requireIntegrationScope('store:quotes:write'), createQuote);
router.post('/shipments', requireIntegrationScope('store:shipments:write'), createShipmentFromQuote);
router.post('/shipments/:shipmentId/parcels', requireIntegrationScope('store:shipments:write'), addShipmentParcels);
router.post('/shipments/:shipmentId/cancel', requireIntegrationScope('store:shipments:write'), cancelShipment);
router.get('/shipments/:shipmentId', requireIntegrationScope('store:shipments:read'), getShipment);

module.exports = router;
