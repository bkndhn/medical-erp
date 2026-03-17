// IndexedDB offline caching for POS
const DB_NAME = "pos_offline_db";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
      if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pending_sales")) db.createObjectStore("pending_sales", { keyPath: "localId" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
