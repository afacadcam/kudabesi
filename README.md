# KudaBesi — Inspeksi Motor & Sparepart Bekas

<div align="center">

![KudaBesi Logo](public/src/images/logo.jpeg)

**Sistem Inspeksi dan Audit Kelayakan Otomotif Digital Non-Chatbot Berbasis Google Gemini Multimodal AI**

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Google Gen AI SDK](https://img.shields.io/badge/%40google%2Fgenai-2.28%2B-4285F4?logo=google&logoColor=white)](https://www.npmjs.com/package/@google/genai)
[![Gemini Multimodal](https://img.shields.io/badge/Google%20Gemini-Multimodal%20AI-8E75B2?logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Vanilla CSS & JS](https://img.shields.io/badge/Frontend-Vanilla%20HTML%2FCSS%2FJS-F7DF1E?logo=javascript&logoColor=black)](public/)
[![License](https://img.shields.io/badge/License-Non--Commercial-red.svg)](LICENSE)

[🌐 Demo Studio](http://localhost:3000) • [💬 AI Chat Assistant](http://localhost:3000/chat.html) • [📖 Dokumentasi Konsep](docs/project/main.md)

</div>

<br>
<br>

## Tentang KudaBesi

Membeli motor bekas atau sparepart copotan di Indonesia penuh dengan risiko tersembunyi:
* **Penjual manipulatif**: Suara mesin kasar yang disamarkan, lecet rangka yang ditutupi stiker.
* **Legalitas bodong**: STNK mati bertahun-tahun dengan denda PKB/SWDKLLJ menumpuk, atau data STNK yang tidak cocok dengan unit fisik.
* **Ketidaktahuan pembeli**: Sulit menaksir estimasi biaya perbaikan komponen ("biaya jajan") dan menawar harga secara logis di tempat.

**KudaBesi** hadir sebagai solusi audit otomotif digital. Bukan sekadar chatbot tanya-jawab, melainkan sebuah **Diagnostic Studio** berformat *Single-Page Application (SPA)* yang mengintegrasikan penglihatan komputer (foto), pendengaran akustik (audio rekaman mesin), dan analisis OCR dokumen via **Google Gemini Multimodal AI** dengan data harga pasar real-time melalui **Google Search Grounding**.

Hasil inspeksi langsung disajikan ke dalam **Bento Report Card** interaktif berisi skor kesehatan (*Health Score*), rincian temuan kerusakan, status legalitas, serta matriks harga dan taktik negosiasi konkret.

---

## 📁 Struktur Proyek

```text
hacktiv8_ai/
├── analyze.js                  # Modul handler inspeksi KudaBesi & prompt engineering
├── index.js                    # Server utama Express.js, routing API, & chat endpoint
├── package.json                # Dependensi & script eksekusi Node.js
├── .env.example                # Templat konfigurasi environment variables
├── .gitignore                  # Berkas yang dikecualikan dari Git
├── docs/                       # Dokumentasi spesifikasi proyek
│   └── project/
│       └── main.md             # Spesifikasi arsitektur & konsep lengkap KudaBesi
└── public/                     # Aset statis & Single-Page Application
    ├── index.html              # Antarmuka utama Diagnostic Studio KudaBesi
    ├── chat.html               # Antarmuka Google Gemini AI Chat Assistant
    └── src/
        ├── images/             # Logo KudaBesi & icon marketplace (Tokopedia, Shopee, Blibli, OLX)
        ├── scripts/
        │   ├── kudabesi.ui-events.js   # Event listener DOM, MediaRecorder mic, validasi slot
        │   ├── kudabesi.api-client.js  # Komunikasi fetch API & renderer Bento Report Card
        │   └── chat.js                 # Logika streaming/chat Gemini, picker model, marked parser
        └── styles/
            ├── main.css        # Desain Clean Light Workshop, Bento Grid, Form & Modal Studio
            └── style.css       # Desain antarmuka Gemini Chat Assistant
```

---

## ⚙️ Prasyarat & Konfigurasi

### Prasyarat
1. **Node.js**: Versi `18.x` atau lebih baru (`node -v`).
2. **NPM**: Versi `9.x` atau lebih baru (`npm -v`).
3. **Google Gemini API Key**: Dapatkan kunci API gratis di [Google AI Studio](https://aistudio.google.com/).

### Konfigurasi `.env`
Salin file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Buka file `.env` dan masukkan API Key Anda:

```env
GOOGLE_API_KEY=AIzaSy...IsiKunciGeminiAndaDiSini...
PORT=3000
MODEL=gemini-3.5-flash-lite
```

| Variabel | Deskripsi | Default |
| :--- | :--- | :--- |
| `GOOGLE_API_KEY` | Kunci autentikasi Google Gemini API | *(Wajib diisi)* |
| `PORT` | Port server lokal Express.js | `3000` |
| `MODEL` | Model default untuk analisis & chat | `gemini-3.5-flash-lite` |

---

## Panduan Instalasi & Menjalankan

### 1. Kloning Repositori
```bash
git clone https://github.com/afacadcam/kudabesi.git
cd kudabesi
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Jalankan Aplikasi

**Mode Standar:**
```bash
npm start
```

**Mode Pengembangan (Nodemon / Auto-reload):**
```bash
# Menggunakan nodemon
npx nodemon index.js

# Atau menggunakan watch mode bawaan Node.js
npm run dev
```

### 4. Buka di Browser
* **Diagnostic Studio KudaBesi**: [http://localhost:3000](http://localhost:3000)
* **Google Gemini AI Assistant**: [http://localhost:3000/chat.html](http://localhost:3000/chat.html)