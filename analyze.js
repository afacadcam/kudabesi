import multer from "multer";

const MAX_FILE_BYTES = 8_000_000;
const MAX_TOTAL_BYTES = 25_000_000; // batas aman payload inline Gemini (~25MB)

const AUDIO_MIME_MAP = {
    "audio/mpeg": "audio/mp3",
    "audio/mp3": "audio/mp3",
    "audio/wav": "audio/wav",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/ogg": "audio/ogg",
    "audio/flac": "audio/flac",
    "audio/x-flac": "audio/flac",
    "audio/aac": "audio/aac",
    "audio/x-m4a": "audio/aac",
    "audio/mp4": "audio/aac",
    "audio/aiff": "audio/aiff",
    "audio/x-aiff": "audio/aiff",
};

const upload = multer({ limits: { fileSize: MAX_FILE_BYTES, files: 35 } }).fields([
    { name: "photos", maxCount: 20 },
    { name: "audio", maxCount: 1 },
    { name: "stnk", maxCount: 1 },
    { name: "service_book", maxCount: 10 },
    { name: "extra_docs", maxCount: 10 },
]);

const baseMime = (file) => (file.mimetype || "").split(";")[0].trim().toLowerCase();

const toPart = (file, kind) => {
    let mime = baseMime(file);
    if (kind === "audio") mime = AUDIO_MIME_MAP[mime];
    return mime ? { type: kind, data: file.buffer.toString("base64"), mime_type: mime } : null;
};

// STNK / buku servis boleh gambar atau PDF.
const toDocPart = (file) => {
    const mime = baseMime(file);
    if (mime === "application/pdf") return toPart(file, "document");
    if (mime.startsWith("image/")) return toPart(file, "image");
    return null;
};

const buildSystemInstruction = (today) => `
Peran: Kamu adalah inspektur otomotif senior untuk motor & sparepart bekas di Indonesia ("KudaBesi").
Tanggal hari ini: ${today}. Gunakan Google Search untuk harga pasar bekas terkini (Tokopedia, Shopee, Blibli, OLX, bursa motor bekas) dan referensi buku servis pabrikan (misal wahanahonda.com untuk Honda, situs resmi Yamaha/Suzuki/Kawasaki untuk merek lain).

Aturan integritas data (WAJIB):
- Hanya laporkan yang benar-benar terlihat di foto, terdengar di audio, atau terbaca di dokumen. Jangan mengarang.
- Jika sesuatu tidak terbaca/tidak jelas, tulis "tidak terbaca" atau "tidak dapat dipastikan" dan turunkan "confidence".
- Semua nilai uang dalam Rupiah sebagai angka bulat (tanpa titik/teks). Harga adalah ESTIMASI.
- Jangan memberi saran ilegal. Jika STNK tidak sesuai dengan fisik motor, tandai "mismatch".

Aturan analisis:
1. Kenali produk: UNIT -> merek + model + varian spesifik (contoh: "Honda Vario 160 CBS", "Yamaha NMAX Neo S", "Honda Beat Karbu"). PART -> nama komponen spesifik (CVT, shockbreaker, master rem, pulley, rumah roller, piece slide, spakbor, dll). Teks dari user hanya petunjuk, verifikasi dengan foto.
2. Audio (KRITIKAL — dengarkan dengan SANGAT TELITI):
   - Sikap: Jadilah SKEPTIS, bukan optimistis. Jangan pernah default ke "suara halus/normal" kecuali benar-benar tidak ada anomali sama sekali. Setiap suara asing sekecil apapun WAJIB dilaporkan.
   - Checklist suara yang WAJIB dievaluasi satu per satu (sebutkan status masing-masing di sound_notes):
     a. Roller CVT: apakah ada suara kasar/gesekan/gredek saat akselerasi? Roller aus biasanya terdengar "kresek-kresek" atau gesekan logam saat RPM naik.
     b. Rantai keteng/cam chain: apakah ada suara "tek tek tek" atau gemericik rantai longgar terutama saat idle dingin?
     c. Bearing (kruk as, roda, CVT): apakah ada dengung/humming yang berubah pitch mengikuti RPM?
     d. Knocking/detonasi: apakah ada ketukan keras dari ruang bakar?
     e. Knalpot: apakah ada kebocoran (suara "bres" atau nembak)?
     f. Kompresi: apakah starter terdengar berat/ringan, apakah ada hentakan kompresi normal?
     g. Idle: apakah putaran stasioner stabil atau naik-turun (hunting)?
     h. Getaran abnormal: apakah ada vibrasi berlebih yang terdengar?
   - Jika ada suara yang ambigu/tidak jelas, tulis "terdeteksi kemungkinan [X] namun perlu pemeriksaan fisik langsung untuk konfirmasi" — JANGAN abaikan.
   - Format penulisan sound_notes (WAJIB ter-break per baris rapi):
     * Tulis setiap temuan komponen dalam baris baru menggunakan format bullet (- [Komponen]: [temuan spesifik]) atau penomoran huruf ((a), (b), dst).
     * DILARANG melakukan pengulangan kata antara nama komponen dan deskripsinya. Contoh BENAR: "- Roller CVT: terdengar halus dan tidak gredek"; Contoh SALAH: "- Roller CVT: Roller CVT terdengar...".
   - Khusus kategori PART: jika audio tidak dilampirkan, isi sound_notes dengan "Audio tidak dilampirkan (inspeksi difokuskan pada kondisi fisik part)".
3. Foto: kondisi cat, ban, cakram, rembes oli, karat, retak, modifikasi, kelengkapan.
4. UNIT dengan STNK: cocokkan nopol/merek/tipe/tahun/warna dengan fisik. Toleransi privasi: Jika nopol di foto motor disensor/diblur/ditutup demi privasi, JANGAN tandai sebagai "mismatch"; lakukan validasi silang melalui kecocokan Merek, Tipe varian, Warna bodi, dan Generasi tahun fisik motor. Tetap catat nopol dari STNK untuk cek pajak, dan beri keterangan pada notes bahwa nopol fisik disamarkan untuk privasi. Hitung status pajak dan estimasi denda keterlambatan (PKB + SWDKLLJ) berdasarkan masa berlaku di STNK dan tanggal hari ini. Jika STNK ADA tapi belum 5 tahunan/ganti plat, catat.
5. UNIT tanpa STNK (bodong): status "bodong", nilai pasar wajar turun 40%-60% dari harga unit bersurat, dan jelaskan di verdict & notes. Skor kesehatan tidak boleh di atas 60.
6. PART: abaikan STNK (stnk_audit.status = "not_applicable").
7. Harga: hitung "fair_price_min/max" dari pasaran bekas setelah dikurangi biaya perbaikan & denda pajak. "recommended_offer" adalah harga tawar konkret. "estimated_resale_value" adalah perkiraan harga jual lagi setelah perbaikan. "negotiation_talking_point" berisi argumen teknis singkat berbasis temuan.
8. Odometer & Kilometer (Khusus UNIT):
   - Periksa seluruh foto: jika ada foto spidometer/odometer (analog/digital), baca angka KM via visual/OCR dan bandingkan dengan angka klaim user. Jika tidak ada foto spidometer, jadikan angka klaim input user sebagai basis audit.
   - Evaluasi rasio pemakaian tahunan terhadap tahun motor (standar normal Indonesia 8.000–12.000 KM/tahun, < 5.000 KM/tahun = rendah/simpanan, > 20.000 KM/tahun = tinggi/operasional).
   - Deteksi indikasi manipulasi/reset odometer: Jika angka KM rendah (< 15.000 KM) namun keausan fisik parah (cakram bergelombang dalam, ban gundul, handgrip/footstep licin, mesin kusam/rembes), atau jika catatan KM di buku servis lebih tinggi dari angka sekarang, tandai usage_status sebagai "suspicious", turunkan health_score, dan sertakan di negotiation_talking_point.
   - Khusus kategori PART: isi odometer_audit dengan null.
9. Marketplace: buat draf judul & deskripsi iklan dan sertakan 4 platform utama dalam urutan: Tokopedia, Shopee, Blibli, dan OLX beserta estimasi harga masing-masing.

Format keluaran: HANYA satu objek JSON valid (tanpa markdown, tanpa teks lain) dengan skema persis:
{
  "product_detected": { "name": string, "brand": string, "category": "unit"|"part", "year": string|null, "confidence": number(0-1) },
  "health_score": number(0-100),
  "verdict": { "badge": string, "level": "good"|"caution"|"warning"|"danger", "summary": string },
  "stnk_audit": { "status": "valid"|"bodong"|"mismatch"|"unreadable"|"not_applicable", "plate": string|null, "tax_status": string, "tax_due_date": string|null, "tax_penalty_est": number, "notes": string },
  "odometer_audit": { "claimed_km": number, "detected_km": number|null, "usage_status": "low"|"normal"|"high"|"suspicious", "avg_km_per_year": number|null, "notes": string }|null,
  "visual_sound_inspection": { "physical_notes": string, "sound_notes": string, "service_book_notes": string, "repair_items": [ { "item": string, "est_cost": number } ] },
  "price_matrix": { "offered_price": number, "total_repair_cost": number, "tax_penalty_est": number, "fair_price_min": number, "fair_price_max": number, "recommended_offer": number, "estimated_resale_value": number, "bodong_adjustment_note": string|null, "negotiation_talking_point": string },
  "marketplace_sample": { "suggested_title": string, "description": string, "platforms": [ { "name": "Tokopedia"|"Shopee"|"Blibli"|"OLX", "est_price": number } ] }
}
Gunakan Bahasa Indonesia untuk semua teks.`;

const extractJson = (text) => {
    if (!text) return null;
    const cleaned = text.replace(/```json|```/gi, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
        return null;
    }
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

export const createAnalyzeHandlers = (ai, model) => {
    const parseUpload = (req, res, next) => {
        upload(req, res, (err) => {
            if (!err) return next();
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "Ukuran file maksimal 8 MB per file."
                : `Upload gagal: ${err.message}`;
            return fail(res, 400, message);
        });
    };

    const handler = async (req, res) => {
        const files = req.files || {};
        const photos = files.photos || [];
        const audio = (files.audio || [])[0];
        const stnk = (files.stnk || [])[0];
        const docFiles = [...(files.service_book || []), ...(files.extra_docs || [])];
        const { category, stnk_status: stnkStatus, year, notes, odometer } = req.body;
        const offeredPrice = Number(String(req.body.offered_price || "").replace(/\D/g, ""));
        const odometerKm = Number(String(odometer || "").replace(/\D/g, ""));

        if (!["unit", "part"].includes(category)) return fail(res, 400, "Kategori harus 'unit' atau 'part'.");
        const minPhotos = category === "unit" ? 4 : 2;
        if (category === "unit" && !audio) return fail(res, 400, "Audio suara mesin wajib dilampirkan untuk inspeksi unit motor.");
        if (category === "unit" && (odometer === undefined || odometer === null || String(odometer).trim() === "")) {
            return fail(res, 400, "Angka odometer (kilometer) wajib diisi untuk inspeksi unit motor.");
        }
        if (!offeredPrice) return fail(res, 400, "Harga yang ditawarkan wajib diisi.");

        const hasStnk = category === "unit" && stnkStatus === "available";
        if (category === "unit" && !["available", "none"].includes(stnkStatus)) {
            return fail(res, 400, "Pilih status STNK (Ada / Tidak Ada).");
        }
        if (hasStnk && !stnk) return fail(res, 400, "STNK wajib diunggah jika memilih 'Ada STNK'.");

        const total = [...photos, audio, stnk, ...docFiles].filter(Boolean).reduce((n, f) => n + f.size, 0);
        if (total > MAX_TOTAL_BYTES) return fail(res, 400, "Total ukuran semua file terlalu besar (maks ±25 MB). Kecilkan foto/dokumen.");

        const photoParts = photos.map((f) => toPart(f, "image"));
        const audioPart = audio ? toPart(audio, "audio") : null;
        if (photoParts.includes(null)) return fail(res, 400, "Semua foto harus berformat gambar (JPG/PNG/WebP).");
        if (audio && !audioPart) return fail(res, 400, "Format audio tidak didukung. Gunakan MP3, WAV, OGG, FLAC, atau AAC/M4A.");

        const stnkPart = hasStnk ? toDocPart(stnk) : null;
        if (hasStnk && !stnkPart) return fail(res, 400, "STNK harus berupa gambar atau PDF.");
        
        const docParts = docFiles.map((f) => toDocPart(f));
        if (docParts.includes(null)) return fail(res, 400, "Semua buku servis/dokumen pendukung harus berupa gambar atau PDF.");

        const extraCount = photos.length - minPhotos;
        const photoInfo = extraCount > 0
            ? `${photos.length} foto (${minPhotos} foto wajib minimal + ${extraCount} foto sudut/detail tambahan)`
            : `${photos.length} foto sudut utama`;

        const brief = [
            `Kategori: ${category === "unit" ? "UNIT MOTOR" : "SPAREPART"}`,
            category === "unit" ? `Tahun (input user): ${year || "tidak diisi"}` : null,
            category === "unit" ? `Angka Odometer / Jarak Tempuh (input user): ${odometerKm.toLocaleString("id-ID")} KM` : null,
            `Merk/tipe/nama part (input user, opsional): ${notes?.trim() || "tidak diisi"}`,
            `Harga ditawarkan penjual: Rp ${offeredPrice}`,
            category === "unit" ? `Status STNK: ${hasStnk ? "ADA (lampiran STNK disertakan)" : "TIDAK ADA (anggap bodong)"}` : null,
            docParts.length > 0 ? `Dokumen riwayat/servis/pendukung: ${docParts.length} dokumen dilampirkan user` : "Buku servis: tidak dilampirkan, cari referensi pabrikan sesuai tipe",
            `Lampiran: ${photoInfo}, ${audioPart ? "1 rekaman audio disertakan — DENGARKAN SANGAT TELITI setiap detiknya, evaluasi per checklist komponen (roller, keteng, bearing, knocking, knalpot, kompresi, idle, getaran), laporkan SEMUA anomali sekecil apapun" : "tanpa rekaman audio (opsional untuk part)"}${hasStnk ? ", 1 dokumen STNK" : ""}${docParts.length > 0 ? `, ${docParts.length} dokumen pendukung` : ""}.`,
        ].filter(Boolean).join("\n");

        const today = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

        try {
            let interaction;
            try {
                // Coba dengan Google Search grounding untuk data pasar terkini
                interaction = await ai.interactions.create({
                    model,
                    input: [
                        { type: "text", text: brief },
                        ...photoParts,
                        ...(audioPart ? [audioPart] : []),
                        ...(stnkPart ? [stnkPart] : []),
                        ...docParts,
                    ],
                    system_instruction: buildSystemInstruction(today),
                    tools: [{ type: "google_search" }],
                });
            } catch (searchError) {
                const isQuotaError = searchError?.statusCode === 429 || searchError?.status === 429 || String(searchError?.message).includes("quota");
                if (isQuotaError) {
                    console.warn("[KudaBesi] Kuota Google Search grounding penuh/terbatas. Beralih ke analisis internal model...");
                    interaction = await ai.interactions.create({
                        model,
                        input: [
                            { type: "text", text: brief },
                            ...photoParts,
                            ...(audioPart ? [audioPart] : []),
                            ...(stnkPart ? [stnkPart] : []),
                            ...docParts,
                        ],
                        system_instruction: buildSystemInstruction(today),
                    });
                } else {
                    throw searchError;
                }
            }

            const report = extractJson(interaction.output_text);
            if (!report) {
                console.log("Analyze: JSON tidak valid:", interaction.output_text);
                return fail(res, 502, "AI mengembalikan format yang tidak valid. Coba jalankan audit lagi.");
            }
            return res.status(200).json({ success: true, data: report });
        } catch (error) {
            console.log(error);
            return fail(res, 500, "Analisis gagal: " + error.message);
        }
    };

    return [parseUpload, handler];
};
