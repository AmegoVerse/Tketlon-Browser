'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Preload ini dipasang di SEMUA tab, tetapi API hanya diekspos untuk halaman file lokal.
// Situs web (http/https) tidak mendapat apa-apa. Main process memeriksa lagi alamat pengirim.
if (location.protocol === 'file:') {
  const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
  contextBridge.exposeInMainWorld('tketlonPage', {
    getSettings: () => call('page:settings:get'),
    setHomepage: (v) => call('page:homepage:set', v),
    setBookmarksBar: (on) => call('page:bar:set', on),
    setExtensionsMode: (on) => call('page:extmode:set', on),
    listBookmarks: () => call('page:bookmarks:list'),
    removeBookmark: (id) => call('page:bookmarks:remove', id),
    listExtensions: () => call('page:ext:list'),
    addExtension: () => call('page:ext:add'),
    removeExtension: (p) => call('page:ext:remove', p),
    enableExtension: (p, on) => call('page:ext:enable', p, on),
    openExtPopup: (p) => call('page:ext:popup', p),
    openExtOptions: (p) => call('page:ext:options', p),
  });
}
