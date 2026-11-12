'use strict';
const path = require('path');
const { WebContentsView } = require('electron');
const { normalizeInput, isAllowedNavigation } = require('./url');
const { WEBRTC_POLICY } = require('../privacy/policy');

const NEWTAB = path.join(__dirname, '../../ui/newtab.html');
const SETTINGS_PAGE = path.join(__dirname, '../../ui/pages/settings.html');
const PAGE_PRELOAD = path.join(__dirname, '../../preload/preloadPage.js');

class TabManager {
  constructor({ win, sessions, chromeHeight, onChange, getHomepage, onContextMenu }) {
    this.win = win;
    this.sessions = sessions;
    this.chromeHeight = chromeHeight;
    this.onChange = onChange;
    this.getHomepage = getHomepage || (() => '');
    this.onContextMenu = onContextMenu || null;
    this.tabs = new Map();
    this.order = [];
    this.activeId = null;
    this.nextId = 1;
    this.htmlFullscreen = false;
    win.on('resize', () => this.layout());
    win.on('enter-full-screen', () => this.layout());
    win.on('leave-full-screen', () => this.layout());
  }

  create(url) {
    const view = new WebContentsView({
      webPreferences: {
        session: this.sessions.current,
        // Preload ini hanya mengekspos API jika halaman adalah file lokal Tketlon (lihat preloadPage.js).
        preload: PAGE_PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    const id = this.nextId++;
    const tab = { id, view, title: '', loading: false, crashed: false };
    this.tabs.set(id, tab);
    this.order.push(id);
    this.win.contentView.addChildView(view);
    this._wire(tab);
    this.activate(id);
    const wc = view.webContents;
    wc.setWebRTCIPHandlingPolicy(WEBRTC_POLICY);
    if (url && isAllowedNavigation(url)) wc.loadURL(url).catch(() => {});
    else wc.loadFile(NEWTAB).catch(() => {});
    return id;
  }

  // Tab awal / setelah Reset Identity: buka homepage jika diatur, jika tidak Tab Baru.
  createHome() {
    const hp = this.getHomepage();
    return this.create(hp && isAllowedNavigation(hp) ? hp : undefined);
  }

  // section: 'general' | 'bookmarks' | 'extensions'. Jika tab pengaturan sudah ada, pakai ulang.
  openSettings(section = 'general') {
    const hash = ['general', 'bookmarks', 'extensions'].includes(section) ? section : 'general';
    const existing = this.order.find((id) => /\/pages\/settings\.html/.test(this.tabs.get(id).view.webContents.getURL()));
    const id = existing ?? this.create();
    const wc = this.tabs.get(id).view.webContents;
    wc.loadFile(SETTINGS_PAGE, { hash }).catch(() => {});
    this.activate(id);
    return id;
  }

  setChromeHeight(h) {
    this.chromeHeight = h;
    this.layout();
  }

  _wire(tab) {
    const wc = tab.view.webContents;
    const emit = () => this._emit();
    wc.on('page-title-updated', (_e, title) => { tab.title = title; emit(); });
    wc.on('did-start-loading', () => { tab.loading = true; tab.crashed = false; emit(); });
    wc.on('did-stop-loading', () => { tab.loading = false; emit(); });
    wc.on('did-navigate', emit);
    wc.on('did-navigate-in-page', emit);
    wc.on('context-menu', (_e, params) => this.onContextMenu?.(tab, params));
    wc.on('render-process-gone', () => { tab.crashed = true; tab.loading = false; emit(); });
    wc.on('will-navigate', (event, legacyUrl) => {
      const url = event.url ?? legacyUrl;
      if (!isAllowedNavigation(url)) event.preventDefault();
    });
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedNavigation(url)) this.create(url);
      return { action: 'deny' };
    });
    wc.on('enter-html-full-screen', () => {
      this.htmlFullscreen = true;
      this.win.setFullScreen(true);
      this.layout();
    });
    wc.on('leave-html-full-screen', () => {
      this.htmlFullscreen = false;
      this.win.setFullScreen(false);
      this.layout();
    });
  }

  layout() {
    if (this.win.isDestroyed()) return;
    const [w, h] = this.win.getContentSize();
    const top = this.htmlFullscreen ? 0 : this.chromeHeight;
    for (const tab of this.tabs.values()) {
      tab.view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) });
    }
  }

  activate(id) {
    if (!this.tabs.has(id)) return;
    this.activeId = id;
    for (const tab of this.tabs.values()) tab.view.setVisible(tab.id === id);
    this.layout();
    this.tabs.get(id).view.webContents.focus();
    this._emit();
  }

  _remove(id) {
    const tab = this.tabs.get(id);
    if (!tab) return -1;
    const idx = this.order.indexOf(id);
    this.order.splice(idx, 1);
    this.tabs.delete(id);
    this.win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    return idx;
  }

  closeTab(id) {
    const idx = this._remove(id);
    if (idx < 0) return;
    if (this.order.length === 0) { this.activeId = null; this.create(); return; }
    if (this.activeId === id) this.activate(this.order[Math.min(idx, this.order.length - 1)]);
    else this._emit();
  }

  closeActive() { if (this.activeId != null) this.closeTab(this.activeId); }

  // Dipakai Reset Identity: menutup semua tab tanpa membuat tab baru.
  closeAll() {
    const count = this.order.length;
    for (const id of [...this.order]) this._remove(id);
    this.activeId = null;
    this.htmlFullscreen = false;
    if (this.win.isFullScreen()) this.win.setFullScreen(false);
    this._emit();
    return count;
  }

  _active() { return this.tabs.get(this.activeId); }

  navigate(input) {
    const url = normalizeInput(input);
    if (!url) return { ok: false };
    const tab = this._active();
    if (!tab) { this.create(url); return { ok: true }; }
    tab.view.webContents.loadURL(url).catch(() => {});
    return { ok: true };
  }

  _nav(wc) { return wc.navigationHistory ?? wc; }
  back() { const t = this._active(); if (t) { const n = this._nav(t.view.webContents); if (n.canGoBack()) n.goBack(); } }
  forward() { const t = this._active(); if (t) { const n = this._nav(t.view.webContents); if (n.canGoForward()) n.goForward(); } }
  reload() { this._active()?.view.webContents.reload(); }
  home() {
    const wc = this._active()?.view.webContents;
    if (!wc) return;
    const hp = this.getHomepage();
    if (hp && isAllowedNavigation(hp)) wc.loadURL(hp).catch(() => {});
    else wc.loadFile(NEWTAB).catch(() => {});
  }
  toggleDevTools() { this._active()?.view.webContents.toggleDevTools(); }

  getState() {
    const tabs = this.order.map((id) => {
      const tab = this.tabs.get(id);
      const wc = tab.view.webContents;
      const nav = this._nav(wc);
      return {
        id,
        title: tab.title,
        url: wc.getURL(),
        loading: tab.loading,
        crashed: tab.crashed,
        canGoBack: nav.canGoBack(),
        canGoForward: nav.canGoForward(),
      };
    });
    return { tabs, activeId: this.activeId };
  }

  _emit() { this.onChange?.(this.getState()); }
}

module.exports = { TabManager };
