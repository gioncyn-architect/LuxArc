// api/youcam.js — Vercel Serverless Function v13
// FIX v13: ai-earring — tambah field "name" wajib di source_info & object_infos
//          sesuai error: [Path '/source_info'] Object has missing required properties (["name"])
//                        [Path '/object_infos/0'] Object has missing required properties (["name"])

const BASE_URL = 'https://yce-api-01.makeupar.com';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
  maxDuration: 60,
};

const HAIRSTYLE_TEMPLATE_MAP = {
  natural:  'natural_01',
  curly:    'curly_01',
  straight: 'straight_01',
  wavy:     'wavy_01',
  bob:      'bob_01',
  pixie:    'pixie_01',
};

const HAIR_PRESET_MAP = {
  'merah':        'Burgundy',
  'coklat':       'Chocolate Brown',
  'ungu':         'Ash Brown/Lavender',
  'biru':         'Ash Gray',
  'hitam':        'Dark Gray/Ice Blonde',
  'pirang':       'Copper Red/Golden Blonde',
  'burgundy':                   'Burgundy',
  'burgundy/magenta pink':      'Burgundy/Magenta Pink',
  'ash gray':                   'Ash Gray',
  'ash brown/lavender':         'Ash Brown/Lavender',
  'chocolate brown':            'Chocolate Brown',
  'copper red':                 'Copper Red',
  'copper red/golden blonde':   'Copper Red/Golden Blonde',
  'dark brown/caramel blonde':  'Dark Brown/Caramel Blonde',
  'dark gray/ice blonde':       'Dark Gray/Ice Blonde',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

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

      if (!result) {
        return res.status(500).json({ error: 'Skin analysis selesai tapi result kosong' });
      }

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
    if (action === 'ai-makeup') {
      const { user_image_url, zone, category, color, effect: frontendEffect } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const cat = (category || zone || 'lip_color').toLowerCase();

      let effectObject;

      if (frontendEffect && frontendEffect.category) {
        effectObject = frontendEffect;
      } else {
        const col = color || '#E8A0A0';

        if (cat === 'blush') {
          effectObject = {
            category: 'blush',
            pattern: { name: '1color1' },
            palettes: [{ color: col, texture: 'matte', colorIntensity: 65 }],
          };
        } else if (cat === 'eye_shadow' || cat === 'eye' || cat === 'eyes') {
          effectObject = {
            category: 'eye_shadow',
            pattern: { name: '1color1' },
            palettes: [{ color: col, texture: 'shimmer', shimmerColor: col, shimmerIntensity: 50, colorIntensity: 50 }],
          };
        } else if (cat === 'eye_liner' || cat === 'liner') {
          effectObject = {
            category: 'eye_liner',
            pattern: { name: 'Arabic3' },
            palettes: [{ color: col, texture: 'matte', colorIntensity: 90 }],
          };
        } else if (cat === 'bronzer') {
          effectObject = {
            category: 'bronzer',
            pattern: { name: 'Bronzer1' },
            palettes: [{ color: col, colorIntensity: 50 }],
          };
        } else {
          effectObject = {
            category: 'lip_color',
            shape: { name: 'original' },
            style: { type: 'full' },
            morphology: { fullness: 0, wrinkless: 0 },
            palettes: [{ color: col, texture: 'matte', colorIntensity: 80 }],
          };
        }
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
    if (action === 'ai-hair-color') {
      const { user_image_url, color, color_name, preset } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      const rawInput = preset || color_name || color || '';
      const resolvedPreset = HAIR_PRESET_MAP[rawInput.toLowerCase()] || rawInput;

      if (!resolvedPreset) {
        return res.status(400).json({
          error: 'preset diperlukan. Contoh: "Burgundy", "Chocolate Brown", "Ash Gray"',
          available_presets: Object.values(HAIR_PRESET_MAP).filter((v, i, a) => a.indexOf(v) === i),
        });
      }

      console.log(`[hair-color] Input: "${rawInput}" → Preset: "${resolvedPreset}"`);

      const out = await runTask('/s2s/v2.0/task/hair-color', {
        src_file_url: user_image_url,
        preset: resolvedPreset,
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, color_name: resolvedPreset, ...out.raw });
    }

    // ── 6. AI Hairstyle V2.1 ────────────────────────────────
    if (action === 'ai-hairstyle') {
      const { user_image_url, style, template_id, ref_image_url } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      let finalTemplateId = template_id;
      if (!finalTemplateId && style) {
        finalTemplateId = HAIRSTYLE_TEMPLATE_MAP[style.toLowerCase()] || HAIRSTYLE_TEMPLATE_MAP['natural'];
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

    // ── 8. AI Hat VTO ───────────────────────────────────────
    if (action === 'ai-hat') {
      const { user_image_url, hat_image_url, gender } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });
      if (!hat_image_url)  return res.status(400).json({ error: 'hat_image_url diperlukan' });

      console.log(`[ai-hat] user=${user_image_url} hat=${hat_image_url} gender=${gender}`);

      const out = await runTask('/s2s/v2.0/task/hat', {
        src_file_url: user_image_url,
        ref_file_url: hat_image_url,
        gender: gender || 'female',
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    // ── 9. AI Earring VTO v13 ───────────────────────────────
    // YouCam membutuhkan field "name" di source_info dan setiap object_infos.
    // Format lengkap yang benar berdasarkan error schema:
    //   source_info.name  → identifier untuk foto user (bebas, misal "user")
    //   object_infos[].name → identifier untuk tiap anting (misal "earring_0")
    if (action === 'ai-earring') {
      const { user_image_url, earring_image_url, earring_image_urls } = body;
      if (!user_image_url) return res.status(400).json({ error: 'user_image_url diperlukan' });

      // Dukung single URL maupun array
      const refUrls = Array.isArray(earring_image_urls) && earring_image_urls.length
        ? earring_image_urls
        : earring_image_url
          ? [earring_image_url]
          : null;

      if (!refUrls) return res.status(400).json({ error: 'earring_image_url atau earring_image_urls diperlukan' });

      console.log(`[ai-earring] user=${user_image_url} earrings=${JSON.stringify(refUrls)}`);

      // ✅ FIX v13: tambah field "name" yang wajib ada di source_info & object_infos
      const out = await runTask('/s2s/v2.0/task/2d-vto/earring', {
        source_info: {
          name:        'user',          // ✅ wajib — identifier foto user
          src_file_url: user_image_url,
        },
        object_infos: refUrls.map((url, idx) => ({
          name:        `earring_${idx}`, // ✅ wajib — identifier per anting
          ref_file_url: url,
        })),
      });

      if (!out.success) return res.status(out.status || 500).json({ error: out.error, detail: out.detail });
      return res.status(200).json({ result_url: out.result_url, ...out.raw });
    }

    return res.status(400).json({
      error: `Action tidak dikenal: "${action}"`,
      available_actions: [
        'skin-analysis', 'ai-clothes', 'ai-necklace',
        'ai-makeup', 'ai-hair-color', 'ai-hairstyle', 'ai-look',
        'ai-hat', 'ai-earring',
      ],
    });

  } catch (err) {
    console.error('[YouCam API Error]', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
}
