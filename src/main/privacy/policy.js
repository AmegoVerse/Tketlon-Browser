'use strict';
// Izin yang dibutuhkan game web. Semua izin lain ditolak secara default.
const ALLOWED = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write']);
// Menyembunyikan IP lokal dari WebRTC tanpa mematikan panggilan video/game real-time.
const WEBRTC_POLICY = 'default_public_interface_only';

function cleanUserAgent(ua) {
  // Token "Electron/..." dan nama aplikasi membuat sebagian situs salah mendeteksi browser.
  return ua.replace(/\s(?:Electron|tketlon-browser|Tketlon[^\s/]*)\/\S+/gi, '');
}

function applyPolicy(ses, stats, filter) {
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    const ok = ALLOWED.has(permission);
    if (!ok) stats.permissionsDenied[permission] = (stats.permissionsDenied[permission] || 0) + 1;
    callback(ok);
  });
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  ses.setDevicePermissionHandler(() => false); // USB, HID, serial
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()));
  if (filter) filter.attach(ses, stats);
}

module.exports = { applyPolicy, cleanUserAgent, ALLOWED, WEBRTC_POLICY };
