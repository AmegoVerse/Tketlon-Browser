'use strict';
const { Menu, clipboard } = require('electron');
const { isAllowedNavigation, lensByUrl, searchUrl } = require('./url');

// Menu klik kanan di halaman web. `tabs` = TabManager.
function showContextMenu({ win, tabs, tab, params }) {
  const wc = tab.view.webContents;
  const t = [];
  const sel = (params.selectionText || '').trim();
  const isImage = params.mediaType === 'image' && params.srcURL;
  const lens = isImage ? lensByUrl(params.srcURL) : null;

  if (params.linkURL && isAllowedNavigation(params.linkURL)) {
    t.push({ label: 'Buka link di tab baru', click: () => tabs.create(params.linkURL) });
    t.push({ label: 'Salin alamat link', click: () => clipboard.writeText(params.linkURL) });
    t.push({ type: 'separator' });
  }
  if (isImage) {
    t.push({
      label: lens ? 'Telusuri gambar dengan Google Lens' : 'Telusuri dengan Google Lens (gambar ini tidak punya alamat http/https)',
      enabled: Boolean(lens),
      click: () => tabs.create(lens),
    });
    if (isAllowedNavigation(params.srcURL)) {
      t.push({ label: 'Buka gambar di tab baru', click: () => tabs.create(params.srcURL) });
      t.push({ label: 'Salin alamat gambar', click: () => clipboard.writeText(params.srcURL) });
    }
    t.push({ label: 'Salin gambar', click: () => wc.copyImageAt(params.x, params.y) });
    t.push({ type: 'separator' });
  }
  if (sel) {
    const short = sel.length > 30 ? `${sel.slice(0, 30)}…` : sel;
    t.push({ label: `Cari "${short}" di Google`, click: () => tabs.create(searchUrl(sel)) });
  }
  if (params.isEditable) {
    t.push({ role: 'cut', label: 'Potong' }, { role: 'copy', label: 'Salin' }, { role: 'paste', label: 'Tempel' }, { role: 'selectAll', label: 'Pilih semua' });
  } else if (sel) {
    t.push({ role: 'copy', label: 'Salin' });
  }
  if (!sel && !params.isEditable && !isImage && !params.linkURL) {
    const nav = wc.navigationHistory ?? wc;
    t.push(
      { label: 'Mundur', enabled: nav.canGoBack(), click: () => tabs.back() },
      { label: 'Maju', enabled: nav.canGoForward(), click: () => tabs.forward() },
      { label: 'Muat ulang', click: () => tabs.reload() },
    );
  }
  if (t.length) Menu.buildFromTemplate(t).popup({ window: win });
}

module.exports = { showContextMenu };
