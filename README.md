# 📖 Contextual Reader (v1.0)

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-4.2+-092E20?style=flat-square&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

**Contextual Reader** adalah aplikasi web pembaca buku berbahasa Inggris (EPUB, PDF, TXT) berdesain ala **Duolingo** yang dirancang khusus untuk pembelajar bahasa Inggris dari tingkat pemula hingga lanjut. 

Aplikasi ini dilengkapi penerjemah kata kontekstual instan, analisis tata bahasa & 16 jenis *tenses* pada kalimat utuh, kelas kata ramah pemula (*Parts of Speech*), serta sistem review kosakata berbasis **Spaced Repetition (Algoritma SM-2)**.

---

## 🌟 Fitur Utama

- 🎨 **Duolingo-Inspired UI System:**
  - Warna solid cerah (Green `#58CC02`, Blue `#1CB0F6`, Yellow `#FFC800`), font Baloo 2 / Nunito, tombol 3D press, dan antarmuka *Mobile-First Responsive Design*.
  - Mode Tampilan Pembaca: Terang ☀️, Sepia 📜, dan Gelap 🌙.

- ⚡ **Ekstraksi Buku Super Cepat (Sub-2 Detik):**
  - Pemrosesan berkas PDF, EPUB, dan TXT tebal (1.000+ halaman) tanpa hambatan menggunakan `pdfplumber` dan penyusunan batch database SQLite `bulk_create` (0.1 detik).

- 🌐 **Free Multi-Language Dictionary Engine:**
  - **Google Translate GTX Client (0 API Cost):** Mengembalikan terjemahan kontekstual, IPA fonetik, serta daftar variasi makna per kelas kata.
  - **Dukungan 22+ Bahasa Target:** Menerjemahkan kata dan kalimat ke Bahasa Indonesia 🇮🇩, Spanyol 🇪🇸, Prancis 🇫🇷, Jerman 🇩🇪, Jepang 🇯🇵, Mandarin 🇨🇳, Korea 🇰🇷, Arab 🇸🇦, dll.
  - **OmniRoute LLM Engine (`auto/best-free`):** Integrasi AI LLM proxy untuk terjemahan sastra/akademis yang elegan.

- 🎓 **Analisis Tata Bahasa & 16 Jenis Tenses:**
  - Klasifikasi otomatis **16 Jenis Tenses Bahasa Inggris** (Simple Past, Present Continuous, Present Perfect, Past Perfect, dll.).
  - Analisis struktur sintaksis kalimat **Subjek + Predikat/Verb + Objek (S+V+O)**.
  - Ekstraksi daftar kata kerja (*Verbs*), kata benda (*Nouns*), dan kata sifat (*Adjectives*).

- 🏷️ **Kelas Kata Ramah Pemula (*Parts of Speech*):**
  - Penjelasan kelas kata interaktif:
    - 🏷️ **Kata Benda (Noun)**
    - ⚡ **Kata Kerja (Verb)**
    - 🎨 **Kata Sifat (Adjective)**
    - 📍 **Kata Keterangan (Adverb)**

- 🧠 **Sistem Kosakata & Flashcard Review (SM-2):**
  - Menyimpan kata berkesan ke perpustakaan kosakata pribadi.
  - Sesi latihan flashcard berbasis jadwal **Spaced Repetition (SuperMemo SM-2)** untuk memperkuat ingatan memori jangka panjang.

---

## 🏗️ Arsitektur & Teknologi

### Backend
- **Framework:** Django 4.2+ & Django REST Framework
- **Runtime:** Python 3.11
- **Database:** SQLite 3 (Komposit Unique Index)
- **Parser Engine:** `pdfplumber`, `ebooklib`

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + Lucide Icons
- **State Management:** Zustand (Persisted Storage)

### Infrastructure & Deployment
- **Containerization:** Docker & Docker Compose
- **Web Server:** Nginx (SPA Routing & 100MB Body Limit)
- **Tunneling:** Cloudflare Tunnel (`cloudflared`)

---

## 📁 Struktur Direktori Proyek

```text
contextual-reader/
├── backend/
│   ├── reader/
│   │   ├── books/           # Manajemen upload & parser EPUB/PDF/TXT
│   │   ├── translations/    # Google Translate GTX & OmniRoute LLM service
│   │   ├── vocabulary/      # Sistem kosakata & Spaced Repetition (SM-2)
│   │   ├── core/            # Health checks & shared utilities
│   │   └── settings.py      # Konfigurasi Django
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout & Navigation components
│   │   ├── pages/           # Library, Reader, Vocabulary, Settings
│   │   ├── stores/          # Zustand state management
│   │   ├── styles/          # Tailwind CSS global styles
│   │   └── utils/           # Axios API Client
│   ├── nginx.conf
│   ├── Dockerfile
│   ├── tailwind.config.js
│   └── vite.config.js
├── docker-compose.yml
├── deploy.sh
└── README.md
```

---

## 🚀 Panduan Instalasi & Jalankan Proyek

### 1. Menggunakan Docker Compose (Direkomendasikan)

1. Clone repositori ini:
   ```bash
   git clone https://github.com/bagaswibowo/contextual-reader.git
   cd contextual-reader
   ```

2. Jalankan container via Docker Compose:
   ```bash
   docker compose up -d --build
   ```

3. Akses aplikasi melalui browser:
   - Frontend: `http://localhost:8088` (atau via domain reverse proxy Anda)
   - Backend API: `http://localhost:8000/api/`

---

### 2. Jalankan secara Manual (Tanpa Docker)

#### Setup Backend (Django):
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

#### Setup Frontend (React):
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Variabel Lingkungan (*Environment Variables*)

| Variabel | Deskripsi | Default / Example |
| :--- | :--- | :--- |
| `SECRET_KEY` | Kunci rahasia Django | `xxx` |
| `DEBUG` | Mode debug Django | `0` (False) |
| `OMNIROUTE_URL` | Endpoint OmniRoute LLM Proxy | `http://100.127.238.166:20129/v1` |
| `OMNIROUTE_MODEL` | Model AI OmniRoute | `auto/best-free` |
| `TUNNEL_TOKEN` | Token Cloudflare Tunnel | `xxx` |

---

## 📝 Lisensi

Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE).

---

Developed with ❤️ for English Learners by **[Bagas Wibowo](https://github.com/bagaswibowo)**.
