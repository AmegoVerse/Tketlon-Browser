'use strict';
const path = require('path');
const { app, BrowserWindow, Menu, dialog, shell, nativeTheme } = require('electron');
const { SessionManager } = require('./sessions/sessionManager');
const { TabManager } = require('./browser/tabManager');
const { registerIpc } = require('./ipc');
const { formatReceipt } = require('./privacy/receipt');
const { TrackerFilter } = require('./privacy/filter');
const { TestServer } = require('./diagnostics/testServer');
const { makeCanary } = require('./diagnostics/canary');
const { Settings } = require('./store/settings');
const { Bookmarks } = require('./store/bookmarks');
const { ExtensionManager } = require('./extensions/extensionManager');
const { cleanPartitions } = require('./sessions/cleanup');
const { showContextMenu } = require('./browser/contextMenu');
const { LENS_HOME } = require('./browser/url');

const BASE_CHROME_HEIGHT = 84; // tab strip 40 + toolbar 44
const BOOKMARKS_BAR_HEIGHT = 32;

if (!app.requestSingleInstanceLock()) app.quit();

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  const settings = new Settings(path.join(userData, 'settings.json'));
  const bookmarks = new Bookmarks(path.join(userData, 'bookmarks.json'));
  const chromeHeight = () => BASE_CHROME_HEIGHT + (settings.get().showBookmarksBar ? BOOKMARKS_BAR_HEIGHT : 0);
  // Sisa partisi sesi lama (mode ekstensi) dihapus sebelum sesi baru dibuat.
  await cleanPartitions(userData);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 420,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202124' : '#dee1e6',
    title: 'Tketlon Browser',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Jendela UI tidak boleh berpindah halaman atau membuka jendela baru.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, '../ui/index.html'));

  const filter = new TrackerFilter(path.join(__dirname, '../../filters/default.txt'));
  filter.domains.add('selftest-tracker.localhost'); // domain uji untuk halaman uji mandiri
  const testServer = new TestServer({
    getState: () => ({ filterEnabled: filter.enabled, siteException: filter.isException('127.0.0.1') }),
  });
  app.on('will-quit', () => testServer.close());
  const extensions = new ExtensionManager({ settings });
  const sessions = new SessionManager({
    filter,
    canary: makeCanary(testServer),
    persistent: settings.get().extensionsEnabled, // ekstensi butuh partisi persist: (lihat README)
    onStart: (ses) => extensions.loadInto(ses),
  });
  await sessions.ready; // ekstensi termuat sebelum tab pertama dibuka
  const sendToUi = (channel, payload) => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, payload);
  };
  const tabs = new TabManager({
    win,
    sessions,
    chromeHeight: chromeHeight(),
    getHomepage: () => settings.get().homepage,
    onChange: (state) => sendToUi('tabs:update', state),
    onContextMenu: (tab, params) => showContextMenu({ win, tabs, tab, params }),
  });

  const emitBookmarks = () => sendToUi('bookmarks:update', bookmarks.list());
  const emitSettings = () => sendToUi('settings:update', settings.get());
  const activeTab = () => {
    const st = tabs.getState();
    return st.tabs.find((t) => t.id === st.activeId);
  };
  function toggleBookmarkActive() {
    const a = activeTab();
    if (!a || !a.url) return { ok: false };
    const r = bookmarks.toggle({ title: a.title, url: a.url });
    if (!r.ok && r.error) dialog.showErrorBox('Bookmark', r.error);
    emitBookmarks();
    return r;
  }
  function setBookmarksBar(on) {
    const ok = settings.setShowBookmarksBar(on);
    tabs.setChromeHeight(chromeHeight());
    emitSettings();
    return ok;
  }

  async function showAbout() {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Tutup', 'Buka GitHub'],
      defaultId: 0,
      cancelId: 0,
      title: 'Tentang Tketlon Browser',
      message: 'Tketlon Browser',
      detail: [
        'Safety Browser for Privacy',
        '',
        `Versi ${app.getVersion()}`,
        `Chromium ${process.versions.chrome}, Electron ${process.versions.electron}`,
        '',
        'Cincop by AtaLioMego',
        'https://github.com/AmegoVerse/',
        '',
        'Tanpa telemetri, tanpa akun. Batas perlindungan dijelaskan di Privacy Receipt dan halaman uji mandiri.',
      ].join('\n'),
    });
    if (response === 1) shell.openExternal('https://github.com/AmegoVerse/');
  }

  async function resetIdentity() {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Batal', 'Reset Identity'],
      defaultId: 0,
      cancelId: 0,
      title: 'Reset Identity',
      message: 'Reset Identity?',
      detail: 'Semua tab ditutup dan semua login berakhir. File yang sudah diunduh tidak ikut dihapus.',
    });
    if (response !== 1) return;

    tabs.closeAll();
    const report = await sessions.reset();
    tabs.createHome();
    sendStats();

    await dialog.showMessageBox(win, {
      type: report.verified ? 'info' : 'error',
      buttons: ['Tutup'],
      title: 'Privacy Receipt',
      message: report.verified ? 'Identitas baru siap.' : 'Sesi baru dibuat, tetapi pembersihan tidak terverifikasi penuh.',
      detail: formatReceipt(report),
    });
  }

  const getStats = () => ({
    blocked: sessions.stats.blocked.total,
    enabled: filter.enabled,
    loadError: filter.loadError,
  });
  function sendStats() {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('privacy:stats', getStats());
  }
  let statsTimer = null;
  filter.onBlock = () => {
    if (statsTimer) return;
    statsTimer = setTimeout(() => { statsTimer = null; sendStats(); }, 400);
  };

  async function openSelfTest() {
    try {
      const port = await testServer.ensure();
      tabs.create(`http://127.0.0.1:${port}/`);
    } catch (e) {
      dialog.showErrorBox('Halaman uji mandiri', `Server uji lokal tidak dapat dimulai: ${e.message}`);
    }
  }

  function showPrivacyMenu() {
    const st = tabs.getState();
    const active = st.tabs.find((t) => t.id === st.activeId);
    let host = '';
    try { host = new URL(active?.url ?? '').hostname; } catch { host = ''; }
    const siteOff = host ? filter.isException(host) : false;
    Menu.buildFromTemplate([
      { label: `Diblokir di sesi ini: ${sessions.stats.blocked.total}`, enabled: false },
      { label: filter.loadError ? 'Daftar filter: GAGAL dimuat' : `Daftar filter: ${filter.domains.size} domain (starter)`, enabled: false },
      { label: 'WebRTC: hanya IP publik (belum diuji)', enabled: false },
      { type: 'separator' },
      { label: 'Pemblokir pelacak aktif', type: 'checkbox', checked: filter.enabled, click: () => { filter.enabled = !filter.enabled; sendStats(); tabs.reload(); } },
      {
        label: host ? `Matikan untuk ${host}` : 'Pengecualian situs (buka situs dulu)',
        type: 'checkbox',
        checked: siteOff,
        enabled: Boolean(host),
        click: () => { filter.setException(host, !siteOff); tabs.reload(); },
      },
      { type: 'separator' },
      { label: 'Buka halaman uji mandiri', click: () => openSelfTest() },
    ]).popup({ window: win });
  }

  const openBookmarkManager = () => tabs.openSettings('bookmarks');

  function showMainMenu() {
    const a = activeTab();
    const bookmarked = Boolean(a?.url) && bookmarks.has(a.url);
    Menu.buildFromTemplate([
      { label: 'Tab baru', accelerator: 'CmdOrCtrl+T', click: () => tabs.create() },
      { type: 'separator' },
      { label: bookmarked ? 'Hapus bookmark halaman ini' : 'Bookmark halaman ini', accelerator: 'CmdOrCtrl+D', click: () => toggleBookmarkActive() },
      { label: 'Tampilkan bookmark bar', type: 'checkbox', checked: settings.get().showBookmarksBar, accelerator: 'CmdOrCtrl+Shift+B', click: () => setBookmarksBar(!settings.get().showBookmarksBar) },
      { label: 'Kelola bookmark', accelerator: 'CmdOrCtrl+Shift+O', click: openBookmarkManager },
      { type: 'separator' },
      { label: 'Telusuri dengan Google Lens', click: () => tabs.create(LENS_HOME) },
      { label: 'Ekstensi', click: () => tabs.openSettings('extensions') },
      { type: 'separator' },
      { label: 'Reset Identity', accelerator: 'CmdOrCtrl+Shift+Delete', click: () => resetIdentity() },
      { label: 'Pengaturan', accelerator: 'CmdOrCtrl+,', click: () => tabs.openSettings('general') },
      { label: 'Alat pengembang tab', accelerator: 'F12', click: () => tabs.toggleDevTools() },
      { label: 'Tentang Tketlon', click: () => showAbout() },
      { type: 'separator' },
      { role: 'quit', label: 'Keluar' },
    ]).popup({ window: win });
  }

  function showExtensionsMenu() {
    const s = settings.get();
    const items = [];
    if (!s.extensionsEnabled) {
      items.push({ label: 'Dukungan ekstensi sedang mati', enabled: false });
    } else {
      const active = extensions.list().filter((e) => e.active);
      if (!active.length) items.push({ label: 'Belum ada ekstensi aktif', enabled: false });
      for (const e of active) {
        items.push({
          label: `${e.name} ${e.version}`.trim(),
          click: () => {
            if (e.hasPopup) extensions.openPopup(win, e.path, chromeHeight());
            else if (e.hasOptions) extensions.openOptions(win, e.path);
          },
        });
      }
    }
    items.push({ type: 'separator' }, { label: 'Kelola ekstensi', click: () => tabs.openSettings('extensions') });
    Menu.buildFromTemplate(items).popup({ window: win });
  }

  function showBookmarkMenu(id) {
    const b = bookmarks.list().find((x) => x.id === id);
    if (!b) return;
    Menu.buildFromTemplate([
      { label: 'Buka di tab baru', click: () => tabs.create(b.url) },
      { label: 'Hapus', click: () => { bookmarks.removeById(id); emitBookmarks(); } },
      { type: 'separator' },
      { label: 'Kelola bookmark', click: openBookmarkManager },
    ]).popup({ window: win });
  }

  async function setExtensionsMode(on) {
    if (settings.get().extensionsEnabled === on) return { ok: true };
    if (!settings.setExtensionsEnabled(on)) return { ok: false, error: 'Gagal menyimpan pengaturan.' };
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Nanti', 'Mulai ulang sekarang'],
      defaultId: 1,
      cancelId: 0,
      title: 'Perlu mulai ulang',
      message: on ? 'Dukungan ekstensi akan aktif setelah aplikasi dimulai ulang.' : 'Dukungan ekstensi akan mati setelah aplikasi dimulai ulang.',
      detail: on
        ? 'Agar ekstensi bisa dimuat, data sesi sementara akan ditulis ke disk (bukan hanya di memori) dan dihapus saat aplikasi dibuka berikutnya. Semua tab akan ditutup.'
        : 'Sesi kembali sepenuhnya di memori. Semua tab akan ditutup.',
    });
    if (response === 1) { app.relaunch(); app.exit(0); }
    return { ok: true, restartPending: response !== 1 };
  }

  registerIpc({
    win,
    tabs,
    resetIdentity,
    getStats,
    showPrivacyMenu,
    ui: {
      listBookmarks: () => bookmarks.list(),
      toggleBookmark: toggleBookmarkActive,
      bookmarkMenu: showBookmarkMenu,
      manageBookmarks: openBookmarkManager,
      getSettings: () => settings.get(),
      showMainMenu,
      showExtensionsMenu,
      openLens: () => tabs.create(LENS_HOME),
    },
    page: {
      getSettings: () => ({ ...settings.get(), loadError: settings.loadError, saveError: settings.saveError }),
      setHomepage: (v) => settings.setHomepage(v),
      setBookmarksBar,
      setExtensionsMode,
      listBookmarks: () => bookmarks.list(),
      removeBookmark: (id) => { const ok = bookmarks.removeById(id); emitBookmarks(); return ok; },
      listExtensions: () => extensions.list(),
      addExtension: () => extensions.add(win),
      removeExtension: (p) => extensions.remove(p),
      enableExtension: (p, on) => extensions.setEnabled(p, on),
      openExtPopup: (p) => extensions.openPopup(win, p, chromeHeight()),
      openExtOptions: (p) => extensions.openOptions(win, p),
    },
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Tketlon',
        submenu: [
          { label: 'Tab baru', accelerator: 'CmdOrCtrl+T', click: () => tabs.create() },
          { label: 'Bookmark halaman ini', accelerator: 'CmdOrCtrl+D', click: () => toggleBookmarkActive() },
          { label: 'Tampilkan bookmark bar', accelerator: 'CmdOrCtrl+Shift+B', click: () => setBookmarksBar(!settings.get().showBookmarksBar) },
          { label: 'Kelola bookmark', accelerator: 'CmdOrCtrl+Shift+O', click: openBookmarkManager },
          { label: 'Pengaturan', accelerator: 'CmdOrCtrl+,', click: () => tabs.openSettings('general') },
          { label: 'Tutup tab', accelerator: 'CmdOrCtrl+W', click: () => tabs.closeActive() },
          {
            label: 'Fokus address bar',
            accelerator: 'CmdOrCtrl+L',
            click: () => { win.webContents.focus(); win.webContents.send('ui:focus-address'); },
          },
          { label: 'Muat ulang', accelerator: 'CmdOrCtrl+R', click: () => tabs.reload() },
          { label: 'Mundur', accelerator: 'Alt+Left', click: () => tabs.back() },
          { label: 'Maju', accelerator: 'Alt+Right', click: () => tabs.forward() },
          { label: 'Reset Identity', accelerator: 'CmdOrCtrl+Shift+Delete', click: () => resetIdentity() },
          { label: 'Alat pengembang tab', accelerator: 'F12', click: () => tabs.toggleDevTools() },
          { label: 'Tentang Tketlon', click: () => showAbout() },
          { type: 'separator' },
          { role: 'quit', label: 'Keluar' },
        ],
      },
    ])
  );
  win.setMenuBarVisibility(false);

  tabs.createHome();
});
