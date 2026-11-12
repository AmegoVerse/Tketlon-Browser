'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { normalizeInput, normalizeHomepage, isAllowedNavigation, lensByUrl } = require('../src/main/browser/url');

test('domain tanpa skema memakai https', () => {
  assert.strictEqual(normalizeInput('example.com'), 'https://example.com/');
});
test('localhost memakai http', () => {
  assert.strictEqual(normalizeInput('localhost:3000'), 'http://localhost:3000/');
});
test('teks biasa menjadi pencarian', () => {
  assert.match(normalizeInput('cara bikin kopi'), /^https:\/\/www\.google\.com\/search\?q=cara%20bikin%20kopi$/);
});
test('skema berbahaya ditolak', () => {
  assert.strictEqual(normalizeInput('javascript:alert(1)'), null);
  assert.strictEqual(normalizeInput('file:///C:/x.txt'), null);
  assert.strictEqual(normalizeInput('data:text/html,hi'), null);
});
test('navigasi hanya http dan https', () => {
  assert.ok(isAllowedNavigation('https://a.com'));
  assert.ok(!isAllowedNavigation('file:///a'));
  assert.ok(!isAllowedNavigation('not a url'));
});

test('homepage: kosong = Tab Baru, URL valid dinormalisasi, teks biasa/skema berbahaya ditolak', () => {
  assert.strictEqual(normalizeHomepage(''), '');
  assert.strictEqual(normalizeHomepage('  '), '');
  assert.strictEqual(normalizeHomepage('example.com'), 'https://example.com/');
  assert.strictEqual(normalizeHomepage('http://localhost:3000'), 'http://localhost:3000/');
  assert.strictEqual(normalizeHomepage('cara bikin kopi'), null);
  assert.strictEqual(normalizeHomepage('kopi'), null);
  assert.strictEqual(normalizeHomepage('javascript:alert(1)'), null);
  assert.strictEqual(normalizeHomepage('file:///C:/x.html'), null);
});
test('Google Lens: hanya gambar http(s), URL di-encode', () => {
  assert.strictEqual(
    lensByUrl('https://a.com/x.jpg?a=1&b=2'),
    'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent('https://a.com/x.jpg?a=1&b=2') + '&hl=id'
  );
  assert.strictEqual(lensByUrl('data:image/png;base64,AAAA'), null);
  assert.strictEqual(lensByUrl('blob:https://a.com/uuid'), null);
  assert.strictEqual(lensByUrl('javascript:alert(1)'), null);
});
