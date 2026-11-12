'use strict';
const path = require('path');
const { JsonStore } = require('./jsonStore');
const { normalizeHomepage } = require('../browser/url');

const DEFAULTS = {
  homepage: '',            // '' = halaman Tab Baru
  showBookmarksBar: true,
  extensionsEnabled: false, // butuh sesi di disk sementara, jadi default mati (lihat README)
  extensions: [],          // [{ path, enabled }]
};

class Settings {
  constructor(filePath) {
    this.store = new JsonStore(filePath, DEFAULTS);
    const d = this.store.data;
    if (typeof d.homepage !== 'string' || normalizeHomepage(d.homepage) === null) d.homepage = '';
    d.showBookmarksBar = d.showBookmarksBar !== false;
    d.extensionsEnabled = d.extensionsEnabled === true;
    d.extensions = Array.isArray(d.extensions)
      ? d.extensions
          .filter((e) => e && typeof e.path === 'string' && e.path)
          .map((e) => ({ path: path.resolve(e.path), enabled: e.enabled !== false }))
      : [];
  }

  get() { return structuredClone(this.store.data); }
  get loadError() { return this.store.loadError; }
  get saveError() { return this.store.saveError; }

  setHomepage(input) {
    const url = normalizeHomepage(input);
    if (url === null) return { ok: false, error: 'Alamat tidak valid. Contoh: https://www.google.com' };
    this.store.data.homepage = url;
    return { ok: this.store.save(), homepage: url };
  }

  setShowBookmarksBar(on) {
    this.store.data.showBookmarksBar = Boolean(on);
    return this.store.save();
  }

  setExtensionsEnabled(on) {
    this.store.data.extensionsEnabled = Boolean(on);
    return this.store.save();
  }

  addExtension(dir) {
    const p = path.resolve(dir);
    const list = this.store.data.extensions;
    if (list.some((e) => e.path === p)) return { ok: false, error: 'Ekstensi ini sudah ada di daftar.' };
    list.push({ path: p, enabled: true });
    return { ok: this.store.save() };
  }

  removeExtension(dir) {
    const p = path.resolve(dir);
    this.store.data.extensions = this.store.data.extensions.filter((e) => e.path !== p);
    return this.store.save();
  }

  setExtensionEnabled(dir, on) {
    const e = this.store.data.extensions.find((x) => x.path === path.resolve(dir));
    if (!e) return false;
    e.enabled = Boolean(on);
    return this.store.save();
  }
}

module.exports = { Settings, DEFAULTS };
