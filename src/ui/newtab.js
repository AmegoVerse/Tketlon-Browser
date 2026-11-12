'use strict';
// Pintasan di Tab Baru diambil dari bookmark (tanpa memuat ikon dari internet).
(async () => {
  const box = document.getElementById('shortcuts');
  if (!window.tketlonPage) return;
  let list = [];
  try { list = await window.tketlonPage.listBookmarks(); } catch { return; }
  for (const b of list.slice(0, 8)) {
    const a = document.createElement('a');
    a.href = b.url;
    a.title = b.url;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = (b.title || '?').trim().charAt(0).toUpperCase() || '?';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = b.title;
    a.append(dot, name);
    box.append(a);
  }
})();
