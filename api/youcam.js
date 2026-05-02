// api/youcam.js — Vercel Serverless Function v6
// Fitur: AI Clothes, AI Accessory, AI Makeup, AI Hair Color,
//        AI Hairstyle, AI Wig, Photo Enhancer, Skin Analysis

const BASE_URL = 'https://yce-api-01.makeupar.com';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── API Key ───────────────────────────────────────────────
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan di environment' });

  const { action } = req.query;
  if (!action) return res.status(400).json({ error: 'Parameter action diperlukan' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) body = {};

  const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function extractResultUrl(result) {
    return (
      result?.result_url           ||
      result?.data?.output_url     ||
      result?.data?.result_url     ||
      result?.data?.image_url      ||
      result?.data?.dst_file_url   ||
      result?.data?.url            ||
      result?.output_url           ||
      result?.image_url            ||
      result?.data?.results?.url   ||
      result?.data?.results?.[0]?.url ||
      null
    );
  }

  async function pollTask(taskId, endpoint, maxRetry = 30, intervalMs = 2000) {
    for (let i = 0; i < maxRetry; i++) {
      await sleep(intervalMs);
      const r = await fetch(`${BASE_URL}${endpoint}/${taskId}`, { headers: HEADERS });
      const rawText = await r.text();
      let d;
      try { d = JSON.parse(rawText); } catch {
        throw new Error('Response bukan JSON saat polling: ' + rawText.slice(0, 200));
      }
      const status = (
        d?.data?.task_status || d?.data?.status || d?.task_status || d?.status || ''
      ).toLowerCase();

      console.log(`[Poll ${i + 1}] taskId=${taskId} status="${status}"`);

      if (['success','completed','done','finish','finished'].includes(status)) return d;
      if (['error','failed','fail'].includes(status)) throw new Error('Tugas AI gagal: ' + JSON.stringify(d));

      const url = extractResultUrl(d);
      if (url) return d;
    }
    throw new Error('Timeout: AI tidak selesai dalam waktu yang ditentukan.');
  }

  async function runTask(endpoint, payload) {
    let startRes, rawText, startData;
    try {
      startRes = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify(payload),
      });
      rawText = await startRes.text();
      try { startData = JSON.parse(rawText); } catch {
        return { error: 'Response API bukan JSON: ' + rawText.slice(0, 300), status: 500 };
      }
    } catch (fetchErr) {
      return { error: 'Gagal koneksi ke YouCam API: ' + fetchErr.message, status: 500 };
    }

    if (!startRes.ok) {
      return {
        error: startData?.message || startData?.error || `Gagal memulai task (${startRes.status})`,
        detail: startData, status: startRes.status,
      };
    }

    const taskId = startData?.data?.task_id || startData?.task_id;
    if (!taskId) {
      const directUrl = extractResultUrl(startData);
      if (directUrl) return { success: true, result_url: directUrl, raw: startData };
      return { error: 'Tidak dapat task_id dari API', detail: startData, status: 500 };
    }

    let result;
    try { result = await pollTask(taskId, endpoint); }
    catch (pollErr) { return { error: pollErr.message, status: 500 }; }

    const resultUrl = extractResultUrl(result);
    if (!resultUrl) {
      return {
        error: 'AI selesai tapi tidak ada URL hasil: ' + JSON.stringify(result).slice(0, 300),
        detail: result, status: 500,
      };
    }
    return { success: true, result_url: resultUrl, raw: result };
  }

  // ══════════════════════════════════════════════════════════
  try {

    // ── 1. Skin Analysis ────────────────────────────────────
    if (action === 'skin-analysis') {
      const { user_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      let startRes, rawText, startData;
      try {
        startRes = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-analysis`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({
            src_file_url: user_image_url,
            dst_actions: ['acne','moisture','pores','wrinkles','radiance','skin_tone'],
            miniserver_args: { enable_mask_overlay: false },
            format: 'json', pf_camera_kit: false,
          }),
        });
        rawText = await startRes.text();
        try { startData = JSON.parse(rawText); } catch {
          return res.status(500).json({ error: 'Response API bukan JSON: ' + rawText.slice(0, 300) });
        }
      } catch (e) {
        return res.status(500).json({ error: 'Gagal koneksi ke YouCam: ' + e.message });
      }

      if (!startRes.ok) return res.status(startRes.status).json({ error: startData?.message || 'Gagal memulai Skin Analysis', detail: startData });

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      let result;
      try { result = await pollTask(taskId, '/s2s/v2.0/task/skin-analysis'); }
      catch (e) { return res.status(500).json({ error: e.message }); }

      return res.status(200).json(result);
    }

    // ── 2. AI Clothes ───────────────────────────────────────
    if (action === 'ai-clothes') {
      const { user_image_url, cloth_image_url } = body;
      if (!user_image_url)  return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!cloth_image_url) return res.status(400).json({ error: 'cloth_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/cloth', {
        src_file_url: user_image_url,
        ref_file_url: cloth_image_url,
        garment_category: 'auto',
        format: 'json', pf_camera_kit: false,
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 3. AI Accessory ─────────────────────────────────────
    if (action === 'ai-accessory') {
      const { user_image_url, accessory_image_url, accessory_type } = body;
      if (!user_image_url)      return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!accessory_image_url) return res.status(400).json({ error: 'accessory_image_url diperlukan' });

      if (accessory_type === 'hat') {
        const out = await runTask('/s2s/v2.0/task/cloth', {
          src_file_url: user_image_url,
          ref_file_url: accessory_image_url,
          garment_category: 'hat',
          format: 'json', pf_camera_kit: false,
        });
        if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
        return res.status(200).json({ result_url: out.result_url, ...out.raw });
      }

      const out = await runTask('/s2s/v2.0/task/accessory', {
        src_file_url: user_image_url,
        source_info: { name: user_image_url },
        ref_file_urls: [accessory_image_url],
        ref_file_ids: [],
        object_infos: [{
          name: accessory_image_url,
          parameter: {
            necklace_need_remove_background: false,
            necklace_shadow_intensity: 0.5,
            necklace_ambient_light_intensity: 0.5,
          },
        }],
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 4. AI Makeup ────────────────────────────────────────
    if (action === 'ai-makeup') {
      const { user_image_url, zone, color } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const lipColor = color || '#FF0000';
      const eyeColor = color || '#8B4513';
      const category = zone === 'eye' || zone === 'eyes' ? 'eye_shadow' : 'lip_color';

      const out = await runTask('/s2s/v2.0/task/makeup', {
        src_file_url: user_image_url,
        effects: [{
          category,
          ...(category === 'eye_shadow' ? {
            palettes: [{ color: eyeColor, texture: 'shimmer', colorIntensity: 50 }],
          } : {
            shape: { name: 'original' },
            style: { type: 'full' },
            morphology: { fullness: 0, wrinkless: 0 },
            palettes: [{ color: lipColor, texture: 'matte', colorIntensity: 50 }],
          }),
        }],
        version: '1.0',
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 5. AI Hair Color (NEW) ──────────────────────────────
    if (action === 'ai-hair-color') {
      const { user_image_url, color, color_name } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!color)          return res.status(400).json({ error: 'color (hex) diperlukan' });

      const out = await runTask('/s2s/v2.0/task/makeup', {
        src_file_url: user_image_url,
        effects: [{
          category: 'hair_color',
          palettes: [{ color: color, texture: 'natural', colorIntensity: 70 }],
        }],
        version: '1.0',
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, color_name: color_name || '', ...out.raw });
    }

    // ── 6. AI Hairstyle ─────────────────────────────────────
    if (action === 'ai-hairstyle') {
      const { user_image_url, style } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/hair-style', {
        src_file_url: user_image_url,
        style: style || 'natural',
        format: 'json', pf_camera_kit: false,
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 7. AI Wig ────────────────────────────────────────────
    if (action === 'ai-wig') {
      const { user_image_url, template_id, wig_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const payload = template_id
        ? { src_file_url: user_image_url, template_id }
        : wig_image_url
          ? { src_file_url: user_image_url, ref_file_url: wig_image_url }
          : null;
      if (!payload) return res.status(400).json({ error: 'Kirim template_id atau wig_image_url' });

      const out = await runTask('/s2s/v2.0/task/wig', payload);
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 8. Photo Enhancer ────────────────────────────────────
    if (action === 'photo-enhance') {
      const { user_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/photo-enhancer', {
        src_file_url: user_image_url,
        format: 'json', pf_camera_kit: false,
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── Action tidak dikenal ─────────────────────────────────
    return res.status(400).json({
      error: `Action tidak dikenal: "${action}"`,
      available_actions: [
        'skin-analysis','ai-clothes','ai-accessory',
        'ai-makeup','ai-hair-color','ai-hairstyle',
        'ai-wig','photo-enhance',
      ],
    });

  } catch (err) {
    console.error('[YouCam API Error]', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
}
