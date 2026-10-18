// IndexedDB storage. Stores: "sites" (key "id") and "tokens" (key "siteId").
// Only sites.js and auth.js use this module. Nothing here runs until a function is called.
const DB_NAME = 'gtg';
const DB_VERSION = 1;

let dbPromise;

function openDb() {
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sites')) db.createObjectStore('sites', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('tokens')) db.createObjectStore('tokens', { keyPath: 'siteId' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = undefined;
            reject(request.error);
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
export const get = (storeName, key) => run(storeName, 'readonly', store => store.get(key));
export const put = (storeName, value) => run(storeName, 'readwrite', store => store.put(value));
export const remove = (storeName, key) => run(storeName, 'readwrite', store => store.delete(key));
