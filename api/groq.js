// api/groq.js — Vercel Serverless Function
// LuxArc AI Style Advisor powered by Groq (LLaMA)

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const LUXARC_PRODUCTS = `
PRODUCT CATALOG LUXARC AI:

WOMEN CLOTHING:
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

WOMEN DRESS:
- Dress Pelangi (Rainbow Colorful) - Rp 195.000
- Dress Kids Pita (Ribbon Kids Party) - Rp 145.000
- Dress Biru (Ocean Blue Midi) - Rp 185.000
- Dress 01 (Midi Wrap Floral) - Rp 215.000
- Dress 02 (Bodycon Night Out) - Rp 245.000
- Dress 03 (Bohemian Maxi) - Rp 228.000
- Dress 04 (Cocktail A-Line) - Rp 265.000
- Dress 05 (Summer Sundress) - Rp 188.000

MEN CLOTHING:
- Blazer Pria (Smart Casual Blazer) - Rp 325.000
- Jaket Denim (Classic Denim Jacket) - Rp 255.000

HATS:
- Topi xx (Streetwear Cap) - Rp 85.000
- Topi 01 (Bucket Hat Trendy) - Rp 95.000
- Topi 02 (Baseball Cap Urban) - Rp 78.000
- Topi 03 (Wide Brim Sun Hat) - Rp 115.000
- Topi 04 (Fedora Classic) - Rp 135.000
- Topi 05 (French Beret Chic) - Rp 98.000

JEWELRY:
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

HAIR COLOR:
- Cat Rambut Premium (AI Hair Color Try-On) - Rp 125.000
`;

// Language detection function
function detectLanguage(message) {
  const indonesianWords = [
    'aku', 'saya', 'kamu', 'yang', 'dan', 'di', 'ke', 'ini', 'itu',
    'mau', 'tidak', 'bisa', 'untuk', 'dengan', 'ada', 'apa', 'ya',
    'dong', 'deh', 'nih', 'loh', 'banget', 'gaun', 'baju', 'pakai',
    'pesta', 'cocok', 'bagus', 'gimana', 'boleh', 'perlu', 'butuh',
    'ingin', 'pengen', 'coba', 'lihat', 'pilih', 'suka', 'harga',
    'murah', 'mahal', 'warna', 'ukuran', 'pas', 'sesuai', 'acara',
    'kondangan', 'kerja', 'santai', 'formal', 'casual', 'hari', 'malam',
    'pagi', 'cantik', 'keren', 'bagaimana', 'kalau', 'jika', 'atau',
    'tapi', 'karena', 'jadi', 'sudah', 'belum', 'sedang', 'akan'
  ];
  const msgLower = message.toLowerCase();
  const foundWords = indonesianWords.filter(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(msgLower);
  });
  return foundWords.length >= 1 ? 'id' : 'en';
}

function buildSystemPrompt(lang, gender) {
  const langInstruction = lang === 'id'
    ? 'DETECTED LANGUAGE: Indonesian. You MUST reply in INDONESIAN (Bahasa Indonesia) only. Do not use any English words.'
    : 'DETECTED LANGUAGE: English. You MUST reply in ENGLISH only. Do not use any Indonesian words.';

  const genderInstruction = gender
    ? `User gender: ${gender === 'female'
        ? 'FEMALE — prioritize women products'
        : 'MALE — prioritize men products (Blazer Pria, Jaket Denim, Topi)'}`
    : '';

  // FIX: All context merged into ONE system message to avoid Groq multi-system conflicts
  return `You are LuxArc AI Style Advisor — a warm, friendly personal stylist for LuxArc AI fashion platform.

${langInstruction}
${genderInstruction}

LANGUAGE DETECTION — MOST IMPORTANT RULE:
- Detect the language of the user's message automatically
- If user writes in Indonesian → reply in INDONESIAN ONLY
- If user writes in English → reply in ENGLISH ONLY
- NEVER mix languages — this is critical
- When in doubt → use Indonesian as default

PERSONALITY:
- Warm and friendly like a best friend who knows fashion
- Honest — give real opinions, not just compliments
- Natural — talk like a real person, not a robot or salesperson
- Never pushy or spammy

IMPORTANT RULES:
1. Always reply in the SAME language as the user — auto detect it
2. Be natural and conversational — like a friendly stylist friend
3. Only recommend products when TRULY relevant to the question
4. If user asks about a specific product → give detailed honest opinion about it
5. If user asks for outfit advice → give fashion advice first, then suggest 1-2 products max
6. Maximum 2 product recommendations per response — only if truly relevant
7. Never list all products at once — that feels pushy and salesy
8. Be warm, honest, and helpful — not like a salesperson
9. If user just wants to chat → just chat naturally, no need to push products
10. Stay on topic: fashion, beauty, style tips, and LuxArc products only

PRODUCT RECOMMENDATION FORMAT:
- When you want to recommend a product, ALWAYS end your message with a special JSON block
- This JSON will be used to show product cards to the user
- Format exactly like this (at the very end of your message):

[PRODUCTS]
{"products":[{"name":"exact product name from catalog","price":"Rp 000.000","reason":"short reason why this suits them (1 sentence)"}]}
[/PRODUCTS]

- Only include this JSON block when recommending products
- If just chatting or answering general questions → do NOT include the JSON block
- Maximum 2 products in the JSON block

${LUXARC_PRODUCTS}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not found' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const { message, history = [], gender = null } = body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // Auto detect language
  const lang = detectLanguage(message);

  try {
    // FIX: Only ONE system message — no more multi-system conflict
    const messages = [
      { role: 'system', content: buildSystemPrompt(lang, gender) },
    ];

    // Include recent chat history (last 6 messages)
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
        temperature: 0.75,
        max_tokens: 1024,  // FIX: was 500 — too small, reply got cut off mid-response
        top_p: 0.9,
      }),
    });

    const groqData = await groqRes.json();

    // FIX: Log full Groq error for easier Vercel debugging
    if (!groqRes.ok) {
      console.error('Groq API error:', JSON.stringify(groqData));
      return res.status(groqRes.status).json({
        error: groqData?.error?.message || 'Groq API error',
        detail: groqData,
      });
    }

    let replyText = groqData?.choices?.[0]?.message?.content || '';

    // FIX: Fallback message if Groq returns empty content
    if (!replyText || replyText.trim() === '') {
      const fallback = lang === 'id'
        ? 'Maaf, aku lagi gangguan sebentar. Coba tanya lagi ya! ✨'
        : 'Sorry, something went wrong. Please try again! ✨';
      return res.status(200).json({
        success: true,
        reply: fallback,
        products: [],
        lang,
      });
    }

    // Parse product recommendations from reply
    let products = [];
    const productMatch = replyText.match(/\[PRODUCTS\]([\s\S]*?)\[\/PRODUCTS\]/);
    if (productMatch) {
      try {
        // FIX: Strip markdown code fences if model wraps JSON in ```
        const raw = productMatch[1].trim().replace(/^```json|^```|```$/gm, '').trim();
        const parsed = JSON.parse(raw);
        products = parsed.products || [];
      } catch (e) {
        console.error('Product JSON parse error:', e.message);
        products = [];
      }
      // Remove the JSON block from the reply text shown to user
      replyText = replyText.replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/, '').trim();
    }

    return res.status(200).json({
      success: true,
      reply: replyText,
      products,
      lang,
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
