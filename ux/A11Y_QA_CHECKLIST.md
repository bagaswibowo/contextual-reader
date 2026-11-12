# Checklist A11y — Lembar Uji QA (Sprint 2)
**Turunan dari:** `ux/UI_SPEC_SPRINT0.md` §4 · **ID stabil:** `A11Y-01` … `A11Y-12`  
**Dipakai oleh:** QA Engineer pada gate Sprint 2 (S2-F3, S2-U1, S2-U2)  
**Aturan:** ID tidak boleh berubah antar sprint. Bila sebuah item dipecah, tambahkan sufiks (`A11Y-05a`), jangan renumber.

## Cara pakai
1. Uji di tiga viewport: mobile 390×844, tablet 768×1024, desktop 1440×900.
2. Uji di tiga tema: light, sepia, dark.
3. Untuk tiap baris isi **Hasil** (`PASS` / `FAIL` / `N/A`) dan tempel bukti (screenshot, nama file axe, atau rekaman screen reader).
4. Satu `FAIL` pada item bertanda **Blocker** menggagalkan gate rilis.

| ID | Prioritas | Komponen | Langkah uji | Kriteria lulus |
|---|---|---|---|---|
| A11Y-01 | Blocker | Roving tabindex kata | Buka bab panjang (>1.000 kata). Tekan `Tab` dari toolbar. Lalu `ArrowRight`/`ArrowLeft`/`ArrowUp`/`ArrowDown`, `Enter`. | Hanya 1 kata `tabindex="0"`; `Tab` keluar dari artikel dalam ≤2 langkah; panah memindah fokus kata/kalimat; `Enter` membuka popover Level 1. |
| A11Y-02 | Blocker | Focus trap modal | Buka TOC, Settings, dan SentenceDetailModal. Tekan `Tab` berulang hingga melewati kontrol terakhir. | Fokus berputar di dalam modal, tidak pernah mencapai elemen di belakang overlay. |
| A11Y-03 | Blocker | ARIA modal | Inspeksi DOM setiap modal/drawer. | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` menunjuk judul yang ada. |
| A11Y-04 | Blocker | Focus restoration | Buka popover dari kata ke-5, tutup dengan `Escape`; ulangi dengan tombol close. | Fokus kembali ke kata pemicu, bukan ke `<body>` atau awal halaman. |
| A11Y-05 | Blocker | Touch target ≥44×44 | Ukur bounding box semua tombol ikon (audio, close, tab, navigasi bab, hapus). | Setiap target interaktif ≥44×44 CSS px, termasuk area transparan di sekitar ikon. |
| A11Y-06 | Serious | Hit area kata inline | Di mobile, ketuk 20 kata berurutan di paragraf rapat. | Tidak ada mis-tap ke kata tetangga; kata yang salah tidak terbuka. |
| A11Y-07 | Blocker | Scroll lock | Buka drawer Level 2 di mobile, geser latar belakang. | Latar tidak ikut scroll; posisi baca tidak melompat saat drawer ditutup. |
| A11Y-08 | Serious | Accessible name ikon | Jalankan axe atau inspeksi `aria-label` pada semua tombol ikon. | Tidak ada tombol tanpa nama aksesibel; label menyebut aksi + objek (mis. "Dengarkan pengucapan resilient"). |
| A11Y-09 | Serious | Status audio live | Putar audio kata dengan screen reader aktif. | Ada `aria-live="polite"` yang mengumumkan mulai dan selesai; tidak mengumumkan berulang saat idle. |
| A11Y-10 | Blocker | Kontras teks | Ukur teks utama, sekunder, aksen, dan teks tombol di 3 tema. | ≥4,5:1 untuk teks normal; ≥3:1 untuk teks ≥18pt/14pt bold. |
| A11Y-11 | Serious | Kontras komponen UI | Ukur border input, outline tombol, indikator tab aktif, progress bar. | ≥3:1 terhadap latar bersebelahan. |
| A11Y-12 | Blocker | Focus visible | Navigasi seluruh halaman dengan keyboard saja. | Setiap elemen yang dapat difokus menampilkan cincin fokus ≥2px yang kontras; tidak ada `outline: none` tanpa pengganti. |

## Bukti minimum yang harus dilampirkan
- axe DevTools: 0 violation kategori `critical` dan `serious` pada Reader, Library, Vocabulary.
- Lighthouse mobile: Accessibility ≥95 (gate Sprint 2 menuntut ≥90; angka ini lebih ketat untuk a11y).
- Rekaman 60 detik: Tab → panah → Enter → Escape pada satu bab.
- Tangkapan kontras untuk 6 pasangan warna kunci per tema (teks utama, teks sekunder, teks tombol, border input, fokus, highlight kalimat).

## Catatan cakupan
- Item ini menguji **hasil implementasi**, bukan spesifikasi. Bila implementasi belum ada, tandai `N/A (belum diimplementasikan)` dan jangan `PASS`.
- `A11Y-01` dan `A11Y-05` adalah dua item yang paling sering gagal pada kode saat ini (3.000 `<button>` dan target 12–16px), jadi uji keduanya lebih dulu.
