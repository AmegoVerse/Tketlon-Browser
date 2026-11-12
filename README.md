# Tketlon Browser (MVP langkah 1-3)

Isi: window, tab, address bar, sesi sementara (partisi in-memory), tolak izin default, Reset Identity + Privacy Receipt dasar.

## Menjalankan
Butuh Node.js 20+ di Windows.

    npm install
    npm start
    npm test      # tes normalisasi URL (tanpa Electron)

## Pintasan
Ctrl+T tab baru, Ctrl+W tutup tab, Ctrl+L address bar, Ctrl+R muat ulang,
Alt+Left/Right mundur/maju, Ctrl+Shift+Delete Reset Identity, F12 DevTools tab aktif.

## Uji manual Reset Identity
1. Buka situs apa saja, tekan F12, Console: `localStorage.x='1'; document.cookie='a=1'`
2. Ctrl+Shift+Delete, konfirmasi. Baca Privacy Receipt (cookie sebelum/sesudah).
3. Buka situs yang sama, F12, Console: `localStorage.x` harus `undefined`, `document.cookie` kosong.

## Catatan
- Perbarui versi `electron` di package.json ke rilis stabil terbaru sebelum dipakai serius (patch keamanan Chromium).
- Unduhan memakai perilaku bawaan Electron (dialog simpan). Karantina unduhan menyusul.
- Popup dibuka sebagai tab baru tanpa `window.opener`; alur login OAuth berbasis popup bisa perlu penyesuaian.

## Langkah 5: filter, WebRTC, izin
- Pemblokir pelacak: domain di `filters/default.txt` (daftar STARTER, ganti dengan daftar yang kamu percaya). Subdomain ikut diblokir; permintaan first-party dan navigasi utama tidak diblokir.
- Tombol "Perisai N" membuka menu: jumlah diblokir sesi ini, matikan global, atau kecualikan situs yang rusak. Pengecualian hanya disimpan di memori.
- Jika daftar gagal dimuat, browser tetap jalan dan tombol menampilkan "Perisai: error".
- WebRTC: kebijakan `default_public_interface_only` (IP lokal disembunyikan, panggilan tetap jalan). Kebocoran IP belum diuji; itu tugas halaman uji.
- Privacy Receipt kini memuat jumlah pelacak diblokir dan domain teratas.

## Langkah 6: halaman uji mandiri + uji kanari
- Menu Perisai > "Buka halaman uji mandiri" menjalankan uji: filter pelacak, WebRTC (IP lokal), izin lokasi/kamera/notifikasi, User-Agent, konsistensi Canvas, WebGL/WebGL2, Wasm, audio, WebSocket, Gamepad, layar penuh, dan FPS.
- Halaman dilayani server lokal di 127.0.0.1 (port acak, hanya dinyalakan saat dibutuhkan, Host header diperiksa). Tidak ada koneksi keluar. Badge "Tidak aman" pada tab uji itu normal (http lokal).
- Setiap Reset Identity menjalankan uji kanari: penanda ditulis ke cookie, localStorage, IndexedDB, Cache Storage, dan service worker di sesi lama, dihapus, lalu diperiksa lagi lewat jendela tersembunyi. Jika ada penanda tersisa atau uji tidak bisa dijalankan, receipt menyatakan pembersihan tidak terverifikasi penuh.
- Uji kanari membuktikan mekanisme hapus bekerja per jenis penyimpanan; bukan pemeriksaan isi tiap situs.

## Build Windows (.exe) dan Android (.apk)
Repo ini berisi dua aplikasi: Electron (root) dan Android (`android/`).

Cara paling mudah: unggah seluruh folder ke repo GitHub, lalu buka tab Actions:
- "Build Windows installer" menghasilkan `Tketlon-Browser-Setup-<versi>.exe` (artifact `tketlon-windows-installer`).
- "Build Android APK (debug)" menghasilkan `app-debug.apk` (artifact `tketlon-android-debug-apk`).
Keduanya jalan otomatis saat push ke `main`, atau manual lewat "Run workflow".

Build lokal:
- Windows: `npm install` lalu `npm run dist` (hasil di `dist/`). Installer belum ditandatangani, jadi SmartScreen akan memberi peringatan.
- Android: buka folder `android/` di Android Studio (Hedgehog atau lebih baru, JDK 17), lalu Build > Build APK. Android Studio membuat Gradle wrapper otomatis. minSdk 26 (Android 8.0).

Catatan Android: APK debug cukup untuk uji sendiri. Untuk rilis luas dibutuhkan keystore dan APK rilis bertanda tangan.

## v0.2: tampilan Chrome, homepage, bookmark, ekstensi, Google Lens
- **Mesin pencari**: Google (`https://www.google.com/search?q=`), untuk address bar, Tab Baru, dan klik kanan > "Cari di Google". Android juga sudah memakai Google.
- **Tampilan**: tab strip, toolbar, omnibox berbentuk pil, tombol bintang, bookmark bar, menu titik tiga, dan mode terang/gelap mengikuti sistem. Reset Identity pindah ke menu titik tiga (tetap Ctrl+Shift+Delete).
- **Homepage**: Menu > Pengaturan > Umum. Pilih "Halaman Tab Baru" atau alamat khusus. Dipakai tombol Beranda, tab pertama saat aplikasi dibuka, dan tab pertama setelah Reset Identity. Ctrl+T tetap membuka Tab Baru.
- **Bookmark**: bintang di address bar atau Ctrl+D; bookmark bar (Ctrl+Shift+B); klik kanan item untuk hapus; kelola di Pengaturan > Bookmark (Ctrl+Shift+O). Tab Baru menampilkan 8 bookmark pertama sebagai pintasan.
- **Google Lens**: (1) tombol Lens di address bar dan di Tab Baru membuka lens.google.com (unggah, seret, atau tempel gambar di sana); (2) klik kanan gambar > "Telusuri gambar dengan Google Lens". Cara (2) hanya untuk gambar beralamat http/https (bukan `data:`/`blob:`).
- **Ekstensi**: Pengaturan > Ekstensi (mirip Add-ons Manager Firefox: daftar, saklar aktif/nonaktif, Opsi, Hapus). Tombol puzzle di toolbar membuka popup ekstensi.

### Penyimpanan dan privasi
Bookmark dan pengaturan disimpan di `settings.json` dan `bookmarks.json` di folder userData aplikasi. Keduanya **tidak** dihapus oleh Reset Identity (itu memang tujuannya), tetapi ini berarti ada data tersimpan di disk. Cookie dan data situs tetap hanya di memori.

### Batasan ekstensi (baca sebelum dipakai)
- Electron memuat ekstensi gaya Chrome (WebExtension MV2/MV3, **folder ter-unpack**) dan hanya mendukung sebagian API `chrome.*`. Add-on Firefox (.xpi / addons.mozilla.org) tidak kompatibel. Tidak ada instal dari Chrome Web Store.
- Electron tidak memuat ekstensi ke sesi yang murni di memori. Karena itu "Dukungan ekstensi" **default mati**. Jika dinyalakan (perlu mulai ulang), sesi memakai partisi `persist:`: data situs ditulis ke disk sementara, dihapus lewat `clearStorageData` saat Reset Identity, dan folder partisinya dihapus saat aplikasi dibuka berikutnya. Jadi klaim "hanya di memori" tidak berlaku saat mode ini aktif. Periksa folder `Partitions` di userData untuk memastikan pembersihan berjalan di versi Electron kamu.
- Ekstensi punya akses luas ke halaman web. Pasang hanya yang kamu percaya; pemblokir pelacak dan kebijakan izin Tketlon tidak membatasi apa yang dilakukan ekstensi.

### Belum ada
Favicon di tab (sengaja tidak memuat ikon dari internet), folder bookmark, impor/ekspor bookmark, pemilihan area layar untuk Lens, sinkronisasi.
