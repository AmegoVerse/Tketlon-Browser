'use strict';
const api = window.tketlonPage;
const $ = (s) => document.querySelector(s);
const SECTIONS = ['general', 'bookmarks', 'extensions'];

function showSection() {
  const h = location.hash.replace('#', '');
  const cur = SECTIONS.includes(h) ? h : 'general';
  for (const s of SECTIONS) {
    $(`#s-${s}`).classList.toggle('active', s === cur);
    document.querySelector(`nav a[data-s="${s}"]`).classList.toggle('active', s === cur);
  }
  if (cur === 'bookmarks') loadBookmarks();
  if (cur === 'extensions') loadExtensions();
}
window.addEventListener('hashchange', showSection);

function say(el, text, kind) { el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// ---- Umum ----
async function loadGeneral() {
  const s = await api.getSettings();
  const custom = Boolean(s.homepage);
  $('#hp-custom').checked = custom;
  $('#hp-newtab').checked = !custom;
  $('#hp-url').value = s.homepage;
  $('#hp-url').disabled = !custom;
  $('#bar-toggle').checked = s.showBookmarksBar;
  $('#ext-mode').checked = s.extensionsEnabled;
  const warn = [s.loadError && `File pengaturan gagal dibaca (${s.loadError}).`, s.saveError && `Gagal menyimpan: ${s.saveError}`].filter(Boolean).join(' ');
  $('#store-note').textContent = warn || 'Pengaturan dan bookmark disimpan sebagai file lokal di perangkat ini dan tidak ikut terhapus oleh Reset Identity.';
}
for (const r of document.querySelectorAll('input[name=hp]')) {
  r.addEventListener('change', async () => {
    const custom = $('#hp-custom').checked;
    $('#hp-url').disabled = !custom;
    if (custom) { $('#hp-url').focus(); return; }
    const r2 = await api.setHomepage('');
    say($('#hp-msg'), r2.ok ? 'Beranda: halaman Tab Baru.' : 'Gagal menyimpan.', r2.ok ? 'good' : 'bad');
  });
}
$('#hp-save').addEventListener('click', async () => {
  if (!$('#hp-custom').checked) { say($('#hp-msg'), 'Pilih "Alamat khusus" dulu.', 'bad'); return; }
  const v = $('#hp-url').value.trim();
  if (!v) { say($('#hp-msg'), 'Isi alamat beranda.', 'bad'); return; }
  const r = await api.setHomepage(v);
  if (r.ok) { $('#hp-url').value = r.homepage; say($('#hp-msg'), 'Tersimpan.', 'good'); }
  else say($('#hp-msg'), r.error || 'Gagal menyimpan.', 'bad');
});
$('#hp-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#hp-save').click(); });
$('#bar-toggle').addEventListener('change', (e) => api.setBookmarksBar(e.target.checked));

// ---- Bookmark ----
async function loadBookmarks() {
  const box = $('#bm-list');
  box.replaceChildren();
  const list = await api.listBookmarks();
  if (!list.length) { box.append(el('div', 'empty', 'Belum ada bookmark.')); return; }
  for (const b of list) {
    const row = el('div', 'row');
    const g = el('div', 'grow');
    const a = el('a', 'link title', b.title);
    a.href = b.url;
    g.append(a, el('div', 'sub', b.url));
    const del = el('button', 'btn danger', 'Hapus');
    del.addEventListener('click', async () => { await api.removeBookmark(b.id); loadBookmarks(); });
    row.append(g, del);
    box.append(row);
  }
}

// ---- Ekstensi ----
$('#ext-mode').addEventListener('change', async (e) => {
  const r = await api.setExtensionsMode(e.target.checked);
  if (!r?.ok) { say($('#ext-msg'), r?.error || 'Gagal mengubah pengaturan.', 'bad'); e.target.checked = !e.target.checked; }
  else say($('#ext-msg'), r.restartPending ? 'Tersimpan. Berlaku setelah aplikasi dimulai ulang.' : '', 'good');
});
$('#ext-add').addEventListener('click', async () => {
  const r = await api.addExtension();
  if (r.canceled) return;
  if (!r.ok) say($('#ext-msg'), r.error || 'Gagal menambah ekstensi.', 'bad');
  else say($('#ext-msg'), r.error ? `Ditambahkan, tetapi gagal dimuat: ${r.error}` : 'Ekstensi ditambahkan.', r.error ? 'bad' : 'good');
  loadExtensions();
});

async function loadExtensions() {
  const s = await api.getSettings();
  $('#ext-mode').checked = s.extensionsEnabled;
  const box = $('#ext-list');
  box.replaceChildren();
  const list = await api.listExtensions();
  if (!list.length) { box.append(el('div', 'empty', 'Belum ada ekstensi. Klik "Tambah ekstensi…" lalu pilih folder yang berisi manifest.json.')); return; }
  for (const x of list) {
    const row = el('div', 'row');
    const g = el('div', 'grow');
    const t = el('div', 'title', `${x.name} ${x.version}`.trim());
    if (x.manifestVersion) t.append(el('span', 'badge', `MV${x.manifestVersion}`));
    if (s.extensionsEnabled && x.enabled) t.append(el('span', 'badge', x.active ? 'aktif' : 'tidak termuat'));
    g.append(t);
    if (x.description) g.append(el('div', 'sub', x.description));
    g.append(el('div', 'sub', x.path));
    if (x.error) g.append(el('div', 'err', x.error));
    row.append(g);
    if (x.hasPopup) { const b = el('button', 'btn', 'Buka'); b.addEventListener('click', () => api.openExtPopup(x.path)); row.append(b); }
    if (x.hasOptions) { const b = el('button', 'btn', 'Opsi'); b.addEventListener('click', () => api.openExtOptions(x.path)); row.append(b); }
    const sw = el('label', 'switch');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = x.enabled; cb.setAttribute('aria-label', `Aktifkan ${x.name}`);
    cb.addEventListener('change', async () => { await api.enableExtension(x.path, cb.checked); loadExtensions(); });
    sw.append(cb, document.createElement('span'));
    const rm = el('button', 'btn danger', 'Hapus');
    rm.addEventListener('click', async () => { await api.removeExtension(x.path); loadExtensions(); });
    row.append(sw, rm);
    box.append(row);
  }
}

loadGeneral();
showSection();
