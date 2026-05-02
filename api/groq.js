// api/groq.js — Vercel Serverless Function
// Personal Stylist AI powered by Groq (LLaMA)
// Fitur: Chat fashion, analisis gaya, rekomendasi produk LuxArc

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

// ── Katalog produk LuxArc (untuk konteks rekomendasi) ────────
const LUXARC_PRODUCTS = `
KATALOG PRODUK LUXARC AI:

PAKAIAN:
- Blouse 2245 (Elegant Striped Top) - Rp 185.000
- Rok Plisket 3301 (Flowy Pleated Skirt) - Rp 210.000
- Dress Batik Modern 4412 (Fusion Batik) - Rp 320.000
- Celana Kulot 1198 (Wide Leg Pants) - Rp 175.000

PERHIASAN MEWAH:
- Kalung Mutiara (Classic White Pearl) - Rp 450.000
- Kalung Emas 211 (Pure Gold 24k) - Rp 1.250.000
- Gelang Emas Putih (White Gold Bracelet) - Rp 890.000
- Anting Berlian Mini (Mini Diamond Earring) - Rp 675.000

AKSESORIS:
- Kaca Mata GC (UV Protect Luxury) - Rp 150.000
- Tas Kulit Premium (Genuine Leather Bag) - Rp 850.000
- Topi Anyaman (Woven Sun Hat) - Rp 125.000

KECANTIKAN:
- Cat Rambut Premium (AI Hair Color Try-On) - Rp 125.000
- Skincare Jerawat Set (Acne Care Series) - Rp 285.000
- Lipstik Velvet Merah (Velvet Red Lip) - Rp 95.000
- Eyeshadow Palette Gold (Gold Eye Palette) - Rp 185.000
`;

const SYSTEM_PROMPT = `Kamu adalah LuxArc AI Style Advisor — personal stylist AI premium untuk platform fashion & kecantikan Indonesia bernama LuxArc AI.

Kepribadianmu:
- Ramah, elegan, dan profesional
- Berbicara dalam Bahasa Indonesia yang natural
- Antusias tentang fashion dan kecantikan
- Memberikan saran yang personal dan spesifik

Kemampuanmu:
1. Merekomendasikan produk dari katalog LuxArc berdasarkan preferensi user
2. Memberikan tips mix & match outfit
3. Saran warna yang cocok berdasarkan undertone kulit
4. Tips perawatan kulit dan kecantikan
5. Analisis tren fashion terkini
6. Membantu user memilih aksesoris yang sesuai

${LUXARC_PRODUCTS}

Aturan penting:
- Selalu rekomendasikan produk dari katalog LuxArc jika relevan
- Sebutkan nama produk dengan jelas beserta harganya
- Jika user ingin coba virtual, arahkan mereka ke fitur AI Try-On
- Jawaban maksimal 3-4 paragraf, padat dan berguna
- Gunakan emoji secukupnya agar terasa friendly
- Jangan keluar dari topik fashion, kecantikan, dan produk LuxArc`;

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  // ── API Key ───────────────────────────────────────────────
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY tidak ditemukan di environment' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const { message, history = [] } = body;
  if (!message) return res.status(400).json({ error: 'message diperlukan' });

  try {
    // ── Bangun conversation messages untuk Groq ───────────────
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Tambahkan history sebelumnya
    for (const h of history) {
      if (h.role && h.text) {
        messages.push({
          role: h.role === 'bot' ? 'assistant' : 'user',
          content: h.text,
        });
      }
    }

    // Tambahkan pesan terbaru user
    messages.push({ role: 'user', content: message });

    // ── Kirim ke Groq API ─────────────────────────────────────
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Model terbaik Groq untuk chat
        messages,
        temperature: 0.8,
        max_tokens: 1024,
        top_p: 0.9,
      }),
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      console.error('[Groq Error]', groqData);
      return res.status(groqRes.status).json({
        error: groqData?.error?.message || 'Groq API error',
        detail: groqData,
      });
    }

    // ── Ekstrak teks jawaban ──────────────────────────────────
    const replyText =
      groqData?.choices?.[0]?.message?.content ||
      'Maaf, aku tidak bisa menjawab saat ini. Coba lagi ya! ✨';

    return res.status(200).json({
      success: true,
      reply: replyText,
    });

  } catch (err) {
    console.error('[Groq Handler Error]', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
}
