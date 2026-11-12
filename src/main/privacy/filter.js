'use strict';
const fs = require('fs');

// Pemblokir domain sederhana. Sengaja tidak bergantung pada Electron agar mudah diuji.
class TrackerFilter {
  constructor(listPath) {
    this.enabled = true;
    this.domains = new Set();
    this.exceptions = new Set(); // host situs teratas yang dikecualikan (hanya di memori)
    this.loadError = null;
    this.errors = 0;
    this.onBlock = null;
    if (listPath) this.load(listPath);
  }

  load(listPath) {
    try {
      const text = fs.readFileSync(listPath, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const d = line.replace(/#.*/, '').trim().toLowerCase();
        if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d)) this.domains.add(d);
      }
    } catch (e) {
      this.loadError = e.message; // browser tetap jalan; status gagal ditampilkan ke pengguna
    }
  }

  _walk(host, set) {
    let h = String(host || '').toLowerCase();
    while (h.includes('.')) {
      if (set.has(h)) return h;
      h = h.slice(h.indexOf('.') + 1);
    }
    return null;
  }

  isException(topHost) { return this._walk(topHost, this.exceptions) !== null; }
  setException(host, on) { if (on) this.exceptions.add(host.toLowerCase()); else this.exceptions.delete(host.toLowerCase()); }

  // Mengembalikan domain daftar yang cocok, atau null jika permintaan boleh lewat.
  shouldBlock(requestUrl, topUrl) {
    if (!this.enabled) return null;
    let host;
    try { host = new URL(requestUrl).hostname; } catch { return null; }
    let top = '';
    try { top = topUrl ? new URL(topUrl).hostname : ''; } catch { top = ''; }
    if (top && this.isException(top)) return null;
    const hit = this._walk(host, this.domains);
    // Jika situs teratas adalah domain daftar itu sendiri (first-party), jangan diblokir.
    if (hit && top && (top === hit || top.endsWith('.' + hit))) return null;
    return hit;
  }

  attach(ses, stats) {
    ses.webRequest.onBeforeRequest((details, callback) => {
      let cancel = false;
      try {
        if (details.resourceType !== 'mainFrame') {
          const wc = details.webContents;
          const top = wc && !wc.isDestroyed() ? wc.getURL() : '';
          const hit = this.shouldBlock(details.url, top);
          if (hit) {
            cancel = true;
            stats.blocked.total += 1;
            stats.blocked.byDomain[hit] = (stats.blocked.byDomain[hit] || 0) + 1;
            this.onBlock?.();
          }
        }
      } catch {
        this.errors += 1; // kegagalan filter tidak boleh merusak pemuatan halaman
        cancel = false;
      }
      callback({ cancel });
    });
  }
}

module.exports = { TrackerFilter };
