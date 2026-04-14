// IndexedDB offline caching for POS
const DB_NAME = "pos_offline_db";
const DB_VERSION = 3;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
      if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
      if (!db.objectStoreNames.contains("branches")) db.createObjectStore("branches", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pending_sales")) db.createObjectStore("pending_sales", { keyPath: "localId" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      // v3: encrypted branch detail storage for offline receipt generation
      if (!db.objectStoreNames.contains("branch_details")) db.createObjectStore("branch_details", { keyPath: "branchId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── XOR obfuscation helpers ────────────────────────────────────────────────
// Symmetric, key derived from tenantId+branchId.
// Not full cryptography, but prevents casual inspection via DevTools / file browsers.
function makeObfuscationKey(tenantId: string, branchId: string): string {
  return `${tenantId}::${branchId}`.repeat(4);
}

function xorObfuscate(data: string, key: string): string {
  const keyBytes = Array.from(key);
  return Array.from(data)
    .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ keyBytes[i % keyBytes.length].charCodeAt(0)))
    .join("");
}

// Encode to base64 for safe IDB storage
function encodeDetails(details: any, tenantId: string, branchId: string): string {
  const json = JSON.stringify(details);
  const obfuscated = xorObfuscate(json, makeObfuscationKey(tenantId, branchId));
  return btoa(unescape(encodeURIComponent(obfuscated)));
}

function decodeDetails(encoded: string, tenantId: string, branchId: string): any {
  try {
    const obfuscated = decodeURIComponent(escape(atob(encoded)));
    const json = xorObfuscate(obfuscated, makeObfuscationKey(tenantId, branchId));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function cacheItems(items: any[]) {
  const db = await openDB();
  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");
  store.clear();
  items.forEach(i => store.put(i));
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  // Save timestamp
  const metaTx = db.transaction("meta", "readwrite");
  metaTx.objectStore("meta").put({ key: "items_cached_at", value: Date.now() });
}

export async function getCachedItems(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction("items", "readonly");
  const store = tx.objectStore("items");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheCategories(categories: any[]) {
  const db = await openDB();
  const tx = db.transaction("categories", "readwrite");
  const store = tx.objectStore("categories");
  store.clear();
  categories.forEach(c => store.put(c));
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function getCachedCategories(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction("categories", "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore("categories").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheBranches(branches: any[]) {
  const db = await openDB();
  const tx = db.transaction("branches", "readwrite");
  const store = tx.objectStore("branches");
  store.clear();
  branches.forEach(b => store.put(b));
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function getCachedBranches(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction("branches", "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore("branches").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingSale(sale: any) {
  const db = await openDB();
  const tx = db.transaction("pending_sales", "readwrite");
  tx.objectStore("pending_sales").put({ ...sale, localId: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}` });
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function getPendingSales(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction("pending_sales", "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore("pending_sales").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPendingSale(localId: string) {
  const db = await openDB();
  const tx = db.transaction("pending_sales", "readwrite");
  tx.objectStore("pending_sales").delete(localId);
}

export async function isOffline(): Promise<boolean> {
  return !navigator.onLine;
}

/** Store a branch's details in IndexedDB with XOR obfuscation keyed by tenantId+branchId */
export async function cacheBranchDetails(branchId: string, details: any, tenantId: string): Promise<void> {
  try {
    const db = await openDB();
    const encoded = encodeDetails(details, tenantId, branchId);
    const tx = db.transaction("branch_details", "readwrite");
    tx.objectStore("branch_details").put({ branchId, encoded, tenantId, cachedAt: Date.now() });
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch { /* non-critical — silently ignore */ }
}

/** Read back branch details from IndexedDB, decoding with XOR. Returns null if not cached. */
export async function getCachedBranchDetails(branchId: string, tenantId: string): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction("branch_details", "readonly");
    const record: any = await new Promise((resolve, reject) => {
      const req = tx.objectStore("branch_details").get(branchId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!record?.encoded) return null;
    return decodeDetails(record.encoded, tenantId, branchId);
  } catch {
    return null;
  }
}
