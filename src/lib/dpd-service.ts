/**
 * DPD Local SDK - Main Service (Functional)
 *
 * High-level service functions that integrate all DPD functionality
 * Database-agnostic - requires adapters to be passed in
 *
 * @package @jazzdev/dpd-local-sdk
 */

import { createShipment, generateLabel, validateAddress } from './shipment';
import { getGeoSession, testConnection } from './auth';
import {
  calculateDeliveryFee,
  calculateDPDCost,
  getNextCollectionDate,
  getEstimatedDeliveryDate,
} from '../config';
import type {
  DPDModuleConfig,
  DPDCredentials,
  CreateShipmentParams,
  CreateShipmentResult,
  GenerateLabelResult,
  ValidateAddressParams,
  ValidateAddressResult,
  SavedAddress,
  DatabaseAdapter,
  StorageAdapter,
  ShippingData,
} from '../types';

// ============================================================================
// Shipment Operations
// ============================================================================

/**
 * Create a complete shipment (shipment + label + database update)
 *
 * @param orderId - Order ID
 * @param params - Shipment parameters
 * @param config - DPD module configuration
 * @param dbAdapter - Database adapter (required)
 * @param storageAdapter - Storage adapter (required)
 * @returns Shipment result with label URL
 */
export async function createCompleteShipment(
  orderId: string,
  params: Omit<CreateShipmentParams, 'orderId'>,
  config: DPDModuleConfig,
  dbAdapter: DatabaseAdapter,
  storageAdapter: StorageAdapter
): Promise<CreateShipmentResult & { labelUrl?: string }> {
  try {
    // 1. Create shipment with DPD
    const shipmentResult = await createShipment(
      config.credentials,
      { orderId, ...params },
      config.business
    );

    if (
      !shipmentResult.success ||
      !shipmentResult.consignmentNumber ||
      !shipmentResult.shipmentId ||
      !shipmentResult.parcelNumber
    ) {
      return shipmentResult;
    }

    // 2. Generate and upload label (requires shipmentId from DPD API)
    const labelResult = await generateAndUploadLabel(
      shipmentResult.shipmentId,
      config.labels.format,
      config.credentials,
      storageAdapter
    );

    if (!labelResult.success || !labelResult.labelUrl) {
      return {
        ...shipmentResult,
        error: `Shipment created but label generation failed: ${labelResult.error}`,
      };
    }

    // 3. Calculate costs
    const dpdCost = calculateDPDCost(
      params.totalWeight,
      params.service,
      config
    );
    const customerCharge = calculateDeliveryFee(0, params.service, config);

    // 4. Create shipping data object
    const now = new Date();
    const shippingData: ShippingData = {
      provider: 'dpd',
      service: params.service,
      shipmentId: shipmentResult.shipmentId,
      consignmentNumber: shipmentResult.consignmentNumber,
      parcelNumber: shipmentResult.parcelNumber,
      trackingUrl: `https://www.dpdlocal.co.uk/service/tracking?parcel=${shipmentResult.parcelNumber}`,
      labelUrl: labelResult.labelUrl,
      status: 'label_generated',
      statusHistory: [
        {
          status: 'created',
          timestamp: now,
          message: 'Shipment created with DPD',
        },
        {
          status: 'label_generated',
          timestamp: now,
          message: 'Shipping label generated',
        },
      ],
      cost: {
        basePrice: dpdCost,
        weightCharge: params.totalWeight * 0.3,
        totalCost: dpdCost,
        customerCharge,
      },
      weight: {
        total: params.totalWeight,
        unit: 'kg',
      },
      parcels: params.numberOfParcels,
      collectionDate: params.collectionDate || getNextCollectionDate(),
      estimatedDelivery: getEstimatedDeliveryDate(
        params.service,
        params.collectionDate
      ),
      createdAt: now,
      updatedAt: now,
    };

    // 5. Update order in database
    try {
      await dbAdapter.updateOrder(orderId, {
        shipping: shippingData,
      });
    } catch (updateError) {
      console.error(
        `❌ CRITICAL: Failed to update order ${orderId} with shipping data!`
      );
      console.error(`   Error:`, updateError);
      throw new Error(
        `Shipment created but failed to update order: ${
          updateError instanceof Error ? updateError.message : 'Unknown error'
        }`
      );
    }

    return {
      success: true,
      consignmentNumber: shipmentResult.consignmentNumber,
      trackingUrl: shipmentResult.trackingUrl,
      labelUrl: labelResult.labelUrl,
    };
  } catch (error) {
    console.error(`\n💥 Complete shipment creation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'COMPLETE_SHIPMENT_FAILED',
    };
  }
}

/**
 * Generate and upload shipping label
 *
 * @param shipmentId - DPD shipment ID
 * @param consignmentNumber - Consignment number
 * @param labelFormat - Label format (thermal or a4)
 * @param credentials - DPD credentials
 * @param storageAdapter - Storage adapter (required)
 * @returns Label result with URL
 */
export async function generateAndUploadLabel(
  shipmentId: string | number,
  labelFormat: 'zpl' | 'clp' | 'epl' | 'html',
  credentials: DPDCredentials,
  storageAdapter: StorageAdapter
): Promise<GenerateLabelResult> {
  try {
    // 1. Generate label with DPD
    const labelResult = await generateLabel(credentials, {
      shipmentId,
      labelFormat,
    });

    if (!labelResult.success || !labelResult.labelData) {
      return labelResult;
    }

    // 2. Generate file name
    const timestamp = Date.now();
    const extension = labelFormat === 'html' ? 'html' : 'txt';
    const fileName = `${shipmentId}-${timestamp}.${extension}`;

    // 3. Upload to storage
    const labelUrl = await storageAdapter.uploadLabel(
      labelResult.labelData,
      fileName
    );

    return {
      success: true,
      labelUrl,
      labelData: labelResult.labelData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Address Operations
// ============================================================================

export async function validateDeliveryAddress(
  params: ValidateAddressParams,
  credentials: DPDCredentials
): Promise<ValidateAddressResult> {
  return await validateAddress(credentials, params);
}

export async function saveAddress(
  userId: string,
  address: Omit<SavedAddress, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  credentials: DPDCredentials,
  dbAdapter: DatabaseAdapter
): Promise<string> {
  // Validate address first
  const validation = await validateAddress(credentials, {
    postcode: address.postcode,
    town: address.town,
  });

  const now = new Date();
  const addressData: Omit<SavedAddress, 'id'> = {
    ...address,
    userId,
    validated: validation.valid,
    validatedAt: validation.valid ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };

  return await dbAdapter.createSavedAddress(addressData);
}

export async function getSavedAddresses(
  userId: string,
  dbAdapter: DatabaseAdapter
): Promise<SavedAddress[]> {
  return await dbAdapter.getSavedAddresses(userId);
}

export async function getSavedAddress(
  addressId: string,
  dbAdapter: DatabaseAdapter
): Promise<SavedAddress | null> {
  return await dbAdapter.getSavedAddress(addressId);
}

export async function updateSavedAddress(
  addressId: string,
  data: Partial<SavedAddress>,
  dbAdapter: DatabaseAdapter
): Promise<void> {
  return await dbAdapter.updateSavedAddress(addressId, data);
}

export async function deleteSavedAddress(
  addressId: string,
  dbAdapter: DatabaseAdapter
): Promise<void> {
  return await dbAdapter.deleteSavedAddress(addressId);
}

// ============================================================================
// Label Operations
// ============================================================================

export async function getLabelUrl(
  consignmentNumber: string,
  storageAdapter: StorageAdapter
): Promise<string | null> {
  try {
    const fileName = `${consignmentNumber}`;
    return await storageAdapter.getLabel(fileName);
  } catch (error) {
    console.error('Error getting label URL:', error);
    return null;
  }
}

export async function regenerateLabel(
  shipmentId: string | number,
  labelFormat: 'zpl' | 'clp' | 'epl' | 'html',
  credentials: DPDCredentials,
  storageAdapter: StorageAdapter
): Promise<GenerateLabelResult> {
  return await generateAndUploadLabel(
    shipmentId,
    labelFormat,
    credentials,
    storageAdapter
  );
}

// ============================================================================
// Utility Operations
// ============================================================================

export async function testDPDConnection(credentials: DPDCredentials): Promise<{
  success: boolean;
  message: string;
}> {
  return await testConnection(credentials);
}

export async function getAuthStatus(credentials: DPDCredentials): Promise<{
  authenticated: boolean;
  expiresAt?: Date | null;
}> {
  try {
    const geoSession = await getGeoSession(credentials);
    return {
      authenticated: !!geoSession,
      expiresAt: null,
    };
  } catch (_error) {
    return {
      authenticated: false,
    };
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  createCompleteShipment,
  generateAndUploadLabel,
  validateDeliveryAddress,
  saveAddress,
  getSavedAddresses,
  getSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  getLabelUrl,
  regenerateLabel,
  testDPDConnection,
  getAuthStatus,
};
