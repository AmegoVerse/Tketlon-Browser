'use strict';
const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog } = require('electron');

function readManifest(dir) {
  const raw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}
const popupOf = (m) => m?.action?.default_popup ?? m?.browser_action?.default_popup ?? null;
const optionsOf = (m) => m?.options_ui?.page ?? m?.options_page ?? null;

// Mengelola ekstensi gaya Chrome (WebExtension, folder ter-unpack). Daftar disimpan di Settings.
// Electron hanya mendukung sebagian API chrome.*; tidak semua ekstensi akan jalan.
class ExtensionManager {
  constructor({ settings }) {
    this.settings = settings;
    this.session = null;
    this.loaded = new Map(); // path -> objek Extension dari Electron
    this.errors = new Map(); // path -> pesan error
    this.popup = null;
  }

  _api(ses) { return ses.extensions ?? ses; }

  // Dipanggil setiap sesi baru dibuat (awal aplikasi dan setelah Reset Identity).
  async loadInto(ses) {
    this.session = ses;
    this.loaded.clear();
    this.errors.clear();
    const s = this.settings.get();
    if (!s.extensionsEnabled) return;
    for (const e of s.extensions) if (e.enabled) await this._load(e.path);
  }

  async _load(dir) {
    if (!this.session) return;
    try {
      const ext = await this._api(this.session).loadExtension(dir);
      this.loaded.set(dir, ext);
      this.errors.delete(dir);
    } catch (e) {
      this.errors.set(dir, e.message);
    }
  }

  async _unload(dir) {
    const ext = this.loaded.get(dir);
    if (!ext || !this.session) return;
    try { await this._api(this.session).removeExtension(ext.id); } catch (e) { this.errors.set(dir, e.message); }
    this.loaded.delete(dir);
  }

  list() {
    return this.settings.get().extensions.map((e) => {
      let manifest = null;
      let error = this.errors.get(e.path) ?? null;
      try { manifest = readManifest(e.path); } catch { error = error ?? 'manifest.json tidak ditemukan atau tidak terbaca (folder dipindah?)'; }
      const ext = this.loaded.get(e.path);
      return {
        path: e.path,
        enabled: e.enabled,
        active: Boolean(ext),
        id: ext?.id ?? null,
        name: ext?.name ?? manifest?.name ?? path.basename(e.path),
        version: ext?.version ?? manifest?.version ?? '',
        description: typeof manifest?.description === 'string' ? manifest.description : '',
        manifestVersion: manifest?.manifest_version ?? null,
        hasPopup: Boolean(ext && popupOf(manifest)),
        hasOptions: Boolean(ext && optionsOf(manifest)),
        error,
      };
    });
  }

  async add(parentWin) {
    const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
      title: 'Pilih folder ekstensi (yang berisi manifest.json)',
      properties: ['openDirectory'],
    });
    if (canceled || !filePaths[0]) return { ok: false, canceled: true };
    const dir = path.resolve(filePaths[0]);
    let manifest;
    try { manifest = readManifest(dir); } catch { return { ok: false, error: 'Folder ini tidak berisi manifest.json yang valid.' }; }
    if (![2, 3].includes(manifest.manifest_version)) return { ok: false, error: 'manifest_version harus 2 atau 3.' };
    const r = this.settings.addExtension(dir);
    if (!r.ok) return { ok: false, error: r.error ?? 'Gagal menyimpan daftar ekstensi.' };
    if (this.settings.get().extensionsEnabled) await this._load(dir);
    return { ok: true, error: this.errors.get(dir) ?? null };
  }

  async remove(dir) {
    const p = path.resolve(dir);
    await this._unload(p);
    this.errors.delete(p);
    return this.settings.removeExtension(p);
  }

  async setEnabled(dir, on) {
    const p = path.resolve(dir);
    if (!this.settings.setExtensionEnabled(p, on)) return false;
    if (!this.settings.get().extensionsEnabled) return true;
    if (on) await this._load(p); else await this._unload(p);
    return true;
  }

  _openExtPage(parentWin, dir, rel, opts) {
    const ext = this.loaded.get(path.resolve(dir));
    if (!ext || !rel) return false;
    let url;
    try {
      const base = new URL(`chrome-extension://${ext.id}/`);
      url = new URL(rel, base);
      if (url.origin !== base.origin) return false;
    } catch { return false; }
    const w = new BrowserWindow({
      parent: parentWin,
      show: false,
      ...opts,
      webPreferences: { session: this.session, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.once('ready-to-show', () => w.show());
    w.loadURL(url.toString()).catch(() => w.close());
    return w;
  }

  openPopup(parentWin, dir, chromeHeight) {
    const p = path.resolve(dir);
    let manifest;
    try { manifest = readManifest(p); } catch { return false; }
    if (this.popup && !this.popup.isDestroyed()) this.popup.close();
    const b = parentWin.getContentBounds();
    const w = this._openExtPage(parentWin, p, popupOf(manifest), {
      width: 380, height: 520, x: b.x + b.width - 400, y: b.y + chromeHeight - 40,
      frame: false, resizable: false, skipTaskbar: true,
    });
    if (!w) return false;
    this.popup = w;
    w.on('blur', () => { if (!w.isDestroyed()) w.close(); });
    return true;
  }

  openOptions(parentWin, dir) {
    const p = path.resolve(dir);
    let manifest;
    try { manifest = readManifest(p); } catch { return false; }
    return Boolean(this._openExtPage(parentWin, p, optionsOf(manifest), { width: 820, height: 640, title: 'Opsi ekstensi' }));
  }
}

module.exports = { ExtensionManager, readManifest };
