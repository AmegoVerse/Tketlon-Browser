'use strict';
const fs = require('fs');
const path = require('path');

// Saat dukungan ekstensi aktif, sesi memakai partisi "persist:" (Electron tidak memuat ekstensi
// ke sesi di memori). Folder partisi lama dihapus saat aplikasi mulai, sebelum sesi dibuat.
async function cleanPartitions(userDataDir) {
  const dir = path.join(userDataDir, 'Partitions');
  const result = { removed: 0, failed: [] };
  let names;
  try { names = await fs.promises.readdir(dir); } catch { return result; }
  for (const n of names) {
    if (!/^tketlon-/i.test(n)) continue;
    try {
      await fs.promises.rm(path.join(dir, n), { recursive: true, force: true });
      result.removed += 1;
    } catch {
      result.failed.push(n);
    }
  }
  return result;
}

module.exports = { cleanPartitions };
