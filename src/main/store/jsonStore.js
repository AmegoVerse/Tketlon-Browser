'use strict';
const fs = require('fs');
const path = require('path');

// Penyimpanan JSON kecil di disk (folder userData). Tanpa dependensi Electron agar bisa diuji.
// Menulis ke file sementara lalu rename, supaya file tidak rusak jika aplikasi mati saat menulis.
class JsonStore {
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = structuredClone(defaults);
    this.loadError = null;
    this.saveError = null;
    this._load();
  }

  _load() {
    let raw;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') this.loadError = e.message;
      return;
    }
    try {
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Bukan objek JSON');
      this.data = { ...structuredClone(this.defaults), ...parsed };
    } catch (e) {
      this.loadError = `File rusak: ${e.message}`;
      // Simpan salinan file rusak agar tidak tertimpa diam-diam.
      try { fs.renameSync(this.filePath, `${this.filePath}.rusak-${Date.now()}`); } catch { /* abaikan */ }
    }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
      this.saveError = null;
      return true;
    } catch (e) {
      this.saveError = e.message;
      return false;
    }
  }
}

module.exports = { JsonStore };
