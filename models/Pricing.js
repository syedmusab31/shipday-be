const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
    economy: {
        baseAmount: { type: Number, required: true, default: 20 },
        divisor: { type: Number, required: true, default: 5000 },
        rate: { type: Number, required: true, default: 1.2 },
        eta: { type: String, default: '1-4 days' }
    },
    express: {
        baseAmount: { type: Number, required: true, default: 40 },
        divisor: { type: Number, required: true, default: 4000 },
        rate: { type: Number, required: true, default: 1.2 },
        eta: { type: String, default: '1-2 days' }
    },
    satchel: {
        economy: {
            a4: { type: Number, required: true, default: 90 },
            a3: { type: Number, required: true, default: 110 }
        },
        express: {
            a4: { type: Number, required: true, default: 110 },
            a3: { type: Number, required: true, default: 130 }
        }
    },
    packagingOptions: {
        type: [{
            id: { type: String, default: '' },
            name: { type: String, required: true, default: 'Packaging' },
            price: { type: Number, required: true, default: 0 },
            active: { type: Boolean, default: true }
        }],
        default: [
            { id: 'boxing', name: 'Boxing', price: 35, active: true },
            { id: 'bubble-wrap', name: 'Bubble Wrap', price: 20, active: true },
            { id: 'tape', name: 'Tape', price: 10, active: true }
        ]
    },
    interProvinceFees: {
        type: [{
            id: { type: String, required: true },
            fromProvince: { type: String, required: true },
            toProvince: { type: String, required: true },
            fee: { type: Number, required: true, min: 0 }
        }],
        default: []
    },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pricing', pricingSchema);
