'use strict';
const crypto = require('crypto');
const { JsonStore } = require('./jsonStore');
const { parseHttp } = require('../browser/url');

class Bookmarks {
  constructor(filePath) {
    this.store = new JsonStore(filePath, { items: [] });
    const items = this.store.data.items;
    this.store.data.items = Array.isArray(items)
      ? items.filter((b) => b && typeof b.url === 'string' && parseHttp(b.url))
      : [];
  }

  get loadError() { return this.store.loadError; }
  list() { return this.store.data.items.map((b) => ({ ...b })); }

  _norm(url) { return parseHttp(url); }
  has(url) { const u = this._norm(url); return Boolean(u) && this.store.data.items.some((b) => b.url === u); }

  add({ title, url }) {
    const u = this._norm(url);
    if (!u) return { ok: false, error: 'Hanya halaman http/https yang bisa dibookmark.' };
    if (this.has(u)) return { ok: true, existed: true };
    let name = String(title ?? '').trim();
    if (!name) { try { name = new URL(u).hostname; } catch { name = u; } }
    this.store.data.items.push({ id: crypto.randomUUID(), title: name.slice(0, 200), url: u, addedAt: Date.now() });
    return { ok: this.store.save() };
  }

  removeById(id) {
    const before = this.store.data.items.length;
    this.store.data.items = this.store.data.items.filter((b) => b.id !== id);
    if (this.store.data.items.length === before) return false;
    return this.store.save();
  }

  removeByUrl(url) {
    const u = this._norm(url);
    if (!u) return false;
    this.store.data.items = this.store.data.items.filter((b) => b.url !== u);
    return this.store.save();
  }

  // Dipakai tombol bintang: tambah jika belum ada, hapus jika sudah ada.
  toggle({ title, url }) {
    if (this.has(url)) { this.removeByUrl(url); return { ok: true, bookmarked: false }; }
    const r = this.add({ title, url });
    return { ok: r.ok, error: r.error, bookmarked: r.ok };
  }
}

module.exports = { Bookmarks };
