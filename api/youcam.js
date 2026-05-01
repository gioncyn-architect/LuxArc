// api/youcam.js — Vercel Serverless Function v7 (FIX dst_actions)
const BASE_URL = 'https://yce-api-01.makeupar.com';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan' });

  const { action } = req.query;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  async function pollTask(taskId, endpoint) {
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const r = await fetch(`${BASE_URL}${endpoint}/${taskId}`, { headers: HEADERS });
      const d = await r.json();
      const status = d?.data?.task_status || d?.task_status;
      if (status === 'success') return d;
      if (status === 'error') throw new Error('Tugas AI gagal: ' + JSON.stringify(d));
    }
    throw new Error('Timeout menunggu AI.');
  }

  try {

    // ── Skin Analysis (FIXED: tambah dst_actions) ─────────────
    if (action === 'skin-analysis') {
      const { user_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-analysis`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          src_file_url: user_image_url,
          dst_actions: [
            'acne',
            'moisture',
            'pores',
            'wrinkles',
            'radiance',
            'skin_tone'
          ],
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json(startData);

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/skin-analysis');
      return res.status(200).json(result);
    }

    // ── AI Clothes (Virtual Try-On) ───────────────────────────
    if (action === 'ai-clothes') {
      const { user_image_url, cloth_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan', body_received: body });
      if (!cloth_image_url) return res.status(400).json({ error: 'cloth_image_url diperlukan' });

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/cloth`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          src_file_url: user_image_url,
          ref_file_url: cloth_image_url,
          garment_category: 'auto',
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json(startData);

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/cloth');
      return res.status(200).json(result);
    }

    // ── AI Hairstyle ──────────────────────────────────────────
    if (action === 'ai-hairstyle') {
      const { user_image_url, style } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/hair-style`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          src_file_url: user_image_url,
          style: style || 'natural',
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json(startData);

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/hair-style');
      return res.status(200).json(result);
    }

    // ── Photo Enhancer ────────────────────────────────────────
    if (action === 'photo-enhance') {
      const { user_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/photo-enhancer`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ src_file_url: user_image_url }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json(startData);

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/photo-enhancer');
      return res.status(200).json(result);
    }
// ── Tambahkan di youcam.js SEBELUM baris ini: ────────────────
// return res.status(400).json({ error: 'Action tidak dikenal: ' + action });
// ─────────────────────────────────────────────────────────────

    // ── AI Makeup (Lipstik & Eyeshadow) ──────────────────────
    if (action === 'ai-makeup') {
      const { user_image_url, product_image_url, zone, product_name } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!product_image_url) return res.status(400).json({ error: 'product_image_url diperlukan' });

      // zone: 'lip' atau 'eye'
      const makeupType = zone === 'eye' ? 'eye-shadow' : 'lip-color';

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/makeup`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          src_file_url: user_image_url,
          ref_file_url: product_image_url,
          dst_actions: [makeupType],
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json(startData);

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/makeup');
      return res.status(200).json(result);
    }
    
    return res.status(400).json({ error: 'Action tidak dikenal: ' + action });

  } catch (err) {
    console.error('YouCam Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
