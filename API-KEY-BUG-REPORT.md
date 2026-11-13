# FRONTEND API KEY / 400 BUG — ANALISIS & PERBAIKAN

**Proyek:** Contextual Reader (`bagaswibowo/contextual-reader`)
**Komponen:** `frontend/src/utils/api.js`, `frontend/src/pages/Reader.jsx`
**Penanggung jawab:** Front-End Developer WEB
**Branch:** `sprint0/frontend-hardening` (`db588ff`) → `sprint0/integration` (`de3fffa`)
**Tanggal:** 12 November 2026

---

## 1. Ringkasan

Klaim awal: `user_id='default'` menyebabkan respons **400**.

Hasil investigasi: **klaim itu tidak benar.** `user_id='default'` diterima backend (HTTP 200/201). Penyebab 400 yang sebenarnya adalah **`custom_base_url`** yang selalu dikirim frontend, lalu ditolak allowlist SSRF backend ketika `LLM_ALLOWED_HOSTS` kosong.

Perbaikan dilakukan di frontend: field custom provider hanya dikirim saat `engine === 'custom'`.

---

## 2. Bukti reproduksi (backend nyata, `origin/sprint0/integration` @ `dea37c9`)

Backend dijalankan dengan env dummy (`SECRET_KEY=ci-dummy-sprint0`, `ALLOWED_HOSTS=localhost,127.0.0.1`, `DEBUG=0`), lalu diuji dengan `curl`:

| Request | Hasil |
|---|---|
| `POST /api/translations/word/` `{sentence_id:1, word:"hello", engine:"google", custom_base_url:"https://api.openai.com/v1", custom_api_key:"sk-test"}` | **HTTP 400** `{"error":"custom_base_url is disabled because no LLM host allowlist is configured."}` |
| `POST /api/translations/word/` `{sentence_id:1, word:"hello", engine:"google"}` (tanpa field custom) | **HTTP 404** `{"error":"Sentence not found"}` — validasi `custom_base_url` lolos, request sampai ke lookup data |
| `GET /api/vocabulary/?user_id=default` | **HTTP 200** `{"count":0,...}` |

Kesimpulan: 400 berasal dari `custom_base_url`, bukan `user_id`.

### Kenapa ini terjadi

`backend/reader/translations/views.py` memanggil `_validated_custom_base_url(request)` **sebelum** melihat `engine`. Jadi selama field `custom_base_url` ada dan tidak kosong, request apa pun — termasuk `engine=google` — divalidasi terhadap `LLM_ALLOWED_HOSTS`. Bila allowlist kosong, seluruh request ditolak 400.

Di frontend, `translationsApi` selalu mengirim:

```js
custom_base_url: customConfig.customBaseUrl,
custom_api_key: customConfig.customApiKey,
custom_model: customConfig.customModel
```

`customBaseUrl` berasal dari store (`frontend/src/stores/index.js`, default `''`). Artinya:

- Selama user belum pernah mengisi Base URL → `custom_base_url: ''` → backend menganggapnya tidak dikirim → aman.
- Begitu user pernah mengisi Base URL di Settings (walau kemudian kembali memilih engine Google/Omni) → nilai itu terus terkirim → **semua terjemahan gagal 400**.

### Dampak tambahan (keamanan)

`custom_api_key` juga selalu dikirim ke server meskipun engine yang dipakai Google/Omni. Kunci API user tidak perlu meninggalkan browser pada kondisi itu. Perbaikan ini sekaligus menutup kebocoran tersebut.

---

## 3. Perbaikan

### `frontend/src/utils/api.js`

Ditambahkan helper yang hanya mengembalikan field custom bila engine benar-benar `custom` dan nilainya terisi:

```js
const customProviderFields = (engine, customConfig = {}) => {
  if (engine !== 'custom') return {}
  const fields = {}
  if (customConfig.customBaseUrl) fields.custom_base_url = customConfig.customBaseUrl
  if (customConfig.customApiKey) fields.custom_api_key = customConfig.customApiKey
  if (customConfig.customModel) fields.custom_model = customConfig.customModel
  return fields
}
```

Helper dipakai dengan spread di `word`, `sentence`, `batchSentence`, `explain3d`, dan `paragraphSummary`.

`explain3d` dan `paragraphSummary` sebelumnya tidak punya parameter `engine` sama sekali, sehingga selalu mengirim field custom. Keduanya kini menerima `engine` (default `'google'`).

### `frontend/src/pages/Reader.jsx`

`handleFetch3d` meneruskan `translationEngine || 'google'` sebagai argumen `engine` ke `explain3d`.

### Yang TIDAK diubah

- Tidak ada perubahan backend. Penolakan `custom_base_url` tanpa allowlist adalah perilaku keamanan yang benar (menutup SSRF).
- Tidak ada pelonggaran validasi.
- `user_id='default'` dibiarkan apa adanya: itu urusan auth/ownership Sprint 1 (D2), bukan bug 400.

---

## 4. Verifikasi

### 4.1 Payload nyata dari kode yang sudah diperbaiki

Modul `api.js` dijalankan dengan `axios` distub, lalu payload ditangkap:

```text
google  -> {"sentence_id":1,"word":"hello","target_lang":"id","mother_lang":"id","engine":"google"}
omni    -> {"sentence_id":1,"word":"hello","target_lang":"id","mother_lang":"id","engine":"omni"}
custom  -> {"sentence_id":1,"word":"hello","target_lang":"id","mother_lang":"id","engine":"custom","custom_base_url":"https://api.openai.com/v1","custom_api_key":"sk-secret","custom_model":"gpt-4o-mini"}
explain3d google -> {"sentence_text":"text","selected_text":"word","user_level":"B2","target_lang":"id","sentence_id":1,"engine":"google"}
explain3d custom -> {"sentence_text":"text","selected_text":"word","user_level":"B2","target_lang":"id","sentence_id":1,"engine":"custom","custom_base_url":"https://api.openai.com/v1","custom_api_key":"sk-secret","custom_model":"gpt-4o-mini"}
ASSERT PASS: field custom hanya dikirim saat engine=custom
```

### 4.2 Lint & build

```text
npx eslint src/utils/api.js src/pages/Reader.jsx --max-warnings 0
eslint exit=0

npm run build
build exit=0
find dist -name "*.map" | wc -l
0
```

### 4.3 Efek terhadap request

Dengan payload baru, request `engine=google` tidak lagi membawa `custom_base_url`, sehingga tidak lagi memicu 400 dari allowlist SSRF. Request `engine=custom` tetap membawa field custom dan tetap divalidasi backend seperti sebelumnya.

---

## 5. Sisa pekerjaan terkait (bukan frontend)

- **D4** — bila `custom_base_url` dihapus dari produk, frontend dapat membuang seluruh jalur custom provider. Bila dipertahankan, operator wajib mengisi `LLM_ALLOWED_HOSTS` agar engine custom berfungsi.
- **D2 / auth** — `user_id='default'` akan diganti identitas user setelah model auth diputuskan.
- **UX** — saat ini pesan 400 dari backend ditampilkan apa adanya ("custom_base_url is disabled because no LLM host allowlist is configured"). Bisa dibuat lebih ramah di Sprint 1.

---

## 6. Status

**FIXED & VERIFIED** di `sprint0/integration` @ `de3fffa`.
Tidak ada push ke `main`, tidak ada deploy, tidak ada perubahan `backend/`, `docker-compose.yml`, atau `ci.yml`.
