'use strict';
// Skrip uji kanari: menulis penanda uji ke tiap jenis penyimpanan, lalu memeriksa apakah masih ada
// setelah data sesi dihapus. Tanpa dependensi Electron agar logikanya bisa diuji.
const KEYS = ['cookie', 'localStorage', 'indexedDB', 'cacheStorage', 'serviceWorker'];
const LABELS = {
  cookie: 'Cookie',
  localStorage: 'localStorage',
  indexedDB: 'IndexedDB',
  cacheStorage: 'Cache Storage',
  serviceWorker: 'Service worker',
};

const WRITE_SCRIPT = `(async () => {
  const r = {};
  try { document.cookie = 'tk_canary=1; path=/; max-age=86400'; r.cookie = document.cookie.includes('tk_canary'); } catch { r.cookie = false; }
  try { localStorage.setItem('tk_canary', '1'); r.localStorage = localStorage.getItem('tk_canary') === '1'; } catch { r.localStorage = false; }
  try {
    await new Promise((res, rej) => {
      const q = indexedDB.open('tk_canary', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('s');
      q.onsuccess = () => {
        const db = q.result; const tx = db.transaction('s', 'readwrite');
        tx.objectStore('s').put('1', 'k');
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      q.onerror = () => rej(q.error);
    });
    r.indexedDB = true;
  } catch { r.indexedDB = false; }
  try { const c = await caches.open('tk_canary'); await c.put('/tk_canary', new Response('1')); r.cacheStorage = await caches.has('tk_canary'); } catch { r.cacheStorage = false; }
  try { await navigator.serviceWorker.register('/sw.js'); r.serviceWorker = (await navigator.serviceWorker.getRegistrations()).length > 0; } catch { r.serviceWorker = false; }
  return r;
})()`;

const CHECK_SCRIPT = `(async () => {
  const f = {};
  try { f.cookie = document.cookie.includes('tk_canary'); } catch { f.cookie = false; }
  try { f.localStorage = localStorage.getItem('tk_canary') !== null; } catch { f.localStorage = false; }
  try {
    f.indexedDB = await new Promise((res) => {
      let existed = true;
      const q = indexedDB.open('tk_canary');
      q.onupgradeneeded = () => { existed = false; };
      q.onsuccess = () => {
        const db = q.result; const has = db.objectStoreNames.contains('s'); db.close();
        if (!existed) indexedDB.deleteDatabase('tk_canary');
        res(has);
      };
      q.onerror = () => res(false);
    });
  } catch { f.indexedDB = false; }
  try { f.cacheStorage = await caches.has('tk_canary'); } catch { f.cacheStorage = false; }
  try { f.serviceWorker = (await navigator.serviceWorker.getRegistrations()).length > 0; } catch { f.serviceWorker = false; }
  return f;
})()`;

function evaluateCanary(written = {}, found = {}) {
  const items = KEYS.map((key) => ({
    key,
    label: LABELS[key],
    written: written[key] === true,
    found: found[key] === true,
  }));
  const stillFound = items.filter((i) => i.written && i.found).map((i) => i.label);
  const notTested = items.filter((i) => !i.written).map((i) => i.label);
  return { items, stillFound, notTested, ok: stillFound.length === 0 && notTested.length === 0 };
}

module.exports = { KEYS, LABELS, WRITE_SCRIPT, CHECK_SCRIPT, evaluateCanary };
