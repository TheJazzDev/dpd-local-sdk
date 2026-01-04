/**
 * Firebase Storage Adapter Example
 *
 * This is a reference implementation of the StorageAdapter interface
 * for Firebase Storage (Admin SDK).
 */

import { Storage } from "firebase-admin/storage";
import type { StorageAdapter } from "@your-org/dpd-local-sdk";

/**
 * Firebase Storage Adapter
 * Use this on the server-side (Node.js, Next.js API routes, etc.)
 */
export class FirebaseStorageAdapter implements StorageAdapter {
  constructor(
    private storage: Storage,
    private bucketName?: string
  ) {}

  async uploadLabel(labelData: string, fileName: string): Promise<string> {
    const bucket = this.bucketName
      ? this.storage.bucket(this.bucketName)
      : this.storage.bucket();

    const file = bucket.file(`dpd-labels/${fileName}`);

    // Determine content type based on file extension
    const contentType = fileName.endsWith(".html")
      ? "text/html"
      : "text/plain";

    await file.save(labelData, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000", // 1 year
      },
    });

    // Make file publicly readable
    await file.makePublic();

    // Return public URL
    return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  }

  async getLabel(fileName: string): Promise<string> {
    const bucket = this.bucketName
      ? this.storage.bucket(this.bucketName)
      : this.storage.bucket();

    // Try to find the file (may have timestamp suffix)
    const [files] = await bucket.getFiles({
      prefix: `dpd-labels/${fileName}`,
    });

    if (files.length === 0) {
      throw new Error(`Label not found: ${fileName}`);
    }

    // Return the most recent file if multiple exist
    const file = files[files.length - 1];
    return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  }

  async deleteLabel(fileName: string): Promise<void> {
    const bucket = this.bucketName
      ? this.storage.bucket(this.bucketName)
      : this.storage.bucket();

    // Delete all files matching the prefix
    const [files] = await bucket.getFiles({
      prefix: `dpd-labels/${fileName}`,
    });

    await Promise.all(files.map((file) => file.delete()));
  }
}

// Usage example:
// import { initializeApp, cert } from "firebase-admin/app";
// import { getStorage } from "firebase-admin/storage";
//
// const app = initializeApp({
//   credential: cert(serviceAccount),
//   storageBucket: "your-project.appspot.com",
// });
//
// const storage = getStorage(app);
// const adapter = new FirebaseStorageAdapter(storage);
