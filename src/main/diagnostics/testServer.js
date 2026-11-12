'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const TRACKER_HOST = 'selftest-tracker.localhost';
const CONTROL_HOST = 'control.localhost';
const PAGE = path.join(__dirname, 'selftest.html');

// Server uji lokal: hanya mendengarkan 127.0.0.1, port acak, dan hanya dijalankan saat dibutuhkan
// (halaman uji mandiri atau uji kanari Reset Identity). Tidak ada koneksi keluar.
class TestServer {
  constructor({ getState } = {}) {
    this.server = null;
    this.port = null;
    this.starting = null;
    this.getState = getState || (() => ({}));
  }

  ensure() {
    if (this.port) return Promise.resolve(this.port);
    if (!this.starting) {
      this.starting = new Promise((resolve, reject) => {
        const s = http.createServer((req, res) => this._handle(req, res));
        s.on('error', (e) => { this.starting = null; reject(e); });
        s.listen(0, '127.0.0.1', () => {
          this.server = s;
          this.port = s.address().port;
          resolve(this.port);
        });
      });
    }
    return this.starting;
  }

  close() {
    this.server?.close();
    this.server = null;
    this.port = null;
    this.starting = null;
  }

  _handle(req, res) {
    const send = (code, type, body) => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    };
    // Cegah DNS rebinding: hanya Host yang kita kenal yang dilayani.
    const host = String(req.headers.host || '').toLowerCase();
    const mainHost = `127.0.0.1:${this.port}`;
    const allowed = [mainHost, `${TRACKER_HOST}:${this.port}`, `${CONTROL_HOST}:${this.port}`];
    if (!allowed.includes(host)) return send(403, 'text/plain', 'forbidden');
    if (req.method !== 'GET') return send(405, 'text/plain', 'method not allowed');

    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/pixel.js') return send(200, 'application/javascript', 'window.__trackerLoaded = true;');
    if (host !== mainHost) return send(404, 'text/plain', 'not found');

    switch (p) {
      case '/':
        return send(200, 'text/html; charset=utf-8', fs.readFileSync(PAGE));
      case '/canary':
        return send(200, 'text/html; charset=utf-8', '<!doctype html><title>kanari</title>');
      case '/sw.js':
        return send(200, 'application/javascript', "self.addEventListener('fetch', () => {});");
      case '/api/state':
        return send(200, 'application/json', JSON.stringify(this.getState()));
      default:
        return send(404, 'text/plain', 'not found');
    }
  }
}

module.exports = { TestServer, TRACKER_HOST, CONTROL_HOST };
