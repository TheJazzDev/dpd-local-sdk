/**
 * Firestore Database Adapter Example
 *
 * This is a complete reference implementation of the DatabaseAdapter interface
 * for Firebase Firestore (both client and admin SDKs).
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import type {
  DatabaseAdapter,
  SavedAddress,
  DPDLogDocument,
  LogFilters,
} from '@jazzdev/dpd-local-sdk';

/**
 * Firestore Admin Adapter
 * Use this on the server-side (Node.js, Next.js API routes, etc.)
 */
export class FirestoreAdminAdapter implements DatabaseAdapter {
  constructor(private db: Firestore) {}

  // Orders
  async getOrder(orderId: string): Promise<any> {
    const doc = await this.db.collection('orders').doc(orderId).get();
    if (!doc.exists) {
      throw new Error(`Order ${orderId} not found`);
    }
    return { id: doc.id, ...doc.data() };
  }

  async updateOrder(orderId: string, data: any): Promise<void> {
    await this.db
      .collection('orders')
      .doc(orderId)
      .update({
        ...data,
        updatedAt: Timestamp.now(),
      });
  }

  // Saved Addresses
  async getSavedAddresses(userId: string): Promise<SavedAddress[]> {
    const snapshot = await this.db
      .collection('savedAddresses')
      .where('userId', '==', userId)
      .orderBy('isDefault', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as SavedAddress)
    );
  }

  async getSavedAddress(addressId: string): Promise<SavedAddress | null> {
    const doc = await this.db.collection('savedAddresses').doc(addressId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as SavedAddress;
  }

  async createSavedAddress(address: Omit<SavedAddress, 'id'>): Promise<string> {
    const docRef = await this.db.collection('savedAddresses').add({
      ...address,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  }

  async updateSavedAddress(
    addressId: string,
    data: Partial<SavedAddress>
  ): Promise<void> {
    await this.db
      .collection('savedAddresses')
      .doc(addressId)
      .update({
        ...data,
        updatedAt: Timestamp.now(),
      });
  }

  async deleteSavedAddress(addressId: string): Promise<void> {
    await this.db.collection('savedAddresses').doc(addressId).delete();
  }

  // DPD Logs
  async createDPDLog(log: Omit<DPDLogDocument, 'id'>): Promise<string> {
    const docRef = await this.db.collection('dpdLogs').add({
      ...log,
      createdAt: Timestamp.now(),
    });

    return docRef.id;
  }

  async getDPDLogs(filters: LogFilters): Promise<DPDLogDocument[]> {
    let query = this.db.collection('dpdLogs').orderBy('createdAt', 'desc');

    if (filters.orderId) {
      query = query.where('orderId', '==', filters.orderId) as any;
    }

    if (filters.consignmentNumber) {
      query = query.where(
        'consignmentNumber',
        '==',
        filters.consignmentNumber
      ) as any;
    }

    if (filters.operation) {
      query = query.where('operation', '==', filters.operation) as any;
    }

    if (filters.success !== undefined) {
      query = query.where('success', '==', filters.success) as any;
    }

    if (filters.startDate) {
      query = query.where(
        'createdAt',
        '>=',
        Timestamp.fromDate(filters.startDate)
      ) as any;
    }

    if (filters.endDate) {
      query = query.where(
        'createdAt',
        '<=',
        Timestamp.fromDate(filters.endDate)
      ) as any;
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    const snapshot = await query.get();

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as DPDLogDocument)
    );
  }
}

// Usage example:
// import { initializeApp, cert } from "firebase-admin/app";
// import { getFirestore } from "firebase-admin/firestore";
//
// const app = initializeApp({
//   credential: cert(serviceAccount),
// });
//
// const db = getFirestore(app);
// const adapter = new FirestoreAdminAdapter(db);
