# API Kontrak: Panel Kata dan Kalimat

Dokumen ini adalah kontrak untuk Front-End. Semua field di bawah ini sudah
dikembalikan backend dan tidak butuh panggilan tambahan.

## 1. `GET /api/translations/languages/`

Daftar bahasa untuk dropdown global dan dropdown sidebar. Menambah bahasa
cukup mengubah `reader/translations/languages.py`, bukan kode UI.

```json
{
  "languages": [
    {"code": "id", "label": "Indonesia", "tts": "id", "latin_script": true},
    {"code": "en", "label": "Inggris", "tts": "en", "latin_script": true}
  ]
}
```

## 2. `GET /api/translations/dictionary/`

Parameter: `word`, `lang` (bahasa buku), `mother_lang` (bahasa pilihan),
`context` (kalimat tempat kata diklik, opsional).

Field lama tetap ada. Field tetap untuk panel kata:

| Field | Isi |
|---|---|
| `arti_konteks` | arti kata di kalimat itu (hijau) |
| `definisi` | definisi singkat bahasa buku |
| `arti_lain` | `[{makna, kelas_kata, contoh}]`, arti alternatif (abu-abu) |
| `sinonim` | daftar sinonim |
| `terjemahan_lain` | padanan lain, urut dari paling umum |
| `ipa` | transkripsi IPA bahasa buku |
| `fonetik` | ejaan bantu bersuku kata, mis. `re-ZIL-ient` |
| `suku_kata` | `["re", "zil", "ient"]` untuk sorot saat audio jalan |
| `definisi_bahasa_pilihan` | `[{makna, kelas_kata, contoh, sesuai_konteks}]` |

`contoh` berbentuk `{source_text, target_text}` atau `null` bila tidak ada
contoh nyata. Backend tidak mengarang contoh.

`pronunciation` juga memuat `fonetik` dan `suku_kata` supaya satu objek cukup.

### Lapisan bahasa kedua

Parameter opsional `target_lang` (bahasa yang dipilih di panel baca) menambah
lapisan makna kedua tanpa panggilan lain:

| Field | Isi |
|---|---|
| `bahasa_pilihan` | kode bahasa lapisan kedua |
| `arti_bahasa_pilihan` | arti dalam bahasa panel |
| `arti_lain_bahasa_pilihan` | arti alternatif bahasa panel |
| `terjemahan_lain_bahasa_pilihan` | padanan lain bahasa panel |
| `definisi_bahasa_pilihan_lain` | definisi per makna bahasa panel |

Kosong bila `target_lang` sama dengan `mother_lang` atau `lang`, karena field
yang sudah ada sudah memuat makna itu. Contoh: `word=principles&lang=en&
mother_lang=id&target_lang=es` memberi `arti_konteks: "prinsip"` dan
`arti_bahasa_pilihan: "principios"` dalam satu respons.

## 3. `POST /api/translations/interlinear/`

Body: `{"text": "...", "source_lang": "en", "target_lang": "id"}`

```json
{
  "source_text": "She reads books in the library every day.",
  "target_text": "Dia membaca buku di perpustakaan setiap hari.",
  "words": [
    {"index": 0, "source": "She", "target": "Dia", "alternatives": ["ia", "beliau"]}
  ],
  "structure": {
    "source": [{"label": "Subjek", "text": "She", "color": "subject"}],
    "target": [{"label": "Subjek", "text": "Dia", "color": "subject"}],
    "pattern": "S-P-O-K",
    "target_pattern": "S-P-O-K"
  },
  "grammar": {"tense": "Simple Present Tense (...)", "note": "...", "details": {}}
}
```

`color` bernilai `subject`, `predicate`, `object`, `adverbial`, atau `neutral`.
`words[].alternatives` bisa dipakai untuk mengganti arti per kata.

## 4. `GET /api/translations/tts/`

Parameter: `text`, `lang`, `speed` (`normal` atau `slow`). `slow` memakai mode
lambat Google. Untuk 0.5x yang lebih halus, frontend bisa memakai
`audio.playbackRate = 0.5` pada audio normal.

## 5. Cache

Semua hasil per kata dan per bahasa di-cache 7 hari. Klik berulang tidak
memanggil provider lagi. Kunci cache diberi versi; menaikkan `CACHE_VERSION`
di `enrichment.py` atau `interlinear.py` membuang hasil lama setelah deploy.
