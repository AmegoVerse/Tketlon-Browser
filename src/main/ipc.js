'use strict';
const path = require('path');
const { ipcMain } = require('electron');
const { fileURLToPath } = require('url');

const UI_DIR = path.resolve(__dirname, '../ui');
// Hanya halaman lokal Tketlon ini yang boleh memanggil channel "page:*".
const INTERNAL_PAGES = new Set([
  path.join(UI_DIR, 'newtab.html'),
  path.join(UI_DIR, 'pages', 'settings.html'),
].map((p) => p.toLowerCase()));

function isInternalSender(event) {
  try {
    const url = event.senderFrame?.url;
    if (!url || !url.startsWith('file:')) return false;
    return INTERNAL_PAGES.has(path.resolve(fileURLToPath(url)).toLowerCase());
  } catch { return false; }
}

// ui: perintah dari jendela UI (toolbar). page: perintah dari halaman internal (Tab Baru, Pengaturan).
function registerIpc({ win, tabs, resetIdentity, getStats, showPrivacyMenu, ui, page }) {
  const handle = (channel, fn) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (event.sender !== win.webContents) return undefined;
      return fn(...args);
    });
  const handlePage = (channel, fn) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!isInternalSender(event)) return undefined;
      return fn(...args);
    });

  handle('tabs:get', () => tabs.getState());
  handle('tab:new', () => tabs.create());
  handle('tab:close', (id) => tabs.closeTab(Number(id)));
  handle('tab:activate', (id) => tabs.activate(Number(id)));
  handle('nav:go', (input) => tabs.navigate(String(input ?? '')));
  handle('nav:back', () => tabs.back());
  handle('nav:forward', () => tabs.forward());
  handle('nav:reload', () => tabs.reload());
  handle('nav:home', () => tabs.home());
  handle('identity:reset', () => resetIdentity());
  handle('privacy:get', () => getStats());
  handle('privacy:menu', () => showPrivacyMenu());

  handle('bookmarks:list', () => ui.listBookmarks());
  handle('bookmarks:toggle', () => ui.toggleBookmark());
  handle('bookmarks:menu', (id) => ui.bookmarkMenu(String(id)));
  handle('bookmarks:manage', () => ui.manageBookmarks());
  handle('settings:get', () => ui.getSettings());
  handle('menu:main', () => ui.showMainMenu());
  handle('menu:extensions', () => ui.showExtensionsMenu());
  handle('lens:open', () => ui.openLens());

  handlePage('page:settings:get', () => page.getSettings());
  handlePage('page:homepage:set', (v) => page.setHomepage(String(v ?? '')));
  handlePage('page:bar:set', (v) => page.setBookmarksBar(Boolean(v)));
  handlePage('page:extmode:set', (v) => page.setExtensionsMode(Boolean(v)));
  handlePage('page:bookmarks:list', () => page.listBookmarks());
  handlePage('page:bookmarks:remove', (id) => page.removeBookmark(String(id)));
  handlePage('page:ext:list', () => page.listExtensions());
  handlePage('page:ext:add', () => page.addExtension());
  handlePage('page:ext:remove', (p) => page.removeExtension(String(p)));
  handlePage('page:ext:enable', (p, on) => page.enableExtension(String(p), Boolean(on)));
  handlePage('page:ext:popup', (p) => page.openExtPopup(String(p)));
  handlePage('page:ext:options', (p) => page.openExtOptions(String(p)));
}

module.exports = { registerIpc, isInternalSender };
