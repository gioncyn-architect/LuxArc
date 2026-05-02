// api/youcam.js — Vercel Serverless Function v8 (FINAL)
// Produk: AI Clothes V3, AI Necklace VTO, AI Makeup VTO,
//         AI Hair Color, AI Hairstyle V2.1, Skin Analysis V2.1, AI Look VTO

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

  // Ekstrak URL hasil dari berbagai format response YouCam
  function extractResultUrl(result) {
    return (
      result?.data?.results?.url       ||
      result?.data?.results?.[0]?.url  ||
      result?.data?.result_url         ||
      result?.data?.output_url         ||
      result?.data?.image_url          ||
      result?.data?.dst_file_url       ||
      result?.data?.url                ||
      result?.result_url               ||
      result?.output_url               ||
      result?.image_url                ||
      null
    );
  }

  // Polling sampai task selesai
  async function pollTask(taskId, pollEndpoint, maxRetry = 40, intervalMs = 2000) {
    for (let i = 0; i < maxRetry; i++) {
      await sleep(intervalMs);
      const r = await fetch(`${BASE_URL}${pollEndpoint}/${taskId}`, { headers: HEADERS });
      const rawText = await r.text();
      let d;
      try { d = JSON.parse(rawText); } catch {
        throw new Error('Response bukan JSON saat polling: ' + rawText.slice(0, 200));
      }
      const status = (
        d?.data?.task_status || d?.data?.status || d?.task_status || d?.status || ''
      ).toLowerCase();

      console.log(`[Poll ${i + 1}] taskId=${taskId} status="${status}"`);

      if (['success', 'completed', 'done', 'finish', 'finished'].includes(status)) return d;
      if (['error', 'failed', 'fail'].includes(status))
        throw new Error('Tugas AI gagal: ' + JSON.stringify(d));

      // Beberapa endpoint langsung return URL tanpa status "success"
      const url = extractResultUrl(d);
      if (url) return d;
    }
    throw new Error('Timeout: AI tidak selesai dalam waktu yang ditentukan.');
  }

  // Helper umum: POST task → poll → return result
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
        detail: startData,
        status: startRes.status,
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
        detail: result,
        status: 500,
      };
    }
    return { success: true, result_url: resultUrl, raw: result };
  }

  // ══════════════════════════════════════════════════════════
  try {

    // ── 1. Skin Analysis V2.1 ───────────────────────────────
    // dst_actions SD: acne, moisture, pore, wrinkle, radiance, redness, oiliness, dll
    // JANGAN campur HD (hd_acne, dll) dan SD dalam satu request
    if (action === 'skin-analysis') {
      const { user_image_url, dst_actions } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const actions = dst_actions || ['acne', 'moisture', 'pore', 'wrinkle', 'radiance', 'redness', 'oiliness', 'texture'];

      let startRes, rawText, startData;
      try {
        startRes = await fetch(`${BASE_URL}/s2s/v2.1/task/skin-analysis`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({
            src_file_url: user_image_url,
            dst_actions: actions,
            miniserver_args: { enable_mask_overlay: false },
            format: 'json',
          }),
        });
        rawText = await startRes.text();
        try { startData = JSON.parse(rawText); } catch {
          return res.status(500).json({ error: 'Response API bukan JSON: ' + rawText.slice(0, 300) });
        }
      } catch (e) {
        return res.status(500).json({ error: 'Gagal koneksi ke YouCam: ' + e.message });
      }

      if (!startRes.ok)
        return res.status(startRes.status).json({ error: startData?.message || startData?.error || 'Gagal memulai Skin Analysis', detail: startData });

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      let result;
      try { result = await pollTask(taskId, '/s2s/v2.1/task/skin-analysis'); }
      catch (e) { return res.status(500).json({ error: e.message }); }

      return res.status(200).json(result);
    }

    // ── 2. AI Clothes V3.0 ──────────────────────────────────
    // garment_category: 'upper_body' | 'lower_body' | 'full_body' | 'auto'
    if (action === 'ai-clothes') {
      const { user_image_url, cloth_image_url, garment_category } = body;
      if (!user_image_url)  return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!cloth_image_url) return res.status(400).json({ error: 'cloth_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/cloth-v3', {
        src_file_url: user_image_url,
        ref_file_url: cloth_image_url,
        garment_category: garment_category || 'auto',
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 3. AI Necklace VTO ──────────────────────────────────
    // ref_file_urls harus array sesuai docs
    if (action === 'ai-necklace') {
      const { user_image_url, necklace_image_url } = body;
      if (!user_image_url)     return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!necklace_image_url) return res.status(400).json({ error: 'necklace_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/2d-vto/necklace', {
        src_file_url: user_image_url,
        ref_file_urls: [necklace_image_url],   // ← array, bukan string tunggal
        necklace_shadow_intensity: 0.15,
        necklace_ambient_light_intensity: 1.0,
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 4. AI Makeup VTO ────────────────────────────────────
    // zone: 'lip' → lip_color | 'eye' → eye_shadow
    // eye_shadow & lip_color WAJIB ada field pattern
    if (action === 'ai-makeup') {
      const { user_image_url, zone, color, pattern } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!color)          return res.status(400).json({ error: 'color (hex) diperlukan' });

      const isEye = zone === 'eye' || zone === 'eyes';

      const effect = isEye
        ? {
            // Eye Shadow — pattern wajib ada, default: 1color1
            category: 'eye_shadow',
            pattern: { name: pattern || '1color1' },
            palettes: [{
              color: color,
              texture: 'shimmer',
              shimmerColor: color,
              shimmerIntensity: 50,
              colorIntensity: 50,
            }],
          }
        : {
            // Lip Color — shape wajib ada
            category: 'lip_color',
            shape: { name: 'original' },
            style: { type: 'full' },
            morphology: { fullness: 0, wrinkless: 0 },
            palettes: [{
              color: color,
              texture: 'matte',
              colorIntensity: 50,
            }],
          };

      const out = await runTask('/s2s/v2.0/task/makeup-vto', {
        src_file_url: user_image_url,
        effects: [effect],
        version: '1.0',
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 5. AI Hair Color ────────────────────────────────────
    // Endpoint terpisah dari makeup-vto
    // Kirim palette dengan warna hex
    if (action === 'ai-hair-color') {
      const { user_image_url, color, color_name } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!color)          return res.status(400).json({ error: 'color (hex) diperlukan' });

      const out = await runTask('/s2s/v2.0/task/hair-color', {
        src_file_url: user_image_url,
        palettes: [{
          color: color,
          colorIntensity: 70,
        }],
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, color_name: color_name || '', ...out.raw });
    }

    // ── 6. AI Hairstyle V2.1 ────────────────────────────────
    // Pakai endpoint terbaru v2.1/task/hair-transfer
    // Bisa pakai template_id ATAU ref_file_url (foto referensi gaya rambut)
    if (action === 'ai-hairstyle') {
      const { user_image_url, template_id, ref_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!template_id && !ref_image_url)
        return res.status(400).json({ error: 'template_id atau ref_image_url diperlukan' });

      const payload = {
        src_file_url: user_image_url,
        ...(template_id   ? { template_id }              : {}),
        ...(ref_image_url ? { ref_file_url: ref_image_url } : {}),
      };

      const out = await runTask('/s2s/v2.1/task/hair-transfer', payload);
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 7. AI Look VTO ──────────────────────────────────────
    // template_id didapat dari GET /s2s/v2.0/task/template/look-vto
    if (action === 'ai-look') {
      const { user_image_url, template_id } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!template_id)    return res.status(400).json({ error: 'template_id diperlukan' });

      const out = await runTask('/s2s/v2.0/task/look-vto', {
        src_file_url: user_image_url,
        template_id,
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── Action tidak dikenal ─────────────────────────────────
    return res.status(400).json({
      error: `Action tidak dikenal: "${action}"`,
      available_actions: [
        'skin-analysis',
        'ai-clothes',
        'ai-necklace',
        'ai-makeup',
        'ai-hair-color',
        'ai-hairstyle',
        'ai-look',
      ],
    });

  } catch (err) {
    console.error('[YouCam API Error]', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
}
