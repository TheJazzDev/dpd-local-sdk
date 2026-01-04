/**
 * DPD Shipping Module - Encryption Utilities
 *
 * Handles encryption/decryption of sensitive data (DPD credentials)
 * Uses Node.js crypto for server-side encryption
 */

import crypto from "crypto";

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// ============================================================================
// Encryption Key Management
// ============================================================================

/**
 * Get encryption key from environment or generate one
 * IMPORTANT: Store this in environment variables in production
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.DPD_ENCRYPTION_KEY;

  if (envKey) {
    return Buffer.from(envKey, "hex");
  }

  // In development, use a consistent key
  // WARNING: This should NEVER be used in production
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "⚠️  Using default encryption key. Set DPD_ENCRYPTION_KEY in production!",
    );
    return crypto.scryptSync("dpd-dev-key", "salt", KEY_LENGTH);
  }

  throw new Error(
    "DPD_ENCRYPTION_KEY environment variable is required in production",
  );
}

/**
 * Generate a new encryption key
 * Run this once and store the output in DPD_ENCRYPTION_KEY environment variable
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString("hex");
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt sensitive data
 *
 * @param text - Plain text to encrypt
 * @returns Encrypted data as hex string
 */
export function encrypt(text: string): string {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key and salt
    const key = crypto.scryptSync(getEncryptionKey(), salt, KEY_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    // Return as hex string
    return result.toString("hex");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt encrypted data
 *
 * @param encryptedHex - Encrypted data as hex string
 * @returns Decrypted plain text
 */
export function decrypt(encryptedHex: string): string {
  try {
    // Convert from hex
    const data = Buffer.from(encryptedHex, "hex");

    // Extract components
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);

    // Derive key from master key and salt
    const key = crypto.scryptSync(getEncryptionKey(), salt, KEY_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Encrypt DPD credentials
 *
 * @param credentials - Plain credentials object
 * @returns Encrypted credentials object
 */
export function encryptCredentials(credentials: {
  accountNumber: string;
  username: string;
  password: string;
}): {
  accountNumber: string;
  username: string;
  passwordHash: string;
} {
  return {
    accountNumber: credentials.accountNumber,
    username: credentials.username,
    passwordHash: encrypt(credentials.password),
  };
}

/**
 * Decrypt DPD credentials
 *
 * @param encryptedCredentials - Encrypted credentials object
 * @returns Plain credentials object
 */
export function decryptCredentials(encryptedCredentials: {
  accountNumber: string;
  username: string;
  passwordHash: string;
}): {
  accountNumber: string;
  username: string;
  password: string;
} {
  return {
    accountNumber: encryptedCredentials.accountNumber,
    username: encryptedCredentials.username,
    password: decrypt(encryptedCredentials.passwordHash),
  };
}

// ============================================================================
// Hash Functions (for non-reversible encryption)
// ============================================================================

/**
 * Create SHA-256 hash of data
 * Useful for data integrity checks
 *
 * @param data - Data to hash
 * @returns Hash as hex string
 */
export function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Verify hash matches data
 *
 * @param data - Original data
 * @param hash - Hash to verify against
 * @returns true if hash matches
 */
export function verifyHash(data: string, hashToVerify: string): boolean {
  const computed = hash(data);
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(hashToVerify),
  );
}

// ============================================================================
// Export
// ============================================================================

export default {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials,
  generateEncryptionKey,
  hash,
  verifyHash,
};
