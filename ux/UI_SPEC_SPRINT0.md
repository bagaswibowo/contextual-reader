# Contextual Reader — Spesifikasi Desain UI/UX (Sprint 0)
**Dokumen Referensi Teknis untuk Implementasi Sprint 2 (S2-U1, S2-U2, S2-F1 s/d S2-F4)**  
*Status:* **Approved for Sprint 2 Handoff** · *Versi:* 1.0 · *Tanggal:* 12 November 2026  
*Target Implementasi:* Tim Frontend Web (`Reader.jsx`, `Vocabulary.jsx`, `Library.jsx`) & QA Engineer  
*Dokumen Induk:* `/data/OpenBot/Shared/contextual-reader/plan/REMEDIATION_PLAN.md`

---

## Daftar Isi
1. [Progressive Disclosure untuk Popup Kata](#1-progressive-disclosure-untuk-popup-kata)
2. [Sistem Desain & Palet Warna WCAG AA](#2-sistem-desain--palet-warna-wcag-aa)
3. [Spesifikasi Tata Letak Baca (Reading Layout)](#3-spesifikasi-tata-letak-baca-reading-layout)
4. [Checklist & Standar Aksesibilitas (A11y)](#4-checklist--standar-aksesibilitas-a11y)
5. [Spesifikasi Posisi Baca & Indikator Progres Buku](#5-spesifikasi-posisi-baca--indikator-progres-buku)
6. [Spesifikasi Riwayat SRS & Pola Interaksi Aman (Undo)](#6-spesifikasi-riwayat-srs--pola-interaksi-aman-undo)
7. [Dekomposisi Komponen Reader.jsx](#7-dekomposisi-komponen-readerjsx)
8. [Kumpulan Wireframe Deskriptif (8 Wireframe)](#8-kumpulan-wireframe-deskriptif-8-wireframe)
9. [Keputusan yang Perlu Dikonfirmasi Owner](#9-keputusan-yang-perlu-dikonfirmasi-owner)

---

## 1. Progressive Disclosure untuk Popup Kata

### 1.1 Masalah UX Saat Ini
Pada versi awal, mengklik kata apa saja langsung memunculkan *bottom sheet* setinggi **88vh** yang merender lebih dari 15 kontrol interaktif secara serentak (terjemahan kontekstual, fonetik IPA, audio asli, audio terjemahan, transliterasi Latin, kelas kata & variasi makna, widget artikulasi bibir viseme DHH 3D, analisis tata bahasa/tenses, dan *language selector*). Hal ini menimbulkan:
- **Cognitive Overload:** Pembaca terdistraksi dan kehilangan alur membaca (*reading flow*).
- **Network Waste:** Permintaan API ganda dan kalkulasi berat LLM dijalankan seketika meskipun pembaca hanya ingin melihat terjemahan cepat.
- **Konflik Gestur:** Gestur scroll pada konten internal bertabrakan dengan gestur tarik-tutup (*swipe-to-close*).

### 1.2 Model Dua Tingkat (Two-Tier Disclosure)

```
[ Klik Kata ]
      │
      ▼
┌────────────────────────────────────────────────────────┐
│ LEVEL 1: Popover Inline Ringkas                        │
│ • Kata & IPA                                           │
│ • Arti kontekstual (1 baris utama)                     │
│ • Tombol Audio (TTS)                                   │
│ • Aksi Cepat: Simpan/Pelajari                          │
│ • Tombol Sekunder: "Lihat Analisis Lengkap →"          │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ User mengklik "Lihat Analisis Lengkap"
                            ▼
┌────────────────────────────────────────────────────────┐
│ LEVEL 2: Drawer Detail (Side/Bottom)                   │
│ • Tab 1: Kosakata Mendalam (Definisi, Contoh, Pos)     │
│ • Tab 2: Tata Bahasa & Struktur 3D (Tense, Klausul)    │
│ • Tab 3: Panduan Artikulasi Bibir (Viseme DHH)         │
└────────────────────────────────────────────────────────┘
```

### 1.3 Spesifikasi Level 1: Popover Inline Ringkas

| Atribut | Desktop (≥ 768px) | Mobile (< 768px) |
|---|---|---|
| **Tipe Kontainer** | Floating Popover (Anchored ke kata) | Compact Bottom Bar / Mini Card |
| **Dimensi** | Lebar tetap: `320px` · Tinggi maks: `180px` | Lebar: `100%` (inset-x-0) · Tinggi maks: `220px` |
| **Posisi** | Mengambang 8px di atas/bawah kata terpilih (posisi otomatis via kalkulasi *viewport boundary*) | Menempel di bawah (*pinned bottom*), di atas navigasi/toolbar pembaca |
| **Backdrop** | Transparan (klik di luar popover menutup popover tanpa memblokir klik teks lain) | Dimmed overlay ringan (`rgba(0,0,0,0.2)`) |
| **Isi Konten** | 1. Teks kata + transkripsi fonetik IPA ringkas<br>2. Tombol audio pengucapan (ukuran target sentuh 44×44px)<br>3. Arti kontekstual kalimat aktif (maksimal 2 baris teks)<br>4. Tombol aksi: Simpan (Bookmark) & "Analisis Lengkap →" | Identik dengan Desktop, tata letak horizontal kompak dengan *safe-area-inset-bottom* |
| **Konsumsi Jaringan** | Hanya 1 panggilan ringan `GET /api/translations/word/` (cacheable). **Tidak memuat** analisis 3D atau aset viseme. | Sama dengan desktop |
| **Penutupan (Dismiss)** | Klik di luar, tekan `Escape`, atau scroll halaman lebih dari 40px | Tombol close `X`, swipe down ringan, tekan `Escape` |

### 1.4 Spesifikasi Level 2: Drawer Detail Analisis

| Atribut | Desktop (≥ 768px) | Mobile (< 768px) |
|---|---|---|
| **Tipe Kontainer** | Right Sliding Drawer (Drawer Kanan) | Bottom Sheet Modular |
| **Dimensi** | Lebar: `440px` · Tinggi: `100vh` penuh | Lebar: `100%` · Tinggi: `72vh` (tidak menutupi seluruh layar) |
| **Dampak Bacaan** | **Teks bacaan tidak tertutup:** Konten artikel digeser / di-*constrain* ke sisa lebar layar sehingga pengguna bisa membaca artikel sambil melihat analisis. | Menutupi sebagian bawah viewport bacaan, dilengkapi *drag handle* yang kokoh. |
| **Navigasi Tab** | Segmented Control 3 Tab:<br>1. **Kosakata** (Makna kontekstual, kelas kata/POS, variasi makna)<br>2. **Tata Bahasa** (Pola tenses, struktur kalimat, klausa SVO)<br>3. **Artikulasi Bibir** (Viseme guide untuk pembelajar DHH/tunarungu) | Tab identik dengan scrollbar horizontal jika label sempit |
| **Strategi Pemuatan** | **Lazy-on-Demand:** Data tata bahasa/3D hanya dimuat saat tab "Tata Bahasa" diklik pertama kali. Membatalkan *in-flight request* jika drawer ditutup atau kata diganti (`AbortController`). | Sama dengan desktop |
| **Scroll Behavior** | Konten dalam drawer dapat di-scroll secara independen (`overflow-y: auto`) tanpa memicu scroll pada halaman utama (*body scroll lock* pada mobile). | Scroll lock pada latar belakang, scroll hanya aktif di area tab konten. |

---

## 2. Sistem Desain & Palet Warna WCAG AA

### 2.1 Audit & Akar Masalah Kontras
Warna hijau Duolingo lama `#58CC02` memiliki rasio kontras hanya **2,09:1** terhadap latar belakang putih (`#FFFFFF`). Standar **WCAG 2.2 AA** mewajibkan:
- **Teks normal (< 18pt / < 14pt bold):** Rasio kontras minimal **4,5:1**.
- **Teks besar (≥ 18pt / ≥ 14pt bold):** Rasio kontras minimal **3,0:1**.
- **Komponen antarmuka & batas fokus (UI Elements / Non-text):** Rasio kontras minimal **3,0:1**.

Pada tema Sepia, terjadi inkonsistensi (*white patches*) karena beberapa komponen seperti popover, toolbar, dan kartu kosakata tidak terhubung ke token variabel CSS terpusat, melainkan memakai kelas statis `bg-white dark:bg-dark-card`.

### 2.2 Palet Warna Pengganti Terkalibrasi (WCAG AA & AAA)

Berikut adalah palet warna resmi yang telah dihitung dan diverifikasi nilai *Relative Luminance*-nya:

| Tema | Elemen / Peran | Nilai Hex | Nilai HSL | Latar Acuan | Rasio Kontras | Status WCAG |
|---|---|---|---|---|---|---|
| **Light** | Background Halaman | `#FFFFFF` | `hsl(0, 0%, 100%)` | — | — | — |
| | Surface / Card | `#F8FAFC` | `hsl(210, 40%, 98%)` | `#FFFFFF` | — | Base Surface |
| | Teks Utama (Primary) | `#0F172A` | `hsl(222, 47%, 11%)` | `#FFFFFF` | **17.85:1** | Lolos AAA |
| | Teks Sekunder (Muted) | `#475569` | `hsl(215, 16%, 35%)` | `#FFFFFF` | **7.58:1** | Lolos AAA |
| | Teks Aksen Hijau | `#1B6A27` | `hsl(129, 59%, 26%)` | `#FFFFFF` | **6.69:1** | Lolos AAA |
| | Tombol Hijau (Button BG) | `#22752B` | `hsl(127, 55%, 30%)` | `#FFFFFF` (Teks: `#FFF`) | **5.76:1** | Lolos AA |
| | Tombol Biru (Button BG) | `#0369A1` | `hsl(201, 96%, 32%)` | `#FFFFFF` (Teks: `#FFF`) | **5.93:1** | Lolos AA |
| | Border Interaktif / Input | `#64748B` | `hsl(215, 16%, 47%)` | `#FFFFFF` | **4.76:1** | Lolos AA (UI ≥3:1) |
| | Border Dekoratif Halus | `#E2E8F0` | `hsl(214, 32%, 91%)` | `#FFFFFF` | 1.25:1 | Elemen non-kritis |
| | Cincin Fokus (Focus Ring) | `#0284C7` | `hsl(199, 89%, 40%)` | `#FFFFFF` | **4.10:1** | Lolos AA (UI ≥3:1) |
| | Highlight Kalimat Aktif | `#FEF08A` | `hsl(53, 98%, 77%)` | Teks: `#0F172A` | **15.34:1** | Lolos AAA |
| **Sepia** | Background Halaman | `#FBF3E4` | `hsl(38, 77%, 94%)` | — | — | Base Sepia |
| | Surface / Card | `#F4E8D1` | `hsl(38, 62%, 89%)` | `#FBF3E4` | — | Warm Surface |
| | Teks Utama (Primary) | `#2E1E11` | `hsl(28, 45%, 12%)` | `#FBF3E4` | **14.54:1** | Lolos AAA |
| | Teks Sekunder (Muted) | `#684F38` | `hsl(28, 30%, 31%)` | `#FBF3E4` | **6.89:1** | Lolos AAA |
| | Teks Aksen Hijau | `#1E6328` | `hsl(129, 54%, 25%)` | `#FBF3E4` | **6.63:1** | Lolos AAA |
| | Tombol Aksen Warm Brown | `#5C3D1E` | `hsl(30, 51%, 24%)` | `#FBF3E4` (Teks: `#FFF`) | **9.81:1** | Lolos AAA |
| | Border Interaktif / Input | `#8C6D4F` | `hsl(30, 28%, 43%)` | `#FBF3E4` | **4.31:1** | Lolos AA (UI ≥3:1) |
| | Border Dekoratif Halus | `#E5D5BF` | `hsl(35, 45%, 82%)` | `#FBF3E4` | 1.45:1 | Elemen non-kritis |
| | Cincin Fokus (Focus Ring) | `#A04A00` | `hsl(28, 100%, 31%)` | `#FBF3E4` | **5.48:1** | Lolos AA (UI ≥3:1) |
| | Highlight Kalimat Aktif | `#EBD5A0` | `hsl(43, 67%, 77%)` | Teks: `#2E1E11` | **11.11:1** | Lolos AAA |
| **Dark** | Background Halaman | `#12181B` | `hsl(198, 20%, 9%)` | — | — | Deep Charcoal |
| | Surface / Card | `#1A242B` | `hsl(205, 25%, 14%)` | `#12181B` | — | Elevated Surface |
| | Teks Utama (Primary) | `#F8FAFC` | `hsl(210, 40%, 98%)` | `#12181B` | **17.12:1** | Lolos AAA |
| | Teks Sekunder (Muted) | `#94A3B8` | `hsl(215, 20%, 65%)` | `#12181B` | **6.99:1** | Lolos AAA |
| | Teks Aksen Hijau Terang | `#5BE22B` | `hsl(104, 76%, 53%)` | `#12181B` | **10.54:1** | Lolos AAA |
| | Tombol Hijau (Button BG) | `#22752B` | `hsl(127, 55%, 30%)` | `#12181B` (Teks: `#FFF`) | **5.76:1** | Lolos AA |
| | Border Interaktif / Input | `#64748B` | `hsl(215, 16%, 47%)` | `#12181B` | **3.76:1** | Lolos AA (UI ≥3:1) |
| | Border Dekoratif Halus | `#2D3748` | `hsl(218, 23%, 23%)` | `#12181B` | 1.62:1 | Elemen non-kritis |
| | Cincin Fokus (Focus Ring) | `#38BDF8` | `hsl(199, 95%, 60%)` | `#12181B` | **8.36:1** | Lolos AAA (UI ≥3:1) |
| | Highlight Kalimat Aktif | `#1E3A5F` | `hsl(214, 52%, 25%)` | Teks: `#F8FAFC` | **10.99:1** | Lolos AAA |

### 2.3 Token Variabel CSS Resmi (Design Tokens)

Untuk menghilangkan bercak putih pada mode sepia dan mempermudah frontend engineer di Sprint 2, semua styling harus memanfaatkan token CSS semantic berikut:

```css
/* ==========================================================================
   Contextual Reader — Semantic Design Tokens
   File target: src/styles/tokens.css (di-import di globals.css)
   ========================================================================== */

:root {
  /* LIGHT THEME (DEFAULT) */
  --cr-bg-page: #FFFFFF;
  --cr-bg-surface: #F8FAFC;
  --cr-bg-surface-elevated: #FFFFFF;
  --cr-text-primary: #0F172A;
  --cr-text-secondary: #475569;
  --cr-text-accent: #1B6A27;
  
  --cr-btn-primary-bg: #22752B;
  --cr-btn-primary-hover: #1B6A27;
  --cr-btn-primary-shadow: #14531E;
  --cr-btn-primary-text: #FFFFFF;
  
  --cr-border-interactive: #64748B;
  --cr-border-subtle: #E2E8F0;
  --cr-ring-focus: #0284C7;
  
  --cr-highlight-sentence: rgba(254, 240, 138, 0.55);
  --cr-highlight-word-hover: rgba(34, 117, 43, 0.12);
  --cr-highlight-word-active: rgba(34, 117, 43, 0.28);
}

html.sepia {
  /* SEPIA THEME */
  --cr-bg-page: #FBF3E4;
  --cr-bg-surface: #F4E8D1;
  --cr-bg-surface-elevated: #F7EDE0;
  --cr-text-primary: #2E1E11;
  --cr-text-secondary: #684F38;
  --cr-text-accent: #1E6328;
  
  --cr-btn-primary-bg: #2D6632;
  --cr-btn-primary-hover: #225126;
  --cr-btn-primary-shadow: #193D1C;
  --cr-btn-primary-text: #FFFFFF;
  
  --cr-border-interactive: #8C6D4F;
  --cr-border-subtle: #E5D5BF;
  --cr-ring-focus: #A04A00;
  
  --cr-highlight-sentence: rgba(235, 213, 160, 0.70);
  --cr-highlight-word-hover: rgba(45, 102, 50, 0.15);
  --cr-highlight-word-active: rgba(45, 102, 50, 0.30);
}

html.dark {
  /* DARK THEME */
  --cr-bg-page: #12181B;
  --cr-bg-surface: #1A242B;
  --cr-bg-surface-elevated: #222E37;
  --cr-text-primary: #F8FAFC;
  --cr-text-secondary: #94A3B8;
  --cr-text-accent: #5BE22B;
  
  --cr-btn-primary-bg: #22752B;
  --cr-btn-primary-hover: #2E9439;
  --cr-btn-primary-shadow: #134E1C;
  --cr-btn-primary-text: #FFFFFF;
  
  --cr-border-interactive: #64748B;
  --cr-border-subtle: #2D3748;
  --cr-ring-focus: #38BDF8;
  
  --cr-highlight-sentence: rgba(30, 58, 95, 0.65);
  --cr-highlight-word-hover: rgba(91, 226, 43, 0.20);
  --cr-highlight-word-active: rgba(91, 226, 43, 0.40);
}
```

---

## 3. Spesifikasi Tata Letak Baca (Reading Layout)

### 3.1 Eliminasi Fragmentasi Paragraf
Pada implementasi sebelumnya, setiap kalimat dimasukkan ke dalam elemen `<div>` terpisah dengan tata letak flexbox dan padding, sehingga teks buku terlihat seperti daftar bullet tanpa struktur sastra/buku.

**Solusi Arsitektur Teks:**
- Dokumen bab dirender sebagai kumpulan paragraf alami (`<p className="reading-paragraph">`).
- Seluruh kalimat dalam satu paragraf mengalir secara inline (`display: inline`).
- Setiap kalimat dibungkus dengan elemen `<span className="reader-sentence" data-sentence-id="...">` untuk memungkinkan penyorotan (*highlighting*) kalimat tanpa memutus aliran teks pembaca.
- Setiap kata di dalam kalimat dibungkus dengan `<span role="button" className="reader-word" data-word-index="...">`.

### 3.2 Tipografi & Irama Membaca (Reading Rhythm)

| Atribut Tipografi | Nilai Spesifikasi | Alasan UX & Aksesibilitas |
|---|---|---|
| **Max Line Length (Measure)** | `65ch` s/d `72ch` (Desktop maks: `720px`) | Mencegah kelelahan pelacakan visual mata pada monitor lebar (WCAG merekomendasikan ≤80 karakter). |
| **Line Height (Leading)** | `1.75` (dapat diatur pengguna: `1.5`, `1.75`, `2.0`) | Memberikan ruang vertikal optimal bagi mata untuk beralih antar baris teks. |
| **Ukuran Font Dasar** | Default: `18px` (`1.125rem`)<br>Rentang pilihan: `14px` s/d `24px` | Ukuran default 18px nyaman untuk membaca jangka panjang pada layar modern. |
| **Jarak Antar Paragraf** | `1.5em` (`margin-bottom: 1.5em`) | Membedakan jeda ide antar paragraf secara visual tanpa memerlukan indentasi berlebih. |
| **Pilihan Font Family** | 1. **Serif:** Merriweather, Georgia, 'Times New Roman'<br>2. **Sans-serif:** Inter, Nunito, -apple-system | Menampung preferensi pengguna untuk bacaan sastra (Serif) vs bacaan teknis (Sans). |
| **Text Alignment** | `text-left` (Rata Kiri) | Hindari `text-justify` karena menciptakan celah spasi liar (*rivers of white*) yang mengganggu pembaca disleksia. |

---

## 4. Checklist & Standar Aksesibilitas (A11y)

Checklist ini menggunakan nomor identifikasi stabil (`A11Y-01` s/d `A11Y-12`) agar QA Engineer dapat memetakan rencana uji di Sprint 2 secara langsung.

### 4.1 Pola Roving Tabindex untuk Kata (Solusi Masalah 3.000 Button)
- **Defek Awal:** Bab dengan 3.000 kata merender 3.000 elemen `<button>`. Menekan tombol `Tab` memerlukan 3.000 kali penekanan untuk melewati konten bab.
- **Standar Aksesibilitas:** Kontainer artikel harus memiliki satu titik masuk fokus (`tabIndex={0}`). Ketika fokus berada di dalam kontainer:
  1. Tombol `Tab` melompat langsung keluar dari artikel menuju kontrol antarmuka berikutnya (misal: tombol bab berikutnya).
  2. Tombol `ArrowRight` dan `ArrowLeft` memindahkan fokus kata aktif ke kata setelahnya/sebelumnya.
  3. Tombol `ArrowDown` dan `ArrowUp` melompat ke kalimat berikutnya/sebelumnya.
  4. Tombol `Enter` atau `Space` pada kata aktif memicu terbukanya Popover Level 1.
  5. Seluruh kata non-aktif menggunakan `tabIndex={-1}`.

### 4.2 Matriks Checklist Aksesibilitas QA

| ID Uji | Komponen / Area | Kriteria Penerimaan Aksesibilitas | Metode Verifikasi |
|---|---|---|---|
| **A11Y-01** | Navigasi Kata (Roving Tabindex) | Hanya ada 1 kata aktif ber-`tabindex="0"` pada blok bacaan. Kata lainnya ber-`tabindex="-1"`. Menekan `Tab` melompati seluruh artikel. `ArrowRight`/`ArrowLeft` memindahkan fokus kata. | Keyboard navigation (Tab & Panah) |
| **A11Y-02** | Focus Trap Modal | Saat Dialog / Modal (SentenceDetailModal, TOC Drawer, Settings) terbuka, fokus terkunci di dalam modal. Menekan `Tab` pada kontrol terakhir berputar ke kontrol pertama. | Pengujian Tab siklikal |
| **A11Y-03** | ARIA Modal Attributes | Setiap kontainer modal memiliki `role="dialog"`, `aria-modal="true"`, dan `aria-labelledby="[id_judul]"`. | Inspeksi DOM & Screen Reader |
| **A11Y-04** | Kembalikan Fokus (Focus Restoration) | Saat popover atau modal ditutup (via tombol close atau `Escape`), fokus keyboard harus kembali ke elemen pemanggilnya (kata yang diklik). | Screen reader & keyboard flow |
| **A11Y-05** | Target Sentuh Minimum (Touch Target) | Semua tombol kontrol, ikon audio, penutup, tab, dan navigasi bab memiliki ukuran target interaktif minimal **44 × 44 CSS pixels**. | Touch Target bounding-box check |
| **A11Y-06** | Bounding Target Kata Inline | Kata pada teks inline memiliki pseudo-element `::after` atau padding vertikal transparan sehingga area sentuh jari tidak menghasilkan mis-tap. | Mobile viewport hit-testing |
| **A11Y-07** | Body Scroll Lock | Saat Drawer Detail atau Modal terbuka, scroll pada elemen `<body>` dinonaktifkan (`overflow: hidden`) dan posisi scroll tidak bergeser (*zero layout jump*). | Scroll wheel & touch drag test |
| **A11Y-08** | Label Aksesibel Ikon (Accessible Name) | Setiap tombol yang hanya berisi ikon SVG memiliki atribut `aria-label` deskriptif (misal: `aria-label="Dengarkan pengucapan kata [word]"`). | Screen Reader announcement |
| **A11Y-09** | Status Live TTS Audio | Status pemutaran audio memiliki elemen pengumuman `aria-live="polite"` yang membacakan "Memutar pengucapan..." dan "Selesai". | NVDA / VoiceOver test |
| **A11Y-10** | Rasio Kontras Teks (WCAG AA) | Seluruh teks utama memiliki rasio kontras ≥ 4.5:1 terhadap background di ketiga tema (Light, Sepia, Dark). | Lighthouse / Axe DevTools |
| **A11Y-11** | Rasio Kontras Komponen UI | Border aktif input form, outline tombol, dan indikator aktif memiliki rasio kontras ≥ 3.0:1 terhadap latar belakang sekitarnya. | Color Contrast Analyzer |
| **A11Y-12** | Indikator Fokus Visual (Focus Visible) | Seluruh elemen interaktif memiliki cincin fokus visual minimal 2px yang kontras (`--cr-ring-focus`) saat diakses via keyboard. | Pengujian tab visual |

---

## 5. Spesifikasi Posisi Baca & Indikator Progres Buku

### 5.1 Skema Penyimpanan Posisi Baca
Setiap perubahan bab dan pergeseran scroll pembaca disimpan secara persisten di sisi klien (*client storage*) dengan skema data standar berikut:

```typescript
interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  scrollOffsetPct: number;    // Persentase scroll dalam bab (0.00 s/d 100.00)
  lastReadSentenceId?: string; // ID kalimat terakhir yang terlihat di viewport
  lastReadTimestamp: number;   // Epoch millisecond
}
```

### 5.2 Strategi Penyimpanan & Pemulihan (Persistence & Hydration)
1. **Debounced Listener:** Event scroll pada viewport pembaca dipantau menggunakan *passive scroll listener* dengan debounce **300ms** untuk mencegah degradasi performa render.
2. **Intersection Observer:** Kalimat yang melintasi garis pandang tengah layar (*vertical center 50%*) dicatat sebagai `lastReadSentenceId`.
3. **Penyimpanan Lokal:** Disimpan pada key `cr_reading_progress_{bookId}` di `localStorage`.
4. **Auto-Restore saat Masuk Reader:**
   - Ketika pembaca membuka buku `/read/:bookId`, sistem memeriksa `ReadingProgress`.
   - Jika `chapterIndex > 0`, sistem memuat bab yang bersangkutan (bukan selalu Bab 1).
   - Setelah konten bab selesai dirender (`DOM ready`), posisi scroll dikembalikan secara mulus (*smooth scrolling*) ke `scrollOffsetPct` atau elemen kalimat `lastReadSentenceId`.

### 5.3 Indikator Progres pada Kartu Buku (Library)
Setiap kartu buku di halaman Perpustakaan (`Library.jsx`) menampilkan indikator progres cerdas:
1. **Buku Belum Dibaca:** 
   - Label badge: `Belum Mulai`.
   - Tombol utama: `Mulai Membaca`.
2. **Buku Sedang Dibaca (In Progress):**
   - Batang progres visual (*progress bar*) tebal 6px dengan warna aksen `--cr-btn-primary-bg`.
   - Teks info: `Bab 4 dari 18 (22%) · Dibaca 3 jam lalu`.
   - Tombol utama: `Lanjutkan Bab 4 →`.
3. **Buku Selesai (Completed):**
   - Badge hijau: `Selesai 100%`.
   - Tombol sekunder: `Baca Ulang`.

---

## 6. Spesifikasi Riwayat SRS & Pola Interaksi Aman (Undo)

### 6.1 Masalah SRS Saat Ini
1. **Kehilangan Riwayat:** Sesi review flashcard hanya menyimpan hitungan di memori komponen (`sessionStats`). Saat keluar halaman, riwayat akurasi dan streak hilang.
2. **Konflik Flip Card:** Seluruh kartu membungkus event klik untuk membalik kartu (`flip`), sehingga mengklik kontrol audio atau widget pengucapan bibir viseme di bagian belakang kartu sering kali tidak sengaja membalik kartu kembali ke depan.
3. **Penghapusan Tanpa Jaring Pengaman:** Penghapusan kata mengandalkan `window.confirm()`, yang jika terhapus tidak dapat dipulihkan.

### 6.2 Pemisahan Interaksi Kartu Kosakata (Flashcard)
Untuk mencegah konflik interaksi artikulasi bibir dan pembalikan kartu:
- **Area Flip Terdedikasi:** Kartu tidak lagi membalik di sembarang area klik. Pembalikan kartu dipicu oleh:
  1. Tombol eksplisit `[ Balik Kartu ⟲ ]` di bagian bawah kartu.
  2. Klik pada area kosong kartu (bukan pada widget artikulasi atau tombol audio).
  3. Menekan tombol `Space` pada keyboard saat kartu aktif.
- **Isolasi Kontrol Artikulasi:** Kontainer `PronunciationWidget` dan tombol audio berada pada blok terisolasi dengan penanganan event `e.stopPropagation()` dan pembatas visual (*card inset container*) yang jelas.

### 6.3 Panel Riwayat SRS (Retention & Streak Dashboard)
Di bagian atas tab Flashcard pada halaman `Vocabulary.jsx`, disediakan dashboard analitik pembelajaran:
1. **Streak Counter (Hari Beruntun):**
   - Ikon Api (*Flame*) dengan angka hari berturut-turut belajar (misal: `7 Hari Berturut-turut`).
   - Indikator status harian: "Sesi Hari Ini Selesai ✓" atau "Target 10 kata hari ini belum selesai".
2. **Ringkasan Retensi (Session Summary):**
   - Kartu statistik: Total Kata Dikuasai (*Mastered*), Kata Sedang Dipelajari (*Learning*), Kata Perlu Review Hari Ini (*Due*).
   - Akurasi rata-rata sesi terakhir (persentase benar).
3. **Kalender Retensi (Activity Heatmap):**
   - Visualisasi matriks 4 minggu terakhir (28 kotak hari), dengan gradasi intensitas warna hijau sesuai jumlah kata yang direview pada hari tersebut.

### 6.4 Pola Penghapusan Aman (Optimistic Delete with Undo Toast)
Menggantikan dialog `window.confirm()` dengan pola standar aplikasi modern:
1. **Aksi Pengguna:** Pengguna mengklik ikon tempat sampah pada kata.
2. **Reaksi Antarmuka Instan:** Item kata disembunyikan seketika dari daftar secara optimistik (*soft-remove*).
3. **Snackbar / Toast Interaktif:**
   - Muncul notifikasi di bawah layar: `"Kosakata 'eloquent' dihapus. [ Urungkan (5s) ]"`.
   - Terdapat animasi progress bar mundur selama 5 detik.
4. **Pembatalan (Undo):**
   - Jika pengguna mengklik tombol `Urungkan`, kata segera dikembalikan ke daftar tanpa ada request penghapusan ke server.
5. **Eksekusi Final:**
   - Jika 5 detik berlalu tanpa penekanan `Urungkan`, sistem mengirimkan request `DELETE /api/vocabulary/{id}/` ke server.

---

## 7. Dekomposisi Komponen Reader.jsx

Saat ini file `Reader.jsx` berukuran monolitik (1.839 baris / 98 KB) yang memadukan pengelolaan audio, navigasi bab, parsing formula KaTeX, rendering kata, dan deklarasi JSX modal di dalam perulangan token. 

Berikut adalah batas tanggung jawab (*separation of concerns*) untuk 7 komponen hasil dekomposisi pada Sprint 2:

```
┌────────────────────────────────────────────────────────────────────────┐
│                                Reader.jsx                              │
│         (State Orchestrator: Route params, Data Fetching, Sync)        │
└────┬──────────────────┬─────────────────┬───────────────────┬──────────┘
     │                  │                 │                   │
     ▼                  ▼                 ▼                   ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐
│ReaderToolbar │ │ReaderContent │ │  TocDrawer   │ │SentenceDetailModal  │
└──────────────┘ └──────┬───────┘ └──────────────┘ └─────────────────────┘
                        │
                        ├──────────────────────────┐
                        ▼                          ▼
             ┌─────────────────────┐    ┌─────────────────────┐
             │ WordDetailPopover   │    │  WordDetailDrawer   │
             │ (Level 1 Disclosure)│    │(Level 2 Disclosure) │
             └─────────────────────┘    └─────────────────────┘
```

### 7.1 Spesifikasi Per Komponen

#### 1. `ReaderToolbar`
- **Tanggung Jawab:** Navigasi atas pembaca, tombol kembali ke perpustakaan, judul buku & bab aktif, tombol pemicu Daftar Isi (TOC), tombol pengaturan tampilan (font, ukuran, tema), dan indikator konektivitas/mode baca.
- **Props Input:** `bookTitle`, `currentChapterTitle`, `onOpenToc`, `onOpenSettings`, `theme`, `onThemeChange`.
- **Output Events:** `onBack()`, `onToggleToc()`.

#### 2. `ReaderContent`
- **Tanggung Jawab:** Viewport utama teks buku, pengelompokan paragraf mengalir, penanda kalimat aktif, implementasi roving tabindex kata, penanganan gesture sentuh dan seleksi teks, integrasi formula matematika KaTeX.
- **Props Input:** `chapterData`, `activeSentenceId`, `activeWordId`, `fontSize`, `fontFamily`, `lineHeight`.
- **Output Events:** `onWordClick(sentenceId, word, index, boundingBox)`, `onSentenceClick(sentenceId)`, `onScrollProgress(pct)`.

#### 3. `WordDetailPopover` (Level 1)
- **Tanggung Jawab:** Menampilkan popover inline mengambang dekat kata terpilih (desktop) atau bottom bar ringkas (mobile). Berisi fonetik IPA, tombol putar audio kata, terjemahan kilat, tombol simpan kosakata, dan tombol pemicu Drawer Level 2.
- **Props Input:** `word`, `ipa`, `translation`, `targetLang`, `isSaved`, `anchorRect`, `isLoading`.
- **Output Events:** `onPlayAudio(word)`, `onSaveToggle()`, `onOpenFullAnalysis()`, `onClose()`.

#### 4. `WordDetailDrawer` (Level 2)
- **Tanggung Jawab:** Drawer sisi kanan (desktop) atau sheet 72vh (mobile) untuk analisis linguistik mendalam. Berisi sistem tab: (a) Variasi Makna & POS, (b) Analisis Tata Bahasa 3D / Tenses / Klausa, (c) Panduan Artikulasi Bibir (Viseme DHH).
- **Props Input:** `isOpen`, `wordData`, `explain3dData`, `sentenceContext`, `currentTab`, `isLoading3d`.
- **Output Events:** `onTabChange(tabKey)`, `onRequest3dAnalysis()`, `onClose()`.

#### 5. `SentenceDetailModal`
- **Tanggung Jawab:** Dialog modal terpusat saat pengguna ingin menganalisis seluruh kalimat: terjemahan kalimat lengkap, pemecahan klausul, dan audio pengucapan per kalimat.
- **Props Input:** `isOpen`, `sentenceText`, `sentenceTranslation`, `grammarStructure`.
- **Output Events:** `onPlaySentenceAudio()`, `onClose()`.

#### 6. `TocDrawer`
- **Tanggung Jawab:** Panel drawer geser berisi daftar seluruh bab buku, status baca per bab, indikator bab yang sedang aktif, dan pencarian cepat bab.
- **Props Input:** `isOpen`, `chaptersList`, `currentChapterIndex`, `readingProgressMap`.
- **Output Events:** `onSelectChapter(chapterIndex)`, `onClose()`.

#### 7. `useReaderAudio` (Custom Hook)
- **Tanggung Jawab:** Mengisolasi seluruh interaksi `window.speechSynthesis` dan `AudioContext`. Mengelola status pemutaran (`isPlaying`, `activeAudioKey`), pembatalan audio saat komponen unmount, penanganan suara (*voices*), dan sinkronisasi penanda waktu viseme artikulasi bibir. Menghindari kebocoran memori audio (`window._appAudioContext`).
- **Antarmuka:** `{ isPlaying, activeKey, speak(text, lang, key), stop(), availableVoices }`.

---

## 8. Kumpulan Wireframe Deskriptif (8 Wireframe)

### Wireframe 1: Library (Perpustakaan dengan Indikator Progres Baca)
```text
+-----------------------------------------------------------------------------------+
|  CONTEXTUAL READER                    [Buku Saya]  [Kosakata (142)]  [Tema: Sepia]|
+-----------------------------------------------------------------------------------+
|  Perpustakaan                                              [+ Tambah Buku (EPUB)] |
|  Lanjutkan membaca buku Anda dengan panduan terjemahan kontekstual.                |
|                                                                                   |
|  +-----------------------------------+   +------------------------------------+   |
|  | [EPUB] [EN]            [Sampah]   |   | [PDF] [EN]             [Sampah]    |   |
|  | The Great Gatsby                  |   | Sapiens: A Brief History           |   |
|  | F. Scott Fitzgerald               |   | Yuval Noah Harari                  |   |
|  | 12 Bab · 48.200 Kata              |   | 24 Bab · 112.000 Kata              |   |
|  |                                   |   |                                    |   |
|  | Progres: Bab 3 dari 12 (35%)      |   | Status: Belum Dimulai              |   |
|  | [====================--------]     |   | [--------------------------------] |   |
|  | Terakhir dibaca: 2 jam yang lalu  |   | Ditambahkan: Kemarin               |   |
|  |                                   |   |                                    |   |
|  | [ Lanjutkan Membaca (Bab 3) -> ]  |   | [ Mulai Membaca -> ]               |   |
|  +-----------------------------------+   +------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

### Wireframe 2: Reader Desktop (Aliran Paragraf Mengalir & Drawer Kanan Tertutup)
```text
+-----------------------------------------------------------------------------------+
| [<- Kembali]  The Great Gatsby - Bab 3: In my younger and...   [TOC] [A/A] [Tema] |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|       In my younger and more vulnerable years my father gave me some              |
|       advice that I've been turning over in my mind ever since.                   |
|                                                                                   |
|       "Whenever you feel like criticizing any one," he told me, "just             |
|       remember that all the people in this world haven't had the                  |
|       advantages that you've had."                                                |
|                                                                                   |
|       He didn't say any more, but we've always been unusually                     |
|       communicative in a reserved way, and I understood that he                   |
|       meant a great deal more than that. In consequence, I'm inclined             |
|       to reserve all judgements, a habit that has opened up many                  |
|       curious natures to me.                                                      |
|                                                                                   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
| [<- Bab Sebelumnya]              Halaman 24 dari 180              [Bab Berikutnya ->]
+-----------------------------------------------------------------------------------+
```

### Wireframe 3: Reader Mobile (Layar Baca Bersih & Kontrol Mengambang)
```text
+-----------------------------------------------+
| [<-] The Great Gatsby (Bab 3)    [TOC] [Aa]   |
+-----------------------------------------------+
| In my younger and more vulnerable years my    |
| father gave me some advice that I've been     |
| turning over in my mind ever since.           |
|                                               |
| "Whenever you feel like criticizing any       |
| one," he told me, "just remember that all     |
| the people in this world haven't had the      |
| advantages that you've had."                  |
|                                               |
| He didn't say any more, but we've always      |
| been unusually communicative in a reserved    |
| way, and I understood that he meant a great   |
| deal more than that.                          |
|                                               |
|                                               |
|                                               |
+-----------------------------------------------+
| [< Bab 2]           Progres: 42%      [Bab 4 >]
+-----------------------------------------------+
```

### Wireframe 4: Popup Kata Level 1 (Popover Inline Ringkas)
```text
(Desktop: Mengambang di atas kata)          (Mobile: Compact Bottom Docked Card)
          ┌───────────────────────────┐      +-------------------------------------+
          │ resilient  /rɪˈzɪl.jənt/  │      | resilient  /rɪˈzɪl.jənt/    [Audio] |
          │ [Audio 🔊]                 │      | Makna: Tangguh, ulet                |
          │                           │      |                                     |
          │ Makna Kontekstual:        │      | [+ Simpan]   [Lihat Analisis ->] [X]|
          │ "Tangguh / Ulet"          │      +-------------------------------------+
          │                           │
          │ [+ Simpan]  [Analisis ->] │
          └─────────────┬─────────────┘
                        ▼ (Pointer ke kata)
      ...he proved to be resilient under pressure...
```

### Wireframe 5: Popup Kata Level 2 (Drawer Detail Sisi Kanan / Sheet 72vh)
```text
+--------------------------------------------------------------------+--------------+
| [<-] Reader: The Great Gatsby                                      | ANALISIS KATA|
+--------------------------------------------------------------------+--------------+
|                                                                    | resilient    |
|  He didn't say any more, but we've always been                     | /rɪˈzɪl.jənt/|
|  unusually communicative in a reserved way, and                    | [Audio 🔊]   |
|  I understood that he meant a great deal more                      +--------------+
|  than that.                                                        | [Definisi]   |
|                                                                    | [Tata Bahasa]|
|  In consequence, I'm inclined to reserve all                       | [Artikulasi] |
|  judgements, a habit that has opened up many                       +--------------+
|  curious natures to me and also made me the victim                 | TENSES & POLA|
|  of not a few veteran bores.                                       | Simple Past  |
|                                                                    | S + V2 + O   |
|                                                                    |              |
|  The abnormal mind is quick to detect and attach                   | KLAUSA:      |
|  itself to this quality when it appears in a                       | Main Clause: |
|  normal person...                                                  | "he proved"  |
|                                                                    |              |
|                                                                    | KELAS KATA:  |
|                                                                    | • Adj: tangguh
|                                                                    |              |
|                                                                    | [Tutup X]    |
+--------------------------------------------------------------------+--------------+
```

### Wireframe 6: Kartu Kosakata (Pemisahan Area Flip vs Kontrol Artikulasi)
```text
+-----------------------------------------------------------------------------------+
| KOSAKATA FLASHCARD (Kartu 3 dari 15)                       Akurasi Sesi: 85%      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | [SISI BELAKANG KARTU]                                                       |  |
|  |                                                                             |  |
|  |   Arti Kontekstual:                                                         |  |
|  |   TANGGUH / TIDAK MUDAH MENYERAH                                            |  |
|  |                                                                             |  |
|  |   +-- PANDUAN PENGUCAPAN BIBIR (VISEME DHH) ------------------------------+ |  |
|  |   | [Mouth Shape: Rounded-Open]   Fonem: /zɪl/    [Dengarkan Contoh 🔊]   | |  |
|  |   | *Klik pada widget ini tidak membalikkan kartu*                        | |  |
|  |   +-----------------------------------------------------------------------+ |  |
|  |                                                                             |  |
|  |   [ ⟲ Tekan di sini atau tekan SPASI untuk membalik ke kata depan ]         |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  Penilaian Daya Ingat:                                                            |
|  +----------------------+  +-----------------------+  +------------------------+  |
|  | [1] Lupa Sekali      |  | [3] Ingat Ragu-Ragu   |  | [5] Sangat Ingat       |  |
|  | (Ulangi sekarang)    |  | (Review 3 hari)       |  | (Review 7 hari)        |  |
|  +----------------------+  +-----------------------+  +------------------------+  |
+-----------------------------------------------------------------------------------+
```

### Wireframe 7: Panel Riwayat SRS (Streak, Ringkasan, & Heatmap Retensi)
```text
+-----------------------------------------------------------------------------------+
| DAFTAR KOSAKATA & REVIEW                                                          |
|                                                                                   |
| +-- PANEL RETENSI & KEBIASAAN BELAJAR ------------------------------------------+ |
| |                                                                               | |
| |  [ 🔥 12 Hari ]      [ 420 Kata ]       [ 88% Akurasi ]       [ 15 Menit/Hari]| |
| |  Streak Belajar      Total Dikuasai     Rata-rata Jawaban     Waktu Aktif     | |
| |                                                                               | |
| |  Aktivitas 30 Hari Terakhir:                                                  | |
| |  Sen [ ][■][■][ ][■][■][■]                                                    | |
| |  Rab [■][■][ ][■][■][■][■]     Keterangan:                                    | |
| |  Jum [■][■][■][■][■][ ][■]     [ ] 0 kata  [■] 1-10 kata  [■] >15 kata        | |
| |  Min [ ][■][■][■][■][■][■]                                                    | |
| +-------------------------------------------------------------------------------+ |
|                                                                                   |
| [ Semua Kata (142) ]    [ Sesi Review Siap (18 Kata) -> ]                         |
+-----------------------------------------------------------------------------------+
```

### Wireframe 8: Tema Sepia (Konsistensi Total Seluruh Komponen)
```text
+-----------------------------------------------------------------------------------+
| [Warna Dasar: #FBF3E4 Warm Parchment | Teks: #2E1E11 Deep Umber | Aksen: #1E6328] |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  Header & Toolbar (#F4E8D1):      Border Halus (#E5D5BF)                          |
|  +-----------------------------------------------------------------------------+  |
|  | [<-] Perpustakaan      The Great Gatsby (Bab 1)          [TOC] [Aa] [Sepia] |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  Teks Bacaan (#2E1E11 pada latar #FBF3E4 - Rasio Kontras 14.54:1):               |
|  In my younger and more vulnerable years my father gave me some advice            |
|  that I've been turning over in my mind ever since.                               |
|                                                                                   |
|  Highlight Kalimat Aktif (#EBD5A0):                                               |
|  "Whenever you feel like criticizing any one, just remember that all the people   |
|   in this world haven't had the advantages that you've had."                      |
|                                                                                   |
|  Drawer Analisis Kanan (#F4E8D1 dengan border #8C6D4F - Bebas Bercak Putih):      |
|  +------------------------------------------------------+                         |
|  | Tab Aktif: [Tata Bahasa]                             |                         |
|  | Tenses: Past Simple (S + V2)                         |                         |
|  | Tombol Aksi: [Simpan Kosakata] (BG #2D6632 / Teks #FFF)                        |
|  +------------------------------------------------------+                         |
+-----------------------------------------------------------------------------------+
```

---

## 9. Keputusan yang Perlu Dikonfirmasi Owner

Berikut adalah **maksimal 5 pertanyaan kunci** yang memerlukan penegasan dari Product Owner sebelum implementasi Sprint 2 dimulai:

1. **Format Default Popover Level 1 di Mobile:**  
   Apakah di perangkat mobile pembaca lebih menyukai popover mengambang tepat di atas kata terpilih (mirip interaksi iOS/Kindle) atau *docked compact mini-bar* di bagian bawah layar (menghindari jari tangan menutupi teks bacaan)?
2. **Perilaku Teks Desktop saat Drawer Level 2 Terbuka:**  
   Apakah disetujui tata letak teks pembaca bergeser secara responsif (mengurangi margin samping) saat Drawer Kanan dibuka agar pembaca tetap dapat membaca buku sambil memeriksa analisis, atau lebih disukai mode *overlay modal* standar yang menggelapkan latar belakang?
3. **Penyimpanan Riwayat SRS & Auth:**  
   Mengingat fitur akun pengguna baru masuk di Sprint 1 (S1-B1), apakah riwayat streak dan kalender retensi untuk sementara disimpan di `IndexedDB`/`localStorage` per peramban terlebih dahulu, atau menunggu sinkronisasi API multi-device?
4. **Pilihan Palet Tema Sepia:**  
   Apakah palet tema Sepia yang baru (*Warm Parchment* `#FBF3E4` dengan teks *Deep Umber* `#2E1E11` dan aksen hijau tembaga `#1E6328`) disetujui menggantikan styling lama yang memicu bercak putih?
5. **Jangka Waktu Jaring Pengaman Undo:**  
   Apakah durasi 5 detik untuk pembatalan (*Undo*) penghapusan kosakata sudah ideal bagi pengguna, atau perlu diperpanjang menjadi 8 detik?

---

## 10. Status, Pemetaan ke Sprint 2, dan Batas Dokumen

### 10.1 Pemetaan ke item Sprint 2

| Item Sprint 2 | Bagian dokumen yang dipakai |
|---|---|
| S2-F1 (pecah `Reader.jsx`, modal via portal) | §7 (7 komponen + `useReaderAudio`) |
| S2-F2 (virtual scrolling) | §3 (paragraf mengalir; virtualisasi per blok paragraf, bukan per kalimat) |
| S2-F3 (roving tabindex, focus trap, ARIA, scroll lock) | §4 (`A11Y-01` … `A11Y-12`) |
| S2-F4 (simpan posisi baca) | §5 (skema `ReadingProgress` + indikator kartu buku) |
| S2-U1 (drawer detail, kontras, target sentuh) | §1, §2, §4 |
| S2-U2 (riwayat SRS + streak + undo) | §6 |

### 10.2 Artefak pendamping
- `ux/A11Y_QA_CHECKLIST.md` — lembar uji QA dengan ID `A11Y-01` … `A11Y-12`, langkah uji, dan bukti minimum.

### 10.3 Batas dokumen (jujur)
- Dokumen ini **spesifikasi, bukan implementasi**. Tidak ada kode aplikasi yang diubah.
- Angka rasio kontras dihitung dengan rumus WCAG 2.x (relative luminance) dan sudah diverifikasi ulang; nilai lama yang salah sudah dikoreksi.
- Belum ada file Figma/prototipe interaktif; wireframe bersifat deskriptif (ASCII + tabel ukuran).
- Perilaku nyata (screen reader, gesture iOS/Android, performa 3.000 kata) belum diuji di perangkat — itu tugas QA pada Sprint 2.
- Palet dan ukuran di dokumen ini tidak bergantung pada perbaikan `custom_base_url` di frontend; perubahan itu tidak mengubah spesifikasi visual.
