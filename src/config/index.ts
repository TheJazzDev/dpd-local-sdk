/**
 * DPD Local SDK - Configuration
 *
 * Configuration factory for DPD integration
 * Allows customization for different businesses
 *
 * @package @jazzdev/dpd-local-sdk
 */

import type {
  DPDModuleConfig,
  DPDServiceCode,
  BusinessConfig,
  DPDCredentials,
} from '../types';

// ============================================================================
// DPD API Configuration
// ============================================================================

export const DPD_API = {
  BASE_URL: 'https://api.dpdlocal.co.uk',
  ENDPOINTS: {
    AUTH: '/user/?action=login',
    SHIPMENT: '/shipping/shipment',
    LABEL: '/shipping/shipment', // Will append /{shipmentId}/label/
    TRACKING: '/shipping/network/',
    // Note: Address validation uses postcodes.io API instead of DPD
  },
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// ============================================================================
// Service Names (User-Facing)
// ============================================================================

export const SERVICE_NAMES: Record<DPDServiceCode, string> = {
  '12': 'Next Day Delivery',
  '07': 'By 12 PM Delivery',
};

export const SERVICE_DESCRIPTIONS: Record<DPDServiceCode, string> = {
  '12': 'Standard next day delivery - most affordable option',
  '07': 'Premium delivery by 12 PM the next day',
};

// ============================================================================
// Config Factory Function
// ============================================================================

export interface CreateDPDConfigOptions {
  // Credentials
  credentials: DPDCredentials;

  // Business Details
  business: BusinessConfig;

  // Optional Overrides
  pricing?: {
    freeDeliveryThreshold?: number;
    flatDeliveryFee?: number;
    minimumOrderValue?: number;
    services?: {
      '12'?: {
        basePrice: number;
        perKgPrice: number;
        customerPrice: number;
      };
      '07'?: {
        basePrice: number;
        perKgPrice: number;
        customerPrice: number;
      };
    };
  };

  services?: {
    enabled?: DPDServiceCode[];
    default?: DPDServiceCode;
  };

  labels?: {
    format?: 'thermal' | 'a4';
    printer?: {
      model: string;
      dpi: number;
      speed: number;
      connection: 'USB' | 'Network';
    };
  };

  notifications?: {
    email?: {
      enabled: boolean;
      provider: 'resend' | 'sendgrid' | 'ses';
      fromEmail: string;
      adminEmail: string;
    };
    sms?: {
      enabled: boolean;
      provider: 'dpd';
    };
  };

  testMode?: boolean;
}

/**
 * Create DPD Module Configuration
 *
 * @param options - Configuration options
 * @returns Complete DPD module configuration
 *
 * @example
 * ```typescript
 * const config = createDPDConfig({
 *   credentials: {
 *     accountNumber: process.env.DPD_ACCOUNT_NUMBER!,
 *     username: process.env.DPD_USERNAME!,
 *     password: process.env.DPD_PASSWORD!,
 *   },
 *   business: {
 *     name: "Your Business Name",
 *     collectionAddress: {
 *       organisation: "Your Company",
 *       property: "Unit 1",
 *       street: "123 Main St",
 *       locality: "",
 *       town: "London",
 *       county: "Greater London",
 *       postcode: "SW1A 1AA",
 *       countryCode: "GB",
 *     },
 *     contactName: "Your Name",
 *     contactPhone: "+44...",
 *     contactEmail: "info@yourbusiness.com",
 *   },
 * });
 * ```
 */
export function createDPDConfig(
  options: CreateDPDConfigOptions
): DPDModuleConfig {
  // Default pricing
  const defaultPricing = {
    freeDeliveryThreshold: 60.0, // £60
    flatDeliveryFee: 6.0, // £6.00
    minimumOrderValue: 25.0, // £25
    services: {
      '12': {
        // Next Day
        basePrice: 6.0,
        perKgPrice: 0.3,
        customerPrice: 6.0,
      },
      '07': {
        // By 12
        basePrice: 7.0,
        perKgPrice: 0.42,
        customerPrice: 7.0,
      },
    },
  };

  // Default services
  const defaultServices = {
    enabled: ['12', '07'] as DPDServiceCode[],
    default: '12' as DPDServiceCode,
  };

  // Default labels
  const defaultLabels = {
    format: 'thermal' as const,
    printer: {
      model: 'TSC-DA210',
      dpi: 203,
      speed: 6,
      connection: 'USB' as const,
    },
  };

  // Default notifications
  const defaultNotifications = {
    email: {
      enabled: true,
      provider: 'resend' as const,
      fromEmail: options.notifications?.email?.fromEmail || '',
      adminEmail: options.notifications?.email?.adminEmail || '',
    },
    sms: {
      enabled: true,
      provider: 'dpd' as const,
    },
  };

  return {
    credentials: options.credentials,
    business: options.business,
    services: {
      ...defaultServices,
      ...options.services,
    },
    pricing: {
      ...defaultPricing,
      ...options.pricing,
      services: {
        ...defaultPricing.services,
        ...options.pricing?.services,
      },
    },
    labels: {
      ...defaultLabels,
      ...options.labels,
    },
    notifications: {
      ...defaultNotifications,
      ...options.notifications,
    },
    testMode: options.testMode ?? process.env.NODE_ENV !== 'production',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate customer-facing delivery fee
 */
export const calculateDeliveryFee = (
  subtotal: number,
  service: DPDServiceCode = '12',
  config: DPDModuleConfig
): number => {
  // Free delivery over threshold
  if (subtotal >= config.pricing.freeDeliveryThreshold) {
    return 0;
  }

  // Return service-specific fee
  return (
    config.pricing.services[service]?.customerPrice ||
    config.pricing.flatDeliveryFee
  );
};

/**
 * Calculate DPD cost (what they charge us)
 */
export const calculateDPDCost = (
  weight: number,
  service: DPDServiceCode,
  config: DPDModuleConfig
): number => {
  const serviceConfig = config.pricing.services[service];
  if (!serviceConfig) {
    throw new Error(`Invalid service code: ${service}`);
  }

  const basePrice = serviceConfig.basePrice;
  const weightCharge = weight * serviceConfig.perKgPrice;

  return basePrice + weightCharge;
};

/**
 * Check if order qualifies for free delivery
 */
export const qualifiesForFreeDelivery = (
  subtotal: number,
  config: DPDModuleConfig
): boolean => {
  return subtotal >= config.pricing.freeDeliveryThreshold;
};

/**
 * Check if order meets minimum value
 */
export const meetsMinimumOrderValue = (
  subtotal: number,
  config: DPDModuleConfig
): boolean => {
  return subtotal >= config.pricing.minimumOrderValue;
};

/**
 * Get next available collection date
 * DPD requires collection date to be today or future date
 * Excludes Sundays (DPD doesn't collect on Sundays)
 */
export const getNextCollectionDate = (): string => {
  const now = new Date();
  const collectionDate = new Date(now);

  // If it's Sunday, move to Monday
  if (collectionDate.getDay() === 0) {
    collectionDate.setDate(collectionDate.getDate() + 1);
  }

  // Format as YYYY-MM-DD
  return collectionDate.toISOString().split('T')[0];
};

/**
 * Calculate estimated delivery date
 */
export const getEstimatedDeliveryDate = (
  _service: DPDServiceCode,
  collectionDate?: string
): string => {
  const collection = collectionDate ? new Date(collectionDate) : new Date();
  const delivery = new Date(collection);

  // Next day delivery
  delivery.setDate(delivery.getDate() + 1);

  // Skip Sunday deliveries
  if (delivery.getDay() === 0) {
    delivery.setDate(delivery.getDate() + 1);
  }

  return delivery.toISOString().split('T')[0];
};

/**
 * Get DPD tracking URL
 * @param parcelNumber - 14-digit parcel tracking number
 */
export const getTrackingUrl = (parcelNumber: string): string => {
  // DPD Local tracking page with parcel number pre-filled
  return `https://track.dpdlocal.co.uk/?parcelNumber=${parcelNumber}`;
};

/**
 * Validate service code
 */
export const isValidServiceCode = (
  code: string,
  config: DPDModuleConfig
): code is DPDServiceCode => {
  return config.services.enabled.includes(code as DPDServiceCode);
};

/**
 * Get service name
 */
export const getServiceName = (code: DPDServiceCode): string => {
  return SERVICE_NAMES[code] || code;
};

/**
 * Get service description
 */
export const getServiceDescription = (code: DPDServiceCode): string => {
  return SERVICE_DESCRIPTIONS[code] || '';
};
