// api/youcam.js — Vercel Serverless Function
// Fitur: AI Clothes, AI Accessory (Kalung), AI Makeup, AI Wig/Hairstyle, Photo Enhancer, Skin Analysis

const BASE_URL = 'https://yce-api-01.makeupar.com';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // ── CORS Headers ─────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── API Key ──────────────────────────────────────────────────
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan di environment' });

  const { action } = req.query;
  if (!action) return res.status(400).json({ error: 'Parameter action diperlukan' });

  // ── Parse Body ───────────────────────────────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── Helper: Poll task sampai selesai ─────────────────────────
  async function pollTask(taskId, endpoint, maxRetry = 30, intervalMs = 2000) {
    for (let i = 0; i < maxRetry; i++) {
      await sleep(intervalMs);
      const r = await fetch(`${BASE_URL}${endpoint}/${taskId}`, { headers: HEADERS });
      const d = await r.json();
      const status = d?.data?.task_status || d?.task_status;

      if (status === 'success') return d;
     if (status === 'error' || status === 'failed') {
  const errMsg = d?.data?.error_message || d?.data?.error || 'Tugas AI gagal';
  
  // Pesan ramah untuk user
  if (errMsg.includes('too similar to source')) {
    throw new Error('Foto terlalu mirip dengan produk. Pastikan foto full body dan menghadap depan.');
  }
  if (errMsg.includes('Editing failed')) {
    throw new Error('AI gagal memproses foto. Coba gunakan foto yang lebih jelas dan full body.');
  }
  
  throw new Error(errMsg);
}
      }
      // status: 'pending' / 'processing' → lanjut poll
    }
    throw new Error('Timeout: AI tidak selesai dalam waktu yang ditentukan.');
  }

  // ── Helper: Ekstrak URL hasil dari response ──────────────────
  function extractResultUrl(result) {
    return (
      result?.data?.output_url      ||
      result?.data?.result_url      ||
      result?.data?.image_url       ||
      result?.data?.dst_file_url    ||
      result?.data?.url             ||
      result?.output_url            ||
      result?.result_url            ||
      result?.image_url             ||
      null
    );
  }

  // ── Helper: Start task + poll + return ──────────────────────
  async function runTask(endpoint, payload) {
    const startRes = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    const startData = await startRes.json();
    if (!startRes.ok) {
      return { error: startData?.message || `Gagal memulai task di ${endpoint}`, detail: startData, status: startRes.status };
    }

    const taskId = startData?.data?.task_id || startData?.task_id;
    if (!taskId) {
      return { error: 'Tidak dapat task_id dari API', detail: startData, status: 500 };
    }

    const result = await pollTask(taskId, endpoint);
    const resultUrl = extractResultUrl(result);
    if (!resultUrl) {
      return { error: 'AI selesai tapi tidak ada URL hasil', detail: result, status: 500 };
    }

    return { success: true, result_url: resultUrl, raw: result };
  }

  // ════════════════════════════════════════════════════════════
  try {

    // ── 1. Skin Analysis ─────────────────────────────────────
    if (action === 'skin-analysis') {
      const { user_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-analysis`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          src_file_url: user_image_url,
          dst_actions: ['acne', 'moisture', 'pores', 'wrinkles', 'radiance', 'skin_tone'],
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json({ error: startData?.message || 'Gagal memulai Skin Analysis', detail: startData });

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/skin-analysis');
      return res.status(200).json(result);
    }

    // ── 2. AI Clothes (Virtual Try-On Baju) ──────────────────
    if (action === 'ai-clothes') {
      const { user_image_url, cloth_image_url } = body;
      if (!user_image_url)  return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!cloth_image_url) return res.status(400).json({ error: 'cloth_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/cloth', {
        src_file_url: user_image_url,
        ref_file_url: cloth_image_url,
        garment_category: 'auto',
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 3. AI Accessory — Kalung (Necklace) ──────────────────
    if (action === 'ai-accessory') {
      const { user_image_url, accessory_image_url, accessory_type } = body;
      if (!user_image_url)       return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!accessory_image_url)  return res.status(400).json({ error: 'accessory_image_url diperlukan' });

      const category = accessory_type || 'necklace'; // default kalung

      const out = await runTask('/s2s/v2.0/task/accessory', {
        src_file_url:        user_image_url,
        ref_file_url:        accessory_image_url,
        accessory_category:  category,
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 4. AI Makeup (Lipstik & Eyeshadow) ───────────────────
    if (action === 'ai-makeup') {
      const { user_image_url, product_image_url, zone } = body;
      if (!user_image_url)    return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!product_image_url) return res.status(400).json({ error: 'product_image_url diperlukan' });

      // zone: 'eye' → eyeshadow, selain itu → lipstik
      const makeupType = zone === 'eye' ? 'eye-shadow' : 'lip-color';

      const out = await runTask('/s2s/v2.0/task/makeup', {
        src_file_url:  user_image_url,
        ref_file_url:  product_image_url,
        dst_actions:   [makeupType],
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 5. AI Hairstyle ───────────────────────────────────────
    if (action === 'ai-hairstyle') {
      const { user_image_url, style } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/hair-style', {
        src_file_url: user_image_url,
        style:        style || 'natural',
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 6. AI Wig ─────────────────────────────────────────────
    if (action === 'ai-wig') {
      const { user_image_url, template_id, wig_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      if (template_id) {
        // Pakai template dari katalog YouCam
        const out = await runTask('/s2s/v2.0/task/hair-color', {
          src_file_url: user_image_url,
          template_id:  template_id,
        });
        if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
        return res.status(200).json({ result_url: out.result_url, ...out.raw });
      }

      if (wig_image_url) {
        // Pakai gambar wig sebagai referensi
        const out = await runTask('/s2s/v2.0/task/hair-style', {
          src_file_url: user_image_url,
          ref_file_url: wig_image_url,
        });
        if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
        return res.status(200).json({ result_url: out.result_url, ...out.raw });
      }

      return res.status(400).json({ error: 'Kirim template_id atau wig_image_url untuk fitur AI Wig' });
    }

    // ── 7. Photo Enhancer ─────────────────────────────────────
    if (action === 'photo-enhance') {
      const { user_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/photo-enhancer', {
        src_file_url: user_image_url,
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── Action tidak dikenal ──────────────────────────────────
    return res.status(400).json({
      error: `Action tidak dikenal: "${action}"`,
      available_actions: [
        'skin-analysis',
        'ai-clothes',
        'ai-accessory',
        'ai-makeup',
        'ai-hairstyle',
        'ai-wig',
        'photo-enhance',
      ],
    });

  } catch (err) {
    console.error('[YouCam API Error]', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
}
