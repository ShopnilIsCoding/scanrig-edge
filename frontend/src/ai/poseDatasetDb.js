const DB_NAME = 'scanrig-ai-dataset';
const DB_VERSION = 1;
const STORE = 'recordings';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'recordingId' });
        store.createIndex('label', 'label', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(mode, operation) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = operation(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }));
}

export async function saveRecording(recording) {
  await withStore('readwrite', (store) => store.put(recording));
  return recording;
}

export async function getRecordings() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearRecordings() {
  await withStore('readwrite', (store) => store.clear());
}

export async function deleteRecording(recordingId) {
  await withStore('readwrite', (store) => store.delete(recordingId));
}

export async function importRecordings(recordings) {
  const valid = Array.isArray(recordings) ? recordings.filter((item) => item?.recordingId && Array.isArray(item.frames)) : [];
  if (!valid.length) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    valid.forEach((item) => store.put(item));
    tx.oncomplete = () => {
      db.close();
      resolve(valid.length);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
