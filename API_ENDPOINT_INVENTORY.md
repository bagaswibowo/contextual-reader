# Endpoint Inventory — Contextual Reader (Sprint 0 QA, S0-Q1c)

Source: `reader/urls.py`, `reader/books/urls.py`, `reader/translations/urls.py`, `reader/vocabulary/urls.py`, `reader/core/urls.py`, views, serializers.
Scope: `/api/books`, `/api/vocabulary`, `/api/translations`, `/api/core/health`.
Auth: entire API is `AllowAny` (no authentication/authorization yet — S1-B1). `user_id` comes from client query/body, default `"default"`.

## 1. /api/books (books app, BookViewSet)

| Method | Path | Request | Success response | Error status | Notes |
|--------|------|---------|------------------|--------------|-------|
| GET | `/api/books/` | none | list of Book (chapters nested) | 500 if stuck-processing update races | `list()` auto-fails books stuck `>3 min` (writes on GET) |
| POST | `/api/books/` | `file`, `title?`, `author?`, `format?` (multipart) | Book 201 | 400 validation, 500 | starts daemon thread; max 100 MB; magic-byte + Zip Slip checks |
| GET | `/api/books/{id}/` | none | Book detail + chapters | 404 | — |
| PUT/PATCH | `/api/books/{id}/` | Book fields | Book | 400, 404 | full/partial update |
| DELETE | `/api/books/{id}/` | none | 204 | 404 | deletes file + chapters/sessions/entries |
| GET | `/api/books/{id}/chapter/?index=N` | `index` query | Chapter + sentences | 404 | returns ALL sentences (no pagination) |
| GET | `/api/books/{id}/toc/` | none | chapter list | 404 | — |

## 2. /api/vocabulary (vocabulary app, VocabularyViewSet)

| Method | Path | Request | Success response | Error status | Notes |
|--------|------|---------|------------------|--------------|-------|
| GET | `/api/vocabulary/` | `user_id?` | entry list | 200 | default `user_id="default"` |
| POST | `/api/vocabulary/` | `word_translation`, `user_id?` | entry 200/201 | 400 missing, 404 not found | get_or_create; `next_review` default NULL (bug T11) |
| DELETE | `/api/vocabulary/{id}/` | none | 204 | 404 | — |
| GET | `/api/vocabulary/by_book/` | `user_id?`, `book_id?` | grouped per book | 200 | — |
| GET | `/api/vocabulary/due_for_review/` | `user_id?` | entries due | 200 | filters `next_review__lte=now` (bug T11) |
| POST | `/api/vocabulary/{id}/review/` | `quality` 0-5 | entry updated | 400 (bug T10: string quality → 500) | SM-2 |
| POST | `/api/vocabulary/start_session/` | `user_id?`, `book_id` | session 201 | 500 (bug T10: no book_id → IntegrityError) | — |
| POST | `/api/vocabulary/{id}/end_session/` | `cards_reviewed?`, `cards_correct?` | session | 500 (bug T10: unknown pk → DoesNotExist) | — |

## 3. /api/translations (translations app, TranslationViewSet)

| Method | Path | Request | Success response | Error status | Notes |
|--------|------|---------|------------------|--------------|-------|
| POST | `/api/translations/word/` | `sentence_id`, `word`, `target_lang?`, `mother_lang?`, `engine?`, `custom_base_url?`, `custom_api_key?`, `custom_model?` | WordTranslation | 400 missing, 404 sentence | calls Google Translate / custom LLM; SSRF via custom_base_url (T04) |
| POST | `/api/translations/sentence/` | `sentence_id`, `target_lang?`, `mother_lang?`, `engine?`, `custom_base_url?`, … | SentenceTranslation | 400, 404 | SSRF via custom_base_url (T04) |
| POST | `/api/translations/batch-sentence/` | `sentence_ids`, `target_lang?`, `engine?`, … | list | 400 empty | — |
| GET | `/api/translations/tts/` | `text`, `lang?` | audio/mpeg | 400, 500 | proxies translate.google.com |
| POST | `/api/translations/explain-3d/` | `sentence_text`(or `sentence_id`)+`selected_text`, … | result | 400, 404 | SSRF via custom_base_url |
| POST | `/api/translations/paragraph-summary/` | `paragraph_text`, `detail_level?`, … | result | 400 | SSRF via custom_base_url |

## 4. /api/core/health (core app)

| Method | Path | Request | Success response | Error status | Notes |
|--------|------|---------|------------------|--------------|-------|
| GET | `/api/core/health/` | none | `{status, database, cache}` | 200 degraded if db/cache fail | only health endpoint; no liveness/readiness split |

## 5. Frontend → backend call audit (all calls exist)

`frontend/src/utils/api.js` is the single axios client (`baseURL: '/api'`). Every call maps to a real backend route:

- `booksApi`: list `GET /books/`, upload `POST /books/`, get `GET /books/{id}/`, chapter `GET /books/{id}/chapter/`, toc `GET /books/{id}/toc/`, delete `DELETE /books/{id}/` — all exist.
- `translationsApi`: word/sentence/batch-sentence/explain-3d/paragraph-summary `POST`, tts `GET /tts/` — all exist.
- `vocabularyApi`: list/create/delete `GET/POST/DELETE /vocabulary/`, by_book `GET /by_book/`, due `GET /due_for_review/`, review `POST /{id}/review/`, start_session `POST /start_session/`, end_session `POST /{id}/end_session/` — all exist.
- `coreApi`: health `GET /core/health/` — exists.

Direct (non-api.js) calls: `PronunciationWidget.jsx:152`, `Reader.jsx:499`, `Vocabulary.jsx:119` all call `GET /api/translations/tts/` — exists.

**Finding:** no frontend call targets a missing backend endpoint. All 3 routes `/api/books`, `/api/vocabulary`, `/api/translations`, `/api/core/health` are covered by backend. The mismatches are behavioural (error codes, missing auth, pagination, missing `next_review`) — covered by S0-Q1b regression tests.

## 6. Notable gaps in inventory (reported, not fixed by QA)

- No `PATCH`/`PUT` on vocabulary entries; no pagination on `chapter()`.
- `error_message`/`processed_at` not in `BookSerializer` (reported in audit).
- No OpenAPI/Swagger; no `/api/v1/` versioning.
- Auth endpoints (login/register/token) do not exist — `test_unauthenticated_request_to_protected_endpoint_is_rejected` is marked expected-fail pending S1-B1.
