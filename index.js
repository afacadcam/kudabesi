import "dotenv/config";
import multer from "multer";
import express from "express";
import cors from "cors";
import { createAnalyzeHandlers } from "./analyze.js";

import { GoogleGenAI } from "@google/genai";

const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || "gemini-3.5-flash-lite";

const ALLOWED_CHAT_MODELS = [
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { id: "gemma-4-31b-it", label: "Gemma 4" },
];

const app = express();
const upload = multer({
    limits: {
        fileSize: 10_000_000
    }
});

const ai = new GoogleGenAI();

app
    .use(cors())
    .use(express.json())
    .use(express.static('public'))
    // untuk KudaBesi
    .post('/api/analyze', ...createAnalyzeHandlers(ai, MODEL))
    .use(upload.single('file'))
    // untuk chat teks biasa
    .post('/api/generate-text', async (req, res) => {
        const { prompt } = req.body;
        try {
            const interaction = await ai.interactions.create({
                model: MODEL,
                input: prompt,
                system_instruction: "Jawab dengan menggunakan bahasa gaul indonesia dengan santai."
            })

            return res.status(200).json({
                success: true,
                message: interaction.output_text
            })
        } catch (error) {
            console.log(error)
            return res.status(500).json({
                success: false,
                message: "Ada masalah cuy!\n Error: " + error.message
            })
        }
    })
    // untuk chat upload media
    .post('/api/process-media', async (req, res) => {
        const { prompt } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "File wajib diunggah!" });
        }
        const base64File = req.file.buffer.toString("base64");
        const mime = req.file.mimetype;
        const typeMedia = mime === "application/pdf" ? "document" : mime.split("/")[0];
        try {
            const interaction = await ai.interactions.create({
                model: MODEL,
                input: [
                    { type: "text", text: prompt },
                    { type: typeMedia, data: base64File, mime_type: mime }
                ],
                system_instruction: "Jawab dengan menggunakan bahasa gaul indonesia dengan santai."
            })

            return res.status(200).json({
                success: true,
                message: interaction.output_text
            })
        } catch (error) {
            console.log(error)
            return res.status(500).json({
                success: false,
                message: "Ada masalah bos!\n Error: " + error.message
            })
        }
    })
    .get('/api/models', (req, res) => {
        res.json({
            success: true,
            default_model: MODEL,
            models: ALLOWED_CHAT_MODELS
        });
    })
    // untuk chat teks biasa - dengan Multi-Model Options
    .post('/api/chat', async (req, res) => {
        const { prompt, interaction_id, model: requestedModel } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: "Prompt harus diisi!"
            });
        }

        const validModel = ALLOWED_CHAT_MODELS.find((m) => m.id === requestedModel);
        const activeModel = validModel ? validModel.id : MODEL;

        const currentDate = new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const isGemma = activeModel.toLowerCase().includes("gemma");

        const systemInstruction = `
                    Persona: Kamu adalah "KudaBesi AI", konsultan dan inspektur otomotif senior spesialis motor dan sparepart bekas di Indonesia. Berperan seperti montir senior berpengalaman yang jujur, teliti, bersahabat, dan solutif.
                    Tone: Santai, komunikatif, solutif, dan mudah dipahami oleh pemula maupun penghobi motor (Bahasa Indonesia santai & berbobot).
                    Konteks Waktu: Hari ini adalah ${currentDate}. Gunakan tanggal ini sebagai acuan masa berlaku pajak STNK/plat nomor, tahun pembuatan motor, dan tren harga pasar terkini.
                    Keahlian & Topik:
                    - Panduan checklist inspeksi langsung motor bekas (cek rangka, suspensi, rem, ban, speedometer asli vs resetan, lecet bodi, dan rembes oli).
                    - Diagnosis gejala suara mesin & CVT (knocking, klep renggang, rantai keteng kendor, CVT gredek, bearing oblak, kampas ganda aus).
                    - Cek keabsahan surat & pajak (tips cek fisik STNK/BPKB, nomor rangka/mesin, estimasi denda keterlambatan PKB+SWDKLLJ, dan bahaya motor bodong).
                    - Estimasi biaya servis/ganti part dan perbandingan harga suku cadang (orisinal vs aftermarket).
                    - Rekomendasi motor bekas sesuai budget dan taktik tawar-menawar harga dengan penjual.
                    Batasan: Fokus utama adalah otomotif roda dua. Jika ditanya topik di luar otomotif, jawab secara ringkas dan ramah, lalu ajak kembali ke topik otomotif/motor.
                    Format Jawaban: Berikan penjelasan percakapan natural dengan Markdown rapi (gunakan bullet points, bold untuk komponen krusial, dan tabel ringkas jika membandingkan part atau harga). JANGAN keluarkan format JSON mentah di sini karena ini adalah chat interaktif untuk pengguna.
                `;

        try {
            let interaction;
            try {
                interaction = await ai.interactions.create({
                    model: activeModel,
                    input: prompt,
                    system_instruction: systemInstruction,
                    ...(isGemma ? {} : { tools: [{ type: "google_search" }] }),
                    previous_interaction_id: interaction_id
                });
            } catch (searchError) {
                const isQuotaError = searchError?.statusCode === 429 || searchError?.status === 429 || String(searchError?.message).includes("quota");
                if (isQuotaError && !isGemma) {
                    console.warn(`[Chat] Google Search grounding quota limit. Fallback chat langsung dengan ${activeModel}...`);
                    interaction = await ai.interactions.create({
                        model: activeModel,
                        input: prompt,
                        system_instruction: systemInstruction,
                        previous_interaction_id: interaction_id
                    });
                } else {
                    throw searchError;
                }
            }

            return res.status(200).json({
                success: true,
                message: interaction.output_text,
                interaction_id: interaction.id || interaction_id,
                model_used: activeModel
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                success: false,
                message: "Ada masalah bos!\n Error: " + error.message,
                model_used: activeModel
            });
        }
    })
    .listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });