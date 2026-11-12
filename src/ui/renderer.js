'use strict';
const $ = (s) => document.querySelector(s);
const tabsEl = $('#tabs');
const addr = $('#address');
const badge = $('#badge');
let state = { tabs: [], activeId: null };
let bookmarks = [];
let lastActive = null;

// Alamat internal ditampilkan seperti Chrome (chrome://settings), bukan path file.
function displayUrl(url) {
  if (!url.startsWith('file:')) return url;
  const m = url.match(/\/pages\/settings\.html(?:#(\w+))?/);
  if (m) return 'tketlon://settings' + (m[1] && m[1] !== 'general' ? '/' + m[1] : '');
  return ''; // halaman Tab Baru
}

function render() {
  tabsEl.replaceChildren();
  for (const t of state.tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === state.activeId ? ' active' : '');
    const label = (t.loading ? '… ' : '') + (t.crashed ? '⚠ ' : '') + (t.title || 'Tab baru');
    el.title = label;
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = label;
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Tutup tab';
    x.addEventListener('mousedown', (e) => e.stopPropagation());
    x.addEventListener('click', (e) => { e.stopPropagation(); window.tketlon.closeTab(t.id); });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); window.tketlon.closeTab(t.id); }
      else if (e.button === 0) window.tketlon.activateTab(t.id);
    });
    el.append(title, x);
    tabsEl.append(el);
  }

  const a = state.tabs.find((t) => t.id === state.activeId);
  $('#btn-back').disabled = !a?.canGoBack;
  $('#btn-forward').disabled = !a?.canGoForward;
  $('#btn-reload').disabled = !a;

  const url = a?.url ?? '';
  if (document.activeElement !== addr || lastActive !== state.activeId) addr.value = displayUrl(url);
  lastActive = state.activeId;

  const label = badge.querySelector('.label');
  if (url.startsWith('https:')) { badge.className = 'secure'; label.textContent = ''; }
  else if (url.startsWith('http:')) { badge.className = 'insecure'; label.textContent = 'Tidak aman'; }
  else { badge.className = ''; label.textContent = ''; }

  const isWeb = /^https?:/i.test(url);
  const star = $('#btn-star');
  star.disabled = !isWeb;
  star.classList.toggle('active', isWeb && bookmarks.some((b) => b.url === url));
}

function renderBookmarks() {
  const box = $('#bookmarks');
  box.replaceChildren();
  for (const b of bookmarks) {
    const el = document.createElement('button');
    el.className = 'bm';
    el.title = `${b.title}\n${b.url}`;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = (b.title || '?').trim().charAt(0).toUpperCase() || '?';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = b.title;
    el.append(dot, name);
    el.addEventListener('click', () => window.tketlon.go(b.url));
    el.addEventListener('auxclick', (e) => { if (e.button === 1) window.tketlon.newTab().then(() => window.tketlon.go(b.url)); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); window.tketlon.bookmarkMenu(b.id); });
    box.append(el);
  }
  render();
}

function applySettings(s) {
  document.body.classList.toggle('show-bar', Boolean(s?.showBookmarksBar));
}

addr.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { window.tketlon.go(addr.value); addr.blur(); }
  else if (e.key === 'Escape') { addr.blur(); render(); }
});
addr.addEventListener('focus', () => addr.select());

$('#btn-newtab').addEventListener('click', () => window.tketlon.newTab());
$('#btn-back').addEventListener('click', () => window.tketlon.back());
$('#btn-forward').addEventListener('click', () => window.tketlon.forward());
$('#btn-reload').addEventListener('click', () => window.tketlon.reload());
$('#btn-home').addEventListener('click', () => window.tketlon.home());
$('#btn-star').addEventListener('click', () => window.tketlon.toggleBookmark());
$('#btn-lens').addEventListener('click', () => window.tketlon.openLens());
$('#btn-ext').addEventListener('click', () => window.tketlon.extensionsMenu());
$('#btn-shield').addEventListener('click', () => window.tketlon.privacyMenu());
$('#btn-menu').addEventListener('click', () => window.tketlon.mainMenu());
$('#btn-allbookmarks').addEventListener('click', () => window.tketlon.manageBookmarks());

function renderPrivacy(p) {
  const el = $('#btn-shield');
  el.textContent = p.loadError ? 'Perisai: error' : p.enabled ? `Perisai ${p.blocked}` : 'Perisai mati';
  el.className = 'pill' + (p.enabled && !p.loadError ? '' : ' off');
}
window.tketlon.onPrivacy(renderPrivacy);
window.tketlon.getPrivacy().then(renderPrivacy);
window.tketlon.onTabs((s) => { state = s; render(); });
window.tketlon.onBookmarks((l) => { bookmarks = l; renderBookmarks(); });
window.tketlon.onSettings(applySettings);
window.tketlon.onFocusAddress(() => { addr.focus(); addr.select(); });
window.tketlon.getSettings().then(applySettings);
window.tketlon.listBookmarks().then((l) => { bookmarks = l; renderBookmarks(); });
window.tketlon.getState().then((s) => { state = s; render(); });
