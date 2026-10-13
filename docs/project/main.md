# KudaBesi — Spesifikasi Konsep & Arsitektur Proyek

> **KudaBesi** (Inspeksi Motor dan Part) adalah sistem inspeksi dan audit kelayakan otomotif digital non-chatbot berbasis Google Gemini Multimodal AI. Aplikasi mengevaluasi kondisi fisik, suara mesin/part, legalitas dokumen (STNK & Buku Servis), estimasi biaya perbaikan tersembunyi, hingga kalkulasi harga pasar dan nilai jual kembali.

---

## 1. Ringkasan Konsep & Identitas Produk

* **Nama Produk**: KudaBesi
* **Kepanjangan**: Inspeksi Motor dan Part
* **Tipe Antarmuka**: *Single-Page Application (SPA)* — **Non-Chatbot**, berbasis *Diagnostic Studio & Bento Report Card*.
* **Repository**: [https://github.com/afacadcam/kudabesi.git](https://github.com/afacadcam/kudabesi.git)

---

## 2. Alur Pengguna & Aturan Form Dinamis

### 2.1 Pemilihan Kategori (Step 1)
Pengguna memilih salah satu dari dua kategori utama di awal:
1. **Unit Motor Lengkap**
2. **Sparepart Motor**

---

### 2.2 Aturan Input Dokumen & Multimedia (Step 2)

| Komponen Input | Kategori Unit Motor | Kategori Sparepart Motor | Catatan / Validasi |
| :--- | :--- | :--- | :--- |
| **Foto Fisik** | **Wajib min. 4 sisi** (Depan, Belakang, Sisi Kanan, Sisi Kiri/Mesin) | **Wajib min. 2 sisi** (Tampak Depan/Atas, Dudukan/Detail Ulir) | Menggunakan slot kartu dropzone visual interaktif. |
| **Audio Rekaman** | **WAJIB** (Suara starter, idle putaran mesin, atau akselerasi) | **WAJIB** (Suara ketukan fisik part, koclak bearing, desis shock) | Mendukung **Upload File Audio** (`.mp3`, `.wav`, `.m4a`, `.ogg`) dan tombol **🎙️ Rekam Langsung dari Mic**. |
| **Opsi STNK** | Pilihan: **Ada STNK** / **Tidak Ada (Bodong)** | *Tidak Berlaku (Hidden)* | Jika **Ada**, upload STNK **Wajib**. Jika **Tidak Ada**, motor diidentifikasi sebagai **Motor Bodong** dengan pinalti harga drastis. |
| **Angka Odometer (KM)** | **WAJIB** (Input nominal kilometer saat ini) | *Tidak Berlaku (Hidden)* | Basis evaluasi rasio pemakaian tahunan, motor capek, dan indikasi reset speedometer. Foto spidometer bersifat opsional. |
| **Buku Servis** | **Opsional** (Upload PDF/Foto) | *Tidak Berlaku (Hidden)* | Referensi pabrikan (Wahana Honda: `https://www.wahanahonda.com/assets/upload/buku_service/*.pdf`, Yamaha & merek lain via web resmi). |
| **Pilihan Tahun** | Dropdown **2000 – 2026** + Opsi **Tahun Lawas (< 2000, teks kustom)** | *Tidak Berlaku (Hidden)* | Input tahun lawas muncul dinamis jika dipilih opsi kustom. |
| **Teks Tambahan** | Opsional (Tulis merk & tipe jika diketahui) | Opsional (Tulis nama part jika diketahui) | Membantu akurasi pengenalan AI. |
| **Harga Ditawarkan** | **Wajib** (Nominal penawaran penjual dalam Rp) | **Wajib** (Nominal penawaran penjual dalam Rp) | Patokan awal untuk menghitung matrix penawaran dan margin pasar. |

---

## 3. Kemampuan Pengenalan & Kecerdasan Buatan (AI Engine)

1. **Pengenalan Produk Otomatis**:
   * **Unit Motor**: Mendeteksi merk, model, dan varian spesifik (misal: *Honda Vario 160 CBS/ABS*, *Yamaha NMAX NEO S*, *NMAX Turbo*, *Beat Karbu*, *Beat FI*, *Vespa Sprint*, dll).
   * **Sparepart**: Mendeteksi jenis komponen teknis (misal: *CVT kit, shockbreaker tabung, master rem radial, pulley depan, rumah roller, piece slide, spakbor, piringan cakram lebar*).
2. **Validasi & Pencocokan STNK (Khusus Unit)**:
   * Membaca data STNK (Nomor Polisi, Tahun Pembuatan, Warna, Masa Berlaku PKB/STNK).
   * Menilai kesesuaian fisik motor vs data STNK (warna, model).
   * Menghitung status pajak (Pajak Hidup / Pajak Mati) beserta estimasi denda keterlambatan.
   * **Penalti Motor Bodong**: Jika opsi "Tidak Ada STNK" dipilih, harga pasar dipotong drastis **40% – 60%** sebagai faktor risiko legalitas.
3. **Analisis Akustik Suara (Audio)**:
   * Menganalisis rekaman suara mesin/part: mendeteksi gejala knocking, rantai keteng kendor, roller/mangkok CVT gredek, bearing aus, atau kebocoran kompresi/knalpot.
4. **Analisis Fisik (Gambar)**:
   * Menilai kerapian cat bodi, keausan ban, ketebalan piringan cakram, rembesan oli di blok mesin, karat/keropos pada sasis/rangka.
5. **Audit Odometer & Jarak Tempuh (Khusus Unit)**:
   * Menghitung rasio pemakaian tahunan terhadap tahun pembuatan motor (normal 8.000–12.000 km/tahun).
   * Deteksi silang manipulasi/reset odometer: jika KM rendah tapi piringan cakram tipis bergelombang, ban aus, atau buku servis mencatat angka lebih tinggi, AI menandai status mencurigakan (*suspicious*), menurunkan skor kesehatan, dan memuat argumen tawar di tempat.

---

## 4. Desain Tampilan Hasil (Diagnostic Bento Report Card)

Bukan berupa percakapan chat, melainkan rapor diagnostik otomotif satu layar:

1. **Header Identification Card**:
   * Nama dan identitas produk hasil deteksi AI (Badge Merk, Varian, Tahun).
   * **Health Score (0 – 100)** dengan visualisasi meteran/gauge.
   * **Status Rekomendasi**: *Sangat Layak / Layak dengan Catatan / Waspada / Bahaya (Bodong)*.
2. **Legalitas & Audit STNK Card**:
   * Status keabsahan surat & tanggal jatuh tempo pajak.
   * Estimasi denda pajak yang tertunggak (jika ada).
3. **Kondisi Fisik & Akustik Card**:
   * Rincian temuan visual & temuan suara audio.
   * Daftar *Immediate Repairs* (komponen yang wajib jajan/ganti segera beserta estimasi biaya).
4. **Matrix Harga & Negosiasi (Fair-Price Engine)**:
   * Harga Ditawarkan Penjual.
   * Estimasi Total Biaya Perbaikan & Denda.
   * Nilai Pasar Wajar (*Fair Market Value Range*).
   * Estimasi Harga Jual Kembali (*Resale Value*).
   * **Panduan Tawar-Menawar**: Poin argumen teknis konkret untuk menekan harga di tempat.
5. **Sample Marketplace Card**:
   * Tombol informatif: **"Jual di Marketplace"** dengan ikon logo **Tokopedia**, **Shopee**, **Blibli**, dan **Lazada** (hanya contoh informasi judul listing optimal & estimasi harga jual, tanpa tautan aktif).
6. **Action Bar**:
   * Cetak Laporan / Simpan PDF.
   * Mulai Inspeksi Unit Baru.

---

## 5. Implementasi Modal / Pop-Up Interaktif

Agar antarmuka tetap bersih (*clean layout*) tanpa menumpuk elemen di halaman utama, modal/pop-up diterapkan pada 4 titik strategis:

| Nama Modal | Trigger Muncul | Konten & Fungsi di Dalam Modal |
| :--- | :--- | :--- |
| **🎙️ Modal Studio Audio Recorder** | Klik tombol *"Rekam Suara dari Mic"* | • Visualizer animasi gelombang suara (*live audio waveform*).<br>• Timer durasi rekaman (00:00–00:15) dengan panduan posisi mic.<br>• Kontrol: Mulai Rekam, Stop, Putar Ulang (*Preview Playback*), dan *"Gunakan Rekaman Ini"*. |
| **🛒 Modal Asisten Marketplace** | Klik tombol *"Jual di Marketplace"* / ikon Tokopedia/Shopee/Blibli/Lazada | • Draf judul listing otomatis ramah SEO.<br>• Rekomendasi kisaran harga jual per marketplace.<br>• Teks deskripsi spesifikasi & kondisi unit siap pasang.<br>• Tombol *"Salin Deskripsi"* (*Copy to Clipboard*).<br>• Catatan informatif: *Hanya sample simulasi format iklan*. |
| **⚠️ Modal Peringatan Motor Bodong** | Klik pilihan radio *"Tidak Ada STNK"* | • Pop-up alert peringatan risiko hukum berkendara tanpa surat sah.<br>• Penjelasan penyesuaian pinalti harga anjlok drastis (40%–60%).<br>• Tombol konfirmasi: *"Saya Paham, Lanjutkan Audit"* atau *"Batal, Saya Ada STNK"*. |
| **🖨️ Modal Pratinjau Cetak Dossier** | Klik tombol *"Cetak / Simpan Laporan"* | • Pratinjau lembar sertifikat inspeksi resmi siap cetak format A4.<br>• Tombol aksi: *"Cetak / Download PDF"* (`window.print()`). |

---

## 6. Arsitektur Teknis (Technical Implementation)

### 6.1 Backend (`index.js`)
* **Endpoint Existing & Chatbot**: `/api/generate-text`, `/api/process-media`, `/api/models` (daftar pilihan model & default), dan `/api/chat` (mendukung pemilihan model dinamis dengan default `gemini-3.5-flash-lite` dari `.env`).
* **Endpoint Baru**: `POST /api/analyze`
  * Middleware: `multer` multi-fields (`photos` maks 20, `audio`, `stnk`, `service_book`, `extra_docs` maks 10).
  * Batas foto & audio bersifat *minimal wajib* (unit min 4 foto + audio mesin wajib, part min 2 foto + audio opsional). Pengguna bebas melampirkan foto tambahan sudut lain & dokumen pendukung (BPKB, faktur, kwitansi servis) lebih banyak.
  * Integrasi `@google/genai` dengan Google Search Grounding untuk menarik harga pasar motor & sparepart terkini di Indonesia.
  * Structured JSON Output Schema:
    ```json
    {
      "product_detected": {
        "name": "string",
        "category": "unit | part",
        "year": "string | number"
      },
      "health_score": 85,
      "verdict": {
        "badge": "string",
        "summary": "string"
      },
      "stnk_audit": {
        "status": "valid | bodong | mismatch",
        "tax_status": "string",
        "tax_penalty_est": 0,
        "notes": "string"
      },
      "odometer_audit": {
        "claimed_km": 0,
        "detected_km": 0,
        "usage_status": "low | normal | high | suspicious",
        "avg_km_per_year": 0,
        "notes": "string"
      },
      "visual_sound_inspection": {
        "physical_notes": "string",
        "sound_notes": "string",
        "repair_items": [
          { "item": "string", "est_cost": 0 }
        ]
      },
      "price_matrix": {
        "offered_price": 0,
        "total_repair_cost": 0,
        "fair_price_min": 0,
        "fair_price_max": 0,
        "estimated_resale_value": 0,
        "negotiation_talking_point": "string"
      },
      "marketplace_sample": {
        "suggested_title": "string",
        "platforms": ["Tokopedia", "Shopee", "Blibli", "Lazada"]
      }
    }
    ```

### 6.2 Frontend Modularitas JavaScript (`public/src/scripts/`)
Pemisahan tanggung jawab kode klien sesuai *clean code architecture*:
1. **`public/src/scripts/kudabesi.ui-events.js`**:
   * Pengendali interaksi DOM (Toggle Unit vs Part).
   * Validasi form lokal (cek min. 4 foto + audio suara mesin wajib untuk unit; min. 2 foto + audio opsional untuk part).
   * Pengelola slot foto dinamis: slot wajib berlabel + tombol upload foto tambahan (multiple) + thumbnail preview dan tombol hapus (✕).
   * Pengelola dokumen pendukung tambahan (BPKB, faktur, nota servis) dengan daftar file dan aksi hapus.
   * Fitur Perekam Suara Mikrofon Langsung (*Web MediaRecorder API*).
   * Logika tampilan dropdown tahun (2000–2026 vs input teks custom < 2000).
   * Logika saklar STNK (Ada vs Tidak Ada/Bodong warning).
   * Animasi status diagnostik (loading radar telemetry).
2. **`public/src/scripts/kudabesi.api-client.js`**:
   * Komunikasi data asinkronus ke `POST /api/analyze` menggunakan `FormData`.
   * Penanganan error HTTP & status jaringan.
   * Render respons JSON ke elemen DOM Bento Grid Report Card.
3. **`public/src/scripts/chat.js`**:
   * Pengendali logika percakapan interaktif Google Gemini, sinkronisasi model dinamis, multiline textarea (Ctrl+Enter), dan formatting Markdown.

### 6.3 Desain Antarmuka (`public/src/styles/main.css` & `style.css`)
* Menghindari gaya *AI Slop* yang generik.
* Menggunakan tema **Clean Light Workshop & Inspection Sheet (Warna Terang)**:
  * Palet warna: Latar belakang bersih Slate 50 (`#f8fafc`), permukaan kartu putih murni (`#ffffff`), teks kontras tinggi Slate 900 (`#0f172a`), dan teks sekunder Slate 500 (`#64748b`).
  * Aksen: Serene Soft Blue / Biru Halus Lembut (`#2563eb` / `#1d4ed8`) dengan latar lembut (`#eff6ff`) dan teks aksen (`#1e40af`) untuk elemen interaktif, tombol primer, dan fokus. Bebas dari nuansa kuning/oranye.
  * Status & Indikator: Hijau (`#16a34a`), Kuning/Amber peringatan (`#d97706`), Oranye waspada (`#ea580c`), dan Merah Terang (`#dc2626`) khusus untuk badge keparahan kerusakan/audit.
  * Tipografi: *IBM Plex Sans* (teks utama) & *IBM Plex Mono* (angka, kode, nominal mata uang).
  * Kartu Bento modular dengan garis batas lembut (`#e2e8f0`), bayangan halus (`box-shadow`), dan dialog modal animasi native.
