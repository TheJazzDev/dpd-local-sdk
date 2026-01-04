# DPD Local SDK - Integration Guide

This guide will walk you through integrating the DPD Local SDK into your existing application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Implementing Adapters](#implementing-adapters)
5. [Integration into Your App](#integration-into-your-app)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)

## Prerequisites

Before you begin, ensure you have:

- **DPD Account**: Active DPD Local account with API credentials
- **Node.js**: Version 18.0.0 or higher
- **TypeScript**: Version 5.3.0 or higher (recommended)
- **Database**: Any database (Firestore, MongoDB, PostgreSQL, etc.)
- **Storage**: Any storage solution (Firebase Storage, AWS S3, etc.)

## Installation

### 1. Install the SDK

```bash
npm install @jazzdev/dpd-local-sdk
```

### 2. Install Peer Dependencies

Depending on your setup, you may need:

```bash
# If using Firestore
npm install firebase-admin

# If using MongoDB
npm install mongodb

# If using PostgreSQL
npm install pg
```

## Configuration

### 1. Environment Variables

Create a `.env` file in your project root:

```env
# DPD Credentials (Required)
DPD_ACCOUNT_NUMBER=your_account_number
DPD_USERNAME=your_username
DPD_PASSWORD=your_password

# Encryption Key (Required in production)
DPD_ENCRYPTION_KEY=generate_with_generateEncryptionKey()

# Optional
NODE_ENV=production
```

### 2. Generate Encryption Key

Run this once to generate your encryption key:

```typescript
import { generateEncryptionKey } from '@jazzdev/dpd-local-sdk';

console.log('DPD_ENCRYPTION_KEY=' + generateEncryptionKey());
```

### 3. Create DPD Configuration

Create a configuration file (e.g., `lib/dpd-config.ts`):

```typescript
import { createDPDConfig } from '@jazzdev/dpd-local-sdk';

export const dpdConfig = createDPDConfig({
  credentials: {
    accountNumber: process.env.DPD_ACCOUNT_NUMBER!,
    username: process.env.DPD_USERNAME!,
    password: process.env.DPD_PASSWORD!,
  },
  business: {
    name: 'Your Business Name',
    collectionAddress: {
      organisation: 'Your Company Ltd',
      property: 'Your Property',
      street: 'Your Street',
      locality: '',
      town: 'Your Town',
      county: 'Your County',
      postcode: 'YOUR POSTCODE',
      countryCode: 'GB',
    },
    contactName: 'Shipping Department',
    contactPhone: '+44XXXXXXXXXX',
    contactEmail: 'shipping@yourcompany.com',
  },
  // Optional: Customize pricing
  pricing: {
    freeDeliveryThreshold: 60,
    flatDeliveryFee: 6.0,
    minimumOrderValue: 25,
  },
});
```

## Implementing Adapters

### Database Adapter

Create a file `lib/dpd-database-adapter.ts`:

#### Example: Firestore

```typescript
import { DatabaseAdapter } from '@jazzdev/dpd-local-sdk';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export const dpdDatabaseAdapter: DatabaseAdapter = {
  async getOrder(orderId: string) {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) throw new Error('Order not found');
    return { id: doc.id, ...doc.data() };
  },

  async updateOrder(orderId: string, data: any) {
    await db
      .collection('orders')
      .doc(orderId)
      .update({
        ...data,
        updatedAt: Timestamp.now(),
      });
  },

  async getSavedAddresses(userId: string) {
    const snapshot = await db
      .collection('savedAddresses')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async getSavedAddress(addressId: string) {
    const doc = await db.collection('savedAddresses').doc(addressId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  async createSavedAddress(address) {
    const ref = await db.collection('savedAddresses').add({
      ...address,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return ref.id;
  },

  async updateSavedAddress(addressId: string, data) {
    await db
      .collection('savedAddresses')
      .doc(addressId)
      .update({ ...data, updatedAt: Timestamp.now() });
  },

  async deleteSavedAddress(addressId: string) {
    await db.collection('savedAddresses').doc(addressId).delete();
  },

  async createDPDLog(log) {
    const ref = await db.collection('dpdLogs').add(log);
    return ref.id;
  },

  async getDPDLogs(filters) {
    let query = db.collection('dpdLogs');
    if (filters.orderId) query = query.where('orderId', '==', filters.orderId);
    const snapshot = await query.limit(filters.limit || 100).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },
};
```

#### Example: MongoDB

```typescript
import { DatabaseAdapter } from '@jazzdev/dpd-local-sdk';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI!);
const db = client.db();

export const dpdDatabaseAdapter: DatabaseAdapter = {
  async getOrder(orderId: string) {
    const order = await db.collection('orders').findOne({ _id: orderId });
    if (!order) throw new Error('Order not found');
    return { id: order._id, ...order };
  },

  async updateOrder(orderId: string, data: any) {
    await db
      .collection('orders')
      .updateOne(
        { _id: orderId },
        { $set: { ...data, updatedAt: new Date() } }
      );
  },

  // ... implement other methods similarly
};
```

### Storage Adapter

Create a file `lib/dpd-storage-adapter.ts`:

#### Example: Firebase Storage

```typescript
import { StorageAdapter } from '@jazzdev/dpd-local-sdk';
import { getStorage } from 'firebase-admin/storage';

const storage = getStorage();
const bucket = storage.bucket();

export const dpdStorageAdapter: StorageAdapter = {
  async uploadLabel(labelData: string, fileName: string) {
    const file = bucket.file(`dpd-labels/${fileName}`);
    await file.save(labelData);
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  },

  async getLabel(fileName: string) {
    const [files] = await bucket.getFiles({ prefix: `dpd-labels/${fileName}` });
    if (files.length === 0) throw new Error('Label not found');
    const file = files[0];
    return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  },

  async deleteLabel(fileName: string) {
    const file = bucket.file(`dpd-labels/${fileName}`);
    await file.delete();
  },
};
```

#### Example: AWS S3

```typescript
import { StorageAdapter } from '@jazzdev/dpd-local-sdk';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });
const bucketName = process.env.S3_BUCKET!;

export const dpdStorageAdapter: StorageAdapter = {
  async uploadLabel(labelData: string, fileName: string) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: `dpd-labels/${fileName}`,
        Body: labelData,
        ContentType: fileName.endsWith('.html') ? 'text/html' : 'text/plain',
      })
    );
    return `https://${bucketName}.s3.amazonaws.com/dpd-labels/${fileName}`;
  },

  async getLabel(fileName: string) {
    return `https://${bucketName}.s3.amazonaws.com/dpd-labels/${fileName}`;
  },

  async deleteLabel(fileName: string) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: `dpd-labels/${fileName}`,
      })
    );
  },
};
```

## Integration into Your App

### Next.js App Router Example

```typescript
// app/api/shipping/create/route.ts
import { createCompleteShipment } from '@jazzdev/dpd-local-sdk';
import { dpdConfig } from '@/lib/dpd-config';
import { dpdDatabaseAdapter } from '@/lib/dpd-database-adapter';
import { dpdStorageAdapter } from '@/lib/dpd-storage-adapter';

export async function POST(req: Request) {
  const { orderId, deliveryAddress, weight } = await req.json();

  const result = await createCompleteShipment(
    orderId,
    {
      orderRef: orderId,
      service: '12', // Next Day
      deliveryAddress,
      totalWeight: weight,
      numberOfParcels: 1,
      customerEmail: deliveryAddress.contactEmail,
      collectionDate: new Date().toISOString().split('T')[0],
    },
    dpdConfig,
    dpdDatabaseAdapter,
    dpdStorageAdapter
  );

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
```

## Testing

### 1. Test Connection

```typescript
import { testDPDConnection } from '@jazzdev/dpd-local-sdk';
import { dpdConfig } from './lib/dpd-config';

const result = await testDPDConnection(dpdConfig.credentials);
console.log(result.success ? '✅ Connected' : '❌ Failed');
```

### 2. Test Address Validation

```typescript
import { validateDeliveryAddress } from '@jazzdev/dpd-local-sdk';
import { dpdConfig } from './lib/dpd-config';

const result = await validateDeliveryAddress(
  { postcode: 'SW1A 2AA', town: 'London' },
  dpdConfig.credentials
);

console.log(result.valid ? '✅ Valid' : '❌ Invalid');
```

### 3. Create Test Shipment

Use the test mode in your configuration during development:

```typescript
const config = createDPDConfig({
  // ... your config
  testMode: true, // Enables additional logging
});
```

## Production Deployment

### Checklist

- [ ] Set `DPD_ENCRYPTION_KEY` environment variable
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper error monitoring (Sentry, etc.)
- [ ] Set up DPD webhook endpoints for tracking updates
- [ ] Test with real DPD account in staging environment
- [ ] Configure rate limiting for API routes
- [ ] Set up proper logging and monitoring
- [ ] Back up shipping labels to redundant storage
- [ ] Document your integration for your team

### Environment Variables

```env
# Production
NODE_ENV=production
DPD_ACCOUNT_NUMBER=XXXXX
DPD_USERNAME=XXXXX
DPD_PASSWORD=XXXXX
DPD_ENCRYPTION_KEY=XXXXX
```

### Error Monitoring

```typescript
import { createCompleteShipment } from "@jazzdev/dpd-local-sdk";

try {
  const result = await createCompleteShipment(...);

  if (!result.success) {
    // Log to error monitoring service
    Sentry.captureMessage("DPD shipment failed", {
      extra: { error: result.error, orderId },
    });
  }
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

## Support

For issues or questions:

- GitHub Issues: [Report a bug](https://github.com/TheJazzDev/dpd-local-sdk.git/dpd-local-sdk/issues)
- Email: babsman4ll@gmail.com
