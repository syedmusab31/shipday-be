const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/roleMiddleware');
const {
  getMarketingDashboard,
  updateMarketingSettings,
  assignSalesRepresentative,
} = require('../controller/marketing');

router.use(authMiddleware, verifyAdmin);
router.get('/', getMarketingDashboard);
router.put('/settings', updateMarketingSettings);
router.patch('/customers/:customerId/representative', assignSalesRepresentative);

module.exports = router;