'use strict';
// Mesin pencari tetap: Google.
const SEARCH_URL = 'https://www.google.com/search?q=';
const LENS_HOME = 'https://lens.google.com/';
const BLOCKED_SCHEMES = /^(javascript|file|data|vbscript|blob|about|chrome|devtools|view-source):/i;

function parseHttp(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function isLocalHost(host) {
  return host === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function looksLikeHost(s) {
  const host = s.split(/[/?#]/)[0].split(':')[0];
  return isLocalHost(host) || /^[^\s.]+(\.[^\s.]+)*\.[a-z]{2,}$/i.test(host);
}

function searchUrl(query) {
  return SEARCH_URL + encodeURIComponent(query);
}

// Mengubah input address bar menjadi URL http(s), atau null jika ditolak.
function normalizeInput(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return null;
  if (BLOCKED_SCHEMES.test(input)) return null;
  if (/^https?:\/\//i.test(input)) return parseHttp(input);
  const hasSpace = /\s/.test(input);
  if (!hasSpace && looksLikeHost(input)) {
    const host = input.split(/[/?#]/)[0].split(':')[0];
    return parseHttp((isLocalHost(host) ? 'http://' : 'https://') + input);
  }
  return searchUrl(input);
}

// Homepage: '' = halaman Tab Baru. Selain itu harus berupa URL/alamat situs (bukan teks pencarian).
// Mengembalikan string URL, '' (kosong), atau null jika tidak valid.
function normalizeHomepage(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return '';
  if (BLOCKED_SCHEMES.test(input)) return null;
  if (/^https?:\/\//i.test(input)) return parseHttp(input);
  if (/\s/.test(input) || !looksLikeHost(input)) return null;
  const host = input.split(/[/?#]/)[0].split(':')[0];
  return parseHttp((isLocalHost(host) ? 'http://' : 'https://') + input);
}

// Google Lens untuk gambar yang punya alamat http(s) publik.
function lensByUrl(imageUrl) {
  const u = parseHttp(imageUrl);
  return u ? `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(u)}&hl=id` : null;
}

function isAllowedNavigation(url) {
  return parseHttp(url) !== null;
}

module.exports = { normalizeInput, normalizeHomepage, isAllowedNavigation, parseHttp, searchUrl, lensByUrl, SEARCH_URL, LENS_HOME };
