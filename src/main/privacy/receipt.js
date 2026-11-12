'use strict';
function formatReceipt(r) {
  const lines = [];
  lines.push(`Sesi #${r.fromGeneration} diganti sesi #${r.toGeneration} (${r.durationMs} ms)`);
  lines.push('');
  lines.push(`Cookie: ${r.cookiesBefore ?? '?'} sebelum, ${r.cookiesAfter ?? '?'} sesudah (terverifikasi)`);
  lines.push('');
  lines.push('Langkah pembersihan:');
  for (const s of r.steps) lines.push(`${s.ok ? '[OK]' : '[GAGAL]'} ${s.label}`);
  lines.push('');
  if (r.filterLoadError) lines.push(`Pemblokir pelacak: GAGAL memuat daftar (${r.filterLoadError})`);
  else if (!r.filterEnabled) lines.push('Pemblokir pelacak: dinonaktifkan pengguna');
  else {
    lines.push(`Pemblokir pelacak: ${r.blockedTotal} permintaan diblokir (daftar ${r.filterDomains} domain)`);
    if (r.blockedTop.length) lines.push('Teratas: ' + r.blockedTop.map(([d, n]) => `${d} x${n}`).join(', '));
  }
  lines.push('WebRTC: kebijakan hanya-IP-publik diterapkan; buktikan lewat halaman uji mandiri (menu Perisai).');
  const denied = Object.entries(r.deniedPermissions);
  lines.push('');
  lines.push(
    denied.length
      ? 'Izin ditolak: ' + denied.map(([k, v]) => `${k} x${v}`).join(', ')
      : 'Izin ditolak: tidak ada permintaan'
  );
  if (r.errors.length) {
    lines.push('');
    lines.push('Masalah:');
    for (const e of r.errors) lines.push('- ' + e);
  }
  lines.push('');
  const c = r.canary;
  if (!c) {
    lines.push('Uji kanari tidak dikonfigurasi: penghapusan localStorage, IndexedDB, dan service worker belum diverifikasi.');
  } else if (c.error) {
    lines.push(`Uji kanari: TIDAK DAPAT DIJALANKAN (${c.error}). Penghapusan storage belum terverifikasi.`);
  } else {
    lines.push('Uji kanari (penanda uji ditulis lalu dihapus di sesi lama):');
    for (const i of c.items) lines.push(`${!i.written ? '[?]' : i.found ? '[GAGAL]' : '[OK]'} ${i.label}: ${!i.written ? 'tidak dapat diuji' : i.found ? 'penanda MASIH ADA' : 'penanda terhapus'}`);
    lines.push('Uji kanari membuktikan mekanisme hapus bekerja per jenis penyimpanan; bukan pemeriksaan isi tiap situs.');
  }
  lines.push('Tidak ikut terhapus: file unduhan, data yang sudah terkirim ke situs, jejak jaringan.');
  return lines.join('\n');
}
module.exports = { formatReceipt };
