const Pricing = require('../models/Pricing');
const { normalizePackagingOptions } = require('../utils/packagingPricing');
const { normalizeInterProvinceFees } = require('../utils/interProvincePricing');

// Get current pricing configuration (Initialize if not exists)
exports.getPricingConfig = async (req, res) => {
    try {
        let pricing = await Pricing.findOne();

        // If no pricing exists, create default
        if (!pricing) {
            pricing = new Pricing();
            await pricing.save();
        }

        pricing.packagingOptions = normalizePackagingOptions(pricing.packagingOptions);

        res.status(200).json(pricing);
    } catch (err) {
        console.error('Error fetching pricing config:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Update pricing configuration
exports.updatePricingConfig = async (req, res) => {
    try {
        const { economy, express, satchel, packagingOptions, interProvinceFees } = req.body;

        // Upsert: update existing or create new
        // We strictly want only ONE pricing document.
        let pricing = await Pricing.findOne();
        if (!pricing) {
            pricing = new Pricing();
        }

        if (economy) pricing.economy = { ...pricing.economy, ...economy };
        if (express) pricing.express = { ...pricing.express, ...express };
        if (satchel) pricing.satchel = { ...pricing.satchel, ...satchel };
        if (packagingOptions !== undefined) {
            pricing.packagingOptions = normalizePackagingOptions(packagingOptions);
        }
        if (interProvinceFees !== undefined) {
            pricing.interProvinceFees = normalizeInterProvinceFees(interProvinceFees);
        }

        pricing.updatedAt = Date.now();
        await pricing.save();

        res.status(200).json({ message: 'Pricing updated successfully', pricing });
    } catch (err) {
        console.error('Error updating pricing config:', err);
        if (
            err.message?.startsWith('Packaging option') ||
            err.message?.startsWith('Packaging options') ||
            err.message?.startsWith('Inter-province fee')
        ) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
