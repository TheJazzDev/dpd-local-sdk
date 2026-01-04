/**
 * DPD Shipping Module - Authentication Service
 *
 * Handles DPD API authentication using GeoSession
 * Manages token caching and refresh
 */

import { DPD_API } from "../config";
import type { DPDCredentials } from "../types";

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
        acceptHeader === "text/vnd.citizen-clp" ||
        acceptHeader === "text/vnd.eltron-epl" ||
        acceptHeader === "text/html";

      let data: any = null;

      // For label requests, return raw text without parsing
      if (isLabelRequest) {
        if (!response.ok) {
          throw new Error(
            `Label request failed: ${response.status} ${response.statusText}`,
          );
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
};
