/**
 * DPD Shipping Module - Logger Utility
 *
 * Comprehensive logging for all DPD operations
 * Logs to database for audit trail and debugging
 */

import type { DatabaseAdapter, DPDLogDocument } from "../types";

// ============================================================================
// Logger Configuration
// ============================================================================

interface LoggerConfig {
  enabled: boolean;
  logToConsole: boolean;
  logToDatabase: boolean;
  adapter?: DatabaseAdapter;
}

const defaultConfig: LoggerConfig = {
  enabled: true,
  logToConsole: process.env.NODE_ENV !== "production",
  logToDatabase: true,
};

let config: LoggerConfig = { ...defaultConfig };

// ============================================================================
// Logger Configuration Functions
// ============================================================================

/**
 * Configure logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Set database adapter for logging
 */
export function setLoggerAdapter(adapter: DatabaseAdapter): void {
  config.adapter = adapter;
}

// ============================================================================
// Logging Functions
// ============================================================================

export interface LogParams {
  orderId: string;
  consignmentNumber?: string;
  operation: DPDLogDocument["operation"];
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
  duration: number;
  success: boolean;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * Log DPD operation
 */
export async function logOperation(params: LogParams): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const logData: Omit<DPDLogDocument, "id"> = {
    orderId: params.orderId,
    consignmentNumber: params.consignmentNumber,
    operation: params.operation,
    request: {
      endpoint: sanitizeEndpoint(params.request.endpoint),
      method: params.request.method,
      headers: sanitizeHeaders(params.request.headers),
      body: sanitizeBody(params.request.body),
    },
    response: {
      status: params.response.status,
      headers: sanitizeHeaders(params.response.headers),
      body: sanitizeBody(params.response.body),
    },
    duration: params.duration,
    success: params.success,
    error: params.error,
    createdAt: new Date().toISOString(),
  };

  // Log to console in development
  if (config.logToConsole) {
    logToConsole(logData);
  }

  // Log to database
  if (config.logToDatabase && config.adapter) {
    try {
      await config.adapter.createDPDLog(logData);
    } catch (error) {
      console.error("Failed to log to database:", error);
    }
  }
}

/**
 * Create a timer for measuring operation duration
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Wrap async operation with logging
 */
export async function loggedOperation<T>(
  params: {
    orderId: string;
    consignmentNumber?: string;
    operation: DPDLogDocument["operation"];
    endpoint: string;
    method: string;
    requestBody?: any;
  },
  operation: () => Promise<{
    data: T;
    status: number;
    headers?: Record<string, string>;
  }>,
): Promise<T> {
  const timer = startTimer();

  try {
    const result = await operation();

    await logOperation({
      orderId: params.orderId,
      consignmentNumber: params.consignmentNumber,
      operation: params.operation,
      request: {
        endpoint: params.endpoint,
        method: params.method,
        body: params.requestBody,
      },
      response: {
        status: result.status,
        headers: result.headers,
        body: result.data,
      },
      duration: timer(),
      success: true,
    });

    return result.data;
  } catch (error) {
    const errorInfo = {
      code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    };

    await logOperation({
      orderId: params.orderId,
      consignmentNumber: params.consignmentNumber,
      operation: params.operation,
      request: {
        endpoint: params.endpoint,
        method: params.method,
        body: params.requestBody,
      },
      response: {
        status: 500,
        body: errorInfo,
      },
      duration: timer(),
      success: false,
      error: errorInfo,
    });

    throw error;
  }
}

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize endpoint URL (remove sensitive query params)
 */
function sanitizeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    // Remove sensitive query parameters
    url.searchParams.delete("password");
    url.searchParams.delete("token");
    url.searchParams.delete("key");
    return url.toString();
  } catch {
    // Not a valid URL, return as is
    return endpoint;
  }
}

/**
 * Sanitize headers (remove sensitive data)
 */
function sanitizeHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const sanitized = { ...headers };

  // Remove sensitive headers
  delete sanitized.Authorization;
  delete sanitized.authorization;
  delete sanitized.GeoSession;
  delete sanitized["Set-Cookie"];
  delete sanitized["set-cookie"];

  return sanitized;
}

/**
 * Sanitize request/response body (remove sensitive data, limit size)
 */
function sanitizeBody(body?: any): any {
  if (!body) {
    return undefined;
  }

  // Clone body
  let sanitized = JSON.parse(JSON.stringify(body));

  // Remove sensitive fields
  if (typeof sanitized === "object") {
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.token;
    delete sanitized.geoSession;
  }

  // Convert to string and limit size (max 10KB)
  let stringified = JSON.stringify(sanitized);
  const MAX_SIZE = 10000;

  if (stringified.length > MAX_SIZE) {
    stringified = stringified.substring(0, MAX_SIZE) + "... [truncated]";
    sanitized = stringified;
  }

  return sanitized;
}

// ============================================================================
// Console Logging
// ============================================================================

/**
 * Log to console with formatting
 */
function logToConsole(logData: Omit<DPDLogDocument, "id">): void {
  const color = logData.success ? "\x1b[32m" : "\x1b[31m"; // Green or Red
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";

  console.log("\n" + "=".repeat(80));
  console.log(
    `${bold}DPD ${logData.operation.toUpperCase()}${reset} - ${logData.success ? `${color}SUCCESS${reset}` : `${color}FAILED${reset}`}`,
  );
  console.log("=".repeat(80));
  console.log(`Order ID: ${logData.orderId}`);
  if (logData.consignmentNumber) {
    console.log(`Consignment: ${logData.consignmentNumber}`);
  }
  console.log(`Request: ${logData.request.method} ${logData.request.endpoint}`);
  console.log(`Duration: ${logData.duration}ms`);
  console.log(`Status: ${logData.response.status}`);

  if (!logData.success && logData.error) {
    console.log(`${color}Error: ${logData.error.message}${reset}`);
  }

  console.log("=".repeat(80) + "\n");
}

// ============================================================================
// Export
// ============================================================================

export default {
  configureLogger,
  setLoggerAdapter,
  logOperation,
  loggedOperation,
  startTimer,
};
