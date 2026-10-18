// IndexedDB storage. Stores: "sites" (key "id"), "tokens" (key "siteId"), the page cache
// "pageLists" (key "siteId") and "blobs" (key "sha"), and unsaved editor changes "edits" (key "key").
// Only sites.js, auth.js, pages.js and edits.js use this module. Nothing here runs until a function is called.
const DB_NAME = 'gtg';
// Version 2 adds the page cache stores. Version 3 adds "edits". Upgrades keep all earlier data.
const DB_VERSION = 3;

let dbPromise;

function openDb() {
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sites')) db.createObjectStore('sites', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('tokens')) db.createObjectStore('tokens', { keyPath: 'siteId' });
            if (!db.objectStoreNames.contains('pageLists')) db.createObjectStore('pageLists', { keyPath: 'siteId' });
            if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'sha' });
            if (!db.objectStoreNames.contains('edits')) db.createObjectStore('edits', { keyPath: 'key' });
        };
        request.onsuccess = () => {
            const db = request.result;
            // A newer version of the app in another tab needs to upgrade: close this connection.
            db.onversionchange = () => {
                db.close();
                dbPromise = undefined;
            };
            resolve(db);
        };
        request.onerror = () => {
            dbPromise = undefined;
            reject(request.error);
        };
        // An older version of the app in another tab keeps the database open, so the upgrade cannot start.
        request.onblocked = () => {
            dbPromise = undefined;
            reject(Object.assign(new Error('blocked'), {
                userMessage: 'Gorilla To Go is open in another tab or window. Close it, then tap Try again.'
            }));
        };
    });
    return dbPromise;
}

// Run one request in its own transaction. Resolves with the request result when the transaction completes.
async function run(storeName, mode, makeRequest) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = makeRequest(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

export const getAll = storeName => run(storeName, 'readonly', store => store.getAll());
export const getAllKeys = storeName => run(storeName, 'readonly', store => store.getAllKeys());
export const get = (storeName, key) => run(storeName, 'readonly', store => store.get(key));
export const put = (storeName, value) => run(storeName, 'readwrite', store => store.put(value));
export const remove = (storeName, key) => run(storeName, 'readwrite', store => store.delete(key));
