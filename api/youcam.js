// api/youcam.js — Vercel Serverless Function v9 (BUGFIX)
// Produk: AI Clothes V3, AI Necklace VTO, AI Makeup VTO,
//         AI Hair Color, AI Hairstyle V2.1, Skin Analysis V2.1, AI Look VTO
//
// BugFix v9:
//   [1] ai-makeup: tambah case 'blush' — sebelumnya semua non-eye
//       langsung jadi lip_color, termasuk blush → ini penyebab
//       blush hasilnya lipstik merah!
//   [2] ai-makeup: baca field "category" dari body (bukan hanya "zone")
//       + baca "effect" object lengkap dari frontend jika ada
//   [3] ai-hair-color: baca field "palettes" & "preset" dari frontend
//       agar tidak null pattern
//   [4] ai-hairstyle: mapping style name → template_id yang valid
//       sebelumnya frontend kirim "natural/curly/etc" tapi backend
//       butuh template_id → hasilnya error karena keduanya null

const BASE_URL = 'https://yce-api-01.makeupar.com';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

// ── Mapping hairstyle name → template_id YouCam ──────────────
// Template ID ini dari katalog YouCam Hairstyle V2.1
// Sesuaikan jika kamu punya template_id spesifik dari akun kamu
const HAIRSTYLE_TEMPLATE_MAP = {
  natural:  'natural_01',
  curly:    'curly_01',
  straight: 'straight_01',
  wavy:     'wavy_01',
  bob:      'bob_01',
  pixie:    'pixie_01',
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

  // ── Ekstrak URL hasil dari berbagai format response YouCam ─
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

  // ── Polling sampai task selesai ───────────────────────────
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

  // ── Helper umum: POST task → poll → return result ─────────
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

  // ════════════════════════════════════════════════════════════
  try {

    // ── 1. Skin Analysis V2.1 ───────────────────────────────
    if (action === 'skin-analysis') {
      const { user_image_url, dst_actions } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const actions = dst_actions || [
        'acne', 'moisture', 'pore', 'wrinkle',
        'radiance', 'redness', 'oiliness', 'texture',
      ];

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
        return res.status(startRes.status).json({
          error: startData?.message || startData?.error || 'Gagal memulai Skin Analysis',
          detail: startData,
        });

      const taskId = startData?.data?.task_id || startData?.task_id;
      if (!taskId) return res.status(500).json({ error: 'Tidak dapat task_id', detail: startData });

      let result;
      try { result = await pollTask(taskId, '/s2s/v2.1/task/skin-analysis'); }
      catch (e) { return res.status(500).json({ error: e.message }); }

      return res.status(200).json(result);
    }

    // ── 2. AI Clothes V3.0 ──────────────────────────────────
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
    if (action === 'ai-necklace') {
      const { user_image_url, necklace_image_url } = body;
      if (!user_image_url)     return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!necklace_image_url) return res.status(400).json({ error: 'necklace_image_url diperlukan' });

      const out = await runTask('/s2s/v2.0/task/2d-vto/necklace', {
        src_file_url: user_image_url,
        ref_file_urls: [necklace_image_url],
        necklace_shadow_intensity: 0.15,
        necklace_ambient_light_intensity: 1.0,
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 4. AI Makeup VTO ────────────────────────────────────
    // [FIXED v9] Sebelumnya: hanya ada 2 kondisi (eye vs lip)
    //            → blush tidak ada kasusnya → jatuh ke lip_color → lipstik! 😂
    // Sekarang: baca "category" dari frontend + handle semua kategori
    //           + terima "effect" object langsung jika frontend sudah siapkan
    if (action === 'ai-makeup') {
      const { user_image_url, zone, category, color, effect: frontendEffect } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      // Prioritas: baca "category" dulu, fallback ke "zone" (backward compatible)
      const cat = (category || zone || 'lip_color').toLowerCase();

      // Jika frontend sudah kirim effect object lengkap, pakai langsung
      // Ini cara paling aman — frontend yang tahu pattern/shape yang benar
      let effectObject;

      if (frontendEffect && frontendEffect.category) {
        // ✅ Pakai effect dari frontend langsung (script.js v4 sudah kirim ini)
        effectObject = frontendEffect;
        console.log('[makeup] Pakai effect dari frontend:', JSON.stringify(effectObject));
      } else {
        // Fallback: bangun effect di backend berdasarkan category
        // [FIXED] Tambah case 'blush' — sebelumnya tidak ada!
        const col = color || '#E8A0A0';

        if (cat === 'blush') {
          // ✅ FIXED: blush sekarang punya kasusnya sendiri
          effectObject = {
            category: 'blush',
            pattern: { name: '1color1' },   // valid dari blush.json
            palettes: [{
              color: col,
              texture: 'matte',
              colorIntensity: 65,
            }],
          };
        } else if (cat === 'eye_shadow' || cat === 'eye' || cat === 'eyes') {
          effectObject = {
            category: 'eye_shadow',
            pattern: { name: '1color1' },   // valid dari eyeshadow.json
            palettes: [{
              color: col,
              texture: 'shimmer',
              shimmerColor: col,
              shimmerIntensity: 50,
              colorIntensity: 50,
            }],
          };
        } else if (cat === 'eye_liner' || cat === 'liner') {
          effectObject = {
            category: 'eye_liner',
            pattern: { name: 'Arabic3' },   // valid dari eyeliner.json
            palettes: [{
              color: col,
              texture: 'matte',
              colorIntensity: 90,
            }],
          };
        } else if (cat === 'bronzer') {
          effectObject = {
            category: 'bronzer',
            pattern: { name: 'Bronzer1' },  // valid dari bronzer.json
            palettes: [{
              color: col,
              colorIntensity: 50,
            }],
          };
        } else {
          // Default: lip_color (untuk 'lip', 'lips', 'lip_color', dll)
          effectObject = {
            category: 'lip_color',
            shape: { name: 'original' },    // valid dari lipshape.json
            style: { type: 'full' },
            morphology: { fullness: 0, wrinkless: 0 },
            palettes: [{
              color: col,
              texture: 'matte',
              colorIntensity: 80,
            }],
          };
        }

        console.log('[makeup] Bangun effect di backend untuk category:', cat);
      }

      const out = await runTask('/s2s/v2.0/task/makeup-vto', {
        src_file_url: user_image_url,
        effects: [effectObject],
        version: '1.0',
      });
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 5. AI Hair Color ────────────────────────────────────
    // [FIXED v9] Sebelumnya: hanya baca body.color
    //            Sekarang: baca preset & palettes dari frontend juga
    //            Frontend v4 kirim: { color, color_name, preset, palettes }
    if (action === 'ai-hair-color') {
      const { user_image_url, color, color_name, preset, palettes } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      // Bangun payload YouCam Hair Color API
      // Jika ada preset → pakai preset (prioritas sesuai docs YouCam)
      // Jika tidak ada preset → pakai palettes dengan hex color
      let hairPayload = { src_file_url: user_image_url };

      if (preset) {
        // Preset prioritas — docs YouCam: jika preset + palettes, preset menang
        hairPayload.preset = preset;
        console.log('[hair-color] Pakai preset:', preset);
      }

      // Selalu sertakan palettes sebagai fallback / untuk warna custom
      if (palettes && Array.isArray(palettes) && palettes.length > 0) {
        hairPayload.palettes = palettes;
        console.log('[hair-color] Pakai palettes dari frontend:', JSON.stringify(palettes));
      } else if (color) {
        // Fallback: bangun palettes dari color hex
        hairPayload.palettes = [{
          color: color,
          colorIntensity: 75,
        }];
        console.log('[hair-color] Bangun palettes dari color:', color);
      } else if (!preset) {
        // Tidak ada preset maupun color — error
        return res.status(400).json({ error: 'color (hex), preset, atau palettes diperlukan' });
      }

      const out = await runTask('/s2s/v2.0/task/hair-color', hairPayload);
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, color_name: color_name || '', ...out.raw });
    }

    // ── 6. AI Hairstyle V2.1 ────────────────────────────────
    // [FIXED v9] Sebelumnya: frontend kirim "style" (e.g. "natural")
    //            tapi backend langsung pakai sebagai template_id → error!
    //            Sekarang: mapping style name → template_id yang valid
    if (action === 'ai-hairstyle') {
      const { user_image_url, style, template_id, ref_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      // [FIX] Mapping style name → template_id jika template_id tidak dikirim langsung
      let finalTemplateId = template_id;
      if (!finalTemplateId && style) {
        finalTemplateId = HAIRSTYLE_TEMPLATE_MAP[style.toLowerCase()] || HAIRSTYLE_TEMPLATE_MAP['natural'];
        console.log(`[hairstyle] Mapping style "${style}" → template_id "${finalTemplateId}"`);
      }

      if (!finalTemplateId && !ref_image_url) {
        return res.status(400).json({
          error: 'template_id, ref_image_url, atau style diperlukan',
          available_styles: Object.keys(HAIRSTYLE_TEMPLATE_MAP),
        });
      }

      const payload = {
        src_file_url: user_image_url,
        ...(finalTemplateId ? { template_id: finalTemplateId } : {}),
        ...(ref_image_url   ? { ref_file_url: ref_image_url }  : {}),
      };

      const out = await runTask('/s2s/v2.1/task/hair-transfer', payload);
      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 7. AI Look VTO ──────────────────────────────────────
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
