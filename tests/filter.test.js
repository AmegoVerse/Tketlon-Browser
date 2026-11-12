'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TrackerFilter } = require('../src/main/privacy/filter');

function makeFilter(lines) {
  const p = path.join(os.tmpdir(), `tk-${Date.now()}-${Math.random()}.txt`);
  fs.writeFileSync(p, lines.join('\n'));
  return new TrackerFilter(p);
}

test('subdomain pelacak ikut terblokir', () => {
  const f = makeFilter(['# komentar', 'tracker.com']);
  assert.strictEqual(f.shouldBlock('https://a.b.tracker.com/x.js', 'https://situs.com/'), 'tracker.com');
  assert.strictEqual(f.shouldBlock('https://nottracker.com/x.js', 'https://situs.com/'), null);
});
test('permintaan first-party tidak diblokir', () => {
  const f = makeFilter(['tracker.com']);
  assert.strictEqual(f.shouldBlock('https://cdn.tracker.com/a', 'https://www.tracker.com/'), null);
});
test('pengecualian situs dan penonaktifan global', () => {
  const f = makeFilter(['tracker.com']);
  f.setException('situs.com', true);
  assert.strictEqual(f.shouldBlock('https://tracker.com/a', 'https://www.situs.com/'), null);
  f.setException('situs.com', false);
  assert.ok(f.shouldBlock('https://tracker.com/a', 'https://situs.com/'));
  f.enabled = false;
  assert.strictEqual(f.shouldBlock('https://tracker.com/a', 'https://situs.com/'), null);
});
test('file daftar hilang: tidak crash, error tercatat', () => {
  const f = new TrackerFilter('/tidak/ada.txt');
  assert.ok(f.loadError);
  assert.strictEqual(f.shouldBlock('https://tracker.com/a', 'https://situs.com/'), null);
});
test('attach: blokir subresource, lewatkan mainFrame, hitung statistik', () => {
  const f = makeFilter(['tracker.com']);
  let handler;
  const stats = { blocked: { total: 0, byDomain: {} } };
  f.attach({ webRequest: { onBeforeRequest: (h) => { handler = h; } } }, stats);
  const wc = { isDestroyed: () => false, getURL: () => 'https://situs.com/' };
  let res;
  handler({ url: 'https://tracker.com/p.js', resourceType: 'script', webContents: wc }, (r) => { res = r; });
  assert.deepStrictEqual(res, { cancel: true });
  handler({ url: 'https://tracker.com/', resourceType: 'mainFrame', webContents: wc }, (r) => { res = r; });
  assert.deepStrictEqual(res, { cancel: false });
  assert.strictEqual(stats.blocked.total, 1);
  assert.strictEqual(stats.blocked.byDomain['tracker.com'], 1);
});
test('daftar bawaan valid dan tidak kosong', () => {
  const f = new TrackerFilter(path.join(__dirname, '../filters/default.txt'));
  assert.strictEqual(f.loadError, null);
  assert.ok(f.domains.size > 10);
  assert.ok(f.domains.has('doubleclick.net'));
});
