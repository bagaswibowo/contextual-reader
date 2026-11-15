# Desain Sprint 1 — Integrasi Fitur Google Translate ke Contextual Reader

**Status:** Siap implementasi (design handoff) · **Versi:** 1.0 · **Tanggal:** 12 November 2026
**Untuk:** Front-End Developer WEB (`Reader.jsx`, `Vocabulary.jsx`, `Library.jsx`), QA Engineer
**Dari:** UI/UX Designer
**Acuan wajib:** `plan/PM-DECISION-GOOGLE-TRANSLATE-SCOPE.md` (scope) · `arch/SPEC-GOOGLE-TRANSLATE-SPRINT1.md` (kontrak API) · `ux/UI_SPEC_SPRINT0.md` (token, tipografi, a11y) · `ux/A11Y_QA_CHECKLIST.md` (ID uji)

---

## 0. Ringkasan dan batas dokumen

Dokumen ini menajamkan brainstorm `ux/GOOGLE_TRANSLATE_FEATURE_BRAINSTORM.md` menjadi spesifikasi yang bisa langsung dikerjakan, untuk tiga fitur:

| Kode | Fitur | Permukaan UI | Status scope |
|---|---|---|---|
| **F1** | Kartu Wawasan Kata | Level 2 drawer, 4 tab | Sprint 1 MVP |
| **F2** | Riwayat Cari & Simpan | Tab ketiga di `Vocabulary.jsx` | Sprint 1 MVP (**lokal**, bukan server) |
| **F3** | Badge Bahasa Buku | Kartu `Library.jsx` + toolbar `Reader` | Sprint 1 MVP |

Yang **tidak** dibahas di sini karena di luar Sprint 1: OCR/gambar, terjemahan dokumen/bab, phrasebook multi-user, mode Situs/URL, offline, handwriting.

**Batas penting F2:** PM menunda "riwayat terjemahan per user" ke Sprint 2 karena menunggu D2 (auth). Maka F2 di Sprint 1 adalah **riwayat lokal per peramban** (`localStorage`), tanpa endpoint server, tanpa sinkronisasi antar perangkat. Jangan menyebutnya "riwayat akun" di UI.

**Batas dokumen:** ini spesifikasi desain, bukan kode. Tidak ada file aplikasi yang diubah. Wireframe bersifat ASCII + tabel ukuran, bukan Figma. Angka kontras yang dikutip berasal dari Sprint 0 dan **hanya valid untuk pasangan latar yang diukur di sana** — lihat §7.3.

---

## 1. Aturan global (berlaku untuk ketiga fitur)

### 1.1 Aturan "6 blok" — cara menghitung

Sprint 0 gagal karena 15+ kontrol muncul serentak. Karena itu batas ini harus bisa diuji, bukan slogan:

| Dihitung sebagai blok | Tidak dihitung |
|---|---|
| Header kata (kata + IPA + audio + bintang + tutup) | Tab nav |
| Setiap kartu konten di tab aktif | Action bar bawah (sticky) |
| Setiap item daftar yang terlihat | Toast / snackbar |
| | Overlay & drag handle |

**Aturan:** header + maksimal **5 kartu konten** = 6 blok terlihat. Item ke-6 dan seterusnya masuk kontrol "Lihat semua (n)". Bila sebuah blok gagal dimuat, blok itu tetap dihitung (placeholder-nya terlihat).

### 1.2 Target sentuh

Semua kontrol interaktif minimal **44×44 CSS px**, termasuk area transparan di sekitar ikon (A11Y-05). Ikon visual boleh 20/24px, tapi pembungkusnya 44px. Jarak minimum antar target 8px.

### 1.3 Teks dan tipografi

| Peran | Ukuran | Berat | Line-height | Catatan |
|---|---|---|---|---|
| Judul kata (drawer) | 24px | 800 | 1.2 | font heading |
| IPA | 15px | 500 | 1.4 | mono, `--cr-text-secondary` |
| Label seksi | 11px | 700 | 1.3 | uppercase, letter-spacing 0.08em |
| Isi utama | 16px | 400 | 1.6 | **minimum** untuk teks isi |
| Isi sekunder | 14px | 400 | 1.5 | contoh, metadata |
| Chip/sinonim | 13px | 600 | 1.3 | padding 6×10px |

Tidak ada teks di bawah 13px, kecuali label seksi 11px dan kode bahasa 12px — keduanya tidak boleh menjadi satu-satunya pembawa makna.

### 1.4 Token & tema

Semua warna baru **wajib** memakai `--cr-*`. Tidak ada hex baru. Tiga tema: `:root` (light), `html.sepia`, `html.dark`.

> **Temuan handoff:** repo saat ini **belum punya** `--cr-*` (0 kemunculan di `styles/globals.css`) dan belum ada `src/styles/tokens.css`. Token di `UI_SPEC_SPRINT0.md` §2.3 masih berupa spesifikasi. Frontend harus menambahkan file token + impor sebelum komponen baru ditulis. Lihat H-1 di §11.

### 1.5 Performa & biaya LLM

- Drawer dirender **sekali** di level halaman lewat portal, bukan di dalam `tokens.map`.
- Data berat (definisi, sinonim, tata bahasa) dimuat **saat tab dibuka**, bukan saat kata diklik.
- Setiap permintaan punya `AbortController`; menutup drawer atau mengganti kata membatalkan request.
- Batas waktu 8 detik, lalu state timeout (bukan spinner abadi).
- Satu kata = satu permintaan kamus. Jangan memanggil ulang saat tab berpindah.

### 1.6 Gerak (motion)

Drawer masuk 200ms `ease-out`, tab cross-fade 120ms, toast 150ms. Semua animasi dimatikan bila `prefers-reduced-motion: reduce` (skeleton jadi statis, tanpa shimmer).

---

## 2. Peta permukaan

```text
Library card ──[F3 badge EN→ID]──┐
                                 ├── klik badge → popover bahasa target (F3)
Reader toolbar ──[F3 badge]──────┘

Reader: klik kata
   └─ Tier 1 popover (ringkas, tidak berubah struktur)
        └─ "Buka Kamus Lengkap →"
             └─ Tier 2 DictionaryDrawer (F1, 4 tab)
                  ├─ Definisi  (6 blok)
                  ├─ Contoh    (daftar dwibahasa)
                  ├─ Terjemahan(varian + frequency meter)
                  └─ Tata Bahasa (lazy)
                       └─ ★ Simpan → VocabularyEntry (+ kalimat sumber)
                            └─ muncul di tab "Riwayat" (F2)
```

---

# F1 — Kartu Wawasan Kata

## 3. Anatomi drawer

### 3.1 Ukuran dan struktur

| Bagian | Desktop ≥1024 | Tablet 768–1023 | Mobile <768 |
|---|---|---|---|
| Kontainer | Drawer kanan, lebar **440px**, tinggi 100vh | Drawer kanan 400px | Bottom sheet **72vh** |
| Header | 76px, sticky | 76px | 76px + drag handle 20px |
| Tab nav | 48px, 4 tab, sticky | 48px, scroll horizontal | 48px, scroll horizontal |
| Area konten | `overflow-y:auto`, padding 16px, gap 12px | sama | sama, padding bawah 96px |
| Action bar | 64px sticky bawah | 64px | 64px + `safe-area-inset-bottom` |
| Lebar konten | maks 100% (440−32=408px) | — | 100% |

Desktop: konten bacaan **tidak tertutup** — body diberi `padding-right: 440px` saat drawer terbuka (transisi 200ms). Mobile: bottom sheet menutupi bawah, body scroll lock (A11Y-07).

### 3.2 Header

```text
┌─────────────────────────────────────────────┐
│ traditional  /trəˈdɪʃənl/              [×]  │
│ [🔊 Inggris 44] [🔊 Indonesia 44]   [★ 44]  │
└─────────────────────────────────────────────┘
```

- Kata: 24px extrabold, maks 2 baris, `overflow-wrap:anywhere`.
- IPA dari `phonetic_ipa`; bila kosong → placeholder "—" dengan `aria-label="Fonetik tidak tersedia"`, jangan hilangkan baris (mencegah layout shift).
- Dua tombol audio berdampingan, masing-masing 44×44, ikon 20px + label bahasa 12px di bawah/samping pada desktop. Saat memutar: ikon berubah jadi "stop/equalizer" dan label berubah "Memutar…". `aria-live="polite"` (A11Y-09).
- Bintang simpan: `aria-pressed` true/false, label "Simpan kata", saat tersimpan label "Tersimpan" + konfirmasi halus (bukan toast besar).
- Tombol tutup 44×44, `aria-label="Tutup kamus"`.

### 3.3 Blok konten — urutan baku tab Definisi

Urutan ini **tetap**; jangan diacak per kata. Kolom "Sumber" adalah field kontrak API di `SPEC` §2.4.

| # | Blok | Isi | Field API | Wajib? | Bila kosong |
|---|---|---|---|---|---|
| B1 | **Arti di kalimat ini** | 1 arti utama, tebal; di bawahnya kalimat sumber dalam tanda kutip, maks 2 baris + "Lihat kalimat" | `contextual_meaning`, konteks kalimat | Ya | Sembunyikan B1, tampilkan B3 lebih dulu |
| B2 | **Varian makna** | Baris pilihan arti: chip arti + `FrequencyMeter` 3 bar + `back_translations` sebagai teks kecil saat dipilih | `translations_table[]` (`target_word`, `frequency` 1–3, `back_translations`) | Ya | Sembunyikan blok; B1 jadi satu-satunya arti |
| B3 | **Definisi & kelas kata** | `pos` sebagai label kecil, definisi 1–2 baris; maks 2 definisi terlihat | `definitions[].pos`, `.definition` | Ya | "Definisi belum tersedia." + retry inline |
| B4 | **Sinonim** | Maks 6 chip + "+n lainnya"; klik chip = cari kata itu (mengganti isi drawer) | `synonyms[]`, `definitions[].synonyms[]` | Tidak | Sembunyikan blok sepenuhnya (jangan placeholder kosong) |
| B5 | **Contoh** | Maks 2 contoh dwibahasa: sumber + terjemahan, kata kunci di-highlight; tombol audio per kalimat 44px | `examples[]` (`source_text`, `target_text`, `keyword`) | Tidak | Sembunyikan; tab Contoh menampilkan empty state |

**Blok B2 detail** — ini pengganti "tabel terjemahan" yang di Google Translate berupa daftar besar. Di layar sempit, tabel 3 kolom tidak terbaca, jadi:

```text
VARIAN MAKNA
[ tradisionil ■■■ ]  [ biasa ■■□ ]  [ adati ■□□ ]
  ↑ terpilih (border accent + aria-pressed)
  Balik: traditional, conventional, conservative
```

- `frequency` 1–3 → 3 bar. Bar penuh `--cr-text-accent`, bar kosong `--cr-border-interactive` (**bukan** `--cr-border-subtle`, karena subtle 1.25:1 gagal ambang 3:1 untuk indikator).
- Meter punya `role="img"` + `aria-label="Frekuensi 3 dari 3"`. Jangan andalkan warna saja.
- Memilih varian **tidak** memanggil API; hanya mengganti B1 dan contoh yang ditonjolkan.

**Tab lain:**

| Tab | Isi | Batas |
|---|---|---|
| Definisi | B1–B5 | 6 blok (header + 5) |
| Contoh | Semua `examples[]`, maks 6 terlihat, "Lihat semua (n)" | 6 item |
| Terjemahan | `translations_table` penuh + meter + back-translation; urut frequency desc | 6 baris |
| Tata Bahasa | `grammar_3d` (`tense`, `structure`, `role`) + audio kalimat | 3 kartu |

## 4. Wireframe F1

### 4.1 Desktop 1440×900 — tab Definisi

```text
+--------------------------------------------------------------------------+--------------------------------------------+
| [<-]  The Great Gatsby · Bab 3                              [EN -> ID]    |  traditional  /trə'dɪʃənl/           [×]  |
+--------------------------------------------------------------------------+                                            |
|                                                                          |  [🔊 Inggris]  [🔊 Indonesia]        [★]  |
|   In my younger and more vulnerable years my father gave me              +--------------------------------------------+
|   some advice that I've been turning over in my mind ever                  [Definisi] [Contoh] [Terjemahan] [Tata B.]|
|   since.                                                                 |--------------------------------------------|
|                                                                          |  ARTI DI KALIMAT INI                       |
|   "Whenever you feel like criticizing any one," he told me,              |  tradisionil                                |
|   "just remember that all the people in this world haven't               |  "...the traditional festivities..."       |
|   had the advantages that you've had."                                   |                                            |
|                                                                          |  VARIAN MAKNA                              |
|   He didn't say any more, but we've always been                          |  [tradisionil ■■■] [biasa ■■□] [adati ■□□] |
|   unusually communicative in a reserved way, and I                       |  Balik: traditional · conventional         |
|   understood that he meant a great deal more than that.                  |                                            |
|                                                                          |  KELAS KATA · adjective                    |
|   (teks tetap terlihat — drawer tidak menutupi)                          |  existing in or as part of a tradition;    |
|                                                                          |  long-established.                         |
|                                                                          |                                            |
|                                                                          |  SINONIM                                   |
|                                                                          |  [conventional] [customary] [established]  |
|                                                                          |  [orthodox] [standard]  +2 lainnya          |
|                                                                          |                                            |
|                                                                          |  CONTOH                                    |
|                                                                          |  the traditional festivities of the...     |
|                                                                          |  festival tradisional tahunan gereja       |
|                                                                          |  [🔊]                                      |
|                                                                          |                                            |
|                                                                          +--------------------------------------------+
|                                                                          | [★ Simpan kata]   👍  👎  Membantu?        |
+--------------------------------------------------------------------------+--------------------------------------------+
```

Catatan: `[EN -> ID]` di toolbar adalah F3. `👍 👎` di action bar, bukan blok konten.

### 4.2 Mobile 390×844 — bottom sheet 72vh

```text
+---------------------------------------------+
| [<-] The Great Gatsby (Bab 3)      [EN->ID] |
+---------------------------------------------+
| In my younger and more vulnerable years my  |
| father gave me some advice...               |
|                                             |
| "Whenever you feel like criticizing any     |
| one," he told me, "just remember..."        |
+---------------------------------------------+
|                  ▁▁▁▁                       |  <- drag handle 44px
| traditional  /trə'dɪʃənl/             [×]   |
| [🔊 Inggris] [🔊 Indonesia]          [★]   |
| [Definisi] [Contoh] [Terj.] [Tata B.]  ->   |  <- tab scroll horizontal
|---------------------------------------------|
| ARTI DI KALIMAT INI                         |
| tradisionil                                 |
| "...the traditional festivities..."         |
|---------------------------------------------|
| VARIAN MAKNA                                |
| [tradisionil ■■■] [biasa ■■□]               |
| [adati ■□□]                                 |
|---------------------------------------------|
| KELAS KATA · adjective                      |
| existing in or as part of a tradition;      |
| long-established.                           |
|---------------------------------------------|
| SINONIM                                     |
| [conventional] [customary]                  |
| [established] [orthodox] +2                 |
|---------------------------------------------|
| CONTOH                                      |
| the traditional festivities of the...       |
| festival tradisional tahunan gereja   [🔊]  |
|                                             |
+---------------------------------------------+
| [★ Simpan kata]        👍   👎              |  <- sticky, safe-area
+---------------------------------------------+
```

Yang terlihat: header + 5 blok = 6. Bila tinggi sheet tidak cukup, area konten scroll — jumlah blok tidak bertambah.

### 4.3 Tier 1 popover — perubahan minimal

```text
        ┌──────────────────────────────────┐
        │ traditional  /trə'dɪʃənl/   [🔊] │
        │ tradisionil                      │
        │ [★ Simpan]  [Buka Kamus ->]      │
        └────────────────┬─────────────────┘
                         ▼
        ...the traditional festivities...
```

Aturan: Tier 1 **tidak** menampilkan sinonim, contoh, atau varian. Tinggi maks 180px desktop / 220px mobile. Satu permintaan `GET /api/translations/word/` saja.

### 4.4 Tab Contoh dan Terjemahan (ringkas, mobile)

```text
+-----------------------------------+   +-----------------------------------+
| [Definisi] [Contoh] [Terj.] [Tata]|   | [Definisi] [Contoh] [Terj.] [Tata]|
|-----------------------------------|   |-----------------------------------|
| the traditional festivities       |   | adjective                         |
| of the Church year                |   | [tradisionil ■■■] 3/3             |
| festival tradisional tahunan      |   | Balik: traditional, conventional  |
| gereja                            |   |-----------------------------------|
| [🔊 Inggris] [🔊 Indonesia]       |   | adjective                         |
|-----------------------------------|   | [biasa ■■□] 2/3                   |
| the traditional drinks in the     |   | Balik: usual, regular, ordinary   |
| clubhouse                         |   |-----------------------------------|
| minuman tradisional di clubhouse  |   | adjective                         |
| [🔊 Inggris] [🔊 Indonesia]       |   | [adati ■□□] 1/3                   |
|-----------------------------------|   | Balik: traditional                |
| Lihat semua (8)                   |   | Lihat semua (4)                   |
+-----------------------------------+   +-----------------------------------+
```

## 5. State F1

Setiap state harus punya teks yang bisa dibaca dan aksi keluar. Jangan spinner tanpa akhir.

| State | Pemicu | Tampilan | Aksi |
|---|---|---|---|
| **Loading awal** | request kamus berjalan | Skeleton: 1 baris judul + 3 kartu abu (B1, B3, B4) dengan shimmer 1.4s | `Batal` di header (menggantikan ×) |
| **Loading lambat (>3s)** | masih berjalan | Tambah teks kecil "Masih memuat…" di bawah skeleton | Batal tetap ada |
| **Timeout 8s** | tidak selesai | "Definisi belum selesai dimuat." + `[Coba lagi]` + `[Tutup]`; B1/terjemahan yang sudah ada tetap tampil | Retry = 1 request baru |
| **Partial** | sebagian field gagal | Hanya blok gagal yang menampilkan "Sinonim tidak tersedia. [Coba lagi]" — blok lain normal | Retry per blok |
| **Empty (404)** | kata tidak ada | "Belum ada definisi untuk kata ini." + arti dasar bila ada + `[Coba lagi]` | Jangan tampilkan skeleton kosong |
| **Error 400/500** | respons gagal | "Definisi tidak bisa dimuat. Arti dasar tetap tersedia." + `[Coba lagi]` | Sertakan kode error kecil untuk QA |
| **Offline** | `navigator.onLine=false` | "Tidak ada koneksi. Menampilkan hasil tersimpan." bila cache ada; bila tidak: "Sambungkan internet untuk memuat definisi." | Retry otomatis saat online |
| **Dibatalkan** | drawer ditutup / kata diganti | Tidak ada UI, tidak ada toast | — |
| **Kata tersimpan** | ★ ditekan | Bintang terisi + label "Tersimpan" + teks kecil "Disimpan bersama kalimat ini" | Tekan lagi = hapus, dengan undo 5s |
| **Feedback terkirim** | 👍/👎 | Tombol `aria-pressed="true"`, toast "Masukan terkirim. [Urungkan]" 5s | Urungkan = kirim pembatalan |

## 6. Interaksi F1

| Aksi pengguna | Hasil | Fokus / pengumuman |
|---|---|---|
| Klik kata | Tier 1 popover; 1 request `word/` | Fokus tetap di kata (A11Y-04 saat ditutup) |
| `Enter` di kata | sama | — |
| "Buka Kamus Lengkap" | Tier 2 terbuka, tab Definisi, request `dictionary/` | Fokus ke header drawer; `aria-labelledby` = judul kata |
| Klik tab | Ganti panel; request hanya bila tab butuh data baru (Tata Bahasa) | `role="tab"`, `aria-selected`, panah kiri/kanan |
| `Esc` | Tutup drawer, batal request | Fokus kembali ke kata (A11Y-04) |
| Klik luar (desktop) | Tutup drawer | sama |
| Swipe down (mobile) | Tutup bila >30% tinggi | sama |
| Klik chip sinonim | Ganti kata aktif di drawer (tanpa menutup) | Umumkan "Menampilkan sinonim: conventional" |
| ★ | Simpan kata + kalimat sumber (satu request) | `aria-pressed`, live region "Kata disimpan" |
| 👍/👎 | Kirim umpan balik | `aria-pressed`, live region |

---

# F2 — Riwayat Cari & Simpan

## 7. IA dan penempatan

`Vocabulary.jsx` sekarang punya 2 tab (`list` | `flashcards`). Tambah tab ketiga: **Riwayat**.

```text
Daftar Kosakata & Review
[ Semua Kata (142) ]  [ Sesi Review ]  [ Riwayat ]
```

Tab Riwayat menggabungkan tiga hal yang sekarang tidak terjangkau:

1. Kata yang pernah dibuka di Reader (lokal).
2. Status simpan (bintang) + tujuan kembali ke kalimat asal.
3. Pencarian instan atas riwayat **dan** kosakata tersimpan.

**Bukan** yang dimaksud: sinkronisasi akun, riwayat lintas perangkat, atau riwayat terjemahan kalimat penuh. Itu Sprint 2 (D2).

## 8. Model data lokal

Kunci: `cr_lookup_history_v1` (localStorage, JSON array). Ditulis dari drawer saat kata berhasil dimuat.

```json
{
  "v": 1,
  "items": [
    {
      "id": "en:traditional:1728...",
      "word": "traditional",
      "sourceLang": "en",
      "targetLang": "id",
      "translation": "tradisionil",
      "bookId": "b_12",
      "bookTitle": "The Great Gatsby",
      "chapterIndex": 2,
      "chapterTitle": "Bab 3",
      "sentenceId": "s_8841",
      "createdAt": 1762951200000,
      "saved": true
    }
  ]
}
```

Aturan:
- Maks **50** item; buang yang paling lama (FIFO).
- Kata sama dalam **10 menit** → perbarui `createdAt`, jangan duplikat.
- `id` = `sourceLang + ":" + word.toLowerCase() + ":" + (bookId ?? "-")`.
- Tulis dengan `try/catch`; bila kuota penuh, buang 10 item tertua lalu coba lagi sekali. Jangan pernah crash karena storage.
- Data ini **tidak** dikirim ke server. Tidak ada PII.

## 9. Wireframe F2

### 9.1 Desktop 1440 — tab Riwayat

```text
+-----------------------------------------------------------------------------------+
|  Daftar Kosakata & Review                                     [🔥 12 Hari]        |
|  [ Semua Kata (142) ]   [ Sesi Review ]   [ * Riwayat * ]                         |
+-----------------------------------------------------------------------------------+
|  Cari: [ tradi____________________________________________ ]  [x]                 |
|  Filter: [ Semua ] [ Tersimpan ] [ Belum disimpan ]                               |
+-----------------------------------------------------------------------------------+
|  HARI INI                                                                         |
|  +-----------------------------------------------------------------------------+  |
|  | traditional -> tradisionil        ★   Bab 3 · The Great Gatsby · 2 mnt lalu |  |
|  | "the traditional festivities of the Church year"                     [->]   |  |
|  +-----------------------------------------------------------------------------+  |
|  | resilient -> tangguh                  Bab 3 · The Great Gatsby · 5 mnt lalu |  |
|  +-----------------------------------------------------------------------------+  |
|  KEMARIN                                                                          |
|  +-----------------------------------------------------------------------------+  |
|  | ubiquitous -> di mana-mana       ★   Bab 7 · Sapiens · 1 hari lalu         |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  [ Hapus semua riwayat ]                                                          |
+-----------------------------------------------------------------------------------+
```

### 9.2 Mobile 390 — tab Riwayat

```text
+---------------------------------------------+
| Daftar Kosakata & Review        [🔥 12]     |
| [Semua (142)] [Review] [*Riwayat*]          |
+---------------------------------------------+
| [ Cari kata atau arti...            ] [x]   |
| [Semua] [Tersimpan] [Belum]                 |
+---------------------------------------------+
| HARI INI                                    |
| +-----------------------------------------+ |
| | traditional -> tradisionil          ★   | |
| | "the traditional festivities of the     | |
| |  Church year"                           | |
| | Bab 3 · Gatsby · 2 mnt lalu        [->] | |
| +-----------------------------------------+ |
| +-----------------------------------------+ |
| | resilient -> tangguh                    | |
| | Bab 3 · Gatsby · 5 mnt lalu        [->] | |
| +-----------------------------------------+ |
| KEMARIN                                     |
| +-----------------------------------------+ |
| | ubiquitous -> di mana-mana          ★   | |
| | Bab 7 · Sapiens · 1 hari lalu      [->] | |
| +-----------------------------------------+ |
|                                             |
| [ Hapus semua riwayat ]                     |
+---------------------------------------------+
```

### 9.3 Empty state

```text
+---------------------------------------------+
|                 (ikon buku)                 |
|           Belum ada riwayat                 |
|  Kata yang kamu buka saat membaca akan      |
|  muncul di sini.                            |
|           [ Kembali membaca ]               |
+---------------------------------------------+
```

Tiga empty state berbeda, jangan digabung:
1. **Belum pernah** ada riwayat → teks di atas.
2. **Pencarian kosong** → "Tidak ada hasil untuk 'xyz'." + `[Hapus pencarian]`.
3. **Filter kosong** → "Tidak ada kata tersimpan di riwayat ini." + `[Tampilkan semua]`.

## 10. Perilaku F2

| Aksi | Hasil | Detail |
|---|---|---|
| Buka tab Riwayat | Baca localStorage, kelompokkan per hari | Tanpa request jaringan |
| Ketik di pencarian | Filter lokal, debounce **250ms** | Cocokkan `word` + `translation`; highlight kecocokan |
| Hasil <300ms | Wajib untuk 50 item | Tidak ada spinner; render langsung |
| Klik baris | Kembali ke Reader di `bookId`/`chapterIndex`/`sentenceId` | Bila buku sudah dihapus → toast "Buku tidak ditemukan" + tawarkan hapus entri |
| Klik ★ di baris | Toggle simpan kata (tanpa membuka drawer) | Optimistic, undo 5s bila menghapus |
| Klik `->` | Buka drawer kata itu langsung di Reader | Deep link internal |
| Hapus per item | Soft-remove + toast "Dihapus. [Urungkan] 5s" | Setelah 5s, hapus permanen dari storage |
| Hapus semua | Dialog konfirmasi (bukan `window.confirm`) | Wajib ketik ulang? Tidak. Cukup tombol "Hapus semua" + undo 5s |
| Filter Tersimpan | Hanya `saved: true` | Sinkron dengan status bintang di tab Semua |

**Simpan kalimat:** tidak ada tombol terpisah. Bintang di drawer menyimpan kata **dan** kalimat sumber sekaligus — `VocabularyEntry` sudah punya FK `sentence`, jadi tidak perlu skema baru. Konfirmasi di drawer: "Disimpan bersama kalimat ini".

## 11. State F2

| State | Tampilan |
|---|---|
| Loading (kosakata dari API) | 3 skeleton baris; tab Riwayat tetap bisa dibuka dari cache |
| Kosong (belum ada) | Empty state #1 |
| Pencarian kosong | Empty state #2 |
| Filter kosong | Empty state #3 |
| Storage rusak/tidak bisa dibaca | "Riwayat tidak bisa dibaca di peramban ini." + `[Mulai baru]` (hapus kunci) |
| Offline | Tetap berfungsi penuh (lokal) + badge kecil "Lokal" di header tab |

---

# F3 — Badge Bahasa Buku

## 12. Varian badge

Satu komponen, empat varian. Sumber kebenaran: `book.language` (bila ada) atau hasil `POST /detect/` (bila kosong).

| Varian | Kondisi | Tampilan | `aria-label` |
|---|---|---|---|
| **Diterjemahkan** | `source !== target` | `EN → ID` | "Bahasa buku Inggris, terjemahan ke Indonesia. Ganti bahasa target" |
| **Asli** | `source === target` | `EN · Asli` | "Bahasa buku Inggris, tanpa terjemahan. Ganti bahasa target" |
| **Belum diketahui** | `book.language` kosong | `? → ID` | "Bahasa buku belum diketahui. Akan dideteksi saat kata pertama dibuka" |
| **Rendah keyakinan** | confidence < 0.6 | `EN? → ID` | "Bahasa buku kemungkinan Inggris. Deteksi belum yakin" |

Aturan visual:
- Tinggi chip **28px**, padding 4×8, radius 999px, font 12px mono 700 uppercase.
- Pembungkus tombol **44×44** (touch target), chip di tengah.
- Warna: teks `--cr-text-secondary`, latar `--cr-bg-surface`, border 1px `--cr-border-subtle`. Tidak memakai warna status baru.
- Kode bahasa maks 5 karakter; bila lebih → tampilkan kode ISO 2 huruf.
- Jangan gunakan warna sebagai satu-satunya pembeda varian — teks (`Asli`, `?`, `?`) wajib ada.

## 13. Penempatan

### 13.1 Kartu Library

```text
+---------------------------------------+
| [EPUB] [EN -> ID]              [🗑]   |
| The Great Gatsby                      |
| F. Scott Fitzgerald                   |
| 12 Bab · 48.200 Kata                  |
| [==================--------]  35%     |
| [ Lanjutkan Membaca (Bab 3) -> ]      |
+---------------------------------------+
```

- Posisi: baris pertama, setelah badge format, sebelum tombol hapus.
- Bila tidak muat (kartu sempit), badge turun ke baris kedua — jangan truncate jadi "…".
- Tinggi kartu **tidak boleh bertambah**; bila perlu, badge menggantikan badge `EN` lama (bukan ditambah).
- Di mobile 2 kolom kartu, badge tetap 1 baris; `→` boleh menjadi `>` pada lebar <120px.

### 13.2 Toolbar Reader

```text
+--------------------------------------------------------------------------+
| [<-]  The Great Gatsby · Bab 3                 [EN -> ID]  [TOC] [Aa]     |
+--------------------------------------------------------------------------+
```

- Mobile: badge hanya `EN→ID`, tanpa teks tambahan, tetap 44×44.
- Bila target diganti, badge berubah **tanpa reload**.
- Bila `book.language` kosong, badge `? → ID`; setelah kata pertama diklik dan deteksi sukses, badge berubah dengan animasi 150ms.

## 14. Popover pemilih bahasa target

Dibuka dari badge mana pun. Ini satu-satunya tempat mengganti bahasa target di Reader.

```text
+----------------------------------+
| Bahasa target                    |
| [ cari bahasa...            ]    |
|----------------------------------|
| (o) Indonesia              ID    |
| ( ) English                EN    |
| ( ) Español                ES    |
| ( ) 日本語                  JA    |
|----------------------------------|
| Berlaku untuk kata berikutnya.   |
| [ Terapkan ]        [ Batal ]    |
+----------------------------------+
```

- Baris 44px, radio `role="radiogroup"`, panah atas/bawah, `Esc` menutup, fokus kembali ke badge.
- Default: **Indonesia**. Pilihan disimpan di `localStorage` `cr_target_lang_v1` (bukan server).
- Bila drawer sedang terbuka dan target diganti: **jangan** auto-refetch. Tampilkan strip di atas konten: "Bahasa target diganti ke English. [Muat ulang]" — mencegah biaya LLM tak terduga.
- Daftar bahasa dibatasi yang didukung backend; jangan tampilkan 100 bahasa. Usulan Sprint 1: `id, en, es, fr, de, ja, ko, zh, ar, ru` (10).

## 15. State F3

| State | Tampilan |
|---|---|
| `book.language` ada | Badge varian 1/2 |
| `book.language` kosong | `? → ID`, tooltip teks |
| Deteksi gagal | Tetap `? → ID`, tanpa error banner (jangan ganggu membaca) |
| Target diganti | Badge update langsung; toast "Bahasa target: English" |
| Buku tanpa bab / gagal muat | Badge tetap tampil; tidak bergantung data bab |

---

## 16. Matriks tiga tema

Nilai kontras diambil dari `UI_SPEC_SPRINT0.md` §2.2. **Yang diukur di sana adalah teks terhadap background halaman**, bukan terhadap surface. Karena drawer memakai `--cr-bg-surface`, rasio harus diukur ulang (§7.3).

| Elemen | Light | Sepia | Dark | Pasangan token |
|---|---|---|---|---|
| Latar drawer | `#F8FAFC` | `#F4E8D1` | `#1A242B` | `--cr-bg-surface` |
| Latar kartu di dalam drawer | `#FFFFFF` | `#F7EDE0` | `#222E37` | `--cr-bg-surface-elevated` |
| Judul kata | `#0F172A` | `#2E1E11` | `#F8FAFC` | `--cr-text-primary` |
| IPA / metadata | `#475569` | `#684F38` | `#94A3B8` | `--cr-text-secondary` |
| Arti utama / chip aktif | `#1B6A27` | `#1E6328` | `#5BE22B` | `--cr-text-accent` |
| Border kartu | `#E2E8F0` | `#E5D5BF` | `#2D3748` | `--cr-border-subtle` |
| Border chip interaktif | `#64748B` | `#8C6D4F` | `#64748B` | `--cr-border-interactive` |
| Bar frequency penuh | `#1B6A27` | `#1E6328` | `#5BE22B` | `--cr-text-accent` |
| Bar frequency kosong | `#64748B` | `#8C6D4F` | `#64748B` | `--cr-border-interactive` |
| Cincin fokus | `#0284C7` | `#A04A00` | `#38BDF8` | `--cr-ring-focus` |
| Highlight kata kunci | `rgba(254,240,138,.55)` | `rgba(235,213,160,.70)` | `rgba(30,58,95,.65)` | `--cr-highlight-sentence` |
| Tombol primer (★/Terapkan) | `#22752B` / teks `#FFF` | `#2D6632` / `#FFF` | `#22752B` / `#FFF` | `--cr-btn-primary-*` |

### 16.1 Wireframe tema (render map, bukan warna baru)

```text
LIGHT                          SEPIA                          DARK
+------------------------+     +------------------------+     +------------------------+
| #F8FAFC surface        |     | #F4E8D1 surface        |     | #1A242B surface        |
| traditional  #0F172A   |     | traditional  #2E1E11   |     | traditional  #F8FAFC   |
| /trə'dɪʃənl/ #475569   |     | /trə'dɪʃənl/ #684F38   |     | /trə'dɪʃənl/ #94A3B8   |
| tradisionil  #1B6A27   |     | tradisionil  #1E6328   |     | tradisionil  #5BE22B   |
| [card #FFFFFF]         |     | [card #F7EDE0]         |     | [card #222E37]         |
| border #E2E8F0         |     | border #E5D5BF         |     | border #2D3748         |
| [★ #22752B / #FFF]     |     | [★ #2D6632 / #FFF]     |     | [★ #22752B / #FFF]     |
+------------------------+     +------------------------+     +------------------------+
```

Aturan: tidak ada `bg-white` / `dark:bg-dark-card` di komponen baru. Semua lewat token, supaya sepia tidak bercak putih seperti Sprint 0.

### 16.2 Kontras yang wajib diukur ulang (blokir handoff)

| Pasangan baru | Ambang | Catatan |
|---|---|---|
| `--cr-text-accent` di `--cr-bg-surface` | ≥4.5:1 | Sprint 0 mengukur di `#FFFFFF`; surface light `#F8FAFC` sedikit lebih gelap |
| `--cr-text-secondary` di `--cr-bg-surface` | ≥4.5:1 | idem |
| Teks chip di `--cr-bg-surface-elevated` | ≥4.5:1 | kartu di dalam drawer |
| Bar kosong vs bar penuh | ≥3:1 | indikator non-teks |
| Badge `EN→ID` di kartu Library | ≥4.5:1 | kartu punya gradient/overlay |
| Cincin fokus di surface | ≥3:1 | fokus di dalam drawer, bukan di halaman |

Design tidak boleh klaim PASS sebelum diukur. QA: catat 6 pasangan ini per tema di gate.

---

## 17. Responsif, z-index, dan lapisan

| Breakpoint | F1 drawer | F2 tab | F3 badge |
|---|---|---|---|
| <768 (390) | Bottom sheet 72vh, drag handle, tab scroll | 1 kolom, pencarian sticky | chip 28px dalam target 44px |
| 768–1023 | Drawer 400px | 2 kolom kartu riwayat | 1 baris |
| ≥1024 (1440) | Drawer 440px, konten bergeser | 2 kolom + panel detail opsional | 1 baris |

Z-index: Tier 1 popover `40` · overlay drawer `60` · drawer `61` · popover bahasa `65` · toast `70`. Jangan memakai angka acak.

Mobile: `padding-bottom: env(safe-area-inset-bottom)` pada action bar dan sheet.

---

## 18. Aksesibilitas — pemetaan ke ID yang ada

| ID | Berlaku untuk | Tambahan spesifik Sprint 1 |
|---|---|---|
| A11Y-01 | Reader | Tidak berubah; drawer tidak boleh menambah kata `tabindex=0` |
| A11Y-02 | Drawer, popover bahasa | Focus trap di keduanya |
| A11Y-03 | Drawer | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = judul kata |
| A11Y-04 | Popover → kata | Wajib; termasuk saat drawer ditutup lewat swipe |
| A11Y-05 | Semua ikon F1/F3 | Audio, ★, ×, 👍/👎, badge, tab |
| A11Y-06 | Kata inline | Tidak berubah |
| A11Y-07 | Drawer mobile | Body scroll lock, zero layout jump |
| A11Y-08 | Semua ikon | Label menyebut bahasa: "Dengarkan pengucapan traditional dalam bahasa Inggris" |
| A11Y-09 | Audio ganda | Satu live region, sebut bahasa yang diputar |
| A11Y-10 | 3 tema | Termasuk teks chip & badge |
| A11Y-11 | 3 tema | Termasuk bar frequency kosong & border chip |
| A11Y-12 | Drawer | Fokus terlihat di dalam drawer, bukan hanya halaman |

**Usulan tambahan untuk QA (tidak mengubah nomor lama):**

| ID baru | Komponen | Kriteria |
|---|---|---|
| `A11Y-13` | Status loading drawer | Ada `aria-live="polite"` yang mengumumkan "Memuat definisi" dan "Definisi dimuat"; tidak mengumumkan per skeleton |
| `A11Y-14` | Tombol toggle (★, 👍, 👎) | `aria-pressed` berubah dan diumumkan; tidak ada toggle yang hanya mengandalkan warna |
| `A11Y-15` | Tab drawer | `role="tablist"`, panah kiri/kanan, `aria-controls`, panel `role="tabpanel"` |

---

## 19. Rencana komponen & props (untuk Front-End Developer WEB)

Mengikuti dekomposisi di `SPEC` §4, dengan tambahan yang dibutuhkan F2/F3.

```text
frontend/src/components/dictionary/
├── DictionaryDrawer.jsx      # portal sekali di level halaman; state buka/tutup
├── DrawerHeader.jsx          # kata, IPA, dual audio, ★, ×
├── DrawerTabsNav.jsx         # 4 tab, roving tabindex
├── DrawerActionBar.jsx       # ★ simpan + 👍/👎 (BARU)
├── tabs/
│   ├── DefinitionTab.jsx     # B1–B5
│   ├── ExamplesTab.jsx
│   ├── TranslationsTab.jsx
│   └── Grammar3dTab.jsx
└── widgets/
    ├── SynonymBadgeCloud.jsx
    ├── FrequencyMeter.jsx
    ├── WordAudioButton.jsx
    ├── MeaningVariantRow.jsx (BARU)
    └── DrawerSkeleton.jsx    (BARU)

frontend/src/components/language/
├── BookLanguageBadge.jsx     (BARU)
└── TargetLanguagePopover.jsx (BARU)

frontend/src/components/history/
├── LookupHistoryTab.jsx      (BARU)
├── HistoryRow.jsx            (BARU)
└── HistoryEmptyState.jsx     (BARU)
```

| Komponen | Props inti | Event |
|---|---|---|
| `DictionaryDrawer` | `open, word, sourceLang, targetLang, contextSentence, entry, status` | `onClose, onRetry, onSave, onFeedback, onSelectVariant` |
| `DrawerHeader` | `word, ipa, audioUrl, saved, playingLang` | `onPlay(lang), onToggleSave, onClose` |
| `DrawerTabsNav` | `active, tabs, loadingTabs` | `onChange(tab)` |
| `DefinitionTab` | `entry, status, variant, blockErrors` | `onSelectVariant, onRetryBlock(id), onOpenWord(word)` |
| `FrequencyMeter` | `value (1–3), max=3` | — |
| `MeaningVariantRow` | `variants[], selected` | `onSelect` |
| `BookLanguageBadge` | `sourceLang, targetLang, confidence, variant` | `onOpenSelector(anchorRect)` |
| `TargetLanguagePopover` | `open, value, languages[]` | `onApply(lang), onClose` |
| `LookupHistoryTab` | `items[], query, filter` | `onOpenItem, onToggleSave, onDelete, onClearAll` |

Aturan implementasi:
- `DictionaryDrawer` dirender **sekali** di `Reader.jsx` (di luar `tokens.map`).
- `status` = `idle | loading | partial | timeout | empty | error | offline`.
- Jangan menyimpan token/API key di localStorage untuk fitur ini.
- Jangan memanggil API dari dalam item daftar; hanya dari drawer.

---

## 20. Kriteria penerimaan desain

### 20.1 F1 — Kartu Wawasan Kata

| ID | Kriteria (harus bisa diuji) | Cara uji |
|---|---|---|
| **AC-WI-01** | Tab Definisi menampilkan maksimal 6 blok terlihat: header + 5 kartu konten (B1–B5, yang kosong disembunyikan). | Hitung blok visual di 1440, 768, 390. |
| **AC-WI-02** | Urutan blok selalu B1→B5; tidak berubah antar kata. | Buka 5 kata berbeda, bandingkan urutan. |
| **AC-WI-03** | Tier 1 tidak pernah memuat sinonim, contoh, atau varian; tinggi ≤180px desktop / ≤220px mobile. | Ukur bounding box. |
| **AC-WI-04** | Drawer desktop 440px, mobile 72vh; konten bacaan tidak tertutup di desktop. | Screenshot 1440 & 390. |
| **AC-WI-05** | Semua kontrol (audio, ★, ×, tab, 👍/👎, chip sinonim) ≥44×44 CSS px. | Ukur tiap target. |
| **AC-WI-06** | Audio ganda: dua tombol terpisah, label bahasa terlihat, status memutar berbeda per bahasa. | Klik masing-masing, cek `aria-live`. |
| **AC-WI-07** | `FrequencyMeter` menampilkan 3 bar; nilai 1–3 sesuai `translations_table.frequency`; ada label teks untuk screen reader. | Cek 3 kata dengan frequency berbeda. |
| **AC-WI-08** | Bar kosong memakai `--cr-border-interactive`, bukan `--cr-border-subtle`. | Inspeksi computed style. |
| **AC-WI-09** | Memilih varian makna mengganti B1 + contoh tanpa request jaringan baru. | Network tab: 0 request. |
| **AC-WI-10** | State loading memakai skeleton, bukan spinner penuh; ada tombol Batal. | Throttle network ke Slow 3G. |
| **AC-WI-11** | Timeout pada 8 detik menampilkan teks + `[Coba lagi]`, bukan spinner abadi. | Blokir endpoint >8s. |
| **AC-WI-12** | Kegagalan satu blok (mis. sinonim) tidak menghapus blok lain; retry per blok. | Mock 500 hanya untuk sinonim. |
| **AC-WI-13** | 404 menampilkan "Belum ada definisi untuk kata ini." dan arti dasar tetap ada bila tersedia. | Cari kata nonsens. |
| **AC-WI-14** | Menutup drawer membatalkan request; tidak ada toast error setelah ditutup. | Tutup saat loading, cek console/network. |
| **AC-WI-15** | ★ menyimpan kata **dan** kalimat sumber dalam satu aksi; status `aria-pressed` berubah. | Simpan, cek `VocabularyEntry` punya `sentence`. |
| **AC-WI-16** | 👍/👎 satu ketukan, `aria-pressed`, bisa diurungkan dalam 5s; tidak memblokir alur baca. | Klik, tunggu, cek antrean. |
| **AC-WI-17** | Drawer dirender tepat satu kali di DOM, di luar loop kata. | Cari `role="dialog"` di DOM; harus 1. |
| **AC-WI-18** | Tidak ada teks di bawah 13px selain label seksi 11px & kode bahasa 12px. | Inspeksi font-size semua node teks. |

### 20.2 F2 — Riwayat Cari & Simpan

| ID | Kriteria | Cara uji |
|---|---|---|
| **AC-RS-01** | Tab ketiga "Riwayat" ada di `Vocabulary.jsx`, tidak menggantikan tab lama. | Buka halaman. |
| **AC-RS-02** | Riwayat tersimpan di `localStorage` `cr_lookup_history_v1`, maks 50, FIFO. | Buka 55 kata, cek panjang array. |
| **AC-RS-03** | Kata sama dalam 10 menit tidak menghasilkan duplikat. | Buka kata sama 3×, cek 1 entri. |
| **AC-RS-04** | Dikelompokkan "Hari ini / Kemarin / tanggal", urut terbaru dulu. | Cek dengan data 3 hari. |
| **AC-RS-05** | Pencarian debounce 250ms, hasil <300ms untuk 50 item, tanpa spinner. | Ukur waktu render. |
| **AC-RS-06** | Tiga empty state berbeda muncul pada kondisi yang benar. | Uji: kosong, query tanpa hasil, filter tanpa hasil. |
| **AC-RS-07** | Klik baris kembali ke bab + kalimat asal; buku terhapus menghasilkan toast, bukan halaman error. | Hapus buku lalu klik entri. |
| **AC-RS-08** | Hapus per item & hapus semua punya undo 5s; tidak memakai `window.confirm`. | Uji keduanya. |
| **AC-RS-09** | ★ di baris menyimpan tanpa membuka drawer dan sinkron dengan tab Semua. | Toggle, pindah tab. |
| **AC-RS-10** | localStorage rusak/penuh tidak membuat halaman crash; muncul state "tidak bisa dibaca". | Isi kunci dengan JSON invalid. |
| **AC-RS-11** | Tidak ada request jaringan dari tab Riwayat. | Network tab saat buka tab & ketik. |
| **AC-RS-12** | Tidak ada data pribadi/token di localStorage fitur ini. | Inspeksi isi kunci. |

### 20.3 F3 — Badge Bahasa Buku

| ID | Kriteria | Cara uji |
|---|---|---|
| **AC-BB-01** | Empat varian badge tampil sesuai kondisi (diterjemahkan, asli, belum diketahui, keyakinan rendah). | Mock 4 buku. |
| **AC-BB-02** | Badge terlihat di kartu Library tanpa menambah tinggi kartu. | Bandingkan tinggi kartu sebelum/sesudah. |
| **AC-BB-03** | Badge di toolbar Reader terlihat tanpa membuka menu. | Screenshot 1440/390. |
| **AC-BB-04** | Mengganti bahasa target mengubah badge tanpa reload halaman. | Ganti target, amati. |
| **AC-BB-05** | Target tersimpan di `cr_target_lang_v1` dan bertahan setelah reload. | Reload. |
| **AC-BB-06** | Pilihan "Asli" (target = sumber) menghentikan panggilan terjemahan untuk kata berikutnya. | Network tab. |
| **AC-BB-07** | Mengganti target saat drawer terbuka **tidak** auto-refetch; muncul strip "Muat ulang". | Ganti target di tengah drawer. |
| **AC-BB-08** | Badge & popover ≥44×44 target, `aria-label` menyebut bahasa sumber dan target. | Ukur + screen reader. |
| **AC-BB-09** | Kode bahasa >5 karakter dipendekkan ke ISO 2 huruf, tidak terpotong ellipsis. | Mock bahasa panjang. |
| **AC-BB-10** | Deteksi gagal tidak menampilkan error banner di Reader. | Mock 503 detect. |

### 20.4 Lintas fitur

| ID | Kriteria | Cara uji |
|---|---|---|
| **AC-X-01** | Tidak ada hex warna baru di komponen F1–F3; semua lewat `--cr-*`. | Grep `#[0-9a-f]{3,6}` di folder baru. |
| **AC-X-02** | Ketiga tema (light/sepia/dark) tidak menampilkan bercak putih di drawer, kartu riwayat, atau badge. | Screenshot 3 tema × 3 fitur. |
| **AC-X-03** | Enam pasangan kontras di §16.2 diukur dan lulus ambang. | Axe/CCA, catat per tema. |
| **AC-X-04** | `prefers-reduced-motion` mematikan shimmer & transisi drawer. | Emulasi media. |
| **AC-X-05** | Tidak ada `outline: none` tanpa pengganti di komponen baru. | Grep CSS. |
| **AC-X-06** | Tidak ada kata/frasa Inggris yang tidak diterjemahkan di UI (kecuali istilah linguistik: IPA, adjektiva). | Review teks. |

---

## 21. Handoff: item yang harus diselesaikan sebelum/selama implementasi

| ID | Item | Pemilik | Kenapa penting |
|---|---|---|---|
| **H-1** | `src/styles/tokens.css` belum ada; `--cr-*` 0 kemunculan di repo. Tambahkan + impor di `globals.css`. | Frontend | Tanpa ini semua spesifikasi warna tidak bisa dipatuhi |
| **H-2** | `--cr-bg-page` (`#12181B`) ≠ `dark.bg` Tailwind (`#131F24`). Pilih satu. | Frontend + UI/UX | Perbedaan 1 shade membuat lapisan drawer terlihat "mengambang" di dark |
| **H-3** | Endpoint umpan balik 👍/👎 tidak ada di `SPEC` §2. Hanya ada di scope PM. | Backend + PM | AC-WI-16 tidak bisa lulus penuh; desain menyiapkan antrean lokal sebagai fallback |
| **H-4** | Sumber label register (netral/formal/informal) tidak ada di kontrak API. | Backend + Arsitek | B2 hanya menampilkan chip arti; label register ditunda sampai field tersedia |
| **H-5** | Atribusi `source` definisi (kamus vs LLM) belum diputuskan. | PM | Mempengaruhi teks kredit kecil di drawer (belum digambar) |
| **H-6** | `book.language` bisa kosong pada buku lama; backfill atau deteksi saat buka. | Backend + Frontend | Varian `? → ID` harus benar, bukan crash |
| **H-7** | Daftar 10 bahasa yang didukung harus disepakati dengan backend. | Arsitek + Backend | Popover target tidak boleh menawarkan bahasa yang gagal |
| **H-8** | `VocabularyEntry` sudah punya FK `sentence` — konfirmasi tidak perlu migrasi untuk "simpan kalimat". | Backend | Menghindari pekerjaan skema yang tidak perlu |

**Pertanyaan terbuka (maks 5, untuk PM/owner):**
1. Apakah umpan balik 👍/👎 masuk Sprint 1 walau belum ada endpoint, atau ditunda? (H-3)
2. Boleh menambah 10 bahasa target di Sprint 1, atau hanya ID + EN dulu? (H-7)
3. Riwayat lokal 50 entri cukup, atau perlu 100? (biaya storage kecil, tapi daftar jadi panjang)
4. Untuk badge, "Asli" (tanpa terjemahan) perlu jadi pilihan, atau target selalu Indonesia?
5. Apakah label register (formal/informal) wajib di Sprint 1? Bila ya, backend harus menambah field. (H-4)

---

## 22. Batas dokumen & status

- Ini **spesifikasi desain siap implementasi**, bukan implementasi. Tidak ada kode aplikasi yang diubah.
- Semua wireframe ASCII; belum ada Figma/prototipe interaktif.
- Angka ukuran (440px, 72vh, 44px, 8s, 250ms, 50 entri) adalah keputusan desain final untuk Sprint 1; perubahan harus lewat review UI/UX.
- Kontras untuk permukaan baru **belum diukur** — hanya pasangan lama dari Sprint 0 yang terverifikasi. Lihat §16.2.
- Perilaku nyata (screen reader, swipe iOS/Android, keyboard trap di drawer) belum diuji perangkat — tugas QA di gate.
- F2 sengaja lokal; jangan diklaim sebagai fitur akun. Sinkronisasi menunggu D2.
