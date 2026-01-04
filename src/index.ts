/**
 * DPD Local SDK
 *
 * TypeScript SDK for integrating DPD Local shipping services
 * Database-agnostic and framework-independent
 *
 * @package @your-org/dpd-local-sdk
 * @version 1.0.0
 * @author Your Name
 * @license MIT
 */

// ============================================================================
// Types
// ============================================================================

export * from "./types";

// ============================================================================
// Configuration
// ============================================================================

export {
  createDPDConfig,
  DPD_API,
  SERVICE_NAMES,
  SERVICE_DESCRIPTIONS,
  calculateDeliveryFee,
  calculateDPDCost,
  qualifiesForFreeDelivery,
  meetsMinimumOrderValue,
  getNextCollectionDate,
  getEstimatedDeliveryDate,
  getTrackingUrl,
  isValidServiceCode,
  getServiceName,
  getServiceDescription,
} from "./config";

// ============================================================================
// Core Libraries
// ============================================================================

export {
  authenticate,
  getGeoSession,
  clearGeoSession,
  hasValidToken,
  getTokenExpiry,
  authenticatedRequest,
  testConnection,
} from "./lib/auth";

export {
  createShipment,
  generateLabel,
  validateAddress,
  trackShipment,
  calculateParcels,
  validateServiceCode,
  generateConsignmentRef,
} from "./lib/shipment";

export {
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
} from "./lib/dpd-service";

// ============================================================================
// Utilities
// ============================================================================

export {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials,
  generateEncryptionKey,
  hash,
  verifyHash,
} from "./utils/encryption";

export {
  configureLogger,
  setLoggerAdapter,
  logOperation,
  loggedOperation,
  startTimer,
} from "./utils/logger";

// ============================================================================
// Default Export
// ============================================================================

export { default as DPDService } from "./lib/dpd-service";
