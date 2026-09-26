/**
 * IndexedDB Offline Draft Storage
 * Menyimpan draft postingan dan cache akun secara lokal di browser via IndexedDB.
 * Menyediakan fallback in-memory yang aman untuk lingkungan SSR / Node.js / Jest.
 */

export interface OfflineDraft {
  id: string; // "offline_${timestamp}_${random}" atau UUID post yang diedit
  postId?: string; // ID server jika mengedit post yang sudah ada
  textContent: string;
  mediaUrls: string[];
  targetAccountIds: string[];
  scheduledAt: string | null;
  status: "DRAFT";
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  lastSyncError?: string | null;
  retryCount: number;
}

export interface CachedConnectedAccount {
  id: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  accountName: string;
  status: string;
}

export interface CachedPostItem {
  id: string;
  textContent: string;
  mediaUrls: string[] | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: Array<{
    id: string;
    connectedAccountId: string;
    platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
    status: string;
    accountName?: string;
  }>;
}

const DB_NAME = "mupost_offline_db";
const DB_VERSION = 1;
const STORE_DRAFTS = "drafts";
const STORE_ACCOUNTS = "accounts";
const STORE_POSTS = "posts_cache";

// In-memory fallback untuk lingkungan non-browser (Node.js, SSR, atau browser tanpa IDB)
const inMemoryDrafts = new Map<string, OfflineDraft>();
const inMemoryAccounts = new Map<string, CachedConnectedAccount>();
const inMemoryPosts = new Map<string, CachedPostItem>();

export function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined" && indexedDB !== null;
}

function dispatchEvent(name: string, detail?: unknown): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {
      // Abaikan jika CustomEvent tidak didukung
    }
  }
}

/**
 * Membuka koneksi IndexedDB dengan inisialisasi object store yang diperlukan.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB is not available"));
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const draftStore = db.createObjectStore(STORE_DRAFTS, { keyPath: "id" });
          draftStore.createIndex("createdAt", "createdAt", { unique: false });
          draftStore.createIndex("syncStatus", "syncStatus", { unique: false });
          draftStore.createIndex("postId", "postId", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          db.createObjectStore(STORE_ACCOUNTS, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORE_POSTS)) {
          db.createObjectStore(STORE_POSTS, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Menyimpan atau memperbarui draft offline ke IndexedDB.
 */
export async function saveOfflineDraft(input: {
  id?: string;
  postId?: string;
  textContent: string;
  mediaUrls?: string[];
  targetAccountIds?: string[];
  scheduledAt?: string | null;
  status?: "DRAFT";
  syncStatus?: "pending" | "syncing" | "synced" | "failed";
}): Promise<OfflineDraft> {
  const now = new Date().toISOString();
  const id =
    input.id ||
    input.postId ||
    `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Ambil draft lama jika ada untuk mempertahankan createdAt atau retryCount
  let existing: OfflineDraft | null = null;
  try {
    existing = await getOfflineDraftById(id);
  } catch {
    // Abaikan jika tidak ditemukan
  }

  const draft: OfflineDraft = {
    id,
    postId: input.postId || existing?.postId,
    textContent: input.textContent,
    mediaUrls: input.mediaUrls ?? existing?.mediaUrls ?? [],
    targetAccountIds: input.targetAccountIds ?? existing?.targetAccountIds ?? [],
    scheduledAt:
      input.scheduledAt !== undefined ? input.scheduledAt : (existing?.scheduledAt ?? null),
    status: "DRAFT",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    syncStatus: input.syncStatus || "pending",
    lastSyncError: null,
    retryCount: existing?.retryCount ?? 0,
  };

  if (!isIndexedDBAvailable()) {
    inMemoryDrafts.set(draft.id, draft);
    dispatchEvent("mupost:offline-drafts-changed", { action: "saved", draft });
    return draft;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.put(draft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    dispatchEvent("mupost:offline-drafts-changed", { action: "saved", draft });
    return draft;
  } catch {
    // Fallback in-memory jika IDB gagal saat runtime
    inMemoryDrafts.set(draft.id, draft);
    dispatchEvent("mupost:offline-drafts-changed", { action: "saved", draft });
    return draft;
  }
}

function sortDrafts(drafts: OfflineDraft[]): OfflineDraft[] {
  return drafts.sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

/**
 * Mengambil seluruh draft offline yang tersimpan, diurutkan dari yang terbaru.
 */
export async function getOfflineDrafts(): Promise<OfflineDraft[]> {
  if (!isIndexedDBAvailable()) {
    return sortDrafts(Array.from(inMemoryDrafts.values()));
  }

  try {
    const db = await openDB();
    const drafts = await new Promise<OfflineDraft[]>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, "readonly");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    return sortDrafts(drafts);
  } catch {
    return sortDrafts(Array.from(inMemoryDrafts.values()));
  }
}

/**
 * Mengambil satu draft berdasarkan id atau postId.
 */
export async function getOfflineDraftById(idOrPostId: string): Promise<OfflineDraft | null> {
  if (!idOrPostId) return null;

  if (!isIndexedDBAvailable()) {
    if (inMemoryDrafts.has(idOrPostId)) {
      return inMemoryDrafts.get(idOrPostId)!;
    }
    const match = Array.from(inMemoryDrafts.values()).find((d) => d.postId === idOrPostId);
    return match || null;
  }

  try {
    const db = await openDB();
    const draft = await new Promise<OfflineDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, "readonly");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.get(idOrPostId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (draft) return draft;

    // Cari berdasarkan postId jika bukan kecocokan ID langsung
    const all = await getOfflineDrafts();
    return all.find((d) => d.postId === idOrPostId) || null;
  } catch {
    if (inMemoryDrafts.has(idOrPostId)) {
      return inMemoryDrafts.get(idOrPostId)!;
    }
    const match = Array.from(inMemoryDrafts.values()).find((d) => d.postId === idOrPostId);
    return match || null;
  }
}

/**
 * Memperbarui field tertentu dari draft offline yang ada.
 */
export async function updateOfflineDraft(
  id: string,
  updates: Partial<OfflineDraft>
): Promise<OfflineDraft | null> {
  const existing = await getOfflineDraftById(id);
  if (!existing) return null;

  const updated: OfflineDraft = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (!isIndexedDBAvailable()) {
    inMemoryDrafts.set(updated.id, updated);
    dispatchEvent("mupost:offline-drafts-changed", { action: "updated", draft: updated });
    return updated;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    dispatchEvent("mupost:offline-drafts-changed", { action: "updated", draft: updated });
    return updated;
  } catch {
    inMemoryDrafts.set(updated.id, updated);
    dispatchEvent("mupost:offline-drafts-changed", { action: "updated", draft: updated });
    return updated;
  }
}

/**
 * Menghapus draft offline dari IndexedDB.
 */
export async function deleteOfflineDraft(id: string): Promise<boolean> {
  if (!isIndexedDBAvailable()) {
    const existed = inMemoryDrafts.delete(id);
    dispatchEvent("mupost:offline-drafts-changed", { action: "deleted", id });
    return existed;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    dispatchEvent("mupost:offline-drafts-changed", { action: "deleted", id });
    return true;
  } catch {
    inMemoryDrafts.delete(id);
    dispatchEvent("mupost:offline-drafts-changed", { action: "deleted", id });
    return true;
  }
}

/**
 * Menghitung jumlah draft yang menunggu sinkronisasi (status pending atau failed).
 */
export async function getPendingDraftsCount(): Promise<number> {
  const drafts = await getOfflineDrafts();
  return drafts.filter((d) => d.syncStatus === "pending" || d.syncStatus === "failed").length;
}

/**
 * Menyimpan cache akun media sosial yang aktif agar dapat dipilih saat offline.
 */
export async function cacheConnectedAccounts(accounts: CachedConnectedAccount[]): Promise<void> {
  if (!Array.isArray(accounts)) return;

  if (!isIndexedDBAvailable()) {
    accounts.forEach((acc) => inMemoryAccounts.set(acc.id, acc));
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, "readwrite");
      const store = tx.objectStore(STORE_ACCOUNTS);
      accounts.forEach((acc) => store.put(acc));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    accounts.forEach((acc) => inMemoryAccounts.set(acc.id, acc));
  }
}

/**
 * Mengambil cache akun media sosial saat koneksi internet terputus.
 */
export async function getCachedConnectedAccounts(): Promise<CachedConnectedAccount[]> {
  if (!isIndexedDBAvailable()) {
    return Array.from(inMemoryAccounts.values());
  }

  try {
    const db = await openDB();
    return await new Promise<CachedConnectedAccount[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, "readonly");
      const store = tx.objectStore(STORE_ACCOUNTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(inMemoryAccounts.values());
  }
}

/**
 * Menyimpan cache daftar post ke IndexedDB untuk akses offline instan.
 */
export async function cachePostsList(posts: CachedPostItem[]): Promise<void> {
  if (!Array.isArray(posts)) return;

  if (!isIndexedDBAvailable()) {
    posts.forEach((p) => inMemoryPosts.set(p.id, p));
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_POSTS, "readwrite");
      const store = tx.objectStore(STORE_POSTS);
      posts.forEach((p) => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    posts.forEach((p) => inMemoryPosts.set(p.id, p));
  }
}

/**
 * Mengambil cache postingan berdasarkan ID saat offline.
 */
export async function getCachedPost(id: string): Promise<CachedPostItem | null> {
  if (!id) return null;

  if (!isIndexedDBAvailable()) {
    return inMemoryPosts.get(id) || null;
  }

  try {
    const db = await openDB();
    return await new Promise<CachedPostItem | null>((resolve, reject) => {
      const tx = db.transaction(STORE_POSTS, "readonly");
      const store = tx.objectStore(STORE_POSTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return inMemoryPosts.get(id) || null;
  }
}

/**
 * Utility untuk testing: membersihkan seluruh data in-memory fallback.
 */
export function _resetInMemoryStore(): void {
  inMemoryDrafts.clear();
  inMemoryAccounts.clear();
  inMemoryPosts.clear();
}
