# Checklist QA Sprint 0 + Release Gate — Contextual Reader (S0-Q1d)

Part A: QA Sprint 0 checklist (manual + automated) verifying the Sprint 0 gate.
Part B: Release gate (Go/No-Go criteria).
Part C: Staging pen-test checklist before production release (auth bypass, IDOR user_id, SSRF 169.254.169.254, upload file/oversize, rate limit, mass assignment, path traversal media, CORS).

---

## Part A — QA Sprint 0 checklist

### A1. Test foundation (S0-Q1a)
- [ ] `__init__.py` present in `reader/`, `reader/books/`, `reader/translations/`, `reader/vocabulary/`, `reader/core/`
- [ ] `manage.py test reader.translations` no longer raises `TypeError` (module import OK)
- [ ] `makemigrations --check` clean (exit 0) → migrations reproducible
- [ ] All Google Translate calls mocked in `reader/translations/tests.py` (no internet required)
- [ ] `reader/translations/migrations/0001_initial.py` + `reader/vocabulary/migrations/0001_initial.py` created; `migrate` on empty DB creates 4 tables

### A2. Regression tests (S0-Q1b) — lock P0 defects
- [ ] `MigrationTablesTest.test_four_missing_tables_exist` — `translations_wordtranslation`, `translations_sentencetranslation`, `vocabulary_vocabularyentry`, `vocabulary_reviewsession` exist on empty DB
- [ ] `test_start_session_without_book_id_returns_400_not_500` — 400, not 500
- [ ] `test_end_session_unknown_pk_returns_404_not_500` — 404, not 500
- [ ] `test_review_with_string_quality_returns_400_not_500` — 400, not 500
- [ ] `test_new_vocabulary_entry_has_next_review_and_appears_due` — `next_review` set; entry in `due_for_review`
- [ ] `test_unauthenticated_request_to_protected_endpoint_is_rejected` — marked expected-fail(auth), pending S1-B1
- [ ] Suite runs locally without internet (offline = green for mockable tests)

### A3. Endpoint inventory (S0-Q1c)
- [ ] `API_ENDPOINT_INVENTORY.md` written: method, path, request, response, error status for `/api/books`, `/api/vocabulary`, `/api/translations`, `/api/core/health`
- [ ] Frontend call audit complete: every `api.get/post/delete` and direct fetch maps to an existing backend route (no missing endpoint called)
- [ ] Behavioural mismatches recorded (error codes, auth, pagination, `next_review`, OpenAPI versioning)

### A4. Release gate verification (S0-Q1d Part B)
- [ ] CI hijau: backend `manage.py test` passes, `makemigrations --check` clean (DevOps S0-B8 supplies CI; QA confirms green locally)
- [ ] Migrasi reproducible di DB kosong: `migrate` lalu `migrate --check` bersih
- [ ] Tidak ada secret di repo: `grep -R` for `SECRET_KEY`, `xxx`, `dev-secret-key`, hardcoded tokens → none committed (`.env` in `.gitignore`; `.env.example` sans secrets)
- [ ] Backup + restore teruji (DevOps S0-B6): restore ke lokasi uji, bandingkan row count + file hash
- [ ] T01/T03/T04 tertutup: auth model decided (ADR-001), CORS/ALLOWED_HOSTS via env, SSRF allowlist for `custom_base_url`
- [ ] 3 endpoint 500 fixed → regression tests green
- [ ] `next_review` default di-set saat entri dibuat → `due_for_review` works

---

## Part B — Release gate (Go / No-Go)

| # | Criterion | Evidence | Gate |
|---|-----------|----------|------|
| G1 | All regression tests green (S0-Q1b) | `manage.py test reader.vocabulary reader.translations reader.books` OK | Blocker |
| G2 | `makemigrations --check` clean; 4 tables on empty DB | migration output | Blocker |
| G3 | No secrets in repo | grep clean; `.env.example` without values | Blocker |
| G4 | Backup + restore tested (row count + hash match) | restore test output | Blocker |
| G5 | CI pipeline green on push/PR | GitHub Actions run | Blocker |
| G6 | Auth/CORS/SSRF allowlist designed + documented | ADR-001/005, settings via env | Blocker |
| G7 | Frontend calls only existing endpoints | audit in Part A3 | Blocker |

Release = **Go** only if all G1–G7 pass. Any blocker fail = **No-Go**, escalate to Tech Lead/PM.

---

## Part C — Staging pen-test checklist (before production)

Run on a STAGING clone (never production). Each item: method, target, expected result, status.

### C1. Auth bypass (T01)
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C1-1 | Call protected endpoint without auth headers | `GET /api/books/` | 401/403 (after S1-B1) | — |
| C1-2 | Call protected endpoint with invalid/expired token | `POST /api/vocabulary/` | 401 | — |
| C1-3 | Session fixation / token reuse across users | `GET /api/vocabulary/?user_id=X` | isolated per owner | — |

### C2. IDOR via user_id (T01)
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C2-1 | Read another user's books via `user_id` param | `GET /api/books/?user_id=other` | 403 / own data only | — |
| C2-2 | Delete another user's vocabulary entry | `DELETE /api/vocabulary/{other_id}/` | 403/404 | — |
| C2-3 | Review another user's entry | `POST /api/vocabulary/{other_id}/review/` | 403 | — |
| C2-4 | Start/end session for another user's book | `POST /api/vocabulary/start_session/` with `book_id` of other | 403 | — |

### C3. SSRF to 169.254.169.254 (T04)
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C3-1 | `custom_base_url` = `http://169.254.169.254/` | `POST /api/translations/word/` | 400 (blocked) | — |
| C3-2 | `custom_base_url` = `http://127.0.0.1:8000/` | `POST /api/translations/sentence/` | 400 (blocked) | — |
| C3-3 | `custom_base_url` = `http://localhost/`, `::1`, `10./192.168.` ranges | word/sentence/explain-3d | 400 (blocked) | — |
| C3-4 | `custom_base_url` non-allowlist host (e.g. attacker-controlled) | `POST /api/translations/word/` | 400 (blocked) | — |
| C3-5 | Valid allowlist host still works | `POST /api/translations/word/` with allowed LLM host | 200 | — |

### C4. Upload file berbahaya / oversize (T07)
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C4-1 | File > `MAX_FILE_SIZE` (100 MB) via curl | `POST /api/books/` | 400 | — |
| C4-2 | Unsupported extension (`.exe`, `.sh`) | `POST /api/books/` | 400 | — |
| C4-3 | Zip Slip (`../../evil`) inside zip/epub | `POST /api/books/` | 400 | — |
| C4-4 | Zip bomb (uncompressed > 250 MB) | `POST /api/books/` | 400 | — |
| C4-5 | Invalid magic bytes (fake PDF/EPUB) | `POST /api/books/` | 400 | — |
| C4-6 | ZIP without any `.md` (MinerU format required) | `POST /api/books/` | 400 | — |

### C5. Rate limiting (T17)
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C5-1 | Burst translation calls from one client | `POST /api/translations/word/` ×N | 429 after threshold | — |
| C5-2 | Brute-force book upload | `POST /api/books/` ×N | 429 after threshold | — |

### C6. Mass assignment
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C6-1 | POST with unexpected fields (`is_staff`, `user_id` override, `status`) | `POST /api/vocabulary/` | ignored / 400 | — |
| C6-2 | PATCH book with `status=completed` forced | `PATCH /api/books/{id}/` | 400 or restricted | — |

### C7. Path traversal media
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C7-1 | `GET /media/../../../etc/passwd` | media serve | 404/403, not file content | — |
| C7-2 | Upload filename with `..` | `POST /api/books/` | 400 (filename sanitised) | — |

### C8. CORS (T03)
| # | Test | Target | Expected | Status |
|---|------|--------|----------|--------|
| C8-1 | Preflight from non-allowed origin | `OPTIONS /api/books/` | no `Access-Control-Allow-Origin: *` with credentials | — |
| C8-2 | `CORS_ALLOW_ALL_ORIGINS=True` + `CORS_ALLOW_CREDENTIALS=True` combo | settings | invalid combo removed | — |
| C8-3 | Allowed origin only | `GET /api/books/` with `Origin` header | echo allowed origin | — |

Status column: `—` = not yet executed (blocked until S1-B1 auth lands). Mark ✓ / ✗ / skipped when run.
