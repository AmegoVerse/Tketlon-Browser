# Tketlon Browser

**Browse Freely. Stay Private.**  
*Jelajahi dengan bebas. Lindungi privasimu.*

Tketlon Browser adalah proyek peramban web yang dikembangkan dengan fokus pada **privasi, keamanan, dan kendali pengguna atas data penjelajahan**. Proyek ini menggabungkan aplikasi desktop berbasis Electron dengan aplikasi Android berbasis Kotlin. Tujuannya adalah menghadirkan pengalaman browsing yang familiar dan mudah digunakan, sekaligus menyediakan alat untuk mengurangi pelacakan, mengelola izin situs, serta membersihkan data sesi penjelajahan.

Tketlon Browser bukan sekadar alat untuk membuka halaman web. Fitur seperti **Tracker Blocking**, **Reset Identity**, **Privacy Receipt**, dan **Security Self-Test** dirancang agar pengguna dapat memahami dan mengelola sebagian jejak digital yang dihasilkan selama menjelajah internet.

> [!IMPORTANT]
> **Status proyek: v0.2.0 — masih dalam tahap pengembangan.** Implementasi, kompatibilitas, dan tingkat perlindungan dapat berubah. Fitur privasi tidak menjamin anonimitas penuh dan belum menggantikan audit keamanan independen.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Platform dan Teknologi](#platform-dan-teknologi)
- [Memulai di Desktop](#memulai-di-desktop)
- [Pintasan Keyboard](#pintasan-keyboard)
- [Fitur Privasi dan Cara Kerjanya](#fitur-privasi-dan-cara-kerjanya)
- [Pengaturan Penyimpanan dan Batasan](#pengaturan-penyimpanan-dan-batasan)
- [Build Aplikasi](#build-aplikasi)
- [Pengujian Reset Identity](#pengujian-reset-identity)
- [Batasan yang Diketahui](#batasan-yang-diketahui)
- [Arah Pengembangan](#arah-pengembangan)
- [Kontribusi dan Pelaporan Bug](#kontribusi-dan-pelaporan-bug)
- [Lisensi](#lisensi)

## Fitur Utama

### 1. Privacy Protection

Menyediakan kontrol privasi yang membantu pengguna mengurangi pelacakan dan mengelola akses situs terhadap fitur perangkat. Kebijakan izin bawaan dirancang untuk menolak permintaan izin tertentu secara default, sehingga akses seperti lokasi, kamera, atau notifikasi tidak diberikan tanpa keputusan pengguna.

### 2. Tracker Blocking

Memblokir permintaan ke domain pelacak berdasarkan daftar filter yang tersedia di `filters/default.txt`. Subdomain dari domain yang terdaftar ikut dicakup. Browser menyediakan indikator jumlah pemblokiran, opsi untuk menonaktifkan perlindungan, serta pengecualian situs ketika suatu situs mengalami gangguan.

Daftar filter bawaan merupakan daftar awal (*starter list*) dan dapat disesuaikan. Efektivitas pemblokiran bergantung pada isi daftar filter dan pola permintaan situs.

### 3. Reset Identity

Fitur untuk membersihkan data situs pada sesi penjelajahan, termasuk:

- Cookie.
- Local Storage.
- IndexedDB.
- Cache Storage.
- Service Worker.

Pada proses reset, Tketlon Browser menjalankan pengujian kanari (*canary test*) untuk membantu memeriksa apakah penanda uji pada jenis penyimpanan tersebut berhasil dihapus. Hasilnya ditampilkan melalui Privacy Receipt. Jika pengujian tidak dapat dijalankan atau masih menemukan penanda, proses pembersihan akan ditandai belum terverifikasi sepenuhnya.

### 4. Privacy Receipt

Menyediakan ringkasan aktivitas perlindungan privasi, antara lain jumlah pelacak yang diblokir, domain pelacak teratas, serta status verifikasi proses Reset Identity. Receipt merupakan informasi diagnostik mengenai tindakan browser, bukan sertifikat bahwa seluruh jejak digital telah terhapus.

### 5. Security Self-Test

Halaman pengujian mandiri untuk memeriksa sejumlah karakteristik browser dan lingkungan penjelajahan, termasuk:

- Filter pelacak.
- WebRTC dan indikasi alamat IP lokal.
- Izin lokasi, kamera, dan notifikasi.
- User-Agent.
- Konsistensi Canvas.
- WebGL dan WebGL2.
- WebAssembly, audio, WebSocket, dan Gamepad.
- Layar penuh dan FPS.

Halaman pengujian dijalankan melalui server lokal pada `127.0.0.1` dengan port acak dan hanya diaktifkan saat diperlukan. Hasilnya bersifat diagnostik dan bukan sertifikasi keamanan atau pengganti pengujian penetrasi.

### 6. Browser Management

Fitur pengelolaan browser meliputi:

- Tab dan address bar (omnibox).
- Tombol Beranda dan pengaturan homepage.
- Bookmark dan bookmark bar.
- Mesin pencari Google.
- Menu pengaturan browser.
- Tema terang dan gelap yang mengikuti sistem.
- Menu konteks untuk tindakan pada halaman dan gambar.

### 7. Google Lens Integration

Menyediakan akses ke Google Lens melalui tombol di address bar dan halaman Tab Baru. Pengguna juga dapat membuka menu konteks pada gambar dan memilih **Telusuri gambar dengan Google Lens** untuk gambar yang memiliki alamat HTTP/HTTPS. Pengunggahan atau pemrosesan gambar dilakukan melalui layanan Google Lens.

### 8. Extension Support

Tersedia dukungan pemuatan ekstensi bergaya Chrome WebExtension dari folder *unpacked*. Pengguna dapat mengaktifkan, menonaktifkan, membuka opsi, atau menghapus ekstensi melalui Pengaturan > Ekstensi. Kompatibilitas bergantung pada API yang didukung Electron.

**Dukungan ekstensi secara default nonaktif.** Jika diaktifkan, browser menggunakan partisi persisten sementara agar ekstensi dapat bekerja. Konsekuensi penyimpanan dan pembersihannya dijelaskan pada bagian [Pengaturan Penyimpanan dan Batasan](#pengaturan-penyimpanan-dan-batasan).

## Platform dan Teknologi

| Komponen | Teknologi |
| --- | --- |
| Aplikasi desktop | Electron |
| Aplikasi Android | Kotlin / Android WebView |
| Antarmuka desktop | HTML, CSS, JavaScript |
| Mesin browser desktop | Chromium melalui Electron |
| Build installer Windows | electron-builder / NSIS |
| Build Android | Gradle / APK |
| Versi proyek | `0.2.0` |
| Lisensi | MIT |

## Memulai di Desktop

### Persyaratan

- Windows atau sistem operasi desktop yang kompatibel dengan Electron.
- Node.js 20 atau lebih baru.
- npm.

### Instalasi dan menjalankan

Buka terminal pada direktori utama proyek, lalu jalankan:

```bash
npm install
npm start
```

### Menjalankan pengujian

```bash
npm test
```

Pengujian menggunakan Node.js test runner dan dapat dijalankan tanpa membuka aplikasi Electron.

## Pintasan Keyboard

| Pintasan | Fungsi |
| --- | --- |
| `Ctrl + T` | Membuka tab baru |
| `Ctrl + W` | Menutup tab aktif |
| `Ctrl + L` | Memilih address bar |
| `Ctrl + R` | Memuat ulang halaman |
| `Alt + ←` | Kembali |
| `Alt + →` | Maju |
| `Ctrl + Shift + Delete` | Membuka Reset Identity |
| `Ctrl + D` | Menambahkan bookmark |
| `Ctrl + Shift + B` | Menampilkan/menyembunyikan bookmark bar |
| `Ctrl + Shift + O` | Membuka pengelolaan bookmark |
| `F12` | Membuka DevTools untuk tab aktif |

## Fitur Privasi dan Cara Kerjanya

### Sesi penjelajahan

Pada konfigurasi normal, data situs disimpan dalam sesi browser yang dirancang berjalan di memori. Reset Identity membersihkan data situs pada sesi tersebut dan memulai kembali pengalaman penjelajahan sesuai konfigurasi homepage.

### Kebijakan WebRTC

Konfigurasi WebRTC menggunakan kebijakan `default_public_interface_only` untuk membatasi penggunaan antarmuka jaringan lokal. Kebijakan ini bukan bukti bahwa seluruh kemungkinan kebocoran alamat IP telah tertutup; hasilnya perlu diuji pada perangkat dan jaringan masing-masing.

### Daftar filter

Daftar filter awal berada di `filters/default.txt`. Pengguna atau pengembang dapat meninjau dan memperbarui daftar tersebut sesuai kebutuhan. Gunakan sumber daftar filter yang tepercaya dan pahami bahwa pemblokiran yang terlalu agresif dapat menyebabkan sebagian fungsi situs tidak berjalan.

## Pengaturan Penyimpanan dan Batasan

- Bookmark dan pengaturan browser disimpan pada `settings.json` dan `bookmarks.json` di direktori `userData` aplikasi.
- File pengaturan dan bookmark tersebut **tidak dihapus** oleh Reset Identity agar preferensi pengguna tetap tersimpan.
- Dalam konfigurasi sesi normal, data situs dirancang untuk berada di memori.
- Electron tidak memuat ekstensi ke sesi yang sepenuhnya berbasis memori. Karena itu, dukungan ekstensi secara default nonaktif.
- Jika dukungan ekstensi diaktifkan, browser memakai partisi `persist:`. Data situs pada partisi ini dapat ditulis ke disk sementara. Reset Identity menjalankan `clearStorageData`, dan folder partisi dijadwalkan untuk dihapus saat aplikasi dibuka berikutnya.
- Periksa direktori `Partitions` di dalam `userData` untuk memastikan perilaku pembersihan pada versi yang digunakan.
- Ekstensi pihak ketiga dapat memiliki akses luas terhadap halaman web. Ekstensi dapat memengaruhi privasi dan perilaku browser; pasang hanya ekstensi dari sumber yang dipercaya.

## Build Aplikasi

Repositori ini memuat dua target aplikasi: desktop Electron di direktori utama dan Android di direktori `android/`.

### Build Windows (.exe)

Di Windows, jalankan:

```bash
npm install
npm run dist
```

Installer akan dibuat di direktori `dist/` dengan nama seperti `Tketlon-Browser-Setup-0.2.0.exe`.

Installer saat ini belum ditandatangani secara digital. Karena itu, Windows SmartScreen dapat menampilkan peringatan ketika installer dijalankan.

### Build Android (.apk)

1. Buka folder `android/` menggunakan Android Studio.
2. Gunakan JDK 17 dan Android Studio Hedgehog atau versi lebih baru.
3. Tunggu proses sinkronisasi Gradle selesai.
4. Pilih **Build > Build APK(s)**.
5. APK debug akan tersedia pada direktori output build aplikasi Android.

Minimum SDK yang ditetapkan proyek adalah API 26 (Android 8.0). APK debug ditujukan untuk pengujian. Distribusi publik memerlukan konfigurasi signing key dan build rilis yang ditandatangani.

### Build melalui GitHub Actions

Workflow GitHub Actions tersedia untuk membangun installer Windows dan APK Android. Setelah seluruh folder proyek diunggah ke repositori GitHub:

- Workflow **Build Windows installer** menghasilkan artifact `tketlon-windows-installer`.
- Workflow **Build Android APK (debug)** menghasilkan artifact `tketlon-android-debug-apk`.

Workflow dapat berjalan otomatis saat push ke branch `main` atau dijalankan secara manual melalui tab **Actions**. Unduh hasil build dari bagian Artifacts pada workflow yang selesai.

## Pengujian Reset Identity

Pengujian manual dasar pada desktop:

1. Jalankan Tketlon Browser dan buka situs yang dapat digunakan untuk pengujian.
2. Buka DevTools dengan `F12`, lalu pilih Console.
3. Masukkan perintah berikut:

   ```javascript
   localStorage.x = '1';
   document.cookie = 'a=1';
   ```

4. Jalankan Reset Identity dengan `Ctrl + Shift + Delete`, lalu konfirmasi.
5. Periksa Privacy Receipt dan status pengujian kanari.
6. Buka kembali situs yang sama, lalu jalankan di Console:

   ```javascript
   localStorage.x;
   document.cookie;
   ```

7. Pada sesi yang telah dibersihkan, nilai `localStorage.x` diharapkan `undefined` dan cookie uji tidak lagi tersedia.

Pengujian ini hanya memeriksa contoh data pada sesi yang diuji. Pengujian tersebut tidak membuktikan bahwa seluruh informasi pengguna telah dihapus dari situs, akun, jaringan, sistem operasi, atau pihak ketiga.

## Batasan yang Diketahui

- Pemblokiran pelacak bergantung pada daftar filter, aturan pencocokan, dan perilaku situs.
- Reset Identity tidak menghapus seluruh jejak aktivitas yang mungkin tersimpan di luar browser, seperti pada situs web, akun pengguna, jaringan, penyedia layanan internet, atau sistem operasi.
- Pengujian kanari memeriksa mekanisme penghapusan per jenis penyimpanan; pengujian ini bukan pemeriksaan menyeluruh terhadap seluruh data setiap situs.
- Pengujian WebRTC dan karakteristik browser bersifat diagnostik. Hasil dapat berbeda berdasarkan sistem operasi, jaringan, versi Chromium, dan konfigurasi perangkat.
- Ekstensi Chrome WebExtension yang dimuat harus berupa folder *unpacked*. File ekstensi Firefox (`.xpi`) tidak kompatibel.
- Hanya sebagian API `chrome.*` yang didukung oleh Electron. Tidak tersedia instalasi langsung dari Chrome Web Store.
- Beberapa alur login OAuth berbasis popup mungkin memerlukan penyesuaian karena popup dibuka sebagai tab baru tanpa `window.opener`.
- Favicon situs belum dimuat dari internet.
- Fitur folder bookmark, impor/ekspor bookmark, pemilihan area layar untuk Lens, dan sinkronisasi belum tersedia pada versi ini.
- Penggunaan Google Lens melibatkan layanan eksternal Google.
- Tketlon Browser tidak menjanjikan anonimitas penuh dan bukan pengganti VPN, Tor, atau praktik keamanan digital lainnya.

## Arah Pengembangan

Pengembangan berikutnya diarahkan pada:

- Penyempurnaan perlindungan terhadap pelacakan dan pengelolaan daftar filter.
- Penguatan pengamanan sesi, penyimpanan, izin situs, dan konfigurasi browser.
- Peningkatan transparansi hasil Reset Identity dan Privacy Receipt.
- Peningkatan kompatibilitas serta kontrol keamanan ekstensi.
- Penyempurnaan pengalaman pengguna pada desktop dan Android.
- Pengembangan fitur bookmark, impor/ekspor, dan sinkronisasi secara bertahap.
- Pengujian regresi, pengujian keamanan, dan audit independen.

## Kontribusi dan Pelaporan Bug

Masukan, laporan bug, dan kontribusi pengembangan sangat terbuka. Silakan buat *issue* atau *pull request* pada repositori proyek.

Saat melaporkan masalah, sertakan informasi berikut jika memungkinkan:

- Sistem operasi dan versi perangkat.
- Versi Tketlon Browser.
- Langkah untuk mereproduksi masalah.
- Perilaku yang diharapkan dan perilaku yang terjadi.
- Log atau tangkapan layar yang telah dipastikan tidak memuat informasi pribadi, token, cookie, atau data sensitif.

## Lisensi

Tketlon Browser menggunakan lisensi **MIT**. Lihat berkas [`LICENSE`](LICENSE) untuk ketentuan lengkap.

---

<p align="center">
  <strong>Tketlon Browser</strong><br>
  <em>Browse Freely. Stay Private.</em>
</p>
