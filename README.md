# DPD Local SDK

> TypeScript SDK for integrating DPD Local shipping services into your application. Database-agnostic, framework-independent, and production-ready.

[![npm version](https://badge.fury.io/js/%40your-org%2Fdpd-local-sdk.svg)](https://www.npmjs.com/package/@your-org/dpd-local-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✅ **Complete DPD Integration**
- Create shipments and generate labels
- Address validation (UK postcodes)
- Real-time tracking
- Multi-parcel support
- Service selection (Next Day, By 12 PM)

✅ **Database-Agnostic**
- Works with any database (Firestore, MongoDB, PostgreSQL, etc.)
- Adapter pattern for easy integration
- TypeScript-first design

✅ **Production-Ready**
- Battle-tested in production
- Comprehensive error handling
- Automatic token management
- Request retry logic
- Detailed logging

✅ **Developer-Friendly**
- Full TypeScript support
- Comprehensive JSDoc comments
- Example implementations included
- Zero runtime dependencies (peer deps only)

## Installation

```bash
npm install @your-org/dpd-local-sdk
# or
yarn add @your-org/dpd-local-sdk
# or
pnpm add @your-org/dpd-local-sdk
```

## Quick Start

### 1. Create Configuration

```typescript
import { createDPDConfig } from "@your-org/dpd-local-sdk";

const config = createDPDConfig({
  credentials: {
    accountNumber: process.env.DPD_ACCOUNT_NUMBER!,
    username: process.env.DPD_USERNAME!,
    password: process.env.DPD_PASSWORD!,
  },
  business: {
    name: "Your Business Name",
    collectionAddress: {
      organisation: "Your Company Ltd",
      property: "Unit 1",
      street: "123 Main Street",
      locality: "",
      town: "London",
      county: "Greater London",
      postcode: "SW1A 1AA",
      countryCode: "GB",
    },
    contactName: "Your Name",
    contactPhone: "+441234567890",
    contactEmail: "shipping@yourcompany.com",
  },
});
```

### 2. Implement Adapters

The SDK requires two adapters to work with your database and storage:

#### Database Adapter

```typescript
import { DatabaseAdapter } from "@your-org/dpd-local-sdk";

const myDatabaseAdapter: DatabaseAdapter = {
  async getOrder(orderId: string) {
    // Your implementation
    return await db.orders.findById(orderId);
  },

  async updateOrder(orderId: string, data: any) {
    // Your implementation
    await db.orders.update(orderId, data);
  },

  async getSavedAddresses(userId: string) {
    // Your implementation
    return await db.addresses.find({ userId });
  },

  async getSavedAddress(addressId: string) {
    // Your implementation
    return await db.addresses.findById(addressId);
  },

  async createSavedAddress(address) {
    // Your implementation
    const result = await db.addresses.create(address);
    return result.id;
  },

  async updateSavedAddress(addressId: string, data) {
    // Your implementation
    await db.addresses.update(addressId, data);
  },

  async deleteSavedAddress(addressId: string) {
    // Your implementation
    await db.addresses.delete(addressId);
  },

  async createDPDLog(log) {
    // Your implementation
    const result = await db.dpdLogs.create(log);
    return result.id;
  },

  async getDPDLogs(filters) {
    // Your implementation
    return await db.dpdLogs.find(filters);
  },
};
```

#### Storage Adapter

```typescript
import { StorageAdapter } from "@your-org/dpd-local-sdk";

const myStorageAdapter: StorageAdapter = {
  async uploadLabel(labelData: string, fileName: string) {
    // Upload to your storage (S3, Firebase Storage, etc.)
    const url = await storage.upload(labelData, `labels/${fileName}`);
    return url;
  },

  async getLabel(fileName: string) {
    // Get label URL from storage
    return await storage.getUrl(`labels/${fileName}`);
  },

  async deleteLabel(fileName: string) {
    // Delete label from storage
    await storage.delete(`labels/${fileName}`);
  },
};
```

### 3. Create a Shipment

```typescript
import { createCompleteShipment } from "@your-org/dpd-local-sdk";

const result = await createCompleteShipment(
  "ORDER123", // Your order ID
  {
    orderRef: "ORDER123",
    service: "12", // Next Day Delivery
    deliveryAddress: {
      id: "addr_123",
      userId: "user_123",
      isDefault: true,
      property: "10",
      street: "Downing Street",
      town: "London",
      postcode: "SW1A 2AA",
      countryCode: "GB",
      contactName: "John Doe",
      contactPhone: "+441234567890",
      validated: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    totalWeight: 2.5, // kg
    numberOfParcels: 1,
    customerEmail: "customer@example.com",
    customerPhone: "+441234567890",
    deliveryInstructions: "Leave with neighbor if not home",
    collectionDate: "2024-01-15",
  },
  config,
  myDatabaseAdapter,
  myStorageAdapter
);

if (result.success) {
  console.log("Shipment created!");
  console.log("Tracking URL:", result.trackingUrl);
  console.log("Label URL:", result.labelUrl);
} else {
  console.error("Failed:", result.error);
}
```

## API Reference

### Configuration

#### `createDPDConfig(options)`

Creates a complete DPD module configuration.

**Parameters:**
- `options.credentials` - DPD API credentials
- `options.business` - Your business information
- `options.pricing` (optional) - Custom pricing configuration
- `options.services` (optional) - Service configuration
- `options.labels` (optional) - Label printer configuration
- `options.notifications` (optional) - Email/SMS configuration
- `options.testMode` (optional) - Enable test mode

**Returns:** `DPDModuleConfig`

### Core Functions

#### `createCompleteShipment(orderId, params, config, dbAdapter, storageAdapter)`

Create a complete shipment including label generation and database update.

**Parameters:**
- `orderId` - Your internal order ID
- `params` - Shipment parameters (address, weight, service, etc.)
- `config` - DPD configuration
- `dbAdapter` - Database adapter
- `storageAdapter` - Storage adapter

**Returns:** `Promise<CreateShipmentResult>`

#### `validateDeliveryAddress(params, credentials)`

Validate a UK delivery address using postcodes.io API.

**Parameters:**
- `params.postcode` - UK postcode
- `params.town` - Town/city name
- `credentials` - DPD credentials

**Returns:** `Promise<ValidateAddressResult>`

#### `testDPDConnection(credentials)`

Test connection to DPD API.

**Parameters:**
- `credentials` - DPD credentials

**Returns:** `Promise<{ success: boolean; message: string }>`

### Utility Functions

#### `calculateDeliveryFee(subtotal, service, config)`

Calculate customer-facing delivery fee.

#### `calculateDPDCost(weight, service, config)`

Calculate DPD shipping cost (what DPD charges you).

#### `getNextCollectionDate()`

Get next available collection date (excludes Sundays).

#### `getEstimatedDeliveryDate(service, collectionDate?)`

Calculate estimated delivery date.

#### `getTrackingUrl(parcelNumber)`

Generate DPD tracking URL.

## Integration Examples

### Next.js App Router

```typescript
// app/api/shipping/create/route.ts
import { createCompleteShipment } from "@your-org/dpd-local-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { orderId, deliveryAddress, weight } = await req.json();

  const result = await createCompleteShipment(
    orderId,
    {
      orderRef: orderId,
      service: "12",
      deliveryAddress,
      totalWeight: weight,
      numberOfParcels: 1,
      customerEmail: deliveryAddress.contactEmail,
      collectionDate: new Date().toISOString().split("T")[0],
    },
    dpdConfig,
    databaseAdapter,
    storageAdapter
  );

  return NextResponse.json(result);
}
```

### Express.js

```typescript
import express from "express";
import { createCompleteShipment } from "@your-org/dpd-local-sdk";

const app = express();

app.post("/api/shipping/create", async (req, res) => {
  const { orderId, deliveryAddress, weight } = req.body;

  const result = await createCompleteShipment(
    orderId,
    {
      orderRef: orderId,
      service: "12",
      deliveryAddress,
      totalWeight: weight,
      numberOfParcels: 1,
      customerEmail: deliveryAddress.contactEmail,
      collectionDate: new Date().toISOString().split("T")[0],
    },
    dpdConfig,
    databaseAdapter,
    storageAdapter
  );

  res.json(result);
});
```

## Environment Variables

```env
# DPD Credentials (Required)
DPD_ACCOUNT_NUMBER=your_account_number
DPD_USERNAME=your_username
DPD_PASSWORD=your_password

# Encryption (Required in production)
DPD_ENCRYPTION_KEY=your_32_byte_hex_key

# Optional
NODE_ENV=production
```

### Generating Encryption Key

```typescript
import { generateEncryptionKey } from "@your-org/dpd-local-sdk";

const key = generateEncryptionKey();
console.log("DPD_ENCRYPTION_KEY=" + key);
```

## Adapter Examples

Complete adapter examples are available in the `examples/` directory:

- `examples/firestore-adapter.ts` - Firestore implementation
- `examples/mongodb-adapter.ts` - MongoDB implementation
- `examples/postgresql-adapter.ts` - PostgreSQL implementation
- `examples/firebase-storage-adapter.ts` - Firebase Storage implementation
- `examples/s3-storage-adapter.ts` - AWS S3 implementation

## Error Handling

```typescript
const result = await createCompleteShipment(...);

if (!result.success) {
  console.error("Error Code:", result.errorCode);
  console.error("Error Message:", result.error);

  // Handle specific errors
  switch (result.errorCode) {
    case "AUTH_FAILED":
      // Invalid credentials
      break;
    case "INVALID_ADDRESS":
      // Address validation failed
      break;
    case "NETWORK_ERROR":
      // Connection issues
      break;
    default:
      // Generic error
  }
}
```

## TypeScript Support

This SDK is written in TypeScript and provides complete type definitions:

```typescript
import type {
  DPDModuleConfig,
  CreateShipmentParams,
  CreateShipmentResult,
  SavedAddress,
  ShippingData,
  DatabaseAdapter,
  StorageAdapter,
} from "@your-org/dpd-local-sdk";
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT © [Your Name](https://github.com/your-org)

## Support

- 📧 Email: support@your-org.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/dpd-local-sdk/issues)
- 📖 Documentation: [Full Docs](https://docs.your-org.com/dpd-local-sdk)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

**Made with ❤️ for the developer community**
