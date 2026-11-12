# INTEGRASI SPRINT 0 — TAHAP 2: FINALISASI NGINX.CONF
**Proyek:** Contextual Reader (`bagaswibowo/contextual-reader`)  
**Pemilik File:** Front-End Developer WEB  
**Branch:** `sprint0/frontend-hardening`  
**Sumber Integrasi:** Commit `59866f3` (Frontend S0-F1) + Commit `4108188` (DevOps Infra S0-B6)  
**Status:** VALID (`nginx -t` lulus, verifikasi `curl -I` sukses pada seluruh jenis aset)

---

## 1. Latar Belakang & Analisis Konflik

Pada Sprint 0, branch `sprint0/infra-hardening` (DevOps commit `4108188`) dan branch `sprint0/frontend-hardening` (Frontend S0-F1) keduanya mengubah `frontend/nginx.conf`.
Namun, inspeksi mendalam terhadap versi DevOps menunjukkan beberapa masalah regresi kritis:

1. **Penghapusan Proxy API & Media:** DevOps secara tidak sengaja membuang blok `location /api/` dan `location /media/`. Jika konfigurasi DevOps dipakai mentah-mentah, seluruh panggilan API (`/api/books/`, `/api/translations/`, dll) dari React frontend akan gagal (404/fallback ke HTML).
2. **Penghapusan `client_max_body_size 100M`:** DevOps membuang batas upload 100MB sehingga Nginx kembali ke default 1MB, yang langsung menolak upload buku pengguna.
3. **Risiko Path Traversal `alias`:** DevOps menggunakan `alias /usr/share/nginx/html/assets/;` dan `alias /usr/share/nginx/html/static/;`. Penggunaan `alias` pada Nginx rawan off-by-slash path traversal dan redundan karena `root` sudah diset ke `/usr/share/nginx/html`.
4. **Header Cache yang Tidak Baku:** DevOps menggunakan `expires 1y; add_header Cache-Control "public, immutable";` yang dapat menghasilkan duplikasi header Cache-Control. Format standar `add_header Cache-Control "public, max-age=31536000, immutable";` lebih aman dan konsisten di seluruh CDN (Cloudflare).

File final di bawah ini menggabungkan fitur yang valid dari DevOps (endpoint `/health`, dukungan WhiteNoise `/static/`, tuning gzip) dengan aturan cache S0-F1 dan proxy backend yang esensial.

---

## 2. File Final `frontend/nginx.conf`

```nginx
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

## 3. Matriks Hirarki & Aturan Cache

| Path / Pattern | Tipe Modifier | Prioritas Evaluasi | Cache-Control Header | Alasan & Perilaku |
|---|---|---|---|---|
| `/health` | Exact (`=`) | 1 (Tertinggi) | *None* (`Content-Type: text/plain`, HTTP 200) | Healthcheck container Docker Compose & Cloudflare Tunnel; log akses dimatikan. |
| `/favicon.svg` | Exact (`=`) | 1 (Tertinggi) | `public, max-age=86400` | Ikon SVG statis di root; masa cache 1 hari cukup segar dan hemat bandwidth. |
| `/index.html` | Exact (`=`) | 1 (Tertinggi) | `no-cache, no-store, must-revalidate; Pragma: no-cache; Expires: 0` | Wajib selalu segar agar browser langsung mendeteksi chunk hash rilis baru. |
| `/assets/` | Prefix non-regex (`^~`) | 2 (Menghentikan regex) | `public, max-age=31536000, immutable` | Berisi bundel Vite ber-content hash (JS, CSS, font KaTeX, PNG viseme). Aman di-cache 1 tahun. |
| `/static/` | Prefix non-regex (`^~`) | 2 (Menghentikan regex) | `public, max-age=3600` | Aset Django admin & rest_framework (WhiteNoise/collectstatic). Masa cache 1 jam. |
| `/api/` | Prefix standar | 3 | Diatur oleh Django REST Framework | Reverse proxy ke Django backend (port 8000). Meneruskan IP client & header scheme. |
| `/media/` | Prefix standar | 3 | `public, no-transform; expires 30d` | Reverse proxy untuk file buku, cover, dan diagram yang diunggah ke backend. |
| `/` | Prefix fallback | 4 (Terendah) | `no-cache, no-store, must-revalidate; Pragma: no-cache; Expires: 0` | Penanganan rute SPA React Router (`try_files $uri $uri/ /index.html`). |

*Catatan Hirarki:* Tidak ada tumpang-tindih (overlap) maupun ambiguitas regex karena modifier exact (`=`) dan prefix non-regex (`^~`) menangani seluruh file statis dengan deterministik sebelum Nginx memeriksa prefix standar `/api/`, `/media/`, atau fallback `/`.

---

## 4. Bukti Verifikasi Pengujian

### A. Validasi Konfigurasi (`nginx -t`)
```text
nginx: the configuration file /tmp/opencode/nginx-test/test-final-wrapper.conf syntax is ok
nginx: configuration file /tmp/opencode/nginx-test/test-final-wrapper.conf test is successful
```

### B. Bukti `curl -I` Per-Jenis Aset

#### 1. Uji `index.html` (Wajib `no-store` / `no-cache`):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: text/html
Content-Length: 46
Connection: keep-alive
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
Accept-Ranges: bytes
```

#### 2. Uji Aset Hashed `/assets/index-test123.js` (Wajib `immutable` 1 tahun):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: application/javascript
Content-Length: 28
Connection: keep-alive
Cache-Control: public, max-age=31536000, immutable
Accept-Ranges: bytes
```

#### 3. Uji Aset Top-Level `/favicon.svg` (Wajib `max-age=86400`):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: image/svg+xml
Content-Length: 12
Connection: keep-alive
Cache-Control: public, max-age=86400
Accept-Ranges: bytes
```

#### 4. Uji Aset WhiteNoise `/static/admin/css/base.css` (Wajib `max-age=3600`):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: text/css
Content-Length: 23
Connection: keep-alive
Cache-Control: public, max-age=3600
Accept-Ranges: bytes
```

#### 5. Uji Healthcheck Endpoint `/health` (Wajib HTTP 200 "healthy"):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: text/plain
Content-Length: 8
Connection: keep-alive

healthy
```

#### 6. Uji SPA Deep Route Fallback `/read/42` (Wajib `no-cache`):
```http
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: text/html
Content-Length: 46
Connection: keep-alive
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
Accept-Ranges: bytes
```

---

## 5. Daftar Perubahan dari Branch DevOps (`sprint0/infra-hardening`)

| Perubahan dari DevOps (Commit 4108188) | Status | Tindakan & Alasan |
|---|---|---|
| Penambahan endpoint `location /health` | **DIPERTAHANKAN (DITINGKATKAN)** | Diubah menjadi exact match `location = /health` agar lebih cepat dan tidak bentrok dengan rute SPA `/health/...`. Mengembalikan HTTP 200 `healthy\n`. |
| Tuning direktif Gzip (`gzip_vary on; gzip_min_length 1024;`) | **DIPERTAHANKAN** | Optimasi performa kompresi yang sangat baik untuk transfer teks JSON, JS, CSS, dan XML. |
| Penambahan `location ^~ /static/` untuk WhiteNoise | **DIPERTAHANKAN (DIAMANKAN)** | Dipertahankan untuk Django collected static, namun `alias` dibuang dan diganti dengan direct root + `try_files $uri =404;` untuk mencegah kerentanan path traversal Nginx off-by-slash. Header diset `public, max-age=3600`. |
| Penghapusan `location /api/` | **DITOLAK (DIKEMBALIKAN)** | Mengembalikan proxy pass `http://backend:8000/api/` dengan timeout 600s dan `client_max_body_size 100M`. Menghapus ini akan melumpuhkan total koneksi frontend ke backend. |
| Penghapusan `location /media/` | **DITOLAK (DIKEMBALIKAN)** | Mengembalikan proxy pass `http://backend:8000/media/` untuk serving cover buku dan diagram SVG/PNG backend. |
| Penghapusan `client_max_body_size 100M` di level server | **DITOLAK (DIKEMBALIKAN)** | Mengembalikan direktif 100M di blok server agar Nginx tidak menolak upload file buku besar dari client. |
| Penggunaan `alias /usr/share/nginx/html/assets/;` | **DIBUANG** | Redundan terhadap `root /usr/share/nginx/html;` dan berisiko bug alias Nginx. Cukup gunakan `try_files $uri =404;`. |
| Format `expires 1y; add_header Cache-Control "public, immutable";` | **DISERAGAMKAN** | Diganti menjadi standar tunggal `add_header Cache-Control "public, max-age=31536000, immutable";` untuk mencegah duplikasi header HTTP `Cache-Control`. |
