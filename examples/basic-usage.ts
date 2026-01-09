/**
 * Basic Usage Example
 *
 * Complete workflow for creating a DPD shipment
 *
 * SETUP REQUIRED:
 * 1. Install dependencies: npm install firebase-admin
 * 2. Set up your .env file with DPD and Firebase credentials
 * 3. Uncomment the Firebase initialization code below
 */

import {
  createDPDConfig,
  createCompleteShipment,
  validateDeliveryAddress,
  testDPDConnection,
} from '@jazzdev/dpd-local-sdk';
import type { DatabaseAdapter, StorageAdapter } from '@jazzdev/dpd-local-sdk';

// Uncomment to use Firebase adapters:
// import { FirestoreAdminAdapter } from './firestore-adapter';
// import { FirebaseStorageAdapter } from './firebase-storage-adapter';

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
  // You need to implement these adapters for your database/storage
  // See firestore-adapter.ts and firebase-storage-adapter.ts for examples

  // Option A: Use Firebase (uncomment after installing firebase-admin)
  /*
  import { initializeApp, cert } from 'firebase-admin/app';
  import { getFirestore } from 'firebase-admin/firestore';
  import { getStorage } from 'firebase-admin/storage';
  import { FirestoreAdminAdapter } from './firestore-adapter';
  import { FirebaseStorageAdapter } from './firebase-storage-adapter';

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  const databaseAdapter = new FirestoreAdminAdapter(getFirestore(app));
  const storageAdapter = new FirebaseStorageAdapter(getStorage(app));
  */

  // Option B: Create mock adapters for testing
  const databaseAdapter: DatabaseAdapter = {
    async getOrder(orderId: string) {
      return { id: orderId, status: 'pending' };
    },
    async updateOrder(orderId: string, data: any) {
      console.log('Updating order:', orderId, data);
    },
    async getSavedAddresses(userId: string) {
      return [];
    },
    async getSavedAddress(addressId: string) {
      return null;
    },
    async createSavedAddress(address: any) {
      return 'mock-address-id';
    },
    async updateSavedAddress(addressId: string, data: any) {
      console.log('Updating address:', addressId);
    },
    async deleteSavedAddress(addressId: string) {
      console.log('Deleting address:', addressId);
    },
    async createDPDLog(log: any) {
      console.log('DPD Log:', log.operation, log.success ? '✅' : '❌');
      return 'mock-log-id';
    },
    async getDPDLogs(filters: any) {
      return [];
    },
  };

  const storageAdapter: StorageAdapter = {
    async uploadLabel(labelData: string, fileName: string) {
      console.log(`Mock upload: ${fileName} (${labelData.length} bytes)`);
      return `https://mock-storage.example.com/${fileName}`;
    },
    async getLabel(fileName: string) {
      return `https://mock-storage.example.com/${fileName}`;
    },
    async deleteLabel(fileName: string) {
      console.log(`Mock delete: ${fileName}`);
    },
  };

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
