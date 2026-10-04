const express = require('express');
const router = express.Router();
const { getPricingConfig, updatePricingConfig } = require('../controller/pricing');
const authMiddleware = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/roleMiddleware');

router.get('/', getPricingConfig);
router.put('/', authMiddleware, verifyAdmin, updatePricingConfig);

module.exports = router;
