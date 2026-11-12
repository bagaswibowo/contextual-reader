# API — Google Translate Sprint 1 (Backend)

**Status:** implemented on branch `sprint1/backend-google-translate` (based on `origin/sprint0/integration` @ `c5896c1`).
**Scope:** word dictionary lookup, language detection, word-level TTS, DB-backed cache.
**Not in this change:** OCR/image, document/chapter translation, multi-user phrasebook, feedback endpoint, `/word/` response enrichment (see *Follow-ups*).

All endpoints are read-only and unauthenticated, matching the current Sprint 0 posture. They do not accept a free-form URL, so the SSRF allowlist for `custom_base_url` is unchanged.

---

## 1. `GET /api/translations/dictionary/`

Returns definitions, senses, synonyms, IPA, and a word-level audio URL. Results are cached in the database for 7 days.

### Query parameters

| Name | Required | Type | Notes |
|---|---|---|---|
| `word` | yes | string | Max 255 chars. Letters, spaces, apostrophes, dots, hyphens. |
| `lang` | yes | string | Source language code, e.g. `en`. Max 10 chars. |
| `context` | no | string | Sentence around the word, max 1000 chars. Used to rank senses whose examples match. |

### Response `200 OK`

```json
{
  "word": "traditional",
  "lang": "en",
  "part_of_speech": "adjective",
  "phonetic_ipa": "/trəˈdɪʃənəl/",
  "audio_url": "/api/translations/tts/?text=traditional&lang=en",
  "confidence": 0.95,
  "senses": [
    {
      "meaning": "existing in or as part of a tradition; long-established.",
      "examples": ["the traditional festivities of the Church year"],
      "synonyms": ["conventional", "customary", "established"]
    }
  ],
  "synonyms": ["conventional", "customary", "established", "orthodox"],
  "source": "free-dictionary",
  "fetched_at": "2026-11-12T16:54:23.629444Z"
}
```

`source` is `free-dictionary` or `google-translate`. `confidence` is derived from the source (0.95 / 0.60) and is reduced when stale cache is served.

### Errors

| Status | When |
|---|---|
| `400` | `word` or `lang` missing; `word` > 255 chars; `lang` > 10 chars; `context` > 1000 chars; unsupported characters in `word`. |
| `404` | No fresh cache row and every provider failed. |

### Cache and provider behaviour

1. Look up `DictionaryEntry` by `(word_lower, lang)`.
2. If `fetched_at` is younger than 7 days, return it without any network call.
3. Otherwise call the Free Dictionary API (`api.dictionaryapi.dev`).
4. If that fails, fall back to `GoogleTranslateClient.translate_word` (Indonesian meaning).
5. Upsert the row with `fetched_at = now`.
6. If both providers fail but a stale row exists, serve the stale row with lower confidence instead of breaking the reading flow.

The cache is a real table, not `LocMemCache`, so it survives restarts and is shared by all workers.

---

## 2. `POST /api/translations/detect/`

Detects the language of a word or sentence.

### Request

```json
{"text": "The traditional festivities of the Church year"}
```

`text` is required, must be a string, and is limited to **5000 characters**.

### Response `200 OK`

```json
{"lang": "en", "confidence": 0.9}
```

### Errors

| Status | When |
|---|---|
| `400` | `text` missing, empty, not a string, or longer than 5000 characters. |

### Detection method

No new dependency is installed. The detector uses Unicode script ranges (Japanese, Chinese, Korean, Cyrillic, Arabic, Thai, Hindi, Hebrew, Greek) and stop-word/suffix scoring for Latin-script languages (`en`, `id`, `es`, `fr`, `de`, `pt`, `it`, `nl`). Unknown Latin text returns `en` with low confidence (0.2) rather than an error.

---

## 3. `GET /api/translations/tts/`

Existing endpoint, reused for word-level audio. The `audio_url` returned by the dictionary endpoint points here.

| Name | Required | Notes |
|---|---|---|
| `text` | yes | Truncated to 300 chars. |
| `lang` | no | Default `en`. `zh`/`zh-cn` and `zh-tw` are normalised. |

Returns `audio/mpeg` with `Cache-Control: public, max-age=...`. Returns `400` when `text` is missing.

---

## 4. Manual verification (2026-11-12)

Run against `manage.py runserver` with a fresh SQLite database:

```text
GET  /api/translations/dictionary/?word=traditional&lang=en&context=...  -> 200, 0.85s (live provider)
GET  /api/translations/dictionary/?word=traditional&lang=en              -> 200, 0.004s (DB cache hit)
GET  /api/translations/dictionary/?lang=en                               -> 400
POST /api/translations/detect/ {"text":"The traditional ..."}            -> 200 {"lang":"en","confidence":0.9}
POST /api/translations/detect/ {"text":"<5001 chars>"}                   -> 400
GET  /api/translations/tts/?text=traditional&lang=en                     -> 200, 8832 bytes audio/mpeg
```

Automated tests:

```text
manage.py test reader
Ran 77 tests ... OK (expected failures=1)
manage.py migrate --check          -> no changes
manage.py makemigrations --check   -> no changes
```

New tests cover cache miss/hit, stale refresh, stale fallback, provider failure, request validation, response contract, language detection, and TTS.

---

## 5. Files changed

| File | Change |
|---|---|
| `backend/reader/translations/models.py` | Added `DictionaryEntry`. |
| `backend/reader/translations/migrations/0002_dictionaryentry.py` | New migration. |
| `backend/reader/translations/dictionary.py` | Provider chain, DB cache, context ranking, serialization. |
| `backend/reader/translations/language_detection.py` | Script + stop-word/suffix detector. |
| `backend/reader/translations/views.py` | `dictionary` and `detect` actions. |
| `backend/reader/translations/urls.py` | Registered both routes. |
| `backend/reader/translations/tests.py` | 17 new tests. |

---

## 6. Follow-ups (not done here)

- Enrich `POST /api/translations/word/` with `definitions`, `synonyms`, `translations_table`, `examples`, `phonetic_ipa`, `audio_url` (SPEC §2.4). The dictionary cache can supply most of it.
- 👍/👎 feedback endpoint (UI/UX AC-WI-16) — no contract yet.
- Optional `langdetect` dependency if higher accuracy is needed; current heuristic is dependency-free.
- Auth (D2) and CORS/domain (D1) still gate the full Sprint 1 release.
