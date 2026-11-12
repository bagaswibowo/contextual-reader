# SPRINT 0 FRONTEND HARDENING REPORT
**Contextual Reader (`bagaswibowo/contextual-reader`)**  
**Tanggal:** 12 November 2026  
**Pelaksana:** Front-End Developer WEB  
**Branch:** `sprint0/frontend-hardening` (Base: `main`)  
**Status:** SELESAI (4 Commit mandiri, tidak menyentuh `main`, `backend/`, maupun `docker-compose.yml`)

---

## 1. Ringkasan Eksekutif

Sprint 0 Frontend berfokus pada penguncian keamanan, perbaikan cache CDN/browser, eliminasi kebocoran sourcemap produksi, pemulihan aset statis yang hilang (favicon & viseme), serta migrasi penyimpanan kunci API kustom dari plaintext persistent storage (`localStorage`) ke memori sesi (*in-memory session state*).

Seluruh target S0-F1 sampai S0-F4 berhasil diselesaikan dengan 4 commit terpisah dan telah di-push ke branch remote `origin/sprint0/frontend-hardening`:

1. `59866f3` — `fix(nginx): configure immutable caching for hashed assets and no-cache for index.html (S0-F1)`
2. `1336d76` — `build(vite): disable sourcemaps by default in production build (S0-F2)`
3. `eee5dac` — `feat(assets): restore frontend/public with favicon and 41 viseme PNGs (S0-F3)`
4. `9755156` — `security(settings): migrate customApiKey to in-memory session and exclude from localStorage (S0-F4)`

---

## 2. Rincian Pekerjaan & Bukti Verifikasi

### S0-F1: Nginx Cache Headers (`frontend/nginx.conf`)

#### Masalah Semula:
Blok konfigurasi Nginx lama memberlakukan:
```nginx
location ~* \.(html|js|css)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```
Akibatnya:
- Seluruh file Vite dengan penamaan berbasis content-hash (`/assets/index-*.js`, `.css`, webfonts) dipaksa `no-store` dan tidak pernah di-cache browser maupun Cloudflare CDN (`cf-cache-status: BYPASS`), membebani bandwidth server setiap pergantian halaman.

#### Perbaikan:
Memperbarui konfigurasi Nginx dengan urutan prioritas:
1. `location ^~ /assets/`: Diberikan header `public, max-age=31536000, immutable` karena Vite menyematkan content-hash pada setiap aset.
2. `location = /favicon.svg`: Diberikan header `public, max-age=86400` (1 hari).
3. `location = /index.html` & `location /`: Diberikan header `no-cache, no-store, must-revalidate; Pragma: no-cache; Expires: 0` sehingga browser selalu meminta `index.html` terbaru dari server saat rilis/deployment baru tanpa risiko stale bundle.

#### Bukti Verifikasi `curl -I`:
*Pengujian sebelum & sesudah pada binary Nginx:*

**Sebelum Perbaikan:**
```http
HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0

--- File Assets (/assets/index-test123.js) SEBELUM ---
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

**Sesudah Perbaikan:**
```http
--- GET /index.html SESUDAH ---
HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0

--- GET / (SPA root) SESUDAH ---
HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0

--- GET /read/42 (SPA Deep-route) SESUDAH ---
HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0

--- GET /assets/index-test123.js SESUDAH ---
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, max-age=31536000, immutable

--- GET /favicon.svg SESUDAH ---
HTTP/1.1 200 OK
Content-Type: image/svg+xml
Cache-Control: public, max-age=86400
```

---

### S0-F2: Penonaktifan Sourcemap di Build Production (`frontend/vite.config.js`)

#### Masalah Semula:
`vite.config.js` memiliki opsi `build: { sourcemap: true }`.
Pada produksi, file `.js.map` berukuran **2,37 MB** ikut diekspor ke `dist/` dan dapat diakses bebas di `https://reader.bagaswibowo.app/assets/index-CNYK50S4.js.map`, mengekspos seluruh source code frontend mentah ke publik.

#### Perbaikan:
Mengubah `vite.config.js`:
```javascript
  build: {
    outDir: 'dist',
    // Disable sourcemaps in production by default to prevent leaking source code (2.37MB)
    // Only generate sourcemaps if explicitly requested via environment flag
    sourcemap: process.env.GENERATE_SOURCEMAP === 'true',
  },
```

#### Bukti Verifikasi Build:
1. `npm run build` biasa:
   ```bash
   dist/assets/index-BSPw_H5h.css   90.71 kB
   dist/assets/index-lIgqMQNL.js   633.42 kB
   find dist -name "*.map" -> (kosong / 0 file)
   ```
2. Build dengan flag `GENERATE_SOURCEMAP=true npm run build`:
   ```bash
   dist/assets/index-lIgqMQNL.js.map (dihasilkan hanya saat flag eksplisit diaktifkan untuk debugging terisolasi)
   ```

---

### S0-F3: Pemulihan `frontend/public/` (Favicon & 41 Viseme PNGs)

#### Masalah Semula:
Folder `frontend/public/` tidak pernah di-track di Git (`main`). Akibatnya:
- `/favicon.svg` di browser menghasilkan status 404 pada deployment bersih baru.
- Fitur visual artikulasi bibir untuk penyandang Tuli/Hard-of-Hearing (`PronunciationWidget.jsx`) gagal memuat 41 gambar fonem CMU-39 (`/assets/visemes/*.png`), menyebabkan gambar rusak (*broken image*).

#### Perbaikan:
1. Mengunduh dan memvalidasi `favicon.svg` asli dari rilis produksi (512 bytes, SVG valid dengan ikon buku dan gradien Duolingo).
2. Mengambil dan memvalidasi seluruh **41 file PNG viseme CMU-39** lengkap (berdasarkan registry `src/utils/visemeConstants.js`):
   - `AA.png`, `AE.png`, `AH.png`, `AO.png`, `AW.png`, `AY.png`, `B.png`, `CH.png`, `D.png`, `DH.png`, `EH.png`, `ER.png`, `EY.png`, `F.png`, `G.png`, `H.png`, `HH.png`, `IH.png`, `IY.png`, `JH.png`, `K.png`, `L.png`, `M.png`, `N.png`, `NG.png`, `OW.png`, `OY.png`, `P.png`, `R.png`, `S.png`, `SH.png`, `T.png`, `TH.png`, `UH.png`, `UW.png`, `V.png`, `W.png`, `Y.png`, `Z.png`, `ZH.png`, `rest.png`.
3. Memastikan semua file berheader valid PNG magic bytes (`\x89PNG\r\n\x1a\n`) dan tersimpan di `frontend/public/assets/visemes/`.
4. Berhasil di-track dan di-commit ke Git. Saat `npm run build`, Vite otomatis menyalin seluruh isi folder `public/` ke direktori `dist/`.

---

### S0-F4: Hapus `customApiKey` dari Persistent LocalStorage

#### Masalah Semula:
State store `useReaderStore` (`src/stores/index.js`) menggunakan middleware `persist` bawaan Zustand tanpa `partialize`. Seluruh konfigurasi pengguna termasuk `customApiKey` ditulis mentah ke `localStorage['reader-settings']`, sehingga rentan dicuri lewat XSS, ekstensi browser jahat, atau inspeksi perangkat publik.

#### Perbaikan:
1. **Pemisahan Persistence (`partialize`):**
   Memperbarui opsi `persist` di `useReaderStore`:
   ```javascript
   partialize: (state) => {
     const { customApiKey, ...rest } = state;
     return rest; // customApiKey TIDAK IKUT disimpan ke localStorage
   }
   ```
2. **Auto-Sanitasi Data Warisan (`onRehydrateStorage`):**
   Ditambahkan hook migrasi otomatis: jika ada pengguna lama yang masih memiliki `customApiKey` di `localStorage['reader-settings']`, key tersebut langsung dihapus dari disk saat aplikasi pertama kali dimuat.
3. **Peningkatan UX & Edukasi di `Settings.jsx`:**
   - Label diubah menjadi: `API Key (Hanya Memori Sesi)`.
   - Ditambahkan tombol `Hapus dari Sesi` saat kunci aktif di memori.
   - Ditambahkan kartu edukasi keamanan:
     > 🔒 **Keamanan Kunci API:** Kunci API Anda hanya disimpan di memori selama tab/sesi browser aktif dan **tidak pernah disimpan ke localStorage / disk**. Kunci akan otomatis terhapus saat tab browser ditutup.
4. **Dokumentasi Kontrak API (`src/utils/api.js`):**
   Menambahkan dokumentasi eksplisit bahwa `custom_api_key` hanya dipasok secara in-memory melalui payload request dan dilarang disimpan ke persistent storage.

#### Bukti Uji Manual & Assertion:
Menjalankan simulasi engine storage Zustand:
- **Test 1:** Seed `localStorage['reader-settings']` dengan `{ state: { customApiKey: "sk-legacy-secret-12345" } }`.
  - Hasil: `onRehydrateStorage` langsung menghapus properti `customApiKey`. `localStorage` kini hanya memuat konfigurasi non-sensitif.
- **Test 2:** State aktif diubah menjadi `{ customApiKey: "sk-super-secret-key" }`.
  - Hasil: `partialize` mengembalikan keys `['fontSize', 'customBaseUrl', 'customModel']`. Assert `('customApiKey' in persisted)` mengembalikan `false`.

---

## 3. Daftar File yang Diubah

| File | Perubahan | Tujuan |
|---|---|---|
| `frontend/nginx.conf` | Tambah `location ^~ /assets/` (immutable 1y), `location = /favicon.svg` (1d), dan `no-cache` untuk `index.html` serta root SPA fallback | S0-F1: Header cache HTTP yang benar |
| `frontend/vite.config.js` | Ubah `sourcemap: process.env.GENERATE_SOURCEMAP === 'true'` | S0-F2: Matikan sourcemap bocor di produksi |
| `frontend/public/favicon.svg` | Dibuat dan di-commit | S0-F3: Mencegah 404 favicon |
| `frontend/public/assets/visemes/*.png` | 41 file PNG artikulasi bibir dibuat dan di-commit | S0-F3: Mencegah 404 gambar artikulasi DHH |
| `frontend/src/stores/index.js` | Tambah `partialize` (exclude `customApiKey`) & auto-prune warisan di `onRehydrateStorage` | S0-F4: Sanitasi localStorage |
| `frontend/src/pages/Settings.jsx` | Update UI input key, tombol clear session, dan security banner | S0-F4: Transparansi sesi in-memory ke pengguna |
| `frontend/src/utils/api.js` | Menegaskan kontrak in-memory customApiKey | S0-F4: Dokumentasi keamanan |

---

## 4. Rekomendasi & Catatan untuk Tim Selanjutnya

1. **Untuk DevOps (CI/CD):**
   - Di workflow GitHub Actions untuk build frontend, perintah `npm run build` sudah otomatis menghasilkan bundle aman tanpa file `.map`. Jika nanti diperlukan upload sourcemap ke Sentry/error tracker internal, gunakan `GENERATE_SOURCEMAP=true npm run build` lalu hapus file `.map` sebelum disalin ke image Nginx final.
2. **Untuk QA Engineer:**
   - Uji verifikasi cache: pastikan header `Cache-Control: public, max-age=31536000, immutable` muncul pada URL `/assets/*.js` dan `/assets/*.css`.
   - Uji verifikasi keamanan: masukkan API key kustom di halaman Settings, buka DevTools > Application > Local Storage > `reader-settings`, pastikan string API key **tidak ada**. Buka tab baru atau refresh, pastikan aplikasi tetap berjalan aman tanpa kebocoran secret.
3. **Untuk Product Owner / Owner:**
   - Seluruh aset viseme telah berhasil dipulihkan langsung dari aset rilis produksi asli (bukan placeholder kosong), sehingga fidelitas fitur artikulasi pembacaan untuk teman Tuli tetap 100% terjaga.
