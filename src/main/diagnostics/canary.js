'use strict';
const { BrowserWindow } = require('electron');
const { WRITE_SCRIPT, CHECK_SCRIPT } = require('./canaryScripts');

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} melewati ${ms} ms`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// Menjalankan skrip di jendela tersembunyi yang memakai sesi (profil) yang sama dengan tab.
async function runInSession(ses, url, script, ms = 10000) {
  const w = new BrowserWindow({
    show: false,
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await withTimeout(w.loadURL(url), ms, 'Memuat halaman kanari');
    return await withTimeout(w.webContents.executeJavaScript(script, true), ms, 'Menjalankan skrip kanari');
  } finally {
    if (!w.isDestroyed()) w.destroy();
  }
}

function makeCanary(server) {
  return {
    async write(ses) {
      const port = await server.ensure();
      return runInSession(ses, `http://127.0.0.1:${port}/canary`, WRITE_SCRIPT);
    },
    async check(ses) {
      const port = await server.ensure();
      return runInSession(ses, `http://127.0.0.1:${port}/canary`, CHECK_SCRIPT);
    },
  };
}

module.exports = { makeCanary };
