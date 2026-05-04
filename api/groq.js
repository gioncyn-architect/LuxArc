// api/groq.js — Vercel Serverless Function
// LuxArc AI Style Advisor powered by Groq (LLaMA)

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const LUXARC_PRODUCTS = `
KATALOG PRODUK LUXARC AI:

PAKAIAN WANITA:
- Blouse 2245 (Elegant Striped Top) - Rp 185.000
- Blouse Valen Cream (Soft Cream Elegant) - Rp 175.000
- Blouse Valen Hitam (Sleek Black) - Rp 175.000
- Rok Mini Hitam (Chic Black Skirt) - Rp 120.000
- Rok Levis 121 (Vintage Denim) - Rp 165.000
- Gaun Renda Malam (Luxury Lace Evening Gown) - Rp 485.000
- Kemeja Panjang (Formal Long Shirt) - Rp 175.000
- Kaos Olahraga (Sport Active Wear) - Rp 145.000
- Atasan Seksi Merah (Bold Red Sexy Top) - Rp 155.000
- Atasan 01 (Floral Chiffon Top) - Rp 135.000
- Atasan 02 (Classic Stripe Knit) - Rp 125.000
- Atasan 03 (Off Shoulder Glamour) - Rp 155.000
- Atasan 04 (Lace Trim Blouse) - Rp 148.000
- Atasan 05 (Wrap Style Crop Top) - Rp 138.000
- Atasan 06 (Ruffle Neck Romantic) - Rp 162.000
- Atasan 07 (Turtleneck Luxe Knit) - Rp 172.000
- Atasan 08 (Peplum Waist Flare) - Rp 159.000
- Atasan 09 (Halter Neck Satin) - Rp 168.000
- Atasan 10 (Corset Style Bodice) - Rp 195.000

DRESS WANITA:
- Dress Pelangi (Rainbow Colorful) - Rp 195.000
- Dress Kids Pita (Ribbon Kids Party) - Rp 145.000
- Dress Biru (Ocean Blue Midi) - Rp 185.000
- Dress 01 (Midi Wrap Floral) - Rp 215.000
- Dress 02 (Bodycon Night Out) - Rp 245.000
- Dress 03 (Bohemian Maxi) - Rp 228.000
- Dress 04 (Cocktail A-Line) - Rp 265.000
- Dress 05 (Summer Sundress) - Rp 188.000

PAKAIAN PRIA:
- Blazer Pria (Smart Casual Blazer) - Rp 325.000
- Jaket Denim (Classic Denim Jacket) - Rp 255.000

TOPI:
- Topi xx (Streetwear Cap) - Rp 85.000
- Topi 01 (Bucket Hat Trendy) - Rp 95.000
- Topi 02 (Baseball Cap Urban) - Rp 78.000
- Topi 03 (Wide Brim Sun Hat) - Rp 115.000
- Topi 04 (Fedora Classic) - Rp 135.000
- Topi 05 (French Beret Chic) - Rp 98.000

PERHIASAN:
- Kalung Mutiara (Classic White Pearl) - Rp 350.000
- Kalung Emas 211 (Pure Gold 24k) - Rp 2.500.000

MAKEUP:
- Lipstik Merah 01 (Matte Bold Red) - Rp 75.000
- Lipstik Pink 02 (Glossy Nude Pink) - Rp 75.000
- Lipstik Coklat Gold (Velvet Brown) - Rp 89.000
- Lipstik Collection (All Colors Bundle) - Rp 295.000
- Eyeshadow 001 (Smoky Eye Palette) - Rp 120.000
- Eyeshadow Gold (Glam Gold Palette) - Rp 135.000
- Blush On Collection (All Colors Bundle) - Rp 225.000

SKINCARE:
- Skincare Jerawat (Acne Clear Series) - Rp 195.000
- Skincare Pemutih (Brightening & Glow) - Rp 215.000

CAT RAMBUT:
- Cat Rambut Premium (AI Hair Color Try-On) - Rp 125.000
`;

const SYSTEM_PROMPT = `Kamu adalah LuxArc AI Style Advisor — personal stylist AI untuk platform fashion LuxArc AI.

ATURAN WAJIB — BACA BAIK-BAIK:
1. Jawab SINGKAT dan LANGSUNG — maksimal 2-3 kalimat saja
2. Rekomendasikan MAKSIMAL 2-3 produk yang paling relevan saja
3. Jangan panjang lebar, jangan jelaskan semua produk
4. Sesuaikan rekomendasi dengan gender user jika diketahui
5. Jika user wanita → rekomendasikan produk wanita
6. Jika user pria → rekomendasikan produk pria (Blazer Pria, Jaket Denim, Topi)
7. Detect the language used by the user and MUST reply in the SAME language. If user writes in English → reply in English. If Indonesian → reply in Indonesian.
8. Gunakan emoji secukupnya — jangan berlebihan
9. Jangan keluar dari topik fashion, kecantikan, dan produk LuxArc
10. Jika user minta coba produk → arahkan ke tombol "Coba Live" atau "Coba AI"

FORMAT JAWABAN:
- 1-2 kalimat respons
- Sebutkan 2-3 produk rekomendasi dengan harga
- 1 kalimat ajakan action (coba, beli, tanya lagi)

${LUXARC_PRODUCTS}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY tidak ditemukan' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const { message, history = [], gender = null } = body;
  if (!message) return res.status(400).json({ error: 'message diperlukan' });

  try {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Tambahkan konteks gender jika ada
    if (gender) {
      messages.push({
        role: 'system',
        content: `Konteks: User adalah ${gender === 'female' ? 'WANITA' : 'PRIA'}. Rekomendasikan produk yang sesuai gender ini.`
      });
    }

    // History percakapan (max 6 pesan terakhir saja)
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      if (h.role && h.text) {
        messages.push({
          role: h.role === 'bot' ? 'assistant' : 'user',
          content: h.text,
        });
      }
    }

    messages.push({ role: 'user', content: message });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 300, // Dibatasi supaya jawaban singkat
        top_p: 0.9,
      }),
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: groqData?.error?.message || 'Groq API error',
      });
    }

    const replyText =
      groqData?.choices?.[0]?.message?.content ||
      'Maaf, coba lagi ya! ✨';

    return res.status(200).json({ success: true, reply: replyText });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
}
