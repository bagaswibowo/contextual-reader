# LINT FIX REPORT - SPRINT 0
**Proyek:** Contextual Reader (`bagaswibowo/contextual-reader`)  
**Komponen:** Frontend ESLint Configuration & CI Gate  
**Branch:** `sprint0/frontend-hardening`  
**Status:** PASS / HIJAU (0 errors, 0 warnings, max-warnings 0 passed)  
**Tanggal:** 12 November 2026  

---

## 1. Ringkasan Masalah & Akar Penyebab

Pada branch `sprint0/integration`, workflow CI GitHub Actions menjalankan pemeriksaan lint frontend:
```bash
npx eslint . --ext .js,.jsx --max-warnings 0
```
Perintah ini gagal dengan 4 error `no-undef`:
- `frontend/src/components/PronunciationWidget.jsx:33:52 'navigator' is not defined`
- `frontend/src/components/PronunciationWidget.jsx:34:7 'navigator' is not defined`
- `frontend/src/components/PronunciationWidget.jsx:110:7 'clearTimeout' is not defined`
- `frontend/src/pages/Reader.jsx:766:77 'URL' is not defined`

### Akar Masalah:
File `frontend/eslint.config.js` sebelumnya mendefinisikan daftar variabel global browser secara manual dan parsial (hanya mencakup `window`, `document`, `setTimeout`, dan beberapa objek bawaan). Variabel standar runtime browser web modern penting seperti `navigator` (Web Speech API), `clearTimeout` (timer cleanup), dan `URL` (object URL creation) tidak terdaftar. Karena CI menetapkan batas `--max-warnings 0`, keempat error `no-undef` ini menggagalkan lint job dan memblokir release job di CI.

---

## 2. Solusi yang Diterapkan

### Pendekatan yang Dipilih: Paket npm `globals` (`globals.browser`)
Alih-alih menambahkan identifier secara manual yang rapuh terhadap penambahan kode baru di masa mendatang, kami mengadopsi paket standar industri [`globals`](https://www.npmjs.com/package/globals) (v17.14.0) yang merupakan referensi resmi ESLint Flat Config untuk lingkungan eksekusi JavaScript.

### Keunggulan & Alasan Pemilihan:
1. **Lengkap & Komprehensif:** Menyediakan 1.214 definisi global browser standar W3C/WHATWG (termasuk `navigator`, `clearTimeout`, `URL`, `URLSearchParams`, `AbortController`, `ResizeObserver`, `IntersectionObserver`, `AudioContext`, `Blob`, `FormData`, `crypto`, dll).
2. **Resilien:** Menghilangkan risiko error `no-undef` baru saat pengembang menggunakan API browser standar lainnya di masa depan.
3. **Standar Ekosistem ESLint Flat Config:** Kompatibel 100% dengan ESLint 9+ dan Flat Config schema (`...globals.browser`).
4. **Sinkronisasi Lockfile:** Ditambahkan ke `devDependencies` di `frontend/package.json` dan langsung disinkronkan ke `frontend/package-lock.json` untuk menjamin `npm ci` di CI tidak gagal.

---

## 3. Perubahan Berkas

### A. `frontend/eslint.config.js`
```javascript
import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    rules: { "no-undef": "error" },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser
      }
    }
  }
];
```

### B. `frontend/package.json`
Penambahan pada `devDependencies`:
```json
"devDependencies": {
  "@vitejs/plugin-react": "^4.3.1",
  "autoprefixer": "^10.4.20",
  "globals": "^17.14.0",
  "postcss": "^8.4.41",
  "tailwindcss": "^3.4.10",
  "vite": "^5.4.2"
}
```

### C. `frontend/package-lock.json`
Telah diperbarui via `npm install --save-dev globals` dan diverifikasi dengan `npm ci`.

---

## 4. Bukti Verifikasi Pengujian

### A. Output Lint SEBELUM Perbaikan (4 Error)
Perintah:
```bash
npx eslint . --ext .js,.jsx --max-warnings 0
```
Output:
```text
/data/OpenBot/Shared/contextual-reader/frontend/frontend/src/components/PronunciationWidget.jsx
   33:52  error  'navigator' is not defined     no-undef
   34:7   error  'navigator' is not defined     no-undef
  110:7   error  'clearTimeout' is not defined  no-undef

/data/OpenBot/Shared/contextual-reader/frontend/frontend/src/pages/Reader.jsx
  766:77  error  'URL' is not defined  no-undef

✖ 4 problems (4 errors, 0 warnings)
Exit code: 1
```

### B. Output Lint SESUDAH Perbaikan (0 Error, Bersih)
Perintah:
```bash
npx eslint . --ext .js,.jsx --max-warnings 0
```
Output:
```text
(no output)
Exit code: 0
```
Status: **0 problems, 0 errors, 0 warnings. Exit code: 0.**

### C. Verifikasi `npm ci`
Perintah:
```bash
npm ci
```
Output:
```text
added 163 packages, and audited 164 packages in 7s
32 packages are looking for funding
Exit code: 0
```
Status: **PASSED / SUKSES** (`package.json` dan `package-lock.json` tersinkronisasi sempurna).

### D. Verifikasi `npm run build` & Pengecekan Sourcemap
Perintah:
```bash
npm run build
```
Output:
```text
> contextual-reader-frontend@1.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 1646 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                         0.89 kB │ gzip:   0.48 kB
dist/assets/index-DScxHF-n.css                         90.97 kB │ gzip:  18.17 kB
dist/assets/index-BmBbdDcw.js                         634.47 kB │ gzip: 191.80 kB
✓ built in 11.90s
Exit code: 0
```

Verifikasi ketiadaan `.map` files di direktori output produksi `dist/`:
```bash
find dist/ -name "*.map"
(no output)
```
Status: **PASSED / SUKSES** (Build berhasil tanpa file `.map`).

---

## 5. Ringkasan Status Rilis
- **ESLint Gate:** Bersih (0 error, `--max-warnings 0` lolos tanpa penyesuaian aturan atau toleransi).
- **Integritas Dependensi:** `npm ci` lolos dengan exit code 0.
- **Kepatuhan Rilis:** `npm run build` sukses, aturan keamanan S0-F2 (no sourcemap) tetap terjaga.
- **Batasan Sistem:** Tidak ada berkas di `backend/`, `docker-compose.yml`, atau `.github/workflows/ci.yml` yang disentuh.
