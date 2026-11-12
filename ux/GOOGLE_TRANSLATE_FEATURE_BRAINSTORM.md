# Brainstorm Integrasi Fitur Google Translate → Contextual Reader
**Untuk:** PM (dipecah jadi tiket BMAD) · **Dari:** UI/UX Designer  
**Status:** Draf brainstorm, belum komitmen scope · **Tanggal:** 12 November 2026  
**Lampiran acuan:** `image.png` (tangkapan Google Translate, EN→ID, kata "traditional")

---

## 1. Apa yang benar-benar terlihat di gambar

Saya hanya menyimpulkan dari elemen yang tampak, bukan menebak isi yang tidak terbaca:

| Elemen | Isi |
|---|---|
| Merek | Google Terjemahan |
| Tab mode | **Teks · Gambar · Dokumen · Situs** |
| Bahasa | Sumber Inggris, target Indonesia, ada pemilih bahasa + tombol tukar |
| Input | Kata tunggal: `traditional` |
| Output | `tradisional` |
| Panel kanan | **"Definisi traditional"** — kelas kata, daftar definisi, sinonim, contoh pemakaian |
| Kontrol umum | Tombol dengar (audio), salin, simpan, riwayat, umpan balik terjemahan |

Fitur lain Google Translate yang **tidak terlihat jelas** di gambar saya tandai "(standar GT)" agar tidak dianggap bukti dari tangkapan layar.

---

## 2. Inventaris fitur dan keputusan untuk Contextual Reader

Kolom **Keputusan** memakai: **Adopt** (ambil apa adanya), **Adapt** (ambil idenya, ubah untuk konteks baca), **Skip** (tidak relevan).

| # | Fitur Google Translate | Nilai untuk pembaca Contextual Reader | Keputusan |
|---|---|---|---|
| GT-01 | Definisi + kelas kata + sinonim + contoh | Pembaca sering butuh "arti ini apa" tanpa keluar dari halaman. Saat ini Level 2 hanya punya makna kontekstual, belum sinonim/contoh. | **Adapt** → blok "Definisi & Sinonim" di tab Kosakata |
| GT-02 | Terjemahan alternatif / variasi makna | Satu kata bisa punya 2–3 arti; pengguna perlu memilih yang cocok dengan kalimat. | **Adapt** → daftar varian dengan label konteks |
| GT-03 | Audio sumber + audio target | Sudah ada di popup, tapi tersebar dan ikonnya kecil. | **Adopt** → satu baris audio ganda, target 44×44 |
| GT-04 | Simpan ke frasa / phrasebook | Sudah setara "Pelajari" (vocabulary). Bedanya GT menyimpan **kalimat** juga. | **Adapt** → simpan kata **dan** kalimat sumbernya |
| GT-05 | Riwayat terjemahan | Berguna untuk "tadi kata apa ya". Saat ini tidak ada. | **Adapt** → riwayat pencarian kata + posisi baca |
| GT-06 | Deteksi bahasa otomatis + tukar bahasa | Buku sudah punya `language`; yang belum: indikator jelas "buku ini Inggris, terjemahan ke Indonesia". | **Adapt** → badge bahasa di toolbar, bukan auto-detect |
| GT-07 | Terjemahan instan saat mengetik | Cocok untuk kotak pencarian kosakata, bukan untuk membaca. | **Adapt** → pencarian kosakata dengan hasil langsung |
| GT-08 | Mode **Gambar** (OCR kamera) | Pembaca buku fisik bisa memotret halaman lalu lanjut membaca di app. Fitur besar, nilai tinggi, biaya tinggi. | **Adapt (fase lanjut)** |
| GT-09 | Mode **Dokumen** (unggah file) | Sudah ada unggah EPUB/PDF/TXT. Yang belum: "terjemahkan seluruh bab". | **Adapt** → terjemahan bab on-demand, bukan otomatis |
| GT-10 | Mode **Situs** (terjemahkan halaman web) | Di luar produk; app ini pembaca buku, bukan browser. | **Skip** |
| GT-11 | Umpan balik "terjemahan ini membantu?" | Sinyal kualitas untuk memperbaiki prompt/LLM dan menandai kata bermasalah. | **Adapt** → 👍/👎 kecil di drawer, tanpa teks bebas |
| GT-12 | Bahasa offline | Butuh model lokal; di luar kapasitas sekarang. | **Skip (sampai ada kebutuhan nyata)** |
| GT-13 | Input tulisan tangan | Tidak relevan untuk membaca. | **Skip** |
| GT-14 | Varian formal/informal & gender | Relevan untuk pembelajar (mis. Anda/kamu). | **Adapt** → label register di varian makna |

---

## 3. Tiga ide yang paling layak lebih dulu

### Ide A — "Kartu wawasan kata" (gabungan GT-01, GT-02, GT-03, GT-14)
Level 1 tetap ringkas (arti + audio). Yang berubah: tab **Kosakata** di Level 2 mendapat urutan baca yang jelas, bukan tumpukan kotak:

```
┌ Drawer: resilient ─────────────────────────────┐
│ resilient  /rɪˈzɪl.jənt/        [🔊 asal] [🔊 ID]│
│                                                 │
│ ARTI DI KALIMAT INI                             │
│ "tangguh, tidak mudah menyerah"                 │
│                                                 │
│ KELAS KATA   adjektiva                          │
│ VARIAN       tangguh · ulet · liat  (register: netral)│
│ SINONIM      tough · sturdy · hardy             │
│ CONTOH       "a resilient economy"              │
│                                                 │
│ [ Simpan kata ]   [ Simpan kalimat ]            │
│ 👍 👎  Terjemahan ini membantu?                 │
└─────────────────────────────────────────────────┘
```

Aturan desain: maksimal **6 blok** terlihat, sisanya lipat ("Lihat semua sinonim"). Ini menjaga pelajaran dari Sprint 0: jangan ulang bottom sheet 15 kontrol.

### Ide B — "Riwayat cari & simpan" (GT-04, GT-05, GT-07)
Satu tempat untuk tiga hal yang sekarang tersebar: kata yang pernah diklik, kalimat yang disimpan, dan posisi baca terakhir.

```
Kosakata
[ Semua (142) ] [ Riwayat (38) ] [ Sesi Review ]
Cari: [ tradi________ ]  → hasil muncul saat mengetik
─────────────────────────────────────────────
Hari ini
  traditional → tradisional   · Bab 3 · 2 menit lalu
  resilient   → tangguh       · Bab 3 · 5 menit lalu
Kemarin
  ...
```

### Ide C — "Pindai halaman" (GT-08) — fase lanjut
Kamera → OCR → teks masuk sebagai "bacaan sementara" yang bisa diklik per kata, lalu bisa disimpan sebagai buku. Ini fitur pembeda besar, tapi butuh izin kamera, unggah gambar, dan biaya OCR. Jangan masuk Sprint 2.

---

## 4. Prioritas (usulan, bukan keputusan)

| Prioritas | Item | Alasan | Perkiraan usaha desain | Perkiraan usaha engineering |
|---|---|---|---|---|
| **P0** | Ide A: definisi, sinonim, varian, audio ganda, feedback | Langsung menutup celah "arti kontekstual saja" dan memakai drawer yang sudah ada | 2–3 hari | 4–6 hari |
| **P1** | Ide B: riwayat + pencarian instan + simpan kalimat | Memanfaatkan data yang sudah ada; tidak perlu model baru | 2 hari | 3–4 hari |
| **P1** | Indikator bahasa buku (GT-06) | Mencegah salah paham "kenapa terjemahannya aneh" | 0,5 hari | 0,5 hari |
| **P2** | Terjemahan bab on-demand (GT-09) | Berguna, tapi mahal dan lambat; butuh antrean | 2 hari | 5–8 hari |
| **P2** | Pindai halaman / OCR (GT-08) | Nilai tinggi, risiko & biaya tinggi | 4–5 hari | 10+ hari |
| **Skip** | Mode Situs, offline, tulisan tangan | Di luar produk | — | — |

---

## 5. Irisan BMAD (siap dijadikan epic/story oleh PM)

Format: **Epic → Story → Kriteria penerimaan desain**. Ini bukan tiket final; PM yang menetapkan sprint dan estimasi.

### Epic GT-A — Word Insight Card
- **GT-A1** Tampilkan blok Definisi + kelas kata di tab Kosakata.
  - Diterima bila: maksimal 6 blok terlihat; teks ≥16px; kontras ≥4,5:1 di 3 tema; tidak menambah scroll horizontal.
- **GT-A2** Tampilkan varian makna dengan label register (netral/formal/informal).
  - Diterima bila: setiap varian bisa dipilih untuk mengganti arti utama; pilihan tersimpan per kata.
- **GT-A3** Audio ganda (kata asal + terjemahan) dalam satu baris.
  - Diterima bila: dua target ≥44×44; status putar terlihat; `aria-label` menyebut bahasa.
- **GT-A4** Umpan balik 👍/👎 per kata.
  - Diterima bila: satu ketukan, ada konfirmasi halus, tidak memblokir alur baca, bisa dibatalkan.

### Epic GT-B — Lookup History & Phrasebook
- **GT-B1** Riwayat kata yang pernah dibuka, dikelompokkan per hari.
  - Diterima bila: 50 entri terakhir, bisa dihapus per item, ada empty state.
- **GT-B2** Pencarian kosakata dengan hasil saat mengetik (debounce 250ms).
  - Diterima bila: hasil muncul <300ms untuk data lokal; ada status "tidak ditemukan".
- **GT-B3** Simpan kalimat sumber bersama kata.
  - Diterima bila: kalimat tampil di kartu kosakata; bisa dibuka kembali ke bab asal.

### Epic GT-C — Language Clarity
- **GT-C1** Badge bahasa buku + bahasa target di toolbar.
  - Diterima bila: terlihat tanpa membuka menu; berubah saat pengguna mengganti bahasa target.

### Epic GT-D — Chapter Translation (P2)
- **GT-D1** Tombol "Terjemahkan bab ini" dengan progres dan pembatalan.
  - Diterima bila: tidak memblokir membaca; hasil bisa disembunyikan; biaya per bab ditampilkan sebagai perkiraan.

### Epic GT-E — Scan a Page (P2)
- **GT-E1** Ambil foto halaman → OCR → buka sebagai bacaan sementara.
  - Diterima bila: ada pratinjau sebelum diproses; izin kamera diminta dengan alasan jelas; gambar tidak disimpan permanen tanpa persetujuan.

---

## 6. Batasan desain yang tidak boleh dilanggar

1. **Jangan ulang kesalahan Sprint 0:** Level 1 tetap 1 kartu ringkas; semua fitur baru masuk Level 2, bukan muncul serentak.
2. **Target sentuh 44×44** untuk semua ikon audio, simpan, dan umpan balik.
3. **Kontras** memakai token `--cr-*` yang sudah ada; jangan tambah warna baru tanpa hitung rasio.
4. **Tiga tema** (light/sepia/dark) wajib diuji untuk setiap blok baru.
5. **Tidak ada modal di dalam loop kata.** Drawer dirender sekali di level halaman (portal), bukan per token.
6. **Biaya LLM terlihat:** fitur yang memanggil model (definisi, sinonim, terjemahan bab) harus punya status loading, batas waktu, dan tombol batal.

---

## 7. Risiko

| Risiko | Dampak | Mitigasi desain |
|---|---|---|
| Biaya LLM membengkak | Tagihan naik, fitur dimatikan mendadak | Muat definisi/sinonim on-demand; cache per kata; tampilkan "perkiraan biaya" untuk terjemahan bab |
| Latensi | Drawer terasa kosong | Skeleton + batas waktu 8 detik + tombol "coba lagi" |
| Kualitas terjemahan buruk | Pengguna salah belajar | Tampilkan varian, bukan satu jawaban; sediakan 👍/👎 |
| `custom_base_url` / SSRF | 400 atau celah keamanan | Fitur baru memakai engine yang sudah diizinkan; jangan menambah input URL bebas |
| Privasi kamera (OCR) | Foto halaman tersimpan tanpa izin | Pratinjau + hapus otomatis setelah diproses |
| Riwayat menumpuk | Daftar jadi sampah | Batas 50 entri, hapus per item, dan "hapus semua" dengan undo |

---

## 8. Yang perlu diputuskan owner (maksimal 5)

1. **Cakupan rilis:** apakah Ide A (definisi/sinonim/varian) masuk Sprint 2 bersama perbaikan a11y, atau ditunda ke Sprint 3 agar Sprint 2 tetap fokus?
2. **Sumber data definisi:** memakai LLM yang sudah ada, atau API kamus pihak ketiga (mis. Wiktionary/Free Dictionary) untuk mengurangi biaya?
3. **Riwayat:** disimpan lokal per peramban dulu (sebelum auth), atau menunggu akun di Sprint 1?
4. **Terjemahan bab:** boleh otomatis untuk semua buku, atau hanya on-demand per bab dengan konfirmasi biaya?
5. **Pindai halaman (OCR):** apakah fitur ini memang diinginkan pengguna, atau cukup ide eksplorasi?

---

## 9. Batas dokumen

- Ini **brainstorm desain**, bukan spesifikasi final dan bukan tiket BMAD. PM yang memecah jadi epic/story dengan estimasi dan sprint.
- Saya tidak mengubah kode aplikasi dan tidak menambah dependensi.
- Fitur yang saya tandai "(standar GT)" berasal dari pengetahuan umum tentang Google Translate, bukan dari gambar; yang terlihat di gambar hanya bagian yang saya sebut di §1.
- Belum ada validasi pengguna; prioritas di §4 adalah usulan berbasis dampak ke alur baca, bukan hasil riset.
