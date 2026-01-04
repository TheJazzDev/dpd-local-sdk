/**
 * Basic Usage Example
 *
 * Complete workflow for creating a DPD shipment
 */

import {
  createDPDConfig,
  createCompleteShipment,
  validateDeliveryAddress,
  testDPDConnection,
} from '@jazzdev/dpd-local-sdk';
import type { DatabaseAdapter, StorageAdapter } from '@jazzdev/dpd-local-sdk';

// Import your adapters
import { FirestoreAdminAdapter } from './firestore-adapter';
import { FirebaseStorageAdapter } from './firebase-storage-adapter';

async function main() {
  // 1. Create DPD Configuration
  const config = createDPDConfig({
    credentials: {
      accountNumber: process.env.DPD_ACCOUNT_NUMBER!,
      username: process.env.DPD_USERNAME!,
      password: process.env.DPD_PASSWORD!,
    },
    business: {
      name: 'Your Business Name',
      collectionAddress: {
        organisation: 'Your Company Ltd',
        property: 'Unit 1',
        street: '123 Main Street',
        locality: '',
        town: 'London',
        county: 'Greater London',
        postcode: 'SW1A 1AA',
        countryCode: 'GB',
      },
      contactName: 'Shipping Department',
      contactPhone: '+441234567890',
      contactEmail: 'shipping@yourcompany.com',
    },
  });

  // 2. Initialize Adapters
  // (Replace with your actual database and storage initialization)
  const databaseAdapter: DatabaseAdapter = new FirestoreAdminAdapter();
  /* your Firestore instance */
  const storageAdapter: StorageAdapter = new FirebaseStorageAdapter();
  /* your Firebase Storage instance */

  // 3. Test Connection
  console.log('Testing DPD connection...');
  const connectionTest = await testDPDConnection(config.credentials);

  if (!connectionTest.success) {
    console.error('❌ Connection failed:', connectionTest.message);
    return;
  }

  console.log('✅ Connection successful!');

  // 4. Validate Delivery Address
  console.log('\nValidating delivery address...');
  const addressValidation = await validateDeliveryAddress(
    {
      postcode: 'SW1A 2AA',
      town: 'London',
    },
    config.credentials
  );

  if (!addressValidation.valid) {
    console.error('❌ Address validation failed');
    return;
  }

  console.log('✅ Address is valid and serviceable');

  // 5. Create Shipment
  console.log('\nCreating shipment...');
  const shipmentResult = await createCompleteShipment(
    'ORDER123', // Your order ID
    {
      orderRef: 'ORDER123',
      service: '12', // Next Day Delivery
      deliveryAddress: {
        id: 'addr_123',
        userId: 'user_123',
        isDefault: true,
        property: '10',
        street: 'Downing Street',
        town: 'London',
        postcode: 'SW1A 2AA',
        countryCode: 'GB',
        contactName: 'John Doe',
        contactPhone: '+441234567890',
        validated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      totalWeight: 2.5, // kg
      numberOfParcels: 1,
      customerEmail: 'customer@example.com',
      customerPhone: '+441234567890',
      deliveryInstructions: 'Leave with neighbor if not at home',
      collectionDate: new Date().toISOString().split('T')[0],
    },
    config,
    databaseAdapter,
    storageAdapter
  );

  if (shipmentResult.success) {
    console.log('✅ Shipment created successfully!');
    console.log('📦 Consignment Number:', shipmentResult.consignmentNumber);
    console.log('🔗 Tracking URL:', shipmentResult.trackingUrl);
    console.log('🏷️  Label URL:', shipmentResult.labelUrl);
  } else {
    console.error('❌ Shipment creation failed:');
    console.error('   Error:', shipmentResult.error);
    console.error('   Code:', shipmentResult.errorCode);
  }
}

// Run the example
main().catch(console.error);
