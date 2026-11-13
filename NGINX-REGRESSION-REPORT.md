# NGINX REGRESSION REPORT — SPRINT 0
**Proyek:** Contextual Reader (`bagaswibowo/contextual-reader`)  
**Komponen:** Reverse Proxy & Frontend Web Server (`frontend/nginx.conf`, `smoke.py`)  
**Penanggung Jawab:** Front-End Developer WEB  
**Branch:** `sprint0/frontend-hardening` & `sprint0/integration`  
**Status:** RESOLVED & VERIFIED (Smoke test 4/4 passed, reverse proxy `/api/` & `/media/` restored, cache headers verified)  
**Tanggal:** 12 November 2026  

---

## 1. Akar Masalah (Root Cause)

Pada branch `sprint0/integration` (commit `826379a`), ditemukan regresi kritis di mana file `frontend/nginx.conf` kehilangan blok reverse proxy `/api/` dan `/media/`.

### Kronologi Terjadinya Regresi:
1. Pada integrasi awal (commit `1a38a69`), branch DevOps (`4108188`) di-merge. Versi `nginx.conf` DevOps hanya berisi static rules sederhana tanpa blok `location /api/` dan `location /media/`.
2. Versi Frontend yang lengkap dan hardened sebenarnya sudah diselesaikan pada commit `d582e20` (memiliki 8 blok lengkap termasuk proxy ke backend port 8000).
3. Namun, ketika branch DevOps digabungkan, file `frontend/nginx.conf` tertimpa oleh versi infra (`4108188`), sehingga blok proxy `/api/` dan `/media/` terhapus dari branch `sprint0/integration`.
4. Akibatnya, frontend container gagal menghubungi backend. Seluruh request API `/api/...` jatuh ke SPA fallback (`location /`) yang menyajikan `index.html` (text/html) alih-alih respons JSON dari backend.
5. Selain itu, file `smoke.py` menguji `/assets/reader.css` yang tidak ada di repositori maupun di build Vite (karena Vite memproduksi file ber-content-hash seperti `index-<hash>.css`), sehingga assertion cache immutable gagal.

---

## 2. Solusi & Perubahan yang Diterapkan

### A. Restorasi Penuh `frontend/nginx.conf`
Mengambil basis dari commit `d582e20` dengan 8 blok terstruktur lengkap:
- **`location /api/` & `location /media/`**: Proxy pass ke backend Django port 8000 dengan header lengkap (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) dan timeout 600s (`proxy_read_timeout 600s; proxy_send_timeout 600s;`).
- **`client_max_body_size 100M`**: Ditetapkan di level server dan di blok `/api/` untuk mendukung upload buku/dokumen besar.
- **`location = /health`**: Exact match endpoint healthcheck kontainer/tunnel yang mengembalikan HTTP 200 `healthy\n` tanpa logging berlebih.
- **`location ^~ /assets/`**: Cache immutable 1 tahun (`Cache-Control: public, max-age=31536000, immutable`) untuk bundel Vite ber-content hash.
- **`location = /favicon.svg`**: Cache 1 hari (`Cache-Control: public, max-age=86400`).
- **`location ^~ /static/`**: WhiteNoise static files (`Cache-Control: public, max-age=3600`) tanpa `alias` off-by-slash path traversal vulnerability.
- **`location = /index.html` & fallback SPA `location /`**: Strict no-store (`no-cache, no-store, must-revalidate; Pragma: no-cache; Expires: 0`) agar pembaruan rilis langsung terdeteksi browser.
- **Gzip**: `gzip_vary on; gzip_min_length 1024;` dan tipe MIME lengkap.

### B. Perbaikan `smoke.py`
- Mengganti uji statis non-eksisten `/assets/reader.css` dengan aset nyata yang selalu ada di dalam bundel Vite:
  1. `/favicon.svg` (berasal dari `frontend/public/favicon.svg`): Menguji `Cache-Control` mengandung `86400` dan `public`.
  2. `/assets/visemes/rest.png` (berasal dari `frontend/public/assets/visemes/rest.png`): Menguji `Cache-Control` mengandung `immutable` dan `31536000`.
- Assertion tidak dilonggarkan: status code wajib 200 OK dan nilai cache headers diverifikasi ketat.

---

## 3. Isi Lengkap `frontend/nginx.conf`

```nginx
# Contextual Reader - Hardened Production Nginx Configuration (S0-F1 + WhiteNoise + Healthcheck)
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Allow large file uploads up to 100MB (backend validates strict limits)
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml application/xml+rss;

    # 1. Health check endpoint (for container / tunnel healthcheck)
    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "healthy\n";
    }

    # 2. Vite content-hashed static assets (immutable cache for 1 year)
    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # 3. Favicon and top-level static assets (1 day cache)
    location = /favicon.svg {
        add_header Cache-Control "public, max-age=86400";
        try_files $uri =404;
    }

    # 4. WhiteNoise / Django collected static files (safe path, no alias traversal)
    location ^~ /static/ {
        add_header Cache-Control "public, max-age=3600";
        try_files $uri =404;
    }

    # 5. index.html must never be cached so new releases are picked up immediately
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # 6. Proxy API requests to backend with generous timeouts
    location /api/ {
        client_max_body_size 100M;
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # 7. Proxy Media requests (Images/Diagrams/Books) to backend
    location /media/ {
        proxy_pass http://backend:8000/media/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # 8. Handle React Router SPA routes (ensure fallback index.html is also not cached)
    location / {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 4. Bukti Verifikasi Pengujian

### A. Validasi Sintaks Nginx (`nginx -t`)
```text
nginx: the configuration file /tmp/opencode/nginx-smoke/nginx.conf syntax is ok
nginx: configuration file /tmp/opencode/nginx-smoke/nginx.conf test is successful
```

### B. Uji Nyata Reverse Proxy & Static Cache via Curl (Nginx di port 8088 -> Backend di port 8000)

#### 1. Uji Proxy `/api/core/health/` (Mengembalikan JSON `healthy`):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Date: Thu, 12 Nov 2026 12:32:33 GMT
Content-Type: application/json
Content-Length: 49
Connection: keep-alive
Vary: Accept, Cookie, origin
Allow: OPTIONS, GET
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Cross-Origin-Opener-Policy: same-origin

{"status":"healthy","database":"ok","cache":"ok"}
```

#### 2. Uji Proxy `/api/books/` (Mengembalikan JSON List Buku):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Date: Thu, 12 Nov 2026 12:32:33 GMT
Content-Type: application/json
Content-Length: 52
Connection: keep-alive
Vary: Accept, Cookie, origin
Allow: GET, POST, HEAD, OPTIONS
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Cross-Origin-Opener-Policy: same-origin

{"count":0,"next":null,"previous":null,"results":[]}
```

#### 3. Uji Aset Top-Level `/favicon.svg` (Cache 1 Hari):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Date: Thu, 12 Nov 2026 12:32:33 GMT
Content-Type: image/svg+xml
Content-Length: 512
Last-Modified: Thu, 12 Nov 2026 10:57:31 GMT
Connection: keep-alive
ETag: "6af59b9b-200"
Cache-Control: public, max-age=86400
Accept-Ranges: bytes
```

#### 4. Uji Aset Immutable `/assets/visemes/rest.png` (Cache 1 Tahun Immutable):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Date: Thu, 12 Nov 2026 12:32:33 GMT
Content-Type: image/png
Content-Length: 54650
Last-Modified: Thu, 12 Nov 2026 10:57:31 GMT
Connection: keep-alive
ETag: "6af59b9b-d57a"
Cache-Control: public, max-age=31536000, immutable
Accept-Ranges: bytes
```

### C. Eksekusi `smoke.py` Penuh
```text
==================================================
Contextual Reader Smoke Test
==================================================
Testing /api/core/health/...
  ✓ Health check ok
Testing /api/books/...
  ✓ Books list responded with 200
Testing /api/vocabulary/...
  ✓ Vocabulary responded with 200
Testing static cache headers (/favicon.svg and /assets/)...
  ✓ Favicon cacheable (Cache-Control: public, max-age=86400)
  ✓ Static files cacheable (Cache-Control: public, max-age=31536000, immutable)
==================================================
Results: 4/4 passed
✓ All smoke tests passed
```

---

## 5. Ringkasan Status
- **Proxy Status:** Aktif & terverifikasi end-to-end melalui Nginx di port 8088.
- **Cache Headers:** Lolos verifikasi untuk aset immutable (`31536000`), favicon (`86400`), dan SPA fallback (`no-store`).
- **Smoke Suite:** 4/4 tes lulus tanpa melonggarkan assertion.
- **Branch Target:** Ter-commit dan di-push ke `sprint0/frontend-hardening` dan di-merge ke `sprint0/integration`.
