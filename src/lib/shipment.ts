/**
 * DPD Shipping Module - Shipment Service
 *
 * Handles shipment creation, label generation, and tracking
 */

import { authenticatedRequest } from "./auth";
import { DPD_API, getTrackingUrl, getNextCollectionDate } from "../config";
import type {
  DPDCredentials,
  CreateShipmentParams,
  CreateShipmentResult,
  GenerateLabelParams,
  GenerateLabelResult,
  ValidateAddressParams,
  ValidateAddressResult,
  TrackShipmentParams,
  TrackShipmentResult,
  DPDParcel,
  DPDConsignment,
  DPDShipmentRequest,
  DPDShipmentResponse,
  DPDServiceCode,
  ShipmentStatusUpdate,
} from "../types";

// ============================================================================
// Shipment Creation
// ============================================================================

/**
 * Create a shipment with DPD
 *
 * @param credentials - DPD account credentials
 * @param params - Shipment parameters
 * @returns Shipment creation result with consignment number
 */
export async function createShipment(
  credentials: DPDCredentials,
  params: CreateShipmentParams,
  businessConfig: any,
): Promise<CreateShipmentResult> {
  try {
    const {
      orderId,
      orderRef,
      service,
      deliveryAddress,
      totalWeight,
      numberOfParcels,
      customerEmail,
      customerPhone,
      deliveryInstructions,
      collectionDate,
    } = params;

    // Calculate parcel weight distribution
    const weightPerParcel = totalWeight / numberOfParcels;

    // Build parcels array
    const parcels: DPDParcel[] = Array.from(
      { length: numberOfParcels },
      () => ({
        weight: parseFloat(weightPerParcel.toFixed(2)),
      }),
    );

    // Build consignment
    const consignment: DPDConsignment = {
      consignmentNumber: null,
      consignmentRef: orderRef,
      parcel: parcels,
      collectionDetails: {
        address: businessConfig.collectionAddress,
        contactDetails: {
          name: businessConfig.contactName,
          telephone: businessConfig.contactPhone,
          email: businessConfig.contactEmail,
        },
      },
      deliveryDetails: {
        address: {
          organisation: deliveryAddress.organisation || "",
          property: deliveryAddress.property,
          street: deliveryAddress.street,
          locality: deliveryAddress.locality || "",
          town: deliveryAddress.town,
          county: deliveryAddress.county || "",
          postcode: deliveryAddress.postcode,
          countryCode: deliveryAddress.countryCode,
        },
        contactDetails: {
          name: deliveryAddress.contactName,
          telephone: deliveryAddress.contactPhone,
          email: customerEmail,
        },
        notificationDetails: {
          email: customerEmail,
          mobile: customerPhone,
        },
      },
      networkCode: service,
      numberOfParcels,
      totalWeight: parseFloat(totalWeight.toFixed(2)),
      shippingRef1: orderId,
      shippingRef2: orderRef,
      shippingRef3: `FJ-${Date.now()}`, // Unique reference
      deliveryInstructions: deliveryInstructions || undefined,
      liability: false,
    };

    // Build shipment request
    const shipmentRequest: DPDShipmentRequest = {
      jobId: null,
      collectionOnDelivery: false,
      invoice: null,
      collectionDate: collectionDate || getNextCollectionDate(),
      consolidate: false,
      consignment: [consignment],
    };

    // Make API request
    const response = await authenticatedRequest<DPDShipmentResponse>(
      credentials,
      {
        method: "POST",
        endpoint: DPD_API.ENDPOINTS.SHIPMENT,
        body: shipmentRequest,
      },
    );

    const responseData = response.data as any;

    // Extract shipmentId (needed for label generation)
    const shipmentId = responseData?.shipmentId;

    // Extract consignment number (10 digits)
    const consignmentNumber =
      responseData?.consignment?.[0]?.consignmentNumber ||
      responseData?.consignmentDetail?.[0]?.consignmentNumber;

    // Extract parcel number (14 digits - what customers use for tracking)
    const parcelNumbers =
      responseData?.consignment?.[0]?.parcelNumbers ||
      responseData?.consignmentDetail?.[0]?.parcelNumbers;
    const parcelNumber = parcelNumbers?.[0]; // Take first parcel number

    if (!consignmentNumber || !shipmentId || !parcelNumber) {
      return {
        success: false,
        error: `Missing required data: ${!shipmentId ? "shipmentId" : !consignmentNumber ? "consignmentNumber" : "parcelNumber"}`,
        errorCode: "INCOMPLETE_RESPONSE",
      };
    }

    // Generate tracking URL using parcel number (14 digits)
    const trackingUrl = getTrackingUrl(parcelNumber);

    return {
      success: true,
      shipmentId,
      consignmentNumber,
      parcelNumber,
      trackingUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: "SHIPMENT_CREATION_FAILED",
    };
  }
}

// ============================================================================
// Label Generation
// ============================================================================

/**
 * Generate shipping label
 *
 * @param credentials - DPD account credentials
 * @param params - Label generation parameters (shipmentId and format)
 * @returns Label data (base64 or HTML)
 */
export async function generateLabel(
  credentials: DPDCredentials,
  params: GenerateLabelParams,
): Promise<GenerateLabelResult> {
  try {
    const { shipmentId, format } = params;

    // Determine content type based on format
    const contentType =
      format === "thermal" ? "text/vnd.citizen-clp" : "text/html";

    // Build endpoint with shipmentId: /shipping/shipment/{shipmentId}/label/
    const endpoint = `${DPD_API.ENDPOINTS.LABEL}/${shipmentId}/label/`;

    // Make API request - this is a GET request, not POST
    const response = await authenticatedRequest<string>(credentials, {
      method: "GET",
      endpoint: endpoint,
      headers: {
        Accept: contentType,
      },
    });

    // Response should be the label data directly (not wrapped in {data: ...})
    if (
      !response ||
      (typeof response === "object" && !(response as any).data)
    ) {
      return {
        success: false,
        error: "No label data received from DPD",
      };
    }

    return {
      success: true,
      labelData:
        typeof response === "string" ? response : (response as any).data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Address Validation
// ============================================================================

/**
 * Validate delivery address using UK Postcodes API
 *
 * Note: DPD doesn't provide a simple address validation endpoint.
 * We use the free postcodes.io API for UK postcode validation.
 *
 * @param credentials - DPD account credentials (not used for postcode lookup)
 * @param params - Address to validate
 * @returns Validation result
 */
export async function validateAddress(
  _credentials: DPDCredentials,
  params: ValidateAddressParams,
): Promise<ValidateAddressResult> {
  try {
    const { postcode, town } = params;

    // Clean postcode (remove spaces, uppercase)
    const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase();

    // Validate postcode format (UK format: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA)
    const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/;
    if (!postcodeRegex.test(cleanPostcode)) {
      return {
        valid: false,
        serviceable: false,
        message: "Invalid UK postcode format",
      };
    }

    // Use free UK Postcodes API to validate postcode
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          serviceable: false,
          message: "Postcode not found in UK database",
        };
      }
      throw new Error(`Postcode lookup failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    if (!data.result) {
      return {
        valid: false,
        serviceable: false,
        message: "Invalid postcode",
      };
    }

    // Check if postcode is in England, Wales, or Scotland (DPD coverage)
    const country = data.result.country as string;
    const serviceable = ["England", "Wales", "Scotland"].includes(country);

    // Optional: Check if town matches (case-insensitive)
    const returnedTown = (data.result.admin_district || data.result.parish || "") as string;
    const townMatch = town
      ? returnedTown.toLowerCase().includes(town.toLowerCase()) ||
        town.toLowerCase().includes(returnedTown.toLowerCase())
      : true;

    if (!townMatch) {
      return {
        valid: true,
        serviceable,
        message: `Postcode valid but town mismatch. Expected: ${returnedTown}`,
      };
    }

    return {
      valid: true,
      serviceable,
      message: serviceable
        ? "Address is valid and serviceable by DPD"
        : `Address is valid but may not be serviceable by DPD (${country})`,
    };
  } catch (error) {
    return {
      valid: false,
      serviceable: false,
      message:
        error instanceof Error ? error.message : "Address validation failed",
    };
  }
}

// ============================================================================
// Shipment Tracking
// ============================================================================

/**
 * Response shape for DPD shipment tracking endpoint
 */
export interface DPDTrackingEvent {
  status: string;
  timestamp: string;
  message?: string;
  location?: string;
}

export interface DPDTrackingResponse {
  data?: {
    status?: string;
    history?: DPDTrackingEvent[];
    estimatedDelivery?: string;
    actualDelivery?: string;
    [key: string]: unknown;
  };
  error?: {
    errorCode?: string | number;
    errorMessage?: string;
  };
}

/**
 * Track shipment status
 *
 * @param credentials - DPD account credentials
 * @param params - Tracking parameters
 * @returns Tracking result with status history
 */
export async function trackShipment(
  credentials: DPDCredentials,
  params: TrackShipmentParams,
): Promise<TrackShipmentResult> {
  try {
    const { consignmentNumber } = params;

    const response = await authenticatedRequest<DPDTrackingResponse>(
      credentials,
      {
        method: "GET",
        endpoint: `${DPD_API.ENDPOINTS.TRACKING}${consignmentNumber}`,
      },
    );

    if (!response.data) {
      return {
        success: false,
        error: "No tracking data available",
      };
    }

    const status = mapDPDStatus(response.data.status ?? "UNKNOWN");

    // Convert DPD tracking events to our internal format
    const statusHistory = response.data.history
      ? response.data.history.map(
          (event): ShipmentStatusUpdate => ({
            status: mapDPDStatus(event.status),
            timestamp: new Date(event.timestamp).toISOString(),
            message: event.message,
            location: event.location,
          }),
        )
      : undefined;

    return {
      success: true,
      status,
      statusHistory,
      estimatedDelivery: response.data.estimatedDelivery,
      actualDelivery: response.data.actualDelivery,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Tracking failed",
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map DPD status codes to our internal status
 */
function mapDPDStatus(dpdStatus: string): any {
  const statusMap: Record<string, string> = {
    CREATED: "created",
    "LABEL GENERATED": "label_generated",
    COLLECTED: "collected",
    "IN TRANSIT": "in_transit",
    "OUT FOR DELIVERY": "out_for_delivery",
    DELIVERED: "delivered",
    FAILED: "failed",
    CANCELLED: "cancelled",
  };

  return statusMap[dpdStatus.toUpperCase()] || "created";
}

/**
 * Calculate number of parcels based on weight
 * DPD has weight limits per parcel (typically 30kg max)
 */
export function calculateParcels(totalWeight: number): number {
  const MAX_PARCEL_WEIGHT = 30; // kg

  if (totalWeight <= MAX_PARCEL_WEIGHT) {
    return 1;
  }

  return Math.ceil(totalWeight / MAX_PARCEL_WEIGHT);
}

/**
 * Validate service code
 */
export function validateServiceCode(code: string): code is DPDServiceCode {
  return code === "12" || code === "07";
}

/**
 * Generate unique consignment reference
 */
export function generateConsignmentRef(orderId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FJ-${orderId}-${timestamp}${random}`;
}

// ============================================================================
// Export
// ============================================================================

export default {
  createShipment,
  generateLabel,
  validateAddress,
  trackShipment,
  calculateParcels,
  validateServiceCode,
  generateConsignmentRef,
};
