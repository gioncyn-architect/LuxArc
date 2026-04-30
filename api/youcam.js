// api/youcam.js — Vercel Serverless Function
// Proxy semua request ke YouCam API agar API key aman di server

const BASE_URL = 'https://yce-api-01.perfectcorp.com';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan' });

  const { action } = req.query;

  try {
    // ── 1. Upload file → dapat file_id & upload URL ──────────────
    if (action === 'get-upload-url') {
      const { filename, content_type } = req.body;
      const response = await fetch(`${BASE_URL}/s2s/v2.0/file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, content_type }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ── 2. AI Clothes ─────────────────────────────────────────────
    if (action === 'ai-clothes') {
      const { file_id, cloth_file_id } = req.body;
      const response = await fetch(`${BASE_URL}/s2s/v2.0/task/ai-clothes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_file: { file_id },
          cloth_file: { file_id: cloth_file_id },
        }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ── 3. AI Hairstyle ───────────────────────────────────────────
    if (action === 'ai-hairstyle') {
      const { file_id, style } = req.body;
      const response = await fetch(`${BASE_URL}/s2s/v2.0/task/ai-hairstyle-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_file: { file_id },
          style: style || 'natural',
        }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ── 4. Photo Enhancer ─────────────────────────────────────────
    if (action === 'photo-enhance') {
      const { file_id } = req.body;
      const response = await fetch(`${BASE_URL}/s2s/v2.0/task/photo-enhancer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_file: { file_id },
        }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ── 5. Poll task status ───────────────────────────────────────
    if (action === 'task-status') {
      const { task_id, task_type } = req.query;
      const response = await fetch(`${BASE_URL}/s2s/v2.0/task/${task_type}/${task_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(400).json({ error: 'Action tidak dikenal: ' + action });

  } catch (err) {
    console.error('YouCam API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
