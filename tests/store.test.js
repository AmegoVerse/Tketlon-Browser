'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonStore } = require('../src/main/store/jsonStore');
const { Settings } = require('../src/main/store/settings');
const { Bookmarks } = require('../src/main/store/bookmarks');
const { cleanPartitions } = require('../src/main/sessions/cleanup');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tk-store-'));

test('JsonStore: simpan lalu muat ulang', () => {
  const f = path.join(tmp(), 'a.json');
  const s = new JsonStore(f, { x: 1 });
  s.data.x = 5;
  assert.ok(s.save());
  assert.strictEqual(new JsonStore(f, { x: 1 }).data.x, 5);
});
test('JsonStore: file rusak dicadangkan dan default dipakai', () => {
  const dir = tmp();
  const f = path.join(dir, 'a.json');
  fs.writeFileSync(f, '{bukan json');
  const s = new JsonStore(f, { x: 1 });
  assert.strictEqual(s.data.x, 1);
  assert.match(s.loadError, /rusak/);
  assert.ok(fs.readdirSync(dir).some((n) => n.includes('.rusak-')));
});
test('Settings: default, homepage valid/invalid, persist', () => {
  const f = path.join(tmp(), 's.json');
  const s = new Settings(f);
  assert.strictEqual(s.get().homepage, '');
  assert.strictEqual(s.get().showBookmarksBar, true);
  assert.strictEqual(s.get().extensionsEnabled, false);
  assert.strictEqual(s.setHomepage('google.com').homepage, 'https://google.com/');
  assert.strictEqual(s.setHomepage('teks bebas').ok, false);
  assert.strictEqual(s.get().homepage, 'https://google.com/');
  s.setShowBookmarksBar(false);
  assert.strictEqual(new Settings(f).get().showBookmarksBar, false);
  assert.strictEqual(new Settings(f).get().homepage, 'https://google.com/');
});
test('Settings: homepage berbahaya di file diabaikan', () => {
  const f = path.join(tmp(), 's.json');
  fs.writeFileSync(f, JSON.stringify({ homepage: 'javascript:alert(1)' }));
  assert.strictEqual(new Settings(f).get().homepage, '');
});
test('Settings: daftar ekstensi tanpa duplikat, enable/hapus', () => {
  const s = new Settings(path.join(tmp(), 's.json'));
  const d = path.join(tmp(), 'ext');
  assert.ok(s.addExtension(d).ok);
  assert.strictEqual(s.addExtension(d).ok, false);
  assert.ok(s.setExtensionEnabled(d, false));
  assert.strictEqual(s.get().extensions[0].enabled, false);
  assert.ok(s.removeExtension(d));
  assert.strictEqual(s.get().extensions.length, 0);
});
test('Bookmarks: tambah, duplikat, toggle, hapus, tolak non-http', () => {
  const f = path.join(tmp(), 'b.json');
  const b = new Bookmarks(f);
  assert.ok(b.add({ title: 'Contoh', url: 'https://example.com' }).ok);
  assert.ok(b.add({ title: 'Lagi', url: 'https://example.com/' }).existed);
  assert.strictEqual(b.list().length, 1);
  assert.strictEqual(b.add({ title: 'x', url: 'javascript:alert(1)' }).ok, false);
  assert.strictEqual(b.add({ title: 'x', url: 'file:///etc/passwd' }).ok, false);
  assert.strictEqual(new Bookmarks(f).list().length, 1);
  assert.strictEqual(b.toggle({ title: 'Contoh', url: 'https://example.com/' }).bookmarked, false);
  assert.strictEqual(b.toggle({ title: '', url: 'https://example.org/p' }).bookmarked, true);
  assert.strictEqual(b.list()[0].title, 'example.org'); // judul kosong -> hostname
  assert.ok(b.removeById(b.list()[0].id));
  assert.strictEqual(b.list().length, 0);
});
test('Bookmarks: entri tidak valid di file disaring', () => {
  const f = path.join(tmp(), 'b.json');
  fs.writeFileSync(f, JSON.stringify({ items: [{ id: '1', title: 'a', url: 'javascript:1' }, { id: '2', title: 'b', url: 'https://ok.com/' }] }));
  assert.deepStrictEqual(new Bookmarks(f).list().map((x) => x.id), ['2']);
});
test('cleanPartitions: hanya hapus folder tketlon-*', async () => {
  const ud = tmp();
  const parts = path.join(ud, 'Partitions');
  fs.mkdirSync(path.join(parts, 'tketlon-1-abc'), { recursive: true });
  fs.mkdirSync(path.join(parts, 'lain'), { recursive: true });
  const r = await cleanPartitions(ud);
  assert.strictEqual(r.removed, 1);
  assert.deepStrictEqual(fs.readdirSync(parts), ['lain']);
  assert.deepStrictEqual(await cleanPartitions(path.join(ud, 'tidak-ada')), { removed: 0, failed: [] });
});
