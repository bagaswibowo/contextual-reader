# Sprint 0 QA Report — Contextual Reader (S0-Q1)

Branch: `sprint0/qa-regression` (clone at `/data/OpenBot/Shared/contextual-reader/qa/`, based on `origin/main`)
Repo: `bagaswibowo/contextual-reader` — local clone only, **not pushed to GitHub main**.
Date: 2026-11-12 · Owner: QA Engineer · Rencana induk: `REMEDIATION_PLAN.md`

## 1. Daftar test (nama, yang di-cover, status)

| # | Test (file) | Yang di-cover | Status saat ini (belum fix backend) |
|---|-------------|---------------|-------------------------------------|
| T1 | `reader/translations/tests.py` — 9 tests (GrammarAnalyzer ×5, GoogleTranslateClient ×3 mocked, UniversalWordTokenizer ×1) | Grammar analyzer, Google Translate client, tokenizer | **Hijau** (9/9 OK) — Google Translate di-mock, tidak butuh internet |
| T2 | `reader/vocabulary/tests.py` `MigrationTablesTest.test_four_missing_tables_exist` | 4 tabel hilang dibuat di DB kosong: `translations_wordtranslation`, `translations_sentencetranslation`, `vocabulary_vocabularyentry`, `vocabulary_reviewsession` | **Gagal** — migrasi belum ada (menunggu S0-B1 Backend) |
| T3 | `reader/vocabulary/tests.py` `test_start_session_without_book_id_returns_400_not_500` | `start_session` tanpa `book_id` → 400 bukan 500 | **Gagal** (500 IntegrityError `book_id` NOT NULL) |
| T4 | `reader/vocabulary/tests.py` `test_end_session_unknown_pk_returns_404_not_500` | `end_session` pk tak ada → 404 bukan 500 | **Error** (500 DoesNotExist dibubuhkan middleware, tidak dibungkus) |
| T5 | `reader/vocabulary/tests.py` `test_review_with_string_quality_returns_400_not_500` | `review` quality string `"4"` → 400 bukan 500 | **Error** (500 `TypeError: '<=' not supported between instances of 'int' and 'str'`) |
| T6 | `reader/vocabulary/tests.py` `test_new_vocabulary_entry_has_next_review_and_appears_due` | `next_review` diisi saat entri dibuat; muncul di `due_for_review` | **Gagal** (`next_review` NULL default) |
| T7 | `reader/vocabulary/tests.py` `test_unauthenticated_request_to_protected_endpoint_is_rejected` | Endpoint dilindungi ditolak tanpa auth | **Expected-fail (auth)** — menunggu S1-B1 auth; saat ini 200 (AllowAny) |

Catatan: T2–T6 sengaja gagal/error pada kode saat ini — itu sengaja untuk mengunci temuan P0 agar tidak regresi setelah Backend memperbaiki. T7 ditandai expected-fail karena autentikasi belum ada di branch utama (disetujui menunggu S1-B1, jangan dihapus).

## 2. Temuan baru dari proses menulis test

1. **`manage.py test reader.translations` TypeError** disebabkan semua `__init__.py` hilang di `reader/` dan sub-apps (books, translations, vocabulary, core) serta migrations package. Sudah diperbaiki di branch ini dengan menambahkan 6 file `__init__.py` (S0-Q1a).
2. **`makemigrations --check` gagal** karena `translations` tidak punya `0001_initial.py` (terpakai oleh tracked `0002_add_fields.py`) dan `vocabulary` tidak punya folder `migrations/` sama sekali. Sudah digenerate kanonis oleh Django (exit 0, "No changes detected"). Ini adalah pekerjaan S0-B1 milik Backend Developer; QA hanya mencantumkan agar test bisa dijalankan.
3. **`start_session` tanpa `book_id`** menghasilkan `IntegrityError: NOT NULL constraint failed: vocabulary_reviewsession.book_id` → 500, seharusnya 400 (T3).
4. **`end_session` dengan pk tak ada** membiarkan `DoesNotExist` meluas sebagai 500, tidak dibungkus `get_object_or_404` (T4).
5. **`review` dengan quality `"4"` (string)** menghasilkan `TypeError` karena perbandingan `0 <= quality <= 5` antara int dan str gagal → 500, seharusnya 400 (T5).
6. **`next_review` default NULL** saat `VocabularyEntry` dibuat, sehingga `due_for_review` (`next_review__lte=now`) tidak pernah mencakup kata baru (T6).
7. **Semua panggilan frontend ke backend sudah ada** endpoint-nya (audit di `API_ENDPOINT_INVENTORY.md`): tidak ada endpoint yang dipanggil frontend tapi tidak tersedia backend. Ketidakcocokan adalah perilaku (kode error, auth, paginasi, `next_review`, tidak ada OpenAPI/versi `/api/v1/`).
8. **Tidak ada autentikasi sama sekali** (`AllowAny` seluruh API, `user_id` dari client default `"default"`). Uji auth (T7) sengaja expected-fail menunggu S1-B1.

## 3. Daftar cacat yang belum tertangkap test

Berikut cacat yang teridentifikasi dalam audit Sprint 0 tetapi **belum ada uji otomatis yang menangkannya** di branch ini (dalur QA Sprint 1 / lanjutan):

- SSRF lewat `custom_base_url` ke `169.254.169.254` / localhost / rentang internal (T04) — uji di checklist pen-test C3, belum di-automasi.
- Validasi upload di backend (ukuran, format, Zip Slip, zip bomb, magic bytes) sebagian ada di serializer tapi belum diuji otomatis (T07) — uji di checklist C4.
- Rate limiting API belum ada sama sekali (T17) — uji di checklist C5.
- Mass assignment / kolom tidak diizinkan di request body (T28-ish) — uji di checklist C6.
- Path traversal media (`GET /media/../../../`) — uji di checklist C7.
- CORS kombinasi tidak valid (`CORS_ALLOW_ALL_ORIGINS=True` + `CORS_ALLOW_CREDENTIALS=True`) — uji di checklist C8.
- `list()` books melakukan UPDATE pada GET (auto-fail stuck processing) — dampak sisi baca, belum di-uji.
- `chapter()` mengembalikan ribuan kalimat tanpa paginasi — risiko performa/DoS.
- `error_message` / `processed_at` tidak exposed di `BookSerializer`.
- File media PDF tidak dihapus saat `destroy()` buku (T29).
- Tidak ada healthcheck/liveness terpisah, rate limit, atau logging terstruktur.

## 4. Berkas hasil pekerjaan

- `backend/reader/__init__.py`, `books/__init__.py`, `translations/__init__.py`, `vocabulary/__init__.py`, `core/__init__.py` — fondasi test (S0-Q1a)
- `backend/reader/translations/migrations/0001_initial.py`, `__init__.py` — tabel hilang translations
- `backend/reader/vocabulary/migrations/0001_initial.py`, `__init__.py` — tabel hilang vocabulary
- `backend/reader/translations/tests.py` — uji yang sudah ada, Google Translate di-maskir (S0-Q1a)
- `backend/reader/vocabulary/tests.py` — regresi P0 (migrasi, 3 endpoint 500, `next_review`, auth expected-fail) (S0-Q1b)
- `API_ENDPOINT_INVENTORY.md` — inventaris endpoint + audit panggilan frontend (S0-Q1c)
- `QA_SPRINT0_CHECKLIST.md` — checklist QA Sprint 0 + release gate + checklist pen-test staging (S0-Q1d)
- `SPRINT0-QA-REPORT.md` — laporan ini

## 5. Status rilis (gate)

- **S0-Q1a (fondasi test):** selesai — `__init__.py` ditambah, migrasi kanonikal (`makemigrations --check` bersih exit 0), uji tanpa internet hijau.
- **S0-Q1b (regresi P0):** test ditulis dan gagal/error pada kode saat ini (sengaja). Hijau setelah S0-B1 (migrasi) + S0-B5 (bug 500 + `next_review`) selesai Backend.
- **S0-Q1c (inventaris endpoint):** selesai.
- **S0-Q1d (checklist + release gate):** selesai.
- **Release gate:** NO-GO saat ini karena T2–T6 masih gagal (menunggu fix Backend S0-B1/S0-B5) dan T7 expected-fail (menunggu auth S1-B1). Revisit setelah Backend Developer merge `sprint0/backend-hardening`.

Tidak ada push ke GitHub main. Tidak ada perubahan kode backend di luar uji dan migrasi pendukung yang dilakukan Backend Developer.
