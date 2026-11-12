'use strict';
const { session } = require('electron');
const { applyPolicy } = require('../privacy/policy');
const { evaluateCanary } = require('../diagnostics/canaryScripts');

class SessionManager {
  // persistent: pakai partisi "persist:" (dibutuhkan agar ekstensi bisa dimuat). Default: di memori.
  // onStart(session): dipanggil tiap sesi baru dibuat (mis. memuat ekstensi); hasilnya ditunggu lewat this.ready.
  constructor({ filter, canary, persistent = false, onStart } = {}) {
    this.filter = filter || null;
    this.canary = canary || null;
    this.persistent = Boolean(persistent);
    this.onStart = onStart || null;
    this.ready = Promise.resolve();
    this.generation = 0;
    this.current = null;
    this.stats = null;
    this._start();
  }

  _start() {
    this.generation += 1;
    // Tanpa prefix "persist:" => disimpan di memori, bukan di disk (mode default).
    const name = `${this.persistent ? 'persist:' : ''}tketlon-${this.generation}-${Date.now().toString(36)}`;
    this.stats = { permissionsDenied: {}, blocked: { total: 0, byDomain: {} }, startedAt: Date.now() };
    this.current = session.fromPartition(name);
    applyPolicy(this.current, this.stats, this.filter);
    this.ready = Promise.resolve(this.onStart ? this.onStart(this.current) : null).catch(() => {});
  }

  // Menghapus data sesi lama, memverifikasi, lalu berpindah ke sesi baru.
  // Sesi baru SELALU dibuat, bahkan jika penghapusan gagal, supaya identitas lama tidak terpakai.
  async reset() {
    const t0 = Date.now();
    const old = this.current;
    const report = {
      fromGeneration: this.generation,
      toGeneration: null,
      cookiesBefore: null,
      cookiesAfter: null,
      deniedPermissions: { ...this.stats.permissionsDenied },
      blockedTotal: this.stats.blocked.total,
      blockedTop: Object.entries(this.stats.blocked.byDomain).sort((a, b) => b[1] - a[1]).slice(0, 5),
      canary: null,
      filterDomains: this.filter ? this.filter.domains.size : 0,
      filterEnabled: this.filter ? this.filter.enabled : false,
      filterLoadError: this.filter ? this.filter.loadError : null,
      steps: [],
      errors: [],
      verified: false,
      durationMs: 0,
    };

    const countCookies = async (key) => {
      try {
        report[key] = (await old.cookies.get({})).length;
      } catch (e) {
        report.errors.push(`Hitung cookie: ${e.message}`);
      }
    };
    const run = async (label, fn) => {
      try {
        await fn();
        report.steps.push({ label, ok: true });
      } catch (e) {
        report.steps.push({ label, ok: false });
        report.errors.push(`${label}: ${e.message}`);
      }
    };

    await countCookies('cookiesBefore');

    // Uji kanari: tulis penanda uji ke tiap jenis penyimpanan sebelum dihapus.
    let written = null;
    if (this.canary) {
      try { written = await this.canary.write(old); }
      catch (e) {
        report.canary = { error: `Menulis penanda: ${e.message}` };
        report.errors.push(`Uji kanari tidak dapat dijalankan: ${e.message}`);
      }
    }
    await run('Cookie, localStorage, IndexedDB, service worker, Cache Storage', () => old.clearStorageData());
    await run('Cache HTTP', () => old.clearCache());
    await run('Cache autentikasi', () => old.clearAuthCache());
    await run('Cache DNS browser', () => old.clearHostResolverCache());
    await run('Koneksi aktif', () => old.closeAllConnections());

    if (written) {
      try {
        const found = await this.canary.check(old);
        report.canary = evaluateCanary(written, found);
        if (report.canary.stillFound.length) report.errors.push(`Penanda masih ada setelah penghapusan: ${report.canary.stillFound.join(', ')}`);
        if (report.canary.notTested.length) report.errors.push(`Tidak dapat diuji: ${report.canary.notTested.join(', ')}`);
      } catch (e) {
        report.canary = { error: `Memeriksa penanda: ${e.message}` };
        report.errors.push(`Uji kanari tidak dapat diselesaikan: ${e.message}`);
      }
      await run('Pembersihan akhir (setelah uji kanari)', () => old.clearStorageData());
    }
    await countCookies('cookiesAfter');

    report.verified = report.errors.length === 0 && report.cookiesAfter === 0;
    this._start();
    await this.ready;
    report.toGeneration = this.generation;
    report.durationMs = Date.now() - t0;
    return report;
  }
}

module.exports = { SessionManager };
