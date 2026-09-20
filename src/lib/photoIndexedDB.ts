import { uploadMedia } from '../api/storage';
import type { MediaTargetType } from '../types/coop';

export interface PendingPhotoRecord {
  id: string;
  memberId?: string;
  memberName?: string;
  targetType: MediaTargetType;
  photoDataUrl: string;
  createdAt: number;
  status: 'pending' | 'synced' | 'failed';
  firestoreDocId?: string;
  syncError?: string;
  syncAttempts?: number;
}

const DB_NAME = 'SahakariSathi_OfflineMediaDB';
const STORE_NAME = 'pending_photos';
const DB_VERSION = 1;

let dbInstancePromise: Promise<IDBDatabase> | null = null;

/**
 * Open or create the IndexedDB instance for temporary photo persistence.
 */
export function openPhotoIndexedDB(): Promise<IDBDatabase> {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('memberId', 'memberId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbInstancePromise = null;
      reject(request.error);
    };
  });

  return dbInstancePromise;
}

/**
 * Store a captured photo temporarily in IndexedDB.
 */
export async function savePhotoToIndexedDB(
  photoData: Omit<PendingPhotoRecord, 'id' | 'createdAt' | 'status'> & { id?: string }
): Promise<PendingPhotoRecord> {
  const db = await openPhotoIndexedDB();
  const id = photoData.id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: PendingPhotoRecord = {
    ...photoData,
    id,
    createdAt: Date.now(),
    status: 'pending',
    syncAttempts: 0
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending photos from IndexedDB awaiting upload.
 */
export async function getPendingPhotosFromIndexedDB(): Promise<PendingPhotoRecord[]> {
  const db = await openPhotoIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetch all stored photo records from IndexedDB (pending, synced, or failed).
 */
export async function getAllPhotosFromIndexedDB(): Promise<PendingPhotoRecord[]> {
  const db = await openPhotoIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update photo record status to 'synced' in IndexedDB after successful upload.
 */
export async function markPhotoSyncedInIndexedDB(id: string, firestoreDocId?: string): Promise<void> {
  const db = await openPhotoIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record: PendingPhotoRecord | undefined = getReq.result;
      if (!record) {
        resolve();
        return;
      }
      record.status = 'synced';
      record.firestoreDocId = firestoreDocId || id;
      record.syncError = undefined;

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Mark photo sync as failed in IndexedDB with error reason.
 */
export async function markPhotoFailedInIndexedDB(id: string, errorMsg: string): Promise<void> {
  const db = await openPhotoIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record: PendingPhotoRecord | undefined = getReq.result;
      if (!record) {
        resolve();
        return;
      }
      record.status = 'failed';
      record.syncError = errorMsg;
      record.syncAttempts = (record.syncAttempts || 0) + 1;

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete a photo record from IndexedDB.
 */
export async function deletePhotoFromIndexedDB(id: string): Promise<void> {
  const db = await openPhotoIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Upload a single photo record from IndexedDB to the correct Supabase Storage
 * bucket through the backend /uploads API (persists into member KYC profile).
 */
export async function uploadPhotoToFirestore(
  record: PendingPhotoRecord
): Promise<{ success: boolean; firestoreDocId?: string; error?: string }> {
  // Check browser online status first
  if (!navigator.onLine) {
    const errorMsg = 'Browser is currently offline. Photo remains safely queued in IndexedDB.';
    await markPhotoFailedInIndexedDB(record.id, errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    // Upload to the mapped bucket; the backend persists the returned URL onto
    // the member's KYC profile when a member is attached.
    const stored = await uploadMedia(record.targetType, record.photoDataUrl, {
      memberId: record.memberId,
    });

    // Mark as successfully synced in IndexedDB
    await markPhotoSyncedInIndexedDB(record.id, stored.storagePath || stored.url);
    return { success: true, firestoreDocId: stored.storagePath };
  } catch (err: any) {
    console.warn(`Photo upload error for record ${record.id}:`, err);
    const errorMsg = err?.response?.data?.error || err?.message || 'Failed to sync photo to backend';
    await markPhotoFailedInIndexedDB(record.id, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Primary function: Uploads all photos stored in IndexedDB to the backend.
 * Ensures data persistence and recovery if network was interrupted.
 */
export async function syncPendingPhotosToFirestore(): Promise<{
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}> {
  let pendingPhotos: PendingPhotoRecord[] = [];
  try {
    pendingPhotos = await getPendingPhotosFromIndexedDB();
  } catch (err) {
    console.error("Error reading pending photos from IndexedDB:", err);
    return { total: 0, synced: 0, failed: 0, errors: ["IndexedDB read error"] };
  }

  if (pendingPhotos.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const photo of pendingPhotos) {
    const res = await uploadPhotoToFirestore(photo);
    if (res.success) {
      synced++;
    } else {
      failed++;
      if (res.error) errors.push(res.error);
    }
  }

  return { total: pendingPhotos.length, synced, failed, errors };
}
