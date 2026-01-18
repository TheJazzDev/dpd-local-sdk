/**
 * DPD Local SDK - TypeScript Type Definitions
 *
 * Comprehensive type definitions for DPD Local API integration
 * Based on DPD Local API Specification v1.0
 *
 * @package @jazzdev/dpd-local-sdk
 * @version 1.0.0
 */

// ============================================================================
// Timestamp Type (Database-Agnostic)
// ============================================================================

/**
 * Generic timestamp type that works with any database
 * - Date: Standard JavaScript Date object
 * - { toDate(): Date }: Firestore Timestamp-like object
 * - string: ISO 8601 date string
 */
export type TimestampType = Date | { toDate(): Date } | string;

// ============================================================================
// Configuration Types
// ============================================================================

export interface DPDModuleConfig {
  credentials: DPDCredentials;
  business: BusinessConfig;
  services: ServiceConfig;
  pricing: PricingConfig;
  labels: LabelConfig;
  notifications: NotificationConfig;
  testMode: boolean;
}

export interface DPDCredentials {
  accountNumber: string;
  username: string;
  password: string;
  geoSession?: string; // Cached session token
  geoSessionExpiry?: Date;
}

export interface BusinessConfig {
  name: string;
  collectionAddress: {
    organisation: string;
    property: string;
    street: string;
    locality: string;
    town: string;
    county: string;
    postcode: string;
    countryCode: string;
  };
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export interface ServiceConfig {
  enabled: DPDServiceCode[];
  default: DPDServiceCode;
}

export interface PricingConfig {
  freeDeliveryThreshold: number; // £60
  flatDeliveryFee: number; // £6.00
  minimumOrderValue: number; // £25
  services: {
    [key in DPDServiceCode]?: {
      basePrice: number;
      perKgPrice: number;
      customerPrice: number;
    };
  };
}

export interface LabelConfig {
  format: 'zpl' | 'clp' | 'epl' | 'html';
  printer: {
    model: string; // "TSC-DA210"
    dpi: number; // 203
    speed: number; // 6 ips
    connection: 'USB' | 'Network';
  };
}

export interface NotificationConfig {
  email: {
    enabled: boolean;
    provider: 'resend' | 'sendgrid' | 'ses';
    fromEmail: string;
    adminEmail: string;
  };
  sms: {
    enabled: boolean;
    provider: 'dpd'; // DPD handles SMS
  };
}

// ============================================================================
// DPD API Types
// ============================================================================

export type DPDServiceCode = '12' | '07'; // Next Day (12), By 12 (07)

export interface DPDAuthResponse {
  data: {
    geoSession: string;
  };
}

export interface DPDAddress {
  organisation: string;
  property: string;
  street: string;
  locality: string;
  town: string;
  county: string;
  postcode: string;
  countryCode: string;
}

export interface DPDContact {
  name: string;
  telephone: string;
  email?: string;
}

export interface DPDParcel {
  weight: number; // kg
  width?: number; // cm
  height?: number; // cm
  depth?: number; // cm
}

export interface DPDService {
  network: DPDServiceCode;
  numberOfParcels: number;
  totalWeight: number;
  shippingDate: string; // YYYY-MM-DD
  deliveryDetails?: {
    notificationDetails: {
      email?: string;
      mobile?: string;
    };
  };
}

export interface DPDShipmentRequest {
  jobId: string | null;
  collectionOnDelivery: boolean;
  invoice: null;
  collectionDate: string; // YYYY-MM-DD
  consolidate: boolean;
  consignment: DPDConsignment[];
}

export interface DPDConsignment {
  consignmentNumber: string | null;
  consignmentRef: string; // Order ID
  parcel: DPDParcel[];
  collectionDetails: {
    address: DPDAddress;
    contactDetails: DPDContact;
  };
  deliveryDetails: {
    address: DPDAddress;
    contactDetails: DPDContact;
    notificationDetails: {
      email?: string;
      mobile?: string;
    };
  };
  networkCode: DPDServiceCode;
  numberOfParcels: number;
  totalWeight: number;
  shippingRef1: string; // Order ID
  shippingRef2?: string;
  shippingRef3?: string;
  deliveryInstructions?: string;
  liabilityValue?: number;
  liability?: boolean;
}

export interface DPDShipmentResponse {
  data?: {
    shipmentId: number | string;
    consolidated: boolean;
    consignmentDetail?: Array<{
      consignmentNumber: string; // 14-digit tracking number
      parcelNumbers: string[];
    }>;
    // Legacy path (some endpoints may still use this)
    consignment?: Array<{
      consignmentNumber: string;
    }>;
  };
  error?: DPDError | null;
}

export interface DPDLabelRequest {
  consignment: {
    consignmentNumber: string;
  };
}

export interface DPDLabelResponse {
  data: string; // Base64 encoded label or HTML
  error?: DPDError;
}

export interface DPDError {
  errorCode: string;
  errorMessage: string;
  obj: string;
  errorType: string;
}

// ============================================================================
// Database Types (Database-Agnostic)
// ============================================================================

export interface ShippingData {
  provider: 'dpd';
  service: DPDServiceCode;
  shipmentId: string | number; // DPD shipment ID (required for label regeneration)
  consignmentNumber: string; // 10-digit consignment reference
  parcelNumber: string; // 14-digit tracking number (what customers use)
  trackingUrl: string;
  labelUrl: string; // Storage URL
  status: ShipmentStatus;
  statusHistory: ShipmentStatusUpdate[];
  cost: {
    basePrice: number;
    weightCharge: number;
    totalCost: number; // What DPD charges us
    customerCharge: number; // What we charge customer
  };
  weight: {
    total: number; // kg
    unit: 'kg';
  };
  parcels: number;
  collectionDate: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  createdAt: TimestampType;
  updatedAt: TimestampType;
}

export type ShipmentStatus =
  | 'created'
  | 'label_generated'
  | 'collected'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface ShipmentStatusUpdate {
  status: ShipmentStatus;
  timestamp: TimestampType;
  message?: string;
  location?: string;
}

export interface SavedAddress {
  id: string;
  userId: string;
  isDefault: boolean;
  label?: string; // "Home", "Work", etc.
  organisation?: string;
  property: string;
  street: string;
  locality?: string;
  town: string;
  county?: string;
  postcode: string;
  countryCode: string;
  contactName: string;
  contactPhone: string;
  validated: boolean;
  validatedAt?: TimestampType;
  createdAt: TimestampType;
  updatedAt: TimestampType;
}

export interface DPDLogDocument {
  id: string;
  orderId: string;
  consignmentNumber?: string;
  operation:
    | 'auth'
    | 'validate_address'
    | 'create_shipment'
    | 'generate_label'
    | 'track_shipment'
    | 'webhook';
  request: {
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
  };
  duration: number; // ms
  success: boolean;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  createdAt: TimestampType;
}

// ============================================================================
// Service Layer Types
// ============================================================================

export interface CreateShipmentParams {
  orderId: string;
  orderRef: string;
  service: DPDServiceCode;
  deliveryAddress: SavedAddress;
  totalWeight: number;
  numberOfParcels: number;
  customerEmail: string;
  customerPhone?: string;
  deliveryInstructions?: string;
  collectionDate: string;
}

export interface CreateShipmentResult {
  success: boolean;
  shipmentId?: string | number;
  consignmentNumber?: string;
  parcelNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface GenerateLabelParams {
  shipmentId: string | number;
  labelFormat: 'zpl' | 'clp' | 'epl' | 'html';
}

export interface GenerateLabelResult {
  success: boolean;
  labelUrl?: string;
  labelData?: string;
  error?: string;
}

export interface ValidateAddressParams {
  postcode: string;
  town: string;
}

export interface ValidateAddressResult {
  valid: boolean;
  serviceable: boolean;
  message?: string;
}

export interface TrackShipmentParams {
  consignmentNumber: string;
}

export interface TrackShipmentResult {
  success: boolean;
  status?: ShipmentStatus;
  statusHistory?: ShipmentStatusUpdate[];
  estimatedDelivery?: string;
  actualDelivery?: string;
  error?: string;
}

// ============================================================================
// Adapter Interfaces
// ============================================================================

export interface DatabaseAdapter {
  // Orders
  getOrder(orderId: string): Promise<any>;
  updateOrder(orderId: string, data: any): Promise<void>;

  // Saved Addresses
  getSavedAddresses(userId: string): Promise<SavedAddress[]>;
  getSavedAddress(addressId: string): Promise<SavedAddress | null>;
  createSavedAddress(address: Omit<SavedAddress, 'id'>): Promise<string>;
  updateSavedAddress(
    addressId: string,
    data: Partial<SavedAddress>
  ): Promise<void>;
  deleteSavedAddress(addressId: string): Promise<void>;

  // DPD Logs
  createDPDLog(log: Omit<DPDLogDocument, 'id'>): Promise<string>;
  getDPDLogs(filters: LogFilters): Promise<DPDLogDocument[]>;
}

export interface StorageAdapter {
  uploadLabel(labelData: string, fileName: string): Promise<string>;
  getLabel(fileName: string): Promise<string>;
  deleteLabel(fileName: string): Promise<void>;
}

export interface LogFilters {
  orderId?: string;
  consignmentNumber?: string;
  operation?: DPDLogDocument['operation'];
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// ============================================================================
// Geo Session Storage Adapter
// ============================================================================

/**
 * Storage adapter interface for persisting geo session tokens
 *
 * Implement this interface to provide persistent storage for geo sessions
 * across application restarts. Supports any storage backend (Firestore,
 * Redis, PostgreSQL, file system, etc.)
 *
 * @example Firestore Implementation
 * ```typescript
 * const firestoreStorage: GeoSessionStorage = {
 *   async get() {
 *     const doc = await firestore.collection('config').doc('dpd').get();
 *     const data = doc.data();
 *     return data?.geoSession ? {
 *       geoSession: data.geoSession,
 *       expiry: new Date(data.geoSessionExpiry)
 *     } : null;
 *   },
 *   async set(geoSession, expiry) {
 *     await firestore.collection('config').doc('dpd').set({
 *       geoSession,
 *       geoSessionExpiry: expiry.toISOString()
 *     }, { merge: true });
 *   },
 *   async clear() {
 *     await firestore.collection('config').doc('dpd').update({
 *       geoSession: null,
 *       geoSessionExpiry: null
 *     });
 *   }
 * };
 * ```
 */
export interface GeoSessionStorage {
  /**
   * Get stored geo session and expiry
   * @returns Stored session data or null if not found/expired
   */
  get(): Promise<{ geoSession: string; expiry: Date } | null>;

  /**
   * Store geo session and expiry
   * @param geoSession - The geo session token
   * @param expiry - Expiry date/time
   */
  set(geoSession: string, expiry: Date): Promise<void>;

  /**
   * Clear stored geo session
   */
  clear(): Promise<void>;
}

/**
 * In-memory storage adapter (default, no persistence)
 * Session will be lost on application restart
 */
export class InMemoryGeoSessionStorage implements GeoSessionStorage {
  private geoSession: string | null = null;
  private expiry: Date | null = null;

  async get(): Promise<{ geoSession: string; expiry: Date } | null> {
    if (!this.geoSession || !this.expiry) {
      return null;
    }
    return { geoSession: this.geoSession, expiry: this.expiry };
  }

  async set(geoSession: string, expiry: Date): Promise<void> {
    this.geoSession = geoSession;
    this.expiry = expiry;
  }

  async clear(): Promise<void> {
    this.geoSession = null;
    this.expiry = null;
  }
}
