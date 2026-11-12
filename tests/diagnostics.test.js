'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { TestServer } = require('../src/main/diagnostics/testServer');
const { evaluateCanary } = require('../src/main/diagnostics/canaryScripts');
const { formatReceipt } = require('../src/main/privacy/receipt');

function get(port, path, host) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, headers: { Host: host } }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('server uji: rute, Host check, dan state', async () => {
  const s = new TestServer({ getState: () => ({ filterEnabled: true, siteException: false }) });
  const port = await s.ensure();
  try {
    const main = `127.0.0.1:${port}`;
    assert.strictEqual((await get(port, '/', main)).status, 200);
    assert.match((await get(port, '/', main)).body, /Uji mandiri/);
    assert.strictEqual((await get(port, '/canary', main)).status, 200);
    assert.match((await get(port, '/sw.js', main)).type, /javascript/);
    assert.deepStrictEqual(JSON.parse((await get(port, '/api/state', main)).body), { filterEnabled: true, siteException: false });
    assert.strictEqual((await get(port, '/pixel.js', `control.localhost:${port}`)).status, 200);
    assert.strictEqual((await get(port, '/', `control.localhost:${port}`)).status, 404);
    assert.strictEqual((await get(port, '/', 'evil.example.com')).status, 403);
  } finally {
    s.close();
  }
});

test('kanari: semua terhapus => ok', () => {
  const w = { cookie: true, localStorage: true, indexedDB: true, cacheStorage: true, serviceWorker: true };
  const r = evaluateCanary(w, {});
  assert.ok(r.ok);
});
test('kanari: penanda tersisa => gagal', () => {
  const w = { cookie: true, localStorage: true, indexedDB: true, cacheStorage: true, serviceWorker: true };
  const r = evaluateCanary(w, { indexedDB: true });
  assert.ok(!r.ok);
  assert.deepStrictEqual(r.stillFound, ['IndexedDB']);
});
test('kanari: jenis yang tidak bisa ditulis dilaporkan tidak teruji', () => {
  const r = evaluateCanary({ cookie: true }, {});
  assert.ok(!r.ok);
  assert.ok(r.notTested.includes('Service worker'));
});
test('receipt memuat hasil kanari dan tidak mengklaim berhasil jika error', () => {
  const base = { fromGeneration: 1, toGeneration: 2, durationMs: 5, cookiesBefore: 3, cookiesAfter: 0, steps: [], errors: [], deniedPermissions: {}, blockedTotal: 0, blockedTop: [], filterDomains: 5, filterEnabled: true, filterLoadError: null };
  const w = { cookie: true, localStorage: true, indexedDB: true, cacheStorage: true, serviceWorker: true };
  const okText = formatReceipt({ ...base, canary: evaluateCanary(w, {}) });
  assert.match(okText, /\[OK\] IndexedDB: penanda terhapus/);
  const badText = formatReceipt({ ...base, canary: evaluateCanary(w, { localStorage: true }) });
  assert.match(badText, /\[GAGAL\] localStorage: penanda MASIH ADA/);
  const errText = formatReceipt({ ...base, canary: { error: 'timeout' } });
  assert.match(errText, /TIDAK DAPAT DIJALANKAN/);
});
