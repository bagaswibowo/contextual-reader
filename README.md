# Contextual Reader

Contextual Reader is a web-based English reader application designed for language learners. It provides instant per-word dictionary lookup, sentence translation, 16-tense grammar structure analysis (S+V+O), and spaced-repetition vocabulary review (SM-2 algorithm).

The application features a Duolingo-inspired 3D UI system with full mobile-first responsiveness and supports reading EPUB, PDF, and TXT documents up to 100MB.

---

## Technical Features

### Reading & Translation Engine
* **Instant Word Translation:** Free Google Translate GTX engine returning primary translation, IPA phonetics, and parts of speech breakdown (Noun, Verb, Adjective, Adverb).
* **Multi-Language Support:** Translates into 22+ target languages (Indonesian, Spanish, French, German, Japanese, Mandarin, Korean, Arabic, etc.).
* **OmniRoute LLM Integration:** Optional routing to local OmniRoute proxy (`auto/best-free` model) for complex literary translations.
* **16 Tenses & Grammar Analyzer:** Rule-based parser classifying sentence tenses and extracting S+V+O syntax patterns alongside verb, noun, and adjective lists.

### Fast Document Parsing
* **Sub-2s PDF/EPUB Extractor:** Uses `pdfplumber` vector text parsing to process 1,000+ page books in under 2 seconds without CPU-blocking OCR loops.
* **Batch Database Insertion:** Saves 20,000+ extracted sentences per book using SQLite `bulk_create` (0.1s execution time).

### Vocabulary & Spaced Repetition
* **Flashcard Review:** Implements the SuperMemo (SM-2) algorithm for interval-based vocabulary retention.
* **Book Isolation:** Vocabulary entries tracked per book and globally with context snippets.

### Responsive UI & Reading Modes
* **Mobile-First Responsive Layout:** Includes mobile bottom navigation, touch-pill language selectors, and a collapsible display settings bottom sheet (`[ Aa ]`).
* **Reader Themes:** Light, Sepia (`#FBF3E4`), and Dark (`#131F24`) high-contrast themes.

---

## Tech Stack

* **Backend:** Python 3.11, Django 4.2+, Django REST Framework, SQLite 3.
* **Frontend:** React 18, Vite, Tailwind CSS 3.4, Zustand (persisted state).
* **DevOps:** Docker, Docker Compose, Nginx, Cloudflare Tunnel (`cloudflared`).

---

## Project Structure

```text
contextual-reader/
├── backend/
│   ├── reader/
│   │   ├── books/           # Upload handling & document parsers (EPUB, PDF, TXT)
│   │   ├── translations/    # Google Translate GTX & OmniRoute services + Grammar analyzer
│   │   ├── vocabulary/      # Flashcards & SM-2 algorithm
│   │   └── settings.py      # Django configuration
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Navigation, Layout, and Modal components
│   │   ├── pages/           # Library, Reader, Vocabulary, Settings
│   │   ├── stores/          # Zustand state stores
│   │   └── styles/          # Tailwind globals
│   ├── nginx.conf
│   ├── Dockerfile
│   └── vite.config.js
├── docker-compose.yml
├── deploy.sh
└── README.md
```

---

## Installation & Deployment

### Quick Start with Docker Compose

1. Clone the repository:
   ```bash
   git clone https://github.com/bagaswibowo/contextual-reader.git
   cd contextual-reader
   ```

2. Build and start services:
   ```bash
   docker compose up -d --build
   ```

3. Access endpoints:
   * Frontend SPA: `http://localhost:8088`
   * Backend REST API: `http://localhost:8000/api/`

---

### Manual Setup (Development)

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # then fill in SECRET_KEY and ALLOWED_HOSTS
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

All backend configuration is read from the environment. See
[`.env.example`](.env.example) for the complete list. The most important ones:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `SECRET_KEY` | Django secret key (required when `DEBUG=False`) | generated, never committed |
| `DEBUG` | Django debug mode | `False` |
| `ALLOWED_HOSTS` | Comma-separated public hostnames (no wildcard) | `reader.example.com` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact origins | `https://reader.example.com` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow every origin (do not use in production) | `False` |
| `CORS_ALLOW_CREDENTIALS` | Send cookies cross-origin | `False` |
| `OMNIROUTE_BASE_URL` | OpenAI-compatible LLM endpoint, including `/v1` | empty (LLM disabled) |
| `OMNIROUTE_URL` | Legacy alias of `OMNIROUTE_BASE_URL` | empty |
| `OMNIROUTE_MODEL` | OmniRoute model target | `auto/best-free` |
| `LLM_ALLOWED_HOSTS` | Hosts accepted for client `custom_base_url` | host of `OMNIROUTE_BASE_URL` |
| `MAX_FILE_SIZE` | Maximum upload size in bytes | `104857600` |
| `SUPPORTED_FORMATS` | Accepted upload extensions | `epub,txt,pdf,md,zip` |
| `TUNNEL_TOKEN` | Cloudflare Tunnel token (infra only) | never committed |

---

## License

Distributed under the MIT License.
