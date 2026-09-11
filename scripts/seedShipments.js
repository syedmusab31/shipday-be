/**
 * Dummy Shipment Data Seeding Script
 * 
 * This script populates the database with sample shipment data for testing purposes.
 * 
 * USAGE:
 * 1. Navigate to the backend directory: cd C:\wamp\www\shipday\backend
 * 2. Run the script: node scripts/seedShipments.js
 * 
 * REQUIREMENTS:
 * - MongoDB must be running
 * - Environment variables must be configured (MONGODB_URI)
 * - The script will create shipments with realistic test data
 */

const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const User = require('../models/User');
require('dotenv').config();

// Sample shipment data
const sampleShipments = [
  {
    shipmentId: 'SHP' + Date.now() + '001',
    senderDetails: {
      fullName: 'John Smith',
      company: 'Tech Corp',
      email: 'john.smith@techcorp.com',
      mobile: '+27821234567',
      address: {
        street: '123 Main Street',
        suburb: 'Rosebank',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2196',
        latitude: -26.1387,
        longitude: 28.0384
      }
    },
    deliveryDetails: {
      receiverName: 'Sarah Johnson',
      company: 'Digital Solutions',
      mobile: '+27829876543',
      email: 'sarah.johnson@digitalsolutions.com',
      address: {
        street: '456 Business Avenue',
        suburb: 'Sandton',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2196',
        latitude: -26.1075,
        longitude: 28.0566
      }
    },
    collectionDetails: {
      dispatcherName: 'Mike Dispatcher',
      company: 'Tech Corp',
      mobile: '+27821112233',
      address: {
        street: '123 Main Street',
        suburb: 'Rosebank',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2196',
        latitude: -26.1387,
        longitude: 28.0384
      },
      numberOfItems: 1
    },
    parcelDetails: {
      serviceType: 'express',
      parcelType: 'Electronics',
      dimensions: {
        length: 30,
        width: 20,
        height: 15,
        weight: 2.5
      },
      specialInstructions: 'Handle with care - fragile electronics'
    },
    payment: {
      method: 'gateway',
      status: 'paid',
      amount: 150.00,
      transactionId: 'TXN' + Date.now() + '001'
    },
    orderNumber: 'ORD' + Date.now() + '001',
    marketplaceName: 'TechStore',
    numberOfBoxes: 1,
    bookedBy: 'system',
    isFulfillment: true,
    status: 'Out For Delivery',
    notes: 'Express delivery - priority handling',
    estimatedDelivery: '2026-08-30',
    trackingNumber: 'TRK' + Math.random().toString(36).substring(2, 10).toUpperCase()
  },
  {
    shipmentId: 'SHP' + Date.now() + '002',
    senderDetails: {
      fullName: 'Emily Brown',
      company: 'Fashion Hub',
      email: 'emily.brown@fashionhub.com',
      mobile: '+27823456789',
      address: {
        street: '789 Fashion Street',
        suburb: 'Melville',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2092',
        latitude: -26.1750,
        longitude: 28.0000
      }
    },
    deliveryDetails: {
      receiverName: 'David Lee',
      company: 'Style Boutique',
      mobile: '+27827654321',
      email: 'david.lee@styleboutique.com',
      address: {
        street: '321 Style Road',
        suburb: 'Parkhurst',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2193',
        latitude: -26.1390,
        longitude: 28.0100
      }
    },
    collectionDetails: {
      dispatcherName: 'Lisa Dispatcher',
      company: 'Fashion Hub',
      mobile: '+27823344556',
      address: {
        street: '789 Fashion Street',
        suburb: 'Melville',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2092',
        latitude: -26.1750,
        longitude: 28.0000
      },
      numberOfItems: 3
    },
    parcelDetails: {
      serviceType: 'economy',
      parcelType: 'Clothing',
      dimensions: {
        length: 40,
        width: 30,
        height: 20,
        weight: 1.8
      },
      specialInstructions: 'Leave at reception if no one available'
    },
    payment: {
      method: 'ewallet',
      status: 'paid',
      amount: 85.50,
      transactionId: 'TXN' + Date.now() + '002'
    },
    orderNumber: 'ORD' + Date.now() + '002',
    marketplaceName: 'FashionMarket',
    numberOfBoxes: 3,
    bookedBy: 'system',
    isFulfillment: true,
    status: 'In Transit',
    notes: 'Multiple clothing items',
    estimatedDelivery: '2026-08-31',
    trackingNumber: 'TRK' + Math.random().toString(36).substring(2, 10).toUpperCase()
  },
  {
    shipmentId: 'SHP' + Date.now() + '003',
    senderDetails: {
      fullName: 'Robert Wilson',
      company: 'Home Essentials',
      email: 'robert.wilson@homeessentials.com',
      mobile: '+27824567890',
      address: {
        street: '567 Home Lane',
        suburb: 'Greenside',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2034',
        latitude: -26.1500,
        longitude: 27.9900
      }
    },
    deliveryDetails: {
      receiverName: 'Maria Garcia',
      company: null,
      mobile: '+27828765432',
      email: 'maria.garcia@gmail.com',
      address: {
        street: '890 Residential Ave',
        suburb: 'Emmarentia',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2195',
        latitude: -26.1450,
        longitude: 28.0000
      }
    },
    collectionDetails: {
      dispatcherName: 'Tom Dispatcher',
      company: 'Home Essentials',
      mobile: '+27824455667',
      address: {
        street: '567 Home Lane',
        suburb: 'Greenside',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2034',
        latitude: -26.1500,
        longitude: 27.9900
      },
      numberOfItems: 1
    },
    parcelDetails: {
      serviceType: 'express',
      parcelType: 'Furniture',
      dimensions: {
        length: 100,
        width: 60,
        height: 80,
        weight: 25.0
      },
      specialInstructions: 'Large item - requires 2 people to handle'
    },
    payment: {
      method: 'cod',
      status: 'pending',
      amount: 450.00,
      transactionId: null
    },
    orderNumber: 'ORD' + Date.now() + '003',
    marketplaceName: null,
    numberOfBoxes: 1,
    bookedBy: 'online',
    isFulfillment: false,
    status: 'Pending Delivery',
    notes: 'COD - collect payment on delivery',
    estimatedDelivery: '2026-08-30',
    trackingNumber: 'TRK' + Math.random().toString(36).substring(2, 10).toUpperCase()
  },
  {
    shipmentId: 'SHP' + Date.now() + '004',
    senderDetails: {
      fullName: 'Amanda Taylor',
      company: 'Book World',
      email: 'amanda.taylor@bookworld.com',
      mobile: '+27825678901',
      address: {
        street: '234 Book Street',
        suburb: 'Observatory',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2198',
        latitude: -26.1800,
        longitude: 28.0400
      }
    },
    deliveryDetails: {
      receiverName: 'James Anderson',
      company: 'Library Services',
      mobile: '+27829876544',
      email: 'james.anderson@libraryservices.com',
      address: {
        street: '678 Library Road',
        suburb: 'Braamfontein',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2017',
        latitude: -26.1900,
        longitude: 28.0300
      }
    },
    collectionDetails: {
      dispatcherName: 'Kate Dispatcher',
      company: 'Book World',
      mobile: '+27825567890',
      address: {
        street: '234 Book Street',
        suburb: 'Observatory',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2198',
        latitude: -26.1800,
        longitude: 28.0400
      },
      numberOfItems: 5
    },
    parcelDetails: {
      serviceType: 'economy',
      parcelType: 'Books',
      dimensions: {
        length: 35,
        width: 25,
        height: 18,
        weight: 8.5
      },
      specialInstructions: 'Books - fragile - handle with care'
    },
    payment: {
      method: 'payfast',
      status: 'paid',
      amount: 220.00,
      transactionId: 'TXN' + Date.now() + '003'
    },
    orderNumber: 'ORD' + Date.now() + '004',
    marketplaceName: 'BookMarket',
    numberOfBoxes: 5,
    bookedBy: 'system',
    isFulfillment: true,
    status: 'Driver Assigned',
    notes: 'Multiple books - educational materials',
    estimatedDelivery: '2026-08-31',
    trackingNumber: 'TRK' + Math.random().toString(36).substring(2, 10).toUpperCase()
  },
  {
    shipmentId: 'SHP' + Date.now() + '005',
    senderDetails: {
      fullName: 'Christopher Martin',
      company: 'Sports Gear',
      email: 'christopher.martin@sportsgear.com',
      mobile: '+27826789012',
      address: {
        street: '901 Sports Avenue',
        suburb: 'Randburg',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2194',
        latitude: -26.1050,
        longitude: 28.0000
      }
    },
    deliveryDetails: {
      receiverName: 'Jessica White',
      company: 'Fitness First',
      mobile: '+27820987655',
      email: 'jessica.white@fitnessfirst.com',
      address: {
        street: '123 Fitness Lane',
        suburb: 'Rosebank',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2196',
        latitude: -26.1387,
        longitude: 28.0384
      }
    },
    collectionDetails: {
      dispatcherName: 'Steve Dispatcher',
      company: 'Sports Gear',
      mobile: '+27826678901',
      address: {
        street: '901 Sports Avenue',
        suburb: 'Randburg',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2194',
        latitude: -26.1050,
        longitude: 28.0000
      },
      numberOfItems: 2
    },
    parcelDetails: {
      serviceType: 'express',
      parcelType: 'Sports Equipment',
      dimensions: {
        length: 80,
        width: 40,
        height: 35,
        weight: 12.0
      },
      specialInstructions: 'Gym equipment - heavy item'
    },
    payment: {
      method: 'gateway',
      status: 'paid',
      amount: 350.00,
      transactionId: 'TXN' + Date.now() + '004'
    },
    orderNumber: 'ORD' + Date.now() + '005',
    marketplaceName: 'SportsMarket',
    numberOfBoxes: 2,
    bookedBy: 'system',
    isFulfillment: true,
    status: 'Out For Delivery',
    notes: 'Gym equipment - heavy delivery',
    estimatedDelivery: '2026-08-30',
    trackingNumber: 'TRK' + Math.random().toString(36).substring(2, 10).toUpperCase()
  }
];

async function seedShipments() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shipday');
    console.log('Connected to MongoDB successfully');

    // Check for existing drivers to assign shipments
    const drivers = await Driver.find({ status: 'approved' });
    console.log(`Found ${drivers.length} approved drivers`);

    if (drivers.length === 0) {
      console.log('No approved drivers found. Creating sample driver...');
      const sampleDriver = new Driver({
        driverId: 'DRV' + Date.now(),
        username: 'Test Driver',
        email: 'testdriver@shipday.co.za',
        phone: '+27820000000',
        password: 'password123', // Should be hashed in production
        vehicleType: 'van',
        vehicleNumber: 'TEST-123',
        status: 'approved',
        isActive: true
      });
      await sampleDriver.save();
      drivers.push(sampleDriver);
      console.log('Sample driver created');
    }

    // Clear existing test shipments (optional - comment out if you want to keep existing data)
    console.log('Clearing existing test shipments...');
    await Shipment.deleteMany({ shipmentId: { $regex: /^SHP\d+/ } });
    console.log('Existing test shipments cleared');

    // Insert sample shipments
    console.log('Inserting sample shipments...');
    let createdCount = 0;

    for (const shipmentData of sampleShipments) {
      // Assign a random driver to each shipment
      const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
      shipmentData.driver = randomDriver._id;
      shipmentData.driverName = randomDriver.username;

      const shipment = new Shipment(shipmentData);
      await shipment.save();
      createdCount++;
      console.log(`Created shipment: ${shipment.shipmentId} assigned to ${randomDriver.username}`);
    }

    console.log(`\n✅ Successfully seeded ${createdCount} sample shipments`);
    console.log('Summary:');
    console.log(`- Total shipments created: ${createdCount}`);
    console.log(`- Drivers in system: ${drivers.length}`);
    console.log(`- Shipments per driver: ${Math.round(createdCount / drivers.length)}`);

  } catch (error) {
    console.error('Error seeding shipments:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeding function
seedShipments();