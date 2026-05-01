// api/youcam.js — Vercel Serverless Function v2
// Menggunakan URL publik langsung (tidak perlu upload file)

const BASE_URL = 'https://yce-api-01.perfectcorp.com';
// Tambahkan ini di baris paling atas
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

  const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Poll helper
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

    // ── AI Clothes (Virtual Try-On) ───────────────────────────
    if (action === 'ai-clothes') {
      const { user_image_url, cloth_image_url } = req.body;

      // Step 1: Start task
      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/ai-clothes`, {
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

      // Step 2: Poll
      const result = await pollTask(taskId, '/s2s/v2.0/task/ai-clothes');
      return res.status(200).json(result);
    }

    // ── AI Hairstyle ──────────────────────────────────────────
    if (action === 'ai-hairstyle') {
      const { user_image_url, style } = req.body;

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/ai-hairstyle-generator`, {
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

      const result = await pollTask(taskId, '/s2s/v2.0/task/ai-hairstyle-generator');
      return res.status(200).json(result);
    }

    // ── Photo Enhancer ────────────────────────────────────────
    if (action === 'photo-enhance') {
      const { user_image_url } = req.body;

      const startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/photo-enhancer`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          src_file_url: user_image_url,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) return res.status(startRes.status).json(startData);

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      const result = await pollTask(taskId, '/s2s/v2.0/task/photo-enhancer');
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak dikenal: ' + action });

  } catch (err) {
    console.error('YouCam Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
