/**
 * DPD Shipping Module - Authentication Service
 *
 * Handles DPD API authentication using GeoSession
 * Manages token caching and refresh with optional persistent storage
 */

import { DPD_API } from "../config";
import type { DPDCredentials, GeoSessionStorage } from "../types";
import { InMemoryGeoSessionStorage } from "../types";

// ============================================================================
// In-Memory Token Cache
// ============================================================================

interface TokenCache {
  geoSession: string | null;
  expiry: Date | null;
}

const tokenCache: TokenCache = {
  geoSession: null,
  expiry: null,
};

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Authenticate with DPD API and get GeoSession token
 *
 * @param credentials - DPD account credentials
 * @returns GeoSession token
 * @throws Error if authentication fails
 */
export async function authenticate(
  credentials: DPDCredentials,
): Promise<string> {
  const { username, password } = credentials;

  const authHeader = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await fetch(`${DPD_API.BASE_URL}${DPD_API.ENDPOINTS.AUTH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${authHeader}`,
    },
    signal: AbortSignal.timeout(DPD_API.TIMEOUT),
  });

  const raw = await response.text();

  let payload: any;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    if (!response.ok) {
      throw new Error(`Authentication failed: ${raw || response.statusText}`);
    }
    throw new Error("Invalid JSON response from DPD API");
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.errorMessage ??
        `Authentication failed: ${response.status} ${response.statusText}`,
    );
  }

  if (payload?.error) {
    throw new Error(payload.error.errorMessage ?? "Authentication failed");
  }

  const geoSession = payload?.data?.geoSession;

  if (!geoSession) {
    throw new Error("No GeoSession token received from DPD");
  }

  tokenCache.geoSession = geoSession;
  tokenCache.expiry = new Date(Date.now() + 90 * 60 * 1000);

  return geoSession;
}

/**
 * Get valid GeoSession token
 * Returns cached token if valid, otherwise authenticates
 *
 * @param credentials - DPD account credentials
 * @param forceRefresh - Force new authentication even if token is cached
 * @returns GeoSession token
 */
export async function getGeoSession(
  credentials: DPDCredentials,
  forceRefresh = false,
): Promise<string> {
  // Check if we have a valid cached token
  if (
    !forceRefresh &&
    tokenCache.geoSession &&
    tokenCache.expiry &&
    tokenCache.expiry > new Date()
  ) {
    return tokenCache.geoSession;
  }

  // Token expired or not cached, authenticate
  return await authenticate(credentials);
}

/**
 * Clear cached GeoSession token
 * Useful for testing or when credentials change
 */
export function clearGeoSession(): void {
  tokenCache.geoSession = null;
  tokenCache.expiry = null;
}

/**
 * Check if cached token is valid
 *
 * @returns true if token is cached and not expired
 */
export function hasValidToken(): boolean {
  return !!(
    tokenCache.geoSession &&
    tokenCache.expiry &&
    tokenCache.expiry > new Date()
  );
}

/**
 * Get token expiry time
 *
 * @returns Date of token expiry or null if no token
 */
export function getTokenExpiry(): Date | null {
  return tokenCache.expiry;
}

// ============================================================================
// Authenticated Request Wrapper
// ============================================================================

export interface DPDRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
  retry?: boolean;
  retryAttempts?: number;
}

/**
 * Make authenticated request to DPD API
 * Automatically handles authentication and retries
 *
 * @param credentials - DPD account credentials
 * @param options - Request options
 * @returns Response data
 */
export async function authenticatedRequest<T = unknown>(
  credentials: DPDCredentials,
  options: DPDRequestOptions,
): Promise<T> {
  const {
    method,
    endpoint,
    body,
    headers = {},
    retry = true,
    retryAttempts = DPD_API.RETRY_ATTEMPTS,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      const geoSession = await getGeoSession(credentials, attempt > 0);

      const url = endpoint.startsWith("http")
        ? endpoint
        : `${DPD_API.BASE_URL}${endpoint}`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          GeoSession: geoSession,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(DPD_API.TIMEOUT),
      });

      const raw = await response.text();

      // Check if we're expecting non-JSON response (e.g., label data)
      const acceptHeader = headers.Accept || headers.accept;
      const isLabelRequest =
        acceptHeader === "text/vnd.zebra-zpl" ||
        acceptHeader === "text/vnd.citizen-clp" ||
        acceptHeader === "text/vnd.eltron-epl" ||
        acceptHeader === "text/html";

      let data: any = null;

      // For label requests, check if it's actually an error response in JSON format
      if (isLabelRequest) {
        if (!response.ok) {
          throw new Error(
            `Label request failed: ${response.status} ${response.statusText}`,
          );
        }

        // DPD sometimes returns JSON error responses even for label requests
        // Try to parse as JSON to check for errors
        try {
          const parsed = JSON.parse(raw);

          // Check if this is an error response (has error property or data is null/empty)
          if (parsed?.error || parsed?.data === null) {
            // Extract error information
            const errorObj = parsed?.error;
            let errorMessage = 'Label generation failed';
            let errorCode = 'UNKNOWN';

            if (errorObj) {
              // Handle error array format
              if (Array.isArray(errorObj)) {
                const firstError = errorObj[0];
                errorMessage = firstError?.errorMessage || errorMessage;
                errorCode = firstError?.errorCode || errorCode;
              }
              // Handle single error object format
              else if (errorObj.errorMessage) {
                errorMessage = errorObj.errorMessage;
                errorCode = errorObj.errorCode || errorObj.name || errorCode;
              } else if (errorObj.name) {
                errorMessage = errorObj.name;
                errorCode = errorObj.name;
                // Check if there are detailed errors
                if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
                  const detailedError = errorObj.errors[0];
                  errorMessage = detailedError.errorMessage || detailedError.message || errorMessage;
                  errorCode = detailedError.errorCode || errorCode;
                }
              }
            }

            throw new Error(`DPD API Error ${errorCode}: ${errorMessage}`);
          }
          // If JSON parsed successfully but looks like valid data, return it
          if (parsed?.data) {
            return parsed.data as T;
          }
          // If JSON parsed but unexpected format, fall through to return raw
        } catch (parseError) {
          // If it's our thrown error, re-throw it
          if (parseError instanceof Error && parseError.message.startsWith('DPD API Error')) {
            throw parseError;
          }
          // If parsing fails, it's probably valid label data (ZPL/CLP/HTML)
          // Continue and return raw text
        }

        return raw as T;
      }

      // For JSON responses, parse as usual
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        if (!response.ok) {
          throw new Error(raw || response.statusText);
        }
        throw new Error("Invalid JSON response from DPD API");
      }

      // Check if request actually failed
      // DPD API sometimes returns both error AND data - if data exists, it's a warning, not a failure
      const hasData = data?.data && Object.keys(data.data).length > 0;
      const hasError = data?.error;

      if (!response.ok || (hasError && !hasData)) {
        // Log detailed error information for debugging
        if (hasError) {
          console.error(`\n❌ DPD API Error Response:`);
          console.error(
            `   HTTP Status: ${response.status} ${response.statusText}`,
          );
          console.error(
            `   Error Object:`,
            JSON.stringify(data.error, null, 2),
          );
          console.error(`   Full Response:`, JSON.stringify(data, null, 2));
        }

        if (response.status === 401 && retry && attempt < retryAttempts - 1) {
          clearGeoSession();
          await delay(DPD_API.RETRY_DELAY * (attempt + 1));
          continue;
        }

        throw new Error(
          data?.error?.errorMessage ??
            data?.error?.errorAction ??
            data?.error?.obj ??
            JSON.stringify(data?.error) ??
            `Request failed: ${response.statusText}`,
        );
      }

      // Log warnings but continue (DPD returned data despite errors)
      if (hasError && hasData) {
        console.warn(`\n⚠️ DPD API Warning (data was still returned):`);
        console.warn(`   Warning:`, JSON.stringify(data.error, null, 2));
        console.warn(`   Data returned successfully despite warning`);
      }

      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (!retry || attempt >= retryAttempts - 1) {
        throw lastError;
      }

      await delay(DPD_API.RETRY_DELAY * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Test Connection
// ============================================================================

/**
 * Test DPD API connection
 * Useful for verifying credentials in admin panel
 *
 * @param credentials - DPD account credentials
 * @returns true if connection successful
 */
export async function testConnection(
  credentials: DPDCredentials,
): Promise<{ success: boolean; message: string }> {
  try {
    // Clear any cached tokens to force fresh authentication
    clearGeoSession();

    // Attempt authentication
    const geoSession = await authenticate(credentials);

    if (!geoSession) {
      return {
        success: false,
        message: "Authentication succeeded but no token received",
      };
    }

    return {
      success: true,
      message: "Successfully connected to DPD API",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to connect to DPD API",
    };
  }
}

// ============================================================================
// Geo Session Manager (New Adapter-Based Approach)
// ============================================================================

/**
 * Geo Session Manager with adapter pattern
 *
 * Manages DPD geo session lifecycle with persistent storage support.
 * Handles authentication, caching, refresh logic, and automatic retries.
 *
 * @example Basic Usage (In-Memory)
 * ```typescript
 * const manager = new GeoSessionManager(credentials);
 * const session = await manager.getValidGeoSession();
 * ```
 *
 * @example With Persistent Storage (Firestore)
 * ```typescript
 * const storage: GeoSessionStorage = {
 *   async get() { ... },
 *   async set(session, expiry) { ... },
 *   async clear() { ... }
 * };
 * const manager = new GeoSessionManager(credentials, storage);
 * const session = await manager.getValidGeoSession();
 * ```
 */
export class GeoSessionManager {
  private credentials: DPDCredentials;
  private storage: GeoSessionStorage;
  private maxRetries: number;
  private baseRetryDelay: number;

  /**
   * Create a new Geo Session Manager
   *
   * @param credentials - DPD API credentials
   * @param storage - Storage adapter for persistence (optional, defaults to in-memory)
   * @param options - Configuration options
   */
  constructor(
    credentials: DPDCredentials,
    storage?: GeoSessionStorage,
    options?: {
      maxRetries?: number;
      baseRetryDelay?: number;
    }
  ) {
    this.credentials = credentials;
    this.storage = storage || new InMemoryGeoSessionStorage();
    this.maxRetries = options?.maxRetries ?? 3;
    this.baseRetryDelay = options?.baseRetryDelay ?? 2000; // 2 seconds
  }

  /**
   * Get a valid geo session token
   *
   * - Loads from persistent storage if available and valid
   * - Automatically refreshes if expired or not found
   * - Retries with exponential backoff on failure
   * - Saves to persistent storage after refresh
   *
   * @returns Valid geo session token
   * @throws Error if authentication fails after retries
   */
  async getValidGeoSession(): Promise<string> {
    try {
      // Step 1: Try to load from storage
      const stored = await this.storage.get();

      if (stored && this.isSessionValid(stored.geoSession, stored.expiry)) {
        console.log('✅ Using cached geo session from storage');
        return stored.geoSession;
      }

      // Step 2: Need new session - authenticate with retry logic
      console.log('🔄 Fetching new geo session from DPD API...');

      const { geoSession, expiry } = await this.authenticateWithRetry();

      console.log('✅ Successfully fetched new geo session');

      // Step 3: Save to storage
      await this.storage.set(geoSession, expiry);

      return geoSession;
    } catch (error) {
      console.error("❌ Error managing geo session:", error);
      throw new Error(
        `Failed to get valid geo session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Force refresh the geo session
   * Clears cache and fetches a new token
   *
   * @returns New geo session token
   */
  async refreshGeoSession(): Promise<string> {
    await this.storage.clear();
    return this.getValidGeoSession();
  }

  /**
   * Clear stored geo session
   */
  async clearGeoSession(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Check if a session is valid
   */
  private isSessionValid(geoSession: string | null, expiry: Date | null): boolean {
    if (!geoSession || !expiry) {
      return false;
    }

    const now = new Date();
    const expiryDate = expiry instanceof Date ? expiry : new Date(expiry);

    // Check if expired
    if (expiryDate <= now) {
      return false;
    }

    // DPD recommendation: Refresh at start of each day
    // Check if expiry is today but we should refresh for the new day
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryStartOfDay = new Date(
      expiryDate.getFullYear(),
      expiryDate.getMonth(),
      expiryDate.getDate()
    );

    // If expiry is today, check if session is over 12 hours old
    if (expiryStartOfDay.getTime() === startOfToday.getTime()) {
      // DPD sessions last 90 minutes, so if we're starting a new day, refresh
      const sessionCreatedAt = new Date(expiryDate.getTime() - 90 * 60 * 1000);
      const hoursSinceCreation = (now.getTime() - sessionCreatedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreation > 12) {
        return false; // Refresh if session is over 12 hours old
      }
    }

    return true;
  }

  /**
   * Authenticate with retry logic and exponential backoff
   */
  private async authenticateWithRetry(): Promise<{ geoSession: string; expiry: Date }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${this.maxRetries} to fetch geo session...`);

        const geoSession = await this.authenticate();
        const expiry = new Date(Date.now() + 90 * 60 * 1000); // 90 minutes

        return { geoSession, expiry };
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Attempt ${attempt}/${this.maxRetries} failed:`, error);

        if (attempt < this.maxRetries) {
          // Calculate delay with exponential backoff: 2s, 4s, 8s
          const delay = this.baseRetryDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to authenticate after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Authenticate with DPD API
   */
  private async authenticate(): Promise<string> {
    const { username, password } = this.credentials;
    const authHeader = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(`${DPD_API.BASE_URL}${DPD_API.ENDPOINTS.AUTH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      signal: AbortSignal.timeout(DPD_API.TIMEOUT),
    });

    const raw = await response.text();

    let payload: any;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      if (!response.ok) {
        throw new Error(`Authentication failed: ${raw || response.statusText}`);
      }
      throw new Error("Invalid JSON response from DPD API");
    }

    if (!response.ok) {
      throw new Error(
        payload?.error?.errorMessage ??
          `Authentication failed: ${response.status} ${response.statusText}`,
      );
    }

    if (payload?.error) {
      throw new Error(payload.error.errorMessage ?? "Authentication failed");
    }

    const geoSession = payload?.data?.geoSession;

    if (!geoSession) {
      throw new Error("No GeoSession token received from DPD");
    }

    return geoSession;
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  authenticate,
  getGeoSession,
  clearGeoSession,
  hasValidToken,
  getTokenExpiry,
  authenticatedRequest,
  testConnection,
  GeoSessionManager,
};
