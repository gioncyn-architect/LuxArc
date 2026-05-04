// ============================================================
// LuxArc AI — script.js CLEAN v13
// Terhubung ke: /api/youcam (Vercel Serverless)
// Fitur: AI Clothes, Hair Color, Makeup, Skin Analysis,
//        Hairstyle, Accessory, Photo Enhancer, Hat, Earring
// CLEAN v13:
//   [1] Hapus 3x duplikat override window.openCheckout → 1 fungsi bersih
//   [2] Hapus injectBudgetFilterUI() — CSS sudah ada di style.css
//   [3] Hapus injectShareDiscountUI() — konflik dengan HTML nav
//   [4] Hapus toggleLanguage() — tidak dipanggil dari mana pun
//   [5] Hapus mockupVoiceSearch() & mockupVisualSearch() — tidak dipakai
//   [6] Hapus openCheckout_original reference — tidak pernah didefinisikan
//   [7] Hapus _origOpenCheckoutHTML — override broken sebelum fungsi ada
//   [8] Perbaiki syncCartBadge() — badge hidden saat count 0 on load
// ============================================================

const IMGBB_API_KEY = 'f38d35d294b0887931317043aa4ce731';

// ── Format Rupiah ────────────────────────────────────────────
function formatRupiah(number) {
    const num = typeof number === 'string' ? parseInt(number.replace(/\D/g, ''), 10) : Number(number);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// ── Resize gambar sebelum upload (max 1800px) ─────────────────
function resizeImage(base64, maxSize = 1800) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width <= maxSize && height <= maxSize) {
                resolve(base64);
                return;
            }
            const ratio = Math.min(maxSize / width, maxSize / height);
            width  = Math.round(width  * ratio);
            height = Math.round(height * ratio);
            const canvas = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.src = base64;
    });
}

// ── Upload foto ke ImgBB — resize dulu ───────────────────────
async function uploadToImgBB(base64) {
    const resized = await resizeImage(base64, 1800);
    const formData = new FormData();
    formData.append('image', resized.split(',')[1]);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST', body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error('Gagal upload foto: ' + JSON.stringify(data));
    return data.data.url;
}

// ── Upload gambar dari URL lokal / eksternal ke ImgBB ────────
async function uploadUrlToImgBB(url) {
    const absoluteUrl = url.startsWith('http')
        ? url
        : window.location.origin + '/' + url.replace(/^\//, '');

    const fetchRes = await fetch(absoluteUrl);
    if (!fetchRes.ok) throw new Error(`Gagal mengambil gambar produk: ${absoluteUrl}`);
    const blob = await fetchRes.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const publicUrl = await uploadToImgBB(e.target.result);
                resolve(publicUrl);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ── Convert file ke base64 ────────────────────────────────────
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ── Ekstrak URL hasil dari response YouCam ───────────────────
function getOutputUrl(data) {
    return data?.result_url
        || data?.data?.results?.url
        || data?.data?.results?.[0]?.url
        || data?.data?.result_url
        || data?.data?.output_url
        || data?.data?.dst_file_url
        || data?.data?.image_url
        || null;
}

// ════════════════════════════════════════════════════════════
// ── UI HELPERS ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════

function showAIModal(title, html) {
    let modal = document.getElementById('youcam-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'youcam-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-sheet glass-panel" style="max-height:90vh;overflow-y:auto;">
                <button class="modal-close" onclick="closeModal('youcam-modal')">✕</button>
                <p class="modal-title" id="youcam-modal-title"></p>
                <div id="youcam-modal-body"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('youcam-modal-title').innerText = title;
    document.getElementById('youcam-modal-body').innerHTML = html;
    openModal('youcam-modal');
}

function uploadPhotoHTML(inputId, imgId, previewId, btnLabel, btnOnclick) {
    return `
        <div id="${previewId}" style="display:none;margin-bottom:12px;">
            <img id="${imgId}" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover;">
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">

            <!-- Tombol Buka Kamera -->
            <button onclick="openCameraForAI('${inputId}','${imgId}','${previewId}')"
                style="width:100%;padding:12px;border-radius:12px;
                border:1.5px dashed #FFD700;background:transparent;
                color:#FFD700;font-size:0.88em;font-family:inherit;
                cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                📸 Buka Kamera
            </button>

            <!-- Tombol Pilih dari Galeri -->
            <label style="width:100%;padding:12px;border-radius:12px;
                border:1.5px dashed rgba(255,255,255,0.2);background:transparent;
                color:#fff;font-size:0.88em;font-family:inherit;
                cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                🖼️ Pilih dari Galeri
                <input type="file" accept="image/*" id="${inputId}"
                    style="display:none;"
                    onchange="previewPhoto(this,'${imgId}','${previewId}')">
            </label>

        </div>

        <!-- Tombol Coba AI -->
        <button class="btn btn-gold shimmer-btn"
            style="width:100%;padding:12px;" onclick="${btnOnclick}">
            ${btnLabel}
        </button>

        <div id="ai-result-area" style="margin-top:20px;"></div>`;
}
function showAIResult(containerId, outputUrl, filename) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <p style="color:#FFD700;margin-bottom:10px;">✅ Hasil AI:</p>
        <img src="${outputUrl}" style="width:100%;border-radius:12px;margin-bottom:15px;object-fit:contain;max-height:400px;background:#111;">
        <div style="display:flex;gap:10px;">
            <a href="${outputUrl}" download="${filename}.jpg" class="btn btn-gold shimmer-btn" style="flex:1;text-align:center;text-decoration:none;">⬇️ Unduh</a>
            <button class="btn btn-ghost" style="flex:1;" onclick="window.open('https://api.whatsapp.com/send?text=Lihat hasilku dari LuxArc AI! ${encodeURIComponent(outputUrl)}','_blank')">📲 Bagikan WA</button>
        </div>`;
    lookbookImages.push(outputUrl);
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    const inputIds = [
        'user-photo-input','makeup-photo-input','hair-color-photo-input',
        'skin-photo-input','acc-photo-input','enhance-photo-input',
        'autodetect-photo-input','hat-photo-input','earring-photo-input'
    ];
    let beforeUrl = null;
    for (const id of inputIds) {
        const imgEl = document.getElementById(id.replace('-input', '-img'));
        if (imgEl && imgEl.src && !imgEl.src.endsWith('/')) { beforeUrl = imgEl.src; break; }
    }
    if (beforeUrl) {
        beforeAfterPairs.push({ before: beforeUrl, after: outputUrl, label: filename || 'AI Result' });
    }
}
// Fungsi kamera khusus untuk modal AI
function openCameraForAI(inputId, imgId, previewId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Buat input file sementara dengan capture=camera
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.capture = 'environment';
    tempInput.onchange = function() {
        if (this.files && this.files[0]) {
            // Pindahkan file ke input asli
            const dt = new DataTransfer();
            dt.items.add(this.files[0]);
            input.files = dt.files;
            // Preview
            const reader = new FileReader();
            reader.onload = e => {
                document.getElementById(imgId).src = e.target.result;
                document.getElementById(previewId).style.display = 'block';
            };
            reader.readAsDataURL(this.files[0]);
        }
    };
    tempInput.click();
}

function previewPhoto(input, imgId, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById(imgId).src = e.target.result;
            document.getElementById(previewId).style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function uploadPhotoHTML(inputId, imgId, previewId, btnLabel, btnOnclick) {
    return `
        <div id="${previewId}" style="display:none;margin-bottom:12px;">
            <img id="${imgId}" style="width:100%;border-radius:12px;max-height:350px;object-fit:contain;background:#111;">
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            <button onclick="openCameraForAI('${inputId}','${imgId}','${previewId}')"
                style="width:100%;padding:12px;border-radius:12px;
                border:1.5px dashed #FFD700;background:transparent;
                color:#FFD700;font-size:0.88em;font-family:inherit;
                cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                📸 Buka Kamera
            </button>
            <label style="width:100%;padding:12px;border-radius:12px;
                border:1.5px dashed rgba(255,255,255,0.2);background:transparent;
                color:#fff;font-size:0.88em;font-family:inherit;
                cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                🖼️ Pilih dari Galeri
                <input type="file" accept="image/*" id="${inputId}"
                    style="display:none;"
                    onchange="previewPhoto(this,'${imgId}','${previewId}')">
            </label>
        </div>

        <button class="btn btn-gold shimmer-btn"
            style="width:100%;padding:12px;" onclick="${btnOnclick}">
            ${btnLabel}
        </button>

        <div id="ai-result-area" style="margin-top:20px;"></div>`;
}

function showAILoading(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
        <div style="text-align:center;padding:20px;color:#FFD700;">
            ⏳ ${msg}<br><small style="color:#888;">Mohon tunggu 15–30 detik...</small>
        </div>`;
}

function showAIError(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
        <p style="color:#ff4444;padding:10px;background:rgba(255,68,68,0.1);border-radius:10px;">❌ ${msg}</p>`;
}

// ════════════════════════════════════════════════════════════
// ── 1. AI CLOTHES — Virtual Try-On Pakaian ──────────────────
// ════════════════════════════════════════════════════════════
function startSeamlessVTO(imgId) {
    const imgEl = document.getElementById(imgId);
    const src = imgEl ? imgEl.src : '';
    const name = imgEl ? imgEl.alt : 'Produk';
    openAIClothes(src, name);
}

function openAIClothes(productImgSrc, productName) {
    showAIModal(`✨ AI Clothes — ${productName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto dirimu (tampak depan), AI akan memakaikan <b>${productName}</b>!</p>
        ${uploadPhotoHTML('user-photo-input','user-photo-img','user-photo-preview',
            '🤖 Coba Sekarang dengan AI',
            `runAIClothes('${productImgSrc}','${productName}')`
        )}`);
}

async function runAIClothes(productImgSrc, productName) {
    const userInput = document.getElementById('user-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dirimu dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang memproses pakaian...');
        const clothUrl = productImgSrc.startsWith('http')
            ? productImgSrc
            : window.location.origin + '/' + productImgSrc.replace(/^\//, '');
        const res = await fetch('/api/youcam?action=ai-clothes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, cloth_image_url: clothUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-clothes');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 2. AI ACCESSORY — Kalung & Topi ─────────────────────────
// ════════════════════════════════════════════════════════════
function openAIAccessory(accessoryImgSrc, accessoryName, accessoryType = 'necklace') {
    showAIModal(`💎 AI Accessory — ${accessoryName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto dirimu, AI akan memakaikan <b>${accessoryName}</b>!</p>
        ${uploadPhotoHTML('acc-photo-input','acc-photo-img','acc-photo-preview',
            '🤖 Coba Aksesoris dengan AI',
            `runAIAccessory('${accessoryImgSrc}','${accessoryName}','${accessoryType}')`
        )}`);
}

async function runAIAccessory(accessoryImgSrc, accessoryName, accessoryType) {
    const userInput = document.getElementById('acc-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang memakaikan ${accessoryName}...`);
        const accUrl = accessoryImgSrc.startsWith('http')
            ? accessoryImgSrc
            : window.location.origin + '/' + accessoryImgSrc.replace(/^\//, '');

        const res = await fetch('/api/youcam?action=ai-necklace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url: userImageUrl,
                necklace_image_url: accUrl,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-accessory');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 3. AI HAIR COLOR — Cat Rambut ───────────────────────────
// ════════════════════════════════════════════════════════════
const HAIR_COLOR_MAP = {
    'hitam':     '#1C1C1C',
    'coklat':    '#6B3A2A',
    'merah':     '#B22222',
    'oranye':    '#FF6600',
    'kuning':    '#FFD700',
    'hijau':     '#2E8B57',
    'biru':      '#1565C0',
    'ungu':      '#7B2D8B',
    'pink':      '#FF69B4',
    'abu':       '#9E9E9E',
    'silver':    '#C0C0C0',
    'blonde':    '#F5DEB3',
    'platinum':  '#E8E8D0',
    'burgundy':  '#800020',
    'lavender':  '#B57EDC',
    'teal':      '#008080',
    'copper':    '#B87333',
    'rose gold': '#B76E79',
};

function openHairColorYoucam(colorName, colorHex) {
    showAIModal(`🎨 AI Hair Color — ${colorName}`, `
        <div style="display:flex;align-items:center;gap:10px;background:#1a1a1a;border-radius:10px;padding:12px;margin-bottom:15px;">
            <span style="width:28px;height:28px;border-radius:50%;background:${colorHex};border:2px solid rgba(255,255,255,0.2);flex-shrink:0;display:inline-block;"></span>
            <b style="color:#FFD700;font-size:1.05em;">${colorName}</b>
        </div>
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan mengubah warna rambutmu menjadi <b>${colorName}</b>!</p>
        ${uploadPhotoHTML(
            'hair-color-photo-input','hair-color-photo-img','hair-color-photo-preview',
            `💇 Coba Warna ${colorName} dengan AI`,
            `runAIHairColor('${colorName}','${colorHex}')`
        )}`);
}

async function runAIHairColor(colorName, colorHex) {
    const userInput = document.getElementById('hair-color-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang mengubah warna rambut menjadi ${colorName}...`);

        const key = colorName.toLowerCase();
        const finalHex = (colorHex && colorHex.startsWith('#'))
            ? colorHex
            : (HAIR_COLOR_MAP[key] || '#7B2D8B');

        const payload = {
            user_image_url: userImageUrl,
            color_name: colorName,
            color: finalHex,
            palettes: [{
                color: finalHex,
                colorIntensity: 80,
            }],
        };

        const res = await fetch('/api/youcam?action=ai-hair-color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, `luxarc-hair-${colorName.toLowerCase()}`);
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 4. AI MAKEUP — Blush, Lipstik & Eyeshadow ───────────────
// ════════════════════════════════════════════════════════════
const MAKEUP_CATEGORY_CONFIG = {
    blush: {
        category: 'blush',
        pattern: { name: '1color1' },
        defaultColor: '#E8A0A0',
    },
    lip_color: {
        category: 'lip_color',
        shape: { name: 'original' },
        style: { type: 'full' },
        defaultColor: '#CC3355',
    },
    eye_shadow: {
        category: 'eye_shadow',
        pattern: { name: '1color1' },
        defaultColor: '#4B0082',
    },
    eye_liner: {
        category: 'eye_liner',
        pattern: { name: 'Arabic3' },
        defaultColor: '#000000',
    },
};

function detectMakeupColor(makeupName, defaultColor) {
    const n = makeupName.toLowerCase();
    if (n.includes('rose'))            return '#E8A0A0';
    if (n.includes('pink'))            return '#FF69B4';
    if (n.includes('peach'))           return '#FFCBA4';
    if (n.includes('coral'))           return '#FF7F7F';
    if (n.includes('mauve'))           return '#D8A0C0';
    if (n.includes('bronze'))          return '#8B6914';
    if (n.includes('gold'))            return '#CFB53B';
    if (n.includes('coklat') || n.includes('brown')) return '#8B4513';
    if (n.includes('merah') || n.includes('red'))    return '#CC0000';
    if (n.includes('nude') || n.includes('natural')) return '#C8956C';
    if (n.includes('ungu') || n.includes('purple'))  return '#7B2D8B';
    if (n.includes('biru') || n.includes('blue'))    return '#1565C0';
    if (n.includes('hitam') || n.includes('black'))  return '#1a1a1a';
    return defaultColor;
}

function tryMakeupYoucam(makeupImgSrc, zone, makeupName, customColor = null) {
    let category = zone;
    if (zone === 'lips' || zone === 'lip')  category = 'lip_color';
    if (zone === 'eyes' || zone === 'eye')  category = 'eye_shadow';
    if (zone === 'liner')                   category = 'eye_liner';

    const config = MAKEUP_CATEGORY_CONFIG[category] || MAKEUP_CATEGORY_CONFIG['blush'];
    const color = customColor || detectMakeupColor(makeupName, config.defaultColor);

    showAIModal(`💄 AI Makeup — ${makeupName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan mengaplikasikan <b>${makeupName}</b>!</p>
        ${uploadPhotoHTML('makeup-photo-input','makeup-photo-img','makeup-photo-preview',
            `💄 Coba Makeup dengan AI`,
            `runAIMakeup('${category}','${color}','${makeupName}')`
        )}`);
}

async function runAIMakeup(category, color, makeupName) {
    const userInput = document.getElementById('makeup-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang mengaplikasikan ${makeupName}...`);

        const config = MAKEUP_CATEGORY_CONFIG[category] || MAKEUP_CATEGORY_CONFIG['blush'];

        let effectObject = { category };

        if (category === 'blush') {
            effectObject = {
                category: 'blush',
                pattern: config.pattern,
                palettes: [{ color, texture: 'matte', colorIntensity: 65 }],
            };
        } else if (category === 'lip_color') {
            effectObject = {
                category: 'lip_color',
                shape: config.shape,
                style: config.style,
                palettes: [{ color, texture: 'matte', colorIntensity: 80 }],
            };
        } else if (category === 'eye_shadow') {
            effectObject = {
                category: 'eye_shadow',
                pattern: config.pattern,
                palettes: [{ color, texture: 'matte', colorIntensity: 60 }],
            };
        } else if (category === 'eye_liner') {
            effectObject = {
                category: 'eye_liner',
                pattern: config.pattern,
                palettes: [{ color, texture: 'matte', colorIntensity: 90 }],
            };
        }

        const res = await fetch('/api/youcam?action=ai-makeup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url: userImageUrl,
                category,
                color,
                makeup_name: makeupName,
                effect: effectObject,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-makeup');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 5. SKIN ANALYSIS ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function analyzeSkincareYoucam(productId, productName) {
    showAIModal(`✨ Analisis Kulit — ${productName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan menganalisis kulitmu dan merekomendasikan <b>${productName}</b>!</p>
        ${uploadPhotoHTML('skin-photo-input','skin-photo-img','skin-photo-preview',
            '🔬 Analisis Kulitku',
            `runSkinAnalysis('${productName}')`
        )}`);
}

async function runSkinAnalysis(productName) {
    const userInput = document.getElementById('skin-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang menganalisis kulitmu...');
        const res = await fetch('/api/youcam?action=skin-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));

        const r = data?.data?.results || data?.data || data || {};
const scores = {
  acne:     { score: r?.acne?.score     ?? r?.acne     ?? null },
  moisture: { score: r?.moisture?.score ?? r?.moisture ?? null },
  pores:    { score: r?.pore?.score     ?? r?.pore     ?? null },
  wrinkles: { score: r?.wrinkle?.score  ?? r?.wrinkle  ?? null },
  radiance: { score: r?.radiance?.score ?? r?.radiance ?? null },
};
        const labels = {
            acne: '🔴 Jerawat', moisture: '💧 Kelembapan',
            pores: '⭕ Pori-pori', wrinkles: '〰️ Kerutan',
            radiance: '✨ Kecerahan', skin_tone: '🎨 Warna Kulit'
        };

        let resultHTML = `<p style="color:#FFD700;margin-bottom:12px;">✅ Hasil Analisis Kulit:</p>
            <div style="background:#1a1a1a;border-radius:12px;padding:15px;margin-bottom:15px;">`;

        let hasScore = false;
        for (const [key, label] of Object.entries(labels)) {
            const score = scores[key]?.score ?? scores[key] ?? null;
            if (score !== null) {
                hasScore = true;
                const pct = Math.min(100, Math.round(Number(score)));
                resultHTML += `
                    <div style="margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                            <span style="color:#aaa;font-size:0.88em;">${label}</span>
                            <span style="color:#FFD700;font-weight:600;">${pct}/100</span>
                        </div>
                        <div style="background:#333;border-radius:8px;height:6px;">
                            <div style="background:linear-gradient(90deg,#FFD700,#fffae6);border-radius:8px;height:6px;width:${pct}%;transition:width 1s;"></div>
                        </div>
                    </div>`;
            }
        }
        if (!hasScore) {
            resultHTML += `<p style="color:#aaa;text-align:center;padding:10px 0;">Analisis selesai! ✨ Kulitmu dalam kondisi baik.</p>`;
        }
        resultHTML += `</div>
            <p style="color:#aaa;font-size:0.88em;text-align:center;">Rekomendasi: <b style="color:#FFD700;">${productName}</b></p>`;

        document.getElementById('ai-result-area').innerHTML = resultHTML;
        // ── Rekomendasi produk berdasarkan skor ──
const acneScore = Number(scores?.acne?.score ?? scores?.acne ?? 100);
const moistureScore = Number(scores?.moisture?.score ?? scores?.moisture ?? 100);
const radianceScore = Number(scores?.radiance?.score ?? scores?.radiance ?? 100);

let recommendedProducts = [];

if (acneScore < 60) {
    recommendedProducts.push(
        { name: 'Skincare Jerawat', price: 'Rp 195.000', reason: 'Cocok untuk kulit berjerawat' },
        { name: 'Serum Niacinamide', price: 'Rp 165.000', reason: 'Mengontrol pori & jerawat' },
        { name: 'Clay Mask', price: 'Rp 95.000', reason: 'Membersihkan pori secara mendalam' }
    );
} else if (moistureScore < 60) {
    recommendedProducts.push(
        { name: 'Moisturizer Gel', price: 'Rp 175.000', reason: 'Melembapkan kulit kering' },
        { name: 'Toner AHA BHA', price: 'Rp 145.000', reason: 'Eksfoliasi & hidrasi kulit' }
    );
} else if (radianceScore < 60) {
    recommendedProducts.push(
        { name: 'Skincare Pemutih', price: 'Rp 215.000', reason: 'Mencerahkan & glowing' },
        { name: 'Sunscreen SPF 50', price: 'Rp 125.000', reason: 'Proteksi UV harian' }
    );
} else {
    recommendedProducts.push(
        { name: 'Sunscreen SPF 50', price: 'Rp 125.000', reason: 'Proteksi UV setiap hari' },
        { name: 'Moisturizer Gel', price: 'Rp 175.000', reason: 'Menjaga kelembapan kulit' }
    );
}

if (recommendedProducts.length > 0) {
    const recTitle = document.createElement('p');
    recTitle.style.cssText = 'color:#FFD700;font-weight:600;margin:16px 0 8px;';
    recTitle.textContent = '🎯 Produk Rekomendasi untuk Kulitmu:';
    document.getElementById('ai-result-area').appendChild(recTitle);
    renderAIProductCards(recommendedProducts);
}
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 6. AI HAIRSTYLE ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function openAIHairstyle() {
    showAIModal('💇 AI Hairstyle Generator', `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan mengubah gaya rambutmu!</p>
        <label style="display:block;background:#1a1a1a;border:1.5px dashed #FFD700;border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
            📷 Pilih Foto Wajahmu
            <input type="file" accept="image/*" id="hair-photo-input" style="display:none;" onchange="previewPhoto(this,'hair-photo-img','hair-photo-preview')">
        </label>
        <div id="hair-photo-preview" style="display:none;margin-bottom:15px;">
            <img id="hair-photo-img" style="width:100%;border-radius:12px;max-height:160px;object-fit:cover;">
        </div>
        <p style="color:#aaa;margin-bottom:8px;font-size:0.88em;">Pilih Gaya:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px;">
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'natural')" style="font-size:0.82em;border-color:#FFD700;">🌿 Natural</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'curly')" style="font-size:0.82em;">🌀 Curly</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'straight')" style="font-size:0.82em;">📏 Straight</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'wavy')" style="font-size:0.82em;">〰️ Wavy</button>
        </div>
        <input type="hidden" id="selected-hair-style" value="natural">
        <button class="btn btn-gold shimmer-btn" style="width:100%;" onclick="runAIHairstyle()">🤖 Generate Hairstyle</button>
        <div id="ai-result-area" style="margin-top:20px;"></div>`);
}

function selectHairStyle(btn, style) {
    document.querySelectorAll('.hair-style-btn').forEach(b => b.style.borderColor = '');
    btn.style.borderColor = '#FFD700';
    document.getElementById('selected-hair-style').value = style;
}

async function runAIHairstyle() {
    const input = document.getElementById('hair-photo-input');
    const style = document.getElementById('selected-hair-style')?.value || 'natural';
    if (!input?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang mengubah gaya rambut...');
        const res = await fetch('/api/youcam?action=ai-hairstyle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, style }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-hairstyle');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 7. PHOTO ENHANCER ───────────────────────────────────────
// ════════════════════════════════════════════════════════════
function openPhotoEnhancer() {
    showAIModal('🌟 AI Photo Enhancer', `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto, AI akan mempercantik & meningkatkan kualitasnya!</p>
        ${uploadPhotoHTML('enhance-photo-input','enhance-photo-img','enhance-photo-preview',
            '✨ Enhance dengan AI',
            'runPhotoEnhancer()'
        )}`);
}

async function runPhotoEnhancer() {
    const input = document.getElementById('enhance-photo-input');
    if (!input?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang memperindah foto...');
        const res = await fetch('/api/youcam?action=photo-enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-enhanced');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 8. AI HAT — Virtual Try-On Topi ─────────────────────────
// ════════════════════════════════════════════════════════════
function openAIHat(hatImgSrc, hatName) {
    showAIModal(`🎩 AI Hat — ${hatName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto dirimu, AI akan memakaikan <b>${hatName}</b> ke kepalamu!</p>
        ${uploadPhotoHTML('hat-photo-input','hat-photo-img','hat-photo-preview',
            '🎩 Coba Topi dengan AI',
            `runAIHat('${hatImgSrc}','${hatName}')`
        )}`);
}

async function runAIHat(hatImgSrc, hatName) {
    const userInput = document.getElementById('hat-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang memakaikan ${hatName}...`);
        const hatUrl = hatImgSrc.startsWith('http')
            ? hatImgSrc
            : window.location.origin + '/' + hatImgSrc.replace(/^\//, '');
        const res = await fetch('/api/youcam?action=ai-hat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url: userImageUrl,
                hat_image_url:  hatUrl,
                gender: 'female',
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-hat');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 9. AI EARRING — Virtual Try-On Anting ───────────────────
// ════════════════════════════════════════════════════════════
function openAIEarring(earringImgSrc, earringName) {
    showAIModal(`💎 AI Earring — ${earringName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto dirimu (tampak depan), AI akan memakaikan <b>${earringName}</b>!</p>
        ${uploadPhotoHTML('earring-photo-input','earring-photo-img','earring-photo-preview',
            '💎 Coba Anting dengan AI',
            `runAIEarring('${earringImgSrc}','${earringName}')`
        )}`);
}

async function runAIEarring(earringImgSrc, earringName) {
    const userInput = document.getElementById('earring-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `Mengupload gambar anting...`);
        const earringPublicUrl = await uploadUrlToImgBB(earringImgSrc);
        showAILoading('ai-result-area', `AI sedang memakaikan ${earringName}...`);
        const res = await fetch('/api/youcam?action=ai-earring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url:    userImageUrl,
                earring_image_url: earringPublicUrl,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-earring');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── AI ADVISOR — Chat & Quick Replies (Powered by Groq) ─────
// ════════════════════════════════════════════════════════════
const chatHistory = document.getElementById('chat-history');

let groqChatHistory = [];

function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.innerHTML = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.id = 'typing-indicator';
    el.innerHTML = `<span style="color:#FFD700;">✨ LuxArc AI sedang mengetik</span>
        <span style="animation:blink 1s infinite;">...</span>`;
    chatHistory.appendChild(el);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

function appendProductCard(productName, desc, imgSrc) {
    const card = document.createElement('div');
    card.className = 'ai-product-rec';
    card.innerHTML = `
        <img src="${imgSrc}" alt="${productName}">
        <div class="ai-product-rec-info">
            <div class="ai-product-rec-name">${productName}</div>
            <div class="ai-product-rec-desc">${desc}</div>
            <button class="ai-product-rec-btn" onclick="openAIClothes('${imgSrc}','${productName}')">✨ Coba AI</button>
        </div>`;
    chatHistory.appendChild(card);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendToGroq(userMessage) {
    try {
        const res = await fetch('/api/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                history: groqChatHistory.slice(-10),
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Groq error');
        return { reply: data.reply, products: data.products || [] };
    } catch (err) {
        console.error('[Groq Chat Error]', err);
        return { reply: 'Maaf, AI Advisor sedang tidak tersedia. Coba lagi ya! 😊', products: [] };
    }
}

function handleQuickReply(type) {
    const qr = document.getElementById('ai-quick-replies');
    if (qr) qr.style.display = 'none';
    ['submenu-makeup','submenu-cat-rambut','submenu-skin','submenu-anting','submenu-topi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (type === 'makeup') {
        appendMessage('user', '💄 Rekomendasi Makeup');
        setTimeout(() => {
            appendMessage('bot', 'Pilih produk makeup yang ingin kamu coba secara virtual! 💋');
            const s = document.getElementById('submenu-makeup');
            if (s) s.style.display = 'block';
        }, 500);
    } else if (type === 'cat-rambut') {
        appendMessage('user', '🎨 Coba Warna Cat Rambut');
        setTimeout(() => {
            appendMessage('bot', 'Pilih warna cat rambutmu — AI YouCam akan preview di fotomu! 💇');
            const s = document.getElementById('submenu-cat-rambut');
            if (s) s.style.display = 'block';
        }, 500);
    } else if (type === 'fashion') {
        appendMessage('user', '👗 Cari Pakaian & Perhiasan');
        setTimeout(() => {
            appendMessage('bot', 'Pilih produk di Beranda lalu klik "Coba Live" untuk virtual try-on! 🛍️');
            switchPage('beranda');
        }, 500);
    } else if (type === 'skinanalysis') {
        appendMessage('user', '🔬 Analisis Kulit Saya');
        setTimeout(() => {
            appendMessage('bot', 'Pilih concern kulit yang ingin dianalisis!');
            const s = document.getElementById('submenu-skin');
            if (s) s.style.display = 'block';
        }, 500);
    } else if (type === 'free') {
        appendMessage('user', '💬 Tanya Bebas');
        setTimeout(() => {
            appendMessage('bot', 'Silakan tanya apa saja tentang fashion, kecantikan, atau produk LuxArc AI! ✨');
        }, 500);
    }
}

function closeSubmenu() {
    ['submenu-makeup','submenu-cat-rambut','submenu-skin','submenu-anting','submenu-topi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const qr = document.getElementById('ai-quick-replies');
    if (qr) {
        qr.style.display = 'flex';
        qr.style.flexDirection = 'column';
    }
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    input.disabled = true;

    const lower = text.toLowerCase();

    if (lower.includes('cat rambut') || lower.includes('warna rambut')) {
        appendMessage('bot', 'Mau preview warna cat rambut? Pilih warnanya! 🎨');
        setTimeout(() => { const s = document.getElementById('submenu-cat-rambut'); if(s) s.style.display='block'; }, 300);
        input.disabled = false;
        return;
    }
    if (lower.includes('coba makeup') || lower.includes('coba lipstik') || lower.includes('coba eyeshadow')) {
        appendMessage('bot', 'Mau coba makeup virtual? Pilih produknya! 💄');
        setTimeout(() => { const s = document.getElementById('submenu-makeup'); if(s) s.style.display='block'; }, 300);
        input.disabled = false;
        return;
    }
    if (lower.includes('analisis kulit') || lower.includes('cek kulit')) {
        appendMessage('bot', 'Mau analisis kondisi kulitmu? Pilih concern-mu! 🔬');
        setTimeout(() => { const s = document.getElementById('submenu-skin'); if(s) s.style.display='block'; }, 300);
        input.disabled = false;
        return;
    }
    if (lower.includes('ganti gaya rambut') || lower.includes('hairstyle')) {
        appendMessage('bot', 'Mau coba gaya rambut baru? Ayo! 💇');
        setTimeout(() => openAIHairstyle(), 500);
        input.disabled = false;
        return;
    }

 appendTypingIndicator();
const result = await sendToGroq(text);
removeTypingIndicator();
appendMessage('bot', result.reply);

if (result.products && result.products.length > 0) {
    renderAIProductCards(result.products);
}

groqChatHistory.push({ role: 'user', text });
groqChatHistory.push({ role: 'bot', text: result.reply });
    if (groqChatHistory.length > 20) groqChatHistory = groqChatHistory.slice(-20);

    input.disabled = false;
    input.focus();
}
function renderAIProductCards(products) {
    if (!products || products.length === 0) return;
    products.forEach(product => {
        let imgSrc = '';
        let dataPrice = 0;
        let targetCard = null;

        document.querySelectorAll('.product-card').forEach(card => {
            const cardName = (card.getAttribute('data-name') || '').toLowerCase();
            const prodName = product.name.toLowerCase();
            if (cardName.includes(prodName.split(' ')[0]) ||
                prodName.includes(cardName.split(' ')[0])) {
                const img = card.querySelector('img');
                if (img) imgSrc = img.src;
                const priceEl = card.querySelector('[data-price]');
                if (priceEl) dataPrice = parseInt(priceEl.getAttribute('data-price')) || 0;
                targetCard = card;
            }
        });

        // Ambil tombol "Coba AI" dari kartu asli
        let tryAIBtn = '';
        if (targetCard) {
            const ghostBtn = targetCard.querySelector('.btn-ghost');
            if (ghostBtn) {
                tryAIBtn = `<button class="ai-product-rec-btn" style="background:rgba(255,215,0,0.15);border-color:#FFD700;color:#FFD700;"
                    onclick="${ghostBtn.getAttribute('onclick')}">
                    ${ghostBtn.textContent.trim()}
                </button>`;
            }
        }

        const card = document.createElement('div');
        card.className = 'ai-product-rec';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            ${imgSrc
                ? `<img src="${imgSrc}" alt="${product.name}">`
                : `<span style="font-size:2em;">🛍️</span>`}
            <div class="ai-product-rec-info">
                <div class="ai-product-rec-name">${product.name}</div>
                <div class="ai-product-rec-desc">${product.reason || ''}</div>
                <div style="color:#FFD700;font-size:0.82em;font-weight:700;margin-bottom:6px;">
                    ${product.price}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${tryAIBtn}
                    <button class="ai-product-rec-btn"
                        onclick="addToCart('${product.name}', ${dataPrice})">
                        🛒 + Keranjang
                    </button>
                    <button class="ai-product-rec-btn"
                        onclick="switchPage('beranda');setTimeout(()=>{const el=document.querySelector('[data-name*=\\'${product.name.split(' ')[0].toLowerCase()}\\']');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});}},400);">
                        👁 Lihat Produk
                    </button>
                </div>
            </div>`;
        chatHistory.appendChild(card);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    });
}
        
function askAIAbaoutProduct(productName) {
    switchPage('ai');
    setTimeout(() => {
        appendMessage('user', `Berikan saran untuk ${productName}`);
        setTimeout(() => {
            appendMessage('bot', `${productName} adalah pilihan yang sangat bagus! ✨ Mau coba langsung secara virtual?`);
        }, 800);
    }, 400);
}

// ════════════════════════════════════════════════════════════
// ── DETEKSI OTOMATIS ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function triggerAutoDetect() {
    appendMessage('user', '📷 Deteksi Otomatis');
    appendMessage('bot', 'Oke! Upload foto wajahmu untuk analisis kulit dan rekomendasi produk yang tepat. 🔬');

    setTimeout(() => {
        showAIModal('📷 Deteksi Otomatis', `
            <p style="color:#aaa;margin-bottom:15px;">
                Upload foto wajahmu, AI akan menganalisis kulitmu dan memberikan
                rekomendasi produk yang sesuai! 💄
            </p>
            <label style="display:block;background:#1a1a1a;border:1.5px dashed #FFD700;
                border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
                📷 Pilih Foto Wajahmu
                <input type="file" accept="image/*" id="autodetect-photo-input"
                    style="display:none;"
                    onchange="previewPhoto(this,'autodetect-photo-img','autodetect-photo-preview')">
            </label>
            <div id="autodetect-photo-preview" style="display:none;margin-bottom:15px;">
                <img id="autodetect-photo-img"
                    style="width:100%;border-radius:12px;max-height:160px;object-fit:cover;">
            </div>
            <button class="btn btn-gold shimmer-btn" style="width:100%;"
                onclick="runAutoDetectAnalysis()">
                🤖 Analisis & Rekomendasikan Produk
            </button>
            <div id="ai-result-area" style="margin-top:20px;"></div>`);
    }, 400);
}

async function runAutoDetectAnalysis() {
    const input = document.getElementById('autodetect-photo-input');
    if (!input?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang menganalisis kulitmu... 🔬');

        const res = await fetch('/api/youcam?action=skin-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl }),
        });

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error('Response bukan JSON dari server: ' + jsonErr.message);
        }

        if (!res.ok) {
            throw new Error(data?.error || data?.message || `Server error ${res.status}`);
        }

       const r = data?.data?.results || data?.data || data || {};
const scores = {
  acne:     { score: r?.acne?.score     ?? r?.acne     ?? null },
  moisture: { score: r?.moisture?.score ?? r?.moisture ?? null },
  pores:    { score: r?.pore?.score     ?? r?.pore     ?? null },
  wrinkles: { score: r?.wrinkle?.score  ?? r?.wrinkle  ?? null },
  radiance: { score: r?.radiance?.score ?? r?.radiance ?? null },
}; 

        const acne     = Number(scores?.acne?.score     ?? 80);
const moisture = Number(scores?.moisture?.score  ?? 50);
const radiance = Number(scores?.radiance?.score  ?? 50);
        let skinType = '';
        let recommendations = [];

        if (acne < 50) {
            skinType = '⚠️ Kulit cenderung berjerawat';
            recommendations.push('💆 Gunakan foundation ringan & non-comedogenic');
            recommendations.push('🌿 Blush On warna nude/peach lebih cocok');
        } else if (moisture < 50) {
            skinType = '💧 Kulit cenderung kering';
            recommendations.push('✨ Gunakan highlighter untuk tampilan glowing');
            recommendations.push('💄 Lip color dengan formula moisturizing');
        } else if (radiance > 70) {
            skinType = '✨ Kulit cerah & sehat';
            recommendations.push('🌸 Blush On rose atau coral untuk warna segar');
            recommendations.push('💋 Lip color bold sangat cocok untukmu!');
        } else {
            skinType = '😊 Kulit normal & seimbang';
            recommendations.push('💄 Semua warna makeup cocok untuk kulitmu!');
            recommendations.push('🌸 Coba Blush On Collection untuk tampilan natural');
        }

        const labels = {
            acne:     '🔴 Jerawat',
            moisture: '💧 Kelembapan',
            pores:    '⭕ Pori-pori',
            wrinkles: '〰️ Kerutan',
            radiance: '✨ Kecerahan',
            redness:  '🔥 Kemerahan',
        };

        let resultHTML = `
            <p style="color:#FFD700;margin-bottom:10px;font-weight:600;">✅ Hasil Analisis Kulit:</p>
            <p style="color:#aaa;font-size:0.9em;margin-bottom:12px;">${skinType}</p>
            <div style="background:#1a1a1a;border-radius:12px;padding:15px;margin-bottom:15px;">`;

        let hasScore = false;
        for (const [key, label] of Object.entries(labels)) {
            const rawScore = scores?.[key]?.score ?? scores?.[key] ?? null;
            if (rawScore !== null && rawScore !== undefined) {
                hasScore = true;
                const pct = Math.min(100, Math.round(Number(rawScore)));
                resultHTML += `
                    <div style="margin-bottom:10px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#aaa;font-size:0.85em;">${label}</span>
                            <span style="color:#FFD700;font-weight:600;font-size:0.85em;">${pct}/100</span>
                        </div>
                        <div style="background:#333;border-radius:8px;height:5px;">
                            <div style="background:linear-gradient(90deg,#FFD700,#fffae6);
                                border-radius:8px;height:5px;width:${pct}%;transition:width 1s;"></div>
                        </div>
                    </div>`;
            }
        }

        if (!hasScore) {
            resultHTML += `<p style="color:#aaa;text-align:center;padding:8px 0;">Analisis selesai! Kulitmu dalam kondisi baik. ✨</p>`;
        }

        resultHTML += `</div>
            <p style="color:#FFD700;font-weight:600;margin-bottom:8px;">🎯 Rekomendasi untuk Kamu:</p>
            <div style="background:#1a1a1a;border-radius:12px;padding:12px;margin-bottom:15px;">
                ${recommendations.map(r => `<p style="color:#aaa;font-size:0.88em;margin-bottom:6px;">${r}</p>`).join('')}
            </div>
            <p style="color:#888;font-size:0.8em;text-align:center;">
                Tutup modal ini lalu pilih produk di Beranda untuk virtual try-on! ✨
            </p>`;

        document.getElementById('ai-result-area').innerHTML = resultHTML;

        setTimeout(() => {
            closeModal('youcam-modal');
            switchPage('ai');
            setTimeout(() => {
                appendMessage('bot', `Analisis selesai! ✨<br>${skinType}<br><br>${recommendations.join('<br>')}<br><br>Pilih produk di Beranda untuk virtual try-on! 💄`);
            }, 400);
        }, 1500);

    } catch (err) {
        const container = document.getElementById('ai-result-area');
        if (container) {
            showAIError('ai-result-area', err.message);
        } else {
            toast('❌ ' + err.message, 'error');
        }
    }
}

// ════════════════════════════════════════════════════════════
// ── BUDGET FILTER ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
let budgetFilterActive = false;
let currentBudgetMin = 0;
let currentBudgetMax = 9999999;

function toggleBudgetPanel() {
    const panel = document.getElementById('budget-filter-panel');
    if (!panel) return;
    budgetFilterActive = !budgetFilterActive;
    panel.style.display = budgetFilterActive ? 'block' : 'none';
    document.getElementById('btn-budget-filter').classList.toggle('active', budgetFilterActive);
    if (!budgetFilterActive) { currentBudgetMin = 0; currentBudgetMax = 9999999; applyBudgetFilter(); }
}

function setBudgetPreset(btn, min, max) {
    document.querySelectorAll('.budget-preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentBudgetMin = min;
    currentBudgetMax = max;
    const minEl = document.getElementById('budget-range-min');
    const maxEl = document.getElementById('budget-range-max');
    if (minEl) minEl.value = Math.min(min, 2500000);
    if (maxEl) maxEl.value = Math.min(max, 2500000);
    updateBudgetLabels();
    applyBudgetFilter();
}

function onBudgetRangeChange() {
    const minEl = document.getElementById('budget-range-min');
    const maxEl = document.getElementById('budget-range-max');
    currentBudgetMin = parseInt(minEl.value);
    currentBudgetMax = parseInt(maxEl.value);
    if (currentBudgetMin > currentBudgetMax) {
        currentBudgetMax = currentBudgetMin;
        maxEl.value = currentBudgetMin;
    }
    updateBudgetLabels();
    document.querySelectorAll('.budget-preset-btn').forEach(b => b.classList.remove('active'));
    applyBudgetFilter();
}

function updateBudgetLabels() {
    const minLbl = document.getElementById('budget-min-label');
    const maxLbl = document.getElementById('budget-max-label');
    if (minLbl) minLbl.textContent = formatRupiah(currentBudgetMin);
    if (maxLbl) maxLbl.textContent = currentBudgetMax >= 2500000 ? '2.500.000+' : formatRupiah(currentBudgetMax);
}

function applyBudgetFilter() {
    let count = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        const priceEl = card.querySelector('.product-price');
        const price = priceEl ? parseInt(priceEl.dataset.price || '0') : 0;
        const inRange = price >= currentBudgetMin && price <= currentBudgetMax;
        card.classList.toggle('budget-hidden', !inRange);
        if (inRange) {
            card.style.display = '';
            count++;
        } else {
            card.style.display = 'none';
        }
    });
    const msg = document.getElementById('budget-result-msg');
    if (msg) msg.textContent = `${count} produk dalam budget ini`;
    document.getElementById('product-count').innerText = `${count} produk`;
}

function resetBudgetFilter() {
    currentBudgetMin = 0; currentBudgetMax = 9999999;
    const minEl = document.getElementById('budget-range-min');
    const maxEl = document.getElementById('budget-range-max');
    if (minEl) minEl.value = 0;
    if (maxEl) maxEl.value = 2500000;
    updateBudgetLabels();
    document.querySelectorAll('.budget-preset-btn').forEach(b => b.classList.remove('active'));
    const firstBtn = document.querySelector('.budget-preset-btn');
    if (firstBtn) firstBtn.classList.add('active');
    applyBudgetFilter();
}

// ════════════════════════════════════════════════════════════
// ── SHARE & DISKON ───────────────────────────────────────────
// ════════════════════════════════════════════════════════════
const PROMO_CODES = [
    { code: 'LUXARC10', discount: 0.10, label: '10% OFF', desc: 'Diskon 10% semua produk' },
    { code: 'VIVI15',   discount: 0.15, label: '15% OFF', desc: 'Spesial untuk Vivi! Diskon 15%' },
    { code: 'BEAUTY20', discount: 0.20, label: '20% OFF', desc: 'Beauty Day! Diskon 20% makeup & skincare' },
    { code: 'SHARE5',   discount: 0.05, label: '5% OFF',  desc: 'Terima kasih sudah share! Diskon 5%' },
];

let activePromoCode = null;
let activeDiscount = 0;

function openShareDiscount() {
    const totalCartVal = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const hasCart = cart.length > 0;

    let promoListHTML = PROMO_CODES.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:12px;border:1.5px solid rgba(255,215,0,0.2);border-radius:12px;margin-bottom:8px;
            background:rgba(255,215,0,0.04);">
            <div>
                <span style="color:#FFD700;font-weight:700;font-size:0.95em;letter-spacing:1px;">${p.code}</span>
                <p style="color:#aaa;font-size:0.78em;margin:2px 0 0;">${p.desc}</p>
            </div>
            <button onclick="applyPromo('${p.code}')" class="btn btn-ghost" style="font-size:0.78em;padding:6px 14px;">
                Pakai
            </button>
        </div>`).join('');

    showAIModal('🎁 Share & Diskon Otomatis', `
        <p style="color:#aaa;margin-bottom:14px;font-size:0.9em;">
            Share ke WhatsApp dan dapatkan <b style="color:#FFD700;">kode diskon eksklusif</b> untuk belanja!
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
            <button class="btn btn-gold shimmer-btn" onclick="shareToWhatsApp()" style="font-size:0.82em;padding:10px 0;">
                📲 Share ke WA
            </button>
            <button class="btn btn-ghost" onclick="copyShareLink()" style="font-size:0.82em;padding:10px 0;">
                🔗 Copy Link
            </button>
        </div>
        <p style="color:#FFD700;font-weight:600;margin-bottom:10px;font-size:0.9em;">🏷️ Kode Promo Tersedia:</p>
        ${promoListHTML}
        <div style="display:flex;gap:8px;margin-top:14px;">
            <input type="text" id="promo-code-input" placeholder="Masukkan kode promo..."
                style="flex:1;background:#1a1a1a;border:1.5px solid #333;border-radius:10px;
                    color:#fff;padding:10px 12px;font-size:0.88em;font-family:inherit;outline:none;">
            <button class="btn btn-gold" onclick="applyPromoFromInput()" style="padding:10px 16px;font-size:0.88em;">
                ✓ Pakai
            </button>
        </div>
        <div id="promo-feedback" style="margin-top:10px;"></div>
        ${hasCart ? `
        <div style="margin-top:16px;padding:14px;background:#1a1a1a;border-radius:12px;border:1px solid #333;">
            <p style="color:#aaa;font-size:0.85em;">Total keranjang saat ini:</p>
            <p style="color:#FFD700;font-weight:700;font-size:1.1em;">Rp ${formatRupiah(totalCartVal)}</p>
            ${activeDiscount > 0 ? `
                <p style="color:#4CAF50;font-size:0.85em;margin-top:6px;">
                    ✅ Diskon ${Math.round(activeDiscount*100)}% aktif → Hemat <b>Rp ${formatRupiah(Math.round(totalCartVal * activeDiscount))}</b>
                </p>
                <p style="color:#FFD700;font-weight:700;">Bayar: Rp ${formatRupiah(Math.round(totalCartVal * (1 - activeDiscount)))}</p>
            ` : ''}
        </div>` : ''}
    `);
}

function applyPromo(code) {
    const promo = PROMO_CODES.find(p => p.code === code.toUpperCase().trim());
    if (!promo) {
        showPromoFeedback('❌ Kode promo tidak valid!', 'error');
        return;
    }
    activePromoCode = promo.code;
    activeDiscount  = promo.discount;
    toast(`🎉 Kode <b>${promo.code}</b> aktif! Diskon ${promo.label}`, 'info');
    showPromoFeedback(`✅ Kode <b>${promo.code}</b> berhasil dipakai! Diskon <b>${promo.label}</b> akan diterapkan saat checkout.`, 'success');
}

function applyPromoFromInput() {
    const val = document.getElementById('promo-code-input')?.value || '';
    applyPromo(val);
}

function showPromoFeedback(msg, type) {
    const el = document.getElementById('promo-feedback');
    if (!el) return;
    el.innerHTML = `<p style="color:${type === 'error' ? '#ff4444' : '#4CAF50'};font-size:0.85em;
        padding:10px;background:${type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(76,175,80,0.1)'};
        border-radius:10px;">${msg}</p>`;
}

function shareToWhatsApp() {
    const productList = Array.from(document.querySelectorAll('.product-card'))
        .slice(0, 3)
        .map(c => '• ' + (c.querySelector('.product-name')?.innerText || ''))
        .join('\n');
    const msg = encodeURIComponent(
        `✨ *LuxArc AI — Shop Premium*\n\n` +
        `Halo! Cek koleksi terbaru kami:\n${productList}\n\n` +
        `🛍️ ${window.location.href}\n\n` +
        `Gunakan kode *SHARE5* untuk diskon 5%! 🎁`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    toast('📲 Membuka WhatsApp...', 'info');
    setTimeout(() => applyPromo('SHARE5'), 1500);
}

function copyShareLink() {
    const text = `✨ LuxArc AI — ${window.location.href} | Kode diskon: SHARE5`;
    navigator.clipboard?.writeText(text)
        .then(() => toast('🔗 Link disalin! Kode SHARE5 bisa dipakai.', 'info'))
        .catch(() => toast('Salin manual: ' + window.location.href, 'info'));
}

// ════════════════════════════════════════════════════════════
// ── LOOKBOOK + BEFORE/AFTER ──────────────────────────────────
// ════════════════════════════════════════════════════════════
let beforeAfterPairs = [];

function openLookbook() {
    const gallery = document.getElementById('lookbook-gallery');
    const hasBA = beforeAfterPairs.length > 0;

    gallery.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;grid-column:1/-1;">
            <button class="lookbook-tab-btn active" onclick="switchLookbookTab('gallery',this)" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #FFD700;background:rgba(255,215,0,0.12);color:#FFD700;font-family:inherit;font-size:0.82em;cursor:pointer;">📸 Lookbook</button>
            <button class="lookbook-tab-btn" onclick="switchLookbookTab('compare',this)" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.15);background:transparent;color:#aaa;font-family:inherit;font-size:0.82em;cursor:pointer;">✨ Before/After</button>
        </div>
        <div id="lookbook-tab-gallery" style="display:contents;">
            ${lookbookImages.length === 0
                ? '<p style="grid-column:1/-1;text-align:center;color:#888;padding:20px;">Belum ada foto di Lookbook.</p>'
                : lookbookImages.map((img, i) => `
                    <div onclick="openFullImage(${i})" style="cursor:pointer;position:relative;">
                        <img src="${img}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;">
                    </div>`).join('')
            }
        </div>
        <div id="lookbook-tab-compare" style="display:none;grid-column:1/-1;">
            ${hasBA
                ? beforeAfterPairs.map((pair, i) => renderBeforeAfterCard(pair, i)).join('')
                : '<p style="text-align:center;color:#888;padding:20px;">Belum ada hasil AI untuk dibandingkan.<br><small>Coba fitur AI Clothes, Makeup, atau Hair Color dulu!</small></p>'
            }
        </div>`;

    openModal('lookbook-modal');
}

function switchLookbookTab(tab, btn) {
    document.querySelectorAll('.lookbook-tab-btn').forEach(b => {
        b.style.borderColor = 'rgba(255,255,255,0.15)';
        b.style.background  = 'transparent';
        b.style.color       = '#aaa';
        b.classList.remove('active');
    });
    btn.style.borderColor = '#FFD700';
    btn.style.background  = 'rgba(255,215,0,0.12)';
    btn.style.color       = '#FFD700';
    btn.classList.add('active');

    const galleryEl = document.getElementById('lookbook-tab-gallery');
    const compareEl = document.getElementById('lookbook-tab-compare');
    if (galleryEl) galleryEl.style.display  = tab === 'gallery'  ? 'contents' : 'none';
    if (compareEl) compareEl.style.display  = tab === 'compare'  ? 'block'    : 'none';
}

function renderBeforeAfterCard(pair, index) {
    return `
        <div style="margin-bottom:20px;border:1.5px solid rgba(255,215,0,0.15);border-radius:14px;overflow:hidden;background:#0d0d0d;">
            <div style="padding:10px 14px;border-bottom:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#FFD700;font-size:0.82em;font-weight:600;">✨ ${pair.label.replace(/-/g,' ').replace(/luxarc /gi,'')}</span>
                <button onclick="deleteBeforeAfter(${index})" style="background:none;border:none;color:#555;font-size:0.8em;cursor:pointer;">🗑</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;">
                <div style="position:relative;">
                    <img src="${pair.before}" style="width:100%;aspect-ratio:1;object-fit:cover;">
                    <span style="position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,0.7);color:#aaa;font-size:0.7em;padding:2px 8px;border-radius:8px;">BEFORE</span>
                </div>
                <div style="position:relative;border-left:2px solid #FFD700;">
                    <img src="${pair.after}" style="width:100%;aspect-ratio:1;object-fit:cover;">
                    <span style="position:absolute;bottom:6px;right:6px;background:rgba(255,215,0,0.85);color:#000;font-size:0.7em;padding:2px 8px;border-radius:8px;font-weight:700;">AFTER ✨</span>
                </div>
            </div>
            <div style="display:flex;gap:8px;padding:10px 12px;">
                <a href="${pair.after}" download="luxarc-after.jpg" class="btn btn-gold shimmer-btn" style="flex:1;text-align:center;text-decoration:none;font-size:0.8em;padding:8px;">⬇️ Unduh</a>
                <button class="btn btn-ghost" onclick="shareBeforeAfterWA(${index})" style="flex:1;font-size:0.8em;padding:8px;">📲 Share WA</button>
            </div>
        </div>`;
}

function deleteBeforeAfter(index) {
    beforeAfterPairs.splice(index, 1);
    openLookbook();
}

function shareBeforeAfterWA(index) {
    const pair = beforeAfterPairs[index];
    if (!pair) return;
    const msg = encodeURIComponent(`✨ Lihat transformasiku dengan LuxArc AI!\n\nHasil AI: ${pair.after}\n\n🛍️ ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

// ════════════════════════════════════════════════════════════
// ── STATE & VARIABLES ────────────────────────────────────────
// ════════════════════════════════════════════════════════════
let cart = [];
let wishlist = [];
let lookbookImages = [];
let currentCamera = 'user';
let streamReference = null;
let currentViewingImageIndex = null;
let currentLang = 'id';

// ── Bilingual ────────────────────────────────────────────────
const translations = {
    id: {
        heroLabel:"Exclusive Business Suite",
        welcome:"Selamat Datang,<br><em>Vivi Gioncyn.</em>",
        heroSub:"AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive:"Live <b>AI</b> Active", statCol:"Koleksi", statStock:"Stok",
        searchPlaceholder:"Tanya AI: 'Rok pesta malam'...",
        catAll:"Semua Koleksi", catClothes:"Pakaian", catJewelry:"Perhiasan Mewah", catAcc:"Aksesoris",
        secTitle:"Koleksi Terpilih", btnTry:"✨ Coba Live", btnAddCart:"+ Keranjang", btnSaran:"🤖 Minta Saran AI",
        btnAutoDetect:"📷 Deteksi Otomatis", chatInput:"Tanya AI...",
        navHome:"Beranda", navAI:"AI Advisor",
        cartTitle:"Keranjang Belanja", cartTotal:"Total Tagihan:", btnPay:"✓ Selesai Bayar",
        toastCamFlip:"🔄 Memutar kamera...", toastCamErr:"Gagal membuka kamera!",
        toastCart:"masuk ke keranjang!", toastPay:"Pembayaran Berhasil! 🎉"
    },
    en: {
        heroLabel:"Exclusive Business Suite",
        welcome:"Welcome,<br><em>Vivi Gioncyn.</em>",
        heroSub:"AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive:"Live <b>AI</b> Active", statCol:"Collections", statStock:"Stock",
        searchPlaceholder:"Ask AI: 'Evening dress'...",
        catAll:"All Collections", catClothes:"Apparel", catJewelry:"Luxury Jewelry", catAcc:"Accessories",
        secTitle:"Curated Picks", btnTry:"✨ Try Live", btnAddCart:"+ Add to Cart", btnSaran:"🤖 Ask AI",
        btnAutoDetect:"📷 Auto Detect", chatInput:"Ask AI...",
        navHome:"Home", navAI:"AI Advisor",
        cartTitle:"Shopping Cart", cartTotal:"Total Bill:", btnPay:"✓ Complete Payment",
        toastCamFlip:"🔄 Flipping camera...", toastCamErr:"Camera access failed!",
        toastCart:"added to cart!", toastPay:"Payment Successful! 🎉"
    }
};

function toast(msg, type = 'info') {
    const stack = document.getElementById('toast-stack');
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.background = type === 'error' ? 'rgba(255,68,68,0.95)' : 'rgba(255,215,0,0.95)';
    el.style.color = type === 'error' ? '#fff' : '#000';
    el.innerHTML = msg;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
    document.getElementById('nav-' + pageId)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pageId === 'keranjang') renderCartPage();
}

// ════════════════════════════════════════════════════════════
// ── HALAMAN KERANJANG (full-page) ────────────────────────────
// ════════════════════════════════════════════════════════════
function renderCartPage() {
    const itemsEl   = document.getElementById('cart-page-items');
    const voucherEl = document.getElementById('cart-voucher-section');
    const summaryEl = document.getElementById('cart-summary-section');
    const countEl   = document.getElementById('cart-page-item-count');
    const emptyMsg  = document.getElementById('cart-empty-msg');
    if (!itemsEl) return;

    if (countEl) countEl.textContent = cart.length + ' item';

    const bannerEl = document.getElementById('cart-page-promo-banner');
    if (bannerEl) {
        if (activePromoCode && activeDiscount > 0) {
            const promo = PROMO_CODES.find(p => p.code === activePromoCode);
            document.getElementById('cart-page-promo-label').textContent = `Kode: ${activePromoCode} — Diskon ${Math.round(activeDiscount*100)}%`;
            document.getElementById('cart-page-promo-desc').textContent = promo ? promo.desc : '';
            bannerEl.style.display = 'flex';
        } else {
            bannerEl.style.display = 'none';
        }
    }

    if (cart.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        Array.from(itemsEl.querySelectorAll('.cart-page-item')).forEach(el => el.remove());
        if (voucherEl) voucherEl.style.display = 'none';
        if (summaryEl) summaryEl.style.display = 'none';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    const existingItems = itemsEl.querySelectorAll('.cart-page-item');
    existingItems.forEach(el => el.remove());

    const icons = ['👗','💎','💄','✨','🌸','👜','🧴','🎨','💍'];
    cart.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'cart-page-item';
        div.innerHTML = `
            <span class="cart-item-icon">${icons[idx % icons.length]}</span>
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">Rp ${formatRupiah(item.price)}</div>
            </div>
            <button class="cart-item-del" onclick="removeFromCartPage(${idx})" title="Hapus">🗑</button>`;
        itemsEl.appendChild(div);
    });

    if (voucherEl) voucherEl.style.display = 'block';
    if (summaryEl) summaryEl.style.display = 'block';

    document.querySelectorAll('.voucher-chip').forEach(chip => {
        const chipCode = chip.textContent.split(' ')[0].trim();
        chip.classList.toggle('active-chip', chipCode === activePromoCode);
    });

    const rawTotal = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const discountAmt = activeDiscount > 0 ? Math.round(rawTotal * activeDiscount) : 0;
    const finalTotal = rawTotal - discountAmt;

    const subtotalEl = document.getElementById('cart-page-subtotal');
    const discountRowEl = document.getElementById('cart-summary-discount-row');
    const discountEl = document.getElementById('cart-page-discount');
    const totalEl = document.getElementById('cart-page-total');
    const vaEl = document.getElementById('cart-page-va');

    if (subtotalEl) subtotalEl.textContent = 'Rp ' + formatRupiah(rawTotal);
    if (discountRowEl) discountRowEl.style.display = activeDiscount > 0 ? 'flex' : 'none';
    if (discountEl) discountEl.textContent = '- Rp ' + formatRupiah(discountAmt);
    if (totalEl) totalEl.textContent = 'Rp ' + formatRupiah(finalTotal);
    if (vaEl) vaEl.textContent = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function processPaymentPage() {
    toast('⏳ Memverifikasi...');
    setTimeout(() => {
        toast(translations[currentLang].toastPay);
        cart = [];
        activePromoCode = null;
        activeDiscount = 0;
        syncCartBadge();
        renderCartPage();
    }, 1500);
}

function applyPromoPage(code) {
    const promo = PROMO_CODES.find(p => p.code === code.toUpperCase().trim());
    const feedbackEl = document.getElementById('cart-page-promo-feedback');
    if (!promo) {
        if (feedbackEl) feedbackEl.innerHTML = `<p style="color:#ff4444;font-size:0.82em;margin-top:6px;">❌ Kode promo tidak valid!</p>`;
        return;
    }
    activePromoCode = promo.code;
    activeDiscount  = promo.discount;
    if (feedbackEl) feedbackEl.innerHTML = `<p style="color:#4CAF50;font-size:0.82em;margin-top:6px;">✅ Kode <b>${promo.code}</b> aktif! Diskon <b>${promo.label}</b></p>`;
    toast(`🎉 Kode <b>${promo.code}</b> aktif! Diskon ${promo.label}`, 'info');
    renderCartPage();
}

function applyPromoPageFromInput() {
    const val = document.getElementById('cart-page-promo-input')?.value || '';
    applyPromoPage(val);
}

function removePromoPage() {
    activePromoCode = null;
    activeDiscount  = 0;
    toast('Kode promo dihapus.', 'info');
    renderCartPage();
}

// ── Search ───────────────────────────────────────────────────
document.getElementById('search-input')?.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    let count = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        const match = card.innerText.toLowerCase().includes(term) || card.dataset.name?.includes(term);
        card.style.display = match ? 'flex' : 'none';
        if (match) count++;
    });
    document.getElementById('product-count').innerText = `${count} produk`;
});

function filterProducts(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    let count = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        let show = false;
        if (category === 'semua') {
            show = true;
        } else if (category === 'pakaian') {
            show = ['pakaian','atasan','dress'].includes(card.dataset.category);
        } else {
            show = card.dataset.category === category;
        }
        card.style.display = show ? 'flex' : 'none';
        if (show) count++;
    });
    document.getElementById('product-count').innerText = `${count} produk`; 
        const skincareBanner = document.getElementById('skincare-analysis-banner');
        if (skincareBanner) {
            skincareBanner.style.display = category === 'skincare' ? 'block' : 'none';
        }
    }
}

function triggerSkincareAnalysis() {
    showAIModal('🔬 Analisis Kulit', `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan menganalisis dan merekomendasikan skincare yang tepat!</p>
        ${uploadPhotoHTML('skin-photo-input','skin-photo-img','skin-photo-preview',
            '🔬 Analisis Kulitku Sekarang',
            'runSkinAnalysis("analisis")'
        )}`);
}
// ── Camera ───────────────────────────────────────────────────
async function openCamera(isAutoDetect = false) {
    const view = document.getElementById('camera-view');
    const badge = document.getElementById('ai-match-score');
    const controls = document.getElementById('cam-ui-controls');
    view.style.display = 'flex';
    if (isAutoDetect) {
        controls.style.display = 'none';
        badge.style.display = 'flex';
        badge.innerText = '🔍 Memindai Biometrik...';
    } else {
        controls.style.display = 'flex';
        badge.style.display = 'flex';
        badge.innerText = '🤖 Calibrating...';
        setTimeout(() => { badge.innerText = `✨ Match Score: ${Math.floor(Math.random()*15)+85}%`; }, 2000);
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
        document.getElementById('video-stream').srcObject = stream;
        streamReference = stream;
    } catch (err) {
        toast(translations[currentLang].toastCamErr, 'error');
        closeCamera();
    }
}

function closeCamera() {
    if (streamReference) streamReference.getTracks().forEach(t => t.stop());
    document.getElementById('camera-view').style.display = 'none';
    document.getElementById('ai-match-score').style.display = 'none';
    streamReference = null;
}

async function flipCamera() {
    if (streamReference) streamReference.getTracks().forEach(t => t.stop());
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    toast(translations[currentLang].toastCamFlip);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
        document.getElementById('video-stream').srcObject = stream;
        streamReference = stream;
    } catch (err) { toast(translations[currentLang].toastCamErr, 'error'); }
}

// ── Snapshot & Lookbook ──────────────────────────────────────
function takeSnapshot() {
    const v = document.getElementById('video-stream');
    const c = document.getElementById('snapshot-canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    lookbookImages.push(c.toDataURL('image/jpeg'));
    toast('📸 Foto disimpan ke Lookbook!');
}

function openFullImage(index) {
    currentViewingImageIndex = index;
    document.getElementById('full-img-display').src = lookbookImages[index];
    document.getElementById('btn-delete-img').onclick = () => {
        lookbookImages.splice(currentViewingImageIndex, 1);
        closeModal('full-img-modal');
        openLookbook();
    };
    document.getElementById('btn-share-wa').onclick = () => {
        window.open(`https://api.whatsapp.com/send?text=Lihat gayaku dari LuxArc AI!`, '_blank');
    };
    openModal('full-img-modal');
}

function closeFullImage() { closeModal('full-img-modal'); currentViewingImageIndex = null; }

// ── Modal ─────────────────────────────────────────────────────
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'flex';
    setTimeout(() => el.classList.add('open'), 10);
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    setTimeout(() => { el.style.display = 'none'; }, 300);
}

// ── Cart ──────────────────────────────────────────────────────
function addToCart(name, price) {
    const safePrice = typeof price === 'number' ? price : parseInt(String(price).replace(/\D/g,''), 10) || 0;
    cart.push({ name, price: safePrice });
    syncCartBadge();
    // Efek btn-cart added
document.querySelectorAll('.btn-cart').forEach(btn => {
  const orig = btn.innerHTML;
  btn.innerHTML = '✓ Ditambahkan!';
  btn.classList.add('added');
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove('added');
  }, 1500);
});
    toast(`🛒 ${name} ${translations[currentLang].toastCart}`);
    if (document.getElementById('page-keranjang')?.classList.contains('active')) renderCartPage();
}

// FIX: badge selalu sinkron — hidden saat 0, tampil saat > 0
function syncCartBadge() {
    const count = cart.length;
    const navBadge = document.getElementById('cart-count');
    if (navBadge) navBadge.innerText = count;
    const bnavBadge = document.getElementById('bnav-cart-count');
    if (bnavBadge) {
        bnavBadge.innerText = count;
        bnavBadge.style.display = count > 0 ? 'flex' : 'none';
        if (count > 0) {
            bnavBadge.classList.add('bump');
            setTimeout(() => bnavBadge.classList.remove('bump'), 250);
        }
    }
}

function openCheckout() {
    const div = document.getElementById('cart-items');
    const totalSection = document.getElementById('cart-total-section');
    if (!div) return;

    if (cart.length === 0) {
        div.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Keranjang kosong</p>';
        totalSection.style.display = 'none';
    } else {
        div.innerHTML = cart.map((item, idx) => `
            <div style="padding:10px 0;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:0.9em;">${item.name}</span>
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="color:#FFD700;font-weight:600;">Rp ${formatRupiah(item.price)}</span>
                    <button onclick="removeFromCart(${idx})" style="background:none;border:none;color:#ff4444;font-size:1.1em;cursor:pointer;">🗑</button>
                </div>
            </div>`).join('');

        let rawTotal = cart.reduce((a, b) => a + (Number(b.price) || 0), 0);
        const totalEl = document.getElementById('total-price');

        if (activeDiscount > 0) {
            const discounted = Math.round(rawTotal * (1 - activeDiscount));
            const saving = rawTotal - discounted;
            if (totalEl) {
                totalEl.innerHTML = `
                    <span style="text-decoration:line-through;color:#888;font-size:0.85em;">Rp ${formatRupiah(rawTotal)}</span>
                    <span style="color:#4CAF50;font-size:0.8em;margin:0 4px;">−${Math.round(activeDiscount*100)}%</span>
                    <br><span style="color:#FFD700;">Rp ${formatRupiah(discounted)}</span>
                    <small style="color:#4CAF50;display:block;font-size:0.75em;">Hemat Rp ${formatRupiah(saving)} 🎉</small>`;
            }
        } else {
            if (totalEl) totalEl.innerText = 'Rp ' + formatRupiah(rawTotal);
        }

        // Banner promo aktif di modal checkout
        const banner = document.getElementById('active-promo-banner');
        if (banner) {
            if (activePromoCode && activeDiscount > 0) {
                const promo = PROMO_CODES.find(p => p.code === activePromoCode);
                document.getElementById('active-promo-label').textContent = `Kode: ${activePromoCode} — Diskon ${Math.round(activeDiscount*100)}%`;
                document.getElementById('active-promo-desc').textContent = promo ? promo.desc : '';
                banner.style.display = 'flex';
            } else {
                banner.style.display = 'none';
            }
        }

        document.getElementById('va-number').innerText = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
        totalSection.style.display = 'block';
    }
    openModal('checkout-modal');
}

function removeFromCart(i) {
    cart.splice(i, 1);
    syncCartBadge();
    openCheckout();
}

function removeFromCartPage(i) {
    cart.splice(i, 1);
    syncCartBadge();
    renderCartPage();
}

function processPayment() {
    toast('⏳ Memverifikasi...');
    setTimeout(() => {
        toast(translations[currentLang].toastPay);
        cart = [];
        activePromoCode = null;
        activeDiscount = 0;
        syncCartBadge();
        closeModal('checkout-modal');
    }, 1500);
}

function removePromo() {
    activePromoCode = null;
    activeDiscount  = 0;
    openCheckout();
    toast('Kode promo dihapus.', 'info');
}

// ── Wishlist ──────────────────────────────────────────────────
function toggleWishlist(btn, name) {
    const idx = wishlist.indexOf(name);
    if (idx === -1) { wishlist.push(name); btn.innerText = '❤️'; toast(`❤️ ${name} ditambahkan ke Wishlist`); }
    else { wishlist.splice(idx, 1); btn.innerText = '🤍'; }
}

function openWishlist() {
    document.getElementById('wishlist-items').innerHTML = wishlist.length === 0
        ? '<p style="text-align:center;color:#888;padding:20px;">Wishlist kosong</p>'
        : wishlist.map(n => `<div style="padding:10px 0;border-bottom:1px solid #222;font-size:0.9em;">❤️ ${n}</div>`).join('');
    openModal('wishlist-modal');
}

// ── Admin Dashboard ───────────────────────────────────────────
function openAdmin() {
    const revenue = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    document.getElementById('dash-revenue').innerText = `Rp ${formatRupiah(revenue)}`;
    document.getElementById('dash-wishlist-count').innerText = wishlist.length;
    const data = Array.from({ length: 7 }, () => Math.floor(Math.random() * 60) + 30);
    document.getElementById('mini-chart').innerHTML = data.map(() =>
        `<div class="chart-bar" style="height:0%;flex:1;transition:height 0.8s ease-out;background:linear-gradient(to top,#FFD700,#fffae6);border-radius:4px 4px 0 0;"></div>`
    ).join('');
    openModal('admin-modal');
    setTimeout(() => {
        document.querySelectorAll('.chart-bar').forEach((bar, i) => { bar.style.height = `${data[i]}%`; });
    }, 100);
}

// ════════════════════════════════════════════════════════════
// ── SETTINGS DRAWER ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════
let currentCurrency = 'IDR';
const USD_RATE = 16400;

function openSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('settings-overlay');
    if (!drawer) return;
    renderDrawerVoucher();
    drawer.style.display = 'block';
    overlay.style.display = 'block';
    setTimeout(() => { drawer.style.transform = 'translateX(0)'; }, 10);
}

function closeSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('settings-overlay');
    if (!drawer) return;
    drawer.style.transform = 'translateX(100%)';
    setTimeout(() => {
        drawer.style.display = 'none';
        overlay.style.display = 'none';
    }, 300);
}

function setLanguage(lang) {
    currentLang = lang;

    // ── Auto switch currency ──────────────────────────────
    if (lang === 'en') setCurrency('USD');
    else setCurrency('IDR');

    // ── Terjemahan lengkap ────────────────────────────────
    const t = {
        id: {
            // Hero
            heroLabel: 'Exclusive Business Suite',
            heroSub: 'AI Style Advisor · Smart Inventory · Business Intelligence',
            statCol: 'Koleksi', statStock: 'Stok',

            // Search & Filter
            searchPlaceholder: "Tanya AI: 'Rok pesta malam'...",
            catAll: 'Semua Koleksi', catClothes: 'Pakaian',
            secTitle: 'Koleksi Terpilih',

            // Tombol produk
            btnTryLive: '✨ Coba Live',
            btnAddCart: '+ Keranjang',
            btnAskAI: '🤖 Minta Saran AI',
            btnTryMakeup: '💄 Coba Makeup',
            btnTryHat: '🎩 Coba AI',
            btnSkinAnalysis: '✨ Analisis Kulit',
            btnTryHair: '💇 Coba Warna Rambut dengan AI',

            // Nav
            navHome: 'Beranda', navAI: 'AI Advisor',

            // Cart
            cartTitle: 'Keranjang Belanja',
            cartEmpty: 'Keranjang Kosong',
            cartEmptySub: 'Tambahkan produk dari halaman Beranda',
            cartShopNow: 'Belanja Sekarang',
            cartSubtotal: 'Subtotal',
            cartDiscount: 'Diskon Voucher',
            cartTotal: 'Total Tagihan',
            cartVA: 'Transfer Virtual Account',
            cartPay: '✓ Selesai Bayar',
            cartItemCount: 'item',

            // Voucher
            voucherTitle: '🏷️ Voucher & Promo',
            voucherInput: 'Masukkan kode voucher...',
            voucherApply: 'Pakai',
            orderSummary: '📋 Ringkasan Pesanan',

            // AI Advisor
            aiGreeting: 'Halo <b>Vivi!</b> 👋 Saya <b>LuxArc AI</b> — asisten gaya personalmu.<br>Apa yang bisa saya bantu hari ini?',
            btnAutoDetect: '📷 Deteksi Otomatis',
            chatInput: 'Tanya AI...',
            qrMakeup: '💄 Rekomendasi Makeup',
            qrHair: '🎨 Coba Warna Cat Rambut',
            qrFashion: '👗 Cari Pakaian & Perhiasan',
            qrSkin: '🔬 Analisis Kulit Saya',
            qrFree: '💬 Tanya Bebas',

            // Settings
            settingsTitle: '⚙️ Settings',
            langLabel: '🌐 Bahasa',
            currLabel: '💱 Tampilan Harga',
            voucherActive: '🏷️ Voucher Aktif',
            noVoucher: 'Belum ada voucher aktif. Pilih kode di bawah:',
            btnDashboard: '📊 Business Dashboard',
            btnShare: '🎁 Share & Diskon',

            // Toast
            toastCart: 'masuk ke keranjang!',
            toastPay: 'Pembayaran Berhasil! 🎉',
            toastCamFlip: '🔄 Memutar kamera...',
            toastCamErr: 'Gagal membuka kamera!',
        },
        en: {
            // Hero
            heroLabel: 'Exclusive Business Suite',
            heroSub: 'AI Style Advisor · Smart Inventory · Business Intelligence',
            statCol: 'Collections', statStock: 'Stock',

            // Search & Filter
            searchPlaceholder: "Ask AI: 'Evening party dress'...",
            catAll: 'All Collections', catClothes: 'Apparel',
            secTitle: 'Curated Picks',

            // Tombol produk
            btnTryLive: '✨ Try Live',
            btnAddCart: '+ Add to Cart',
            btnAskAI: '🤖 Ask AI',
            btnTryMakeup: '💄 Try Makeup',
            btnTryHat: '🎩 Try AI',
            btnSkinAnalysis: '✨ Skin Analysis',
            btnTryHair: '💇 Try Hair Color with AI',

            // Nav
            navHome: 'Home', navAI: 'AI Advisor',

            // Cart
            cartTitle: 'Shopping Cart',
            cartEmpty: 'Cart is Empty',
            cartEmptySub: 'Add products from the Home page',
            cartShopNow: 'Shop Now',
            cartSubtotal: 'Subtotal',
            cartDiscount: 'Voucher Discount',
            cartTotal: 'Total Bill',
            cartVA: 'Virtual Account Transfer',
            cartPay: '✓ Complete Payment',
            cartItemCount: 'items',

            // Voucher
            voucherTitle: '🏷️ Voucher & Promo',
            voucherInput: 'Enter voucher code...',
            voucherApply: 'Apply',
            orderSummary: '📋 Order Summary',

            // AI Advisor
            aiGreeting: 'Hello <b>Vivi!</b> 👋 I am <b>LuxArc AI</b> — your personal style assistant.<br>How can I help you today?',
            btnAutoDetect: '📷 Auto Detect',
            chatInput: 'Ask AI...',
            qrMakeup: '💄 Makeup Recommendations',
            qrHair: '🎨 Try Hair Color',
            qrFashion: '👗 Find Clothes & Jewelry',
            qrSkin: '🔬 Analyze My Skin',
            qrFree: '💬 Ask Freely',

            // Settings
            settingsTitle: '⚙️ Settings',
            langLabel: '🌐 Language',
            currLabel: '💱 Price Display',
            voucherActive: '🏷️ Active Voucher',
            noVoucher: 'No active voucher. Choose a code below:',
            btnDashboard: '📊 Business Dashboard',
            btnShare: '🎁 Share & Discount',

            // Toast
            toastCart: 'added to cart!',
            toastPay: 'Payment Successful! 🎉',
            toastCamFlip: '🔄 Flipping camera...',
            toastCamErr: 'Camera access failed!',
        }
    };

    const T = t[lang];

    // ── Update translations object (untuk toast dll) ───────
    if (translations[lang]) {
        translations[lang].toastCart = T.toastCart;
        translations[lang].toastPay = T.toastPay;
        translations[lang].toastCamFlip = T.toastCamFlip;
        translations[lang].toastCamErr = T.toastCamErr;
    }

    // ── Hero ───────────────────────────────────────────────
    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) heroSub.textContent = T.heroSub;
    const heroLabel = document.querySelector('.hero-label');
    if (heroLabel) heroLabel.textContent = T.heroLabel;

    // ── Stats ──────────────────────────────────────────────
    document.querySelectorAll('[data-i18n="statCol"]').forEach(el => el.textContent = T.statCol);
    document.querySelectorAll('[data-i18n="statStock"]').forEach(el => el.textContent = T.statStock);

    // ── Search ─────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = T.searchPlaceholder;

    // ── Category buttons ───────────────────────────────────
    const catAll = document.querySelector('[onclick*="semua"]');
    if (catAll) catAll.textContent = T.catAll;
    const catClothes = document.querySelector('[onclick*="pakaian"]');
    if (catClothes) catClothes.textContent = T.catClothes;

    // ── Section title ──────────────────────────────────────
    const secTitle = document.querySelector('.section-title');
    if (secTitle) secTitle.textContent = T.secTitle;

    // ── Semua tombol produk ────────────────────────────────
    document.querySelectorAll('.product-card').forEach(card => {
        const btns = card.querySelectorAll('.btn');
        btns.forEach(btn => {
            const txt = btn.textContent.trim();
            if (txt.includes('Coba Live') || txt.includes('Try Live'))
                btn.textContent = T.btnTryLive;
            else if (txt.includes('Keranjang') || txt.includes('Add to Cart'))
                btn.textContent = T.btnAddCart;
            else if (txt.includes('Minta Saran AI') || txt.includes('Ask AI'))
                btn.textContent = T.btnAskAI;
            else if (txt.includes('Coba Makeup') || txt.includes('Try Makeup'))
                btn.textContent = T.btnTryMakeup;
            else if (txt.includes('Coba AI') || txt.includes('Try AI'))
                btn.textContent = T.btnTryHat;
            else if (txt.includes('Analisis Kulit') || txt.includes('Skin Analysis'))
                btn.textContent = T.btnSkinAnalysis;
        });

        // Tombol try hair
        const hairBtn = card.querySelector('.btn-try-hair');
        if (hairBtn && (hairBtn.textContent.includes('Coba Warna') || hairBtn.textContent.includes('Try Hair'))) {
            hairBtn.textContent = T.btnTryHair;
        }
    });

    // ── Bottom nav ─────────────────────────────────────────
    const navHome = document.querySelector('#nav-beranda span:last-child');
    if (navHome) navHome.textContent = T.navHome;
    const navAI = document.querySelector('#nav-ai span:last-child');
    if (navAI) navAI.textContent = T.navAI;

    // ── Cart page ──────────────────────────────────────────
    const cartTitle = document.querySelector('.cart-page-title');
    if (cartTitle) cartTitle.innerHTML = lang === 'id'
        ? 'Keranjang <span>Belanja</span>'
        : 'Shopping <span>Cart</span>';

    const cartEmpty = document.querySelector('.cart-empty-title');
    if (cartEmpty) cartEmpty.textContent = T.cartEmpty;
    const cartEmptySub = document.querySelector('.cart-empty-sub');
    if (cartEmptySub) cartEmptySub.textContent = T.cartEmptySub;
    const cartShopNow = document.querySelector('.cart-empty-state .btn-gold');
    if (cartShopNow) cartShopNow.textContent = T.cartShopNow;

    const cartVoucherTitle = document.querySelector('.cart-voucher-section .cart-section-label');
    if (cartVoucherTitle) cartVoucherTitle.innerHTML = T.voucherTitle;
    const voucherInput = document.getElementById('cart-page-promo-input');
    if (voucherInput) voucherInput.placeholder = T.voucherInput;
    const voucherApply = document.querySelector('.voucher-apply-btn');
    if (voucherApply) voucherApply.textContent = T.voucherApply;

    const orderSummary = document.querySelector('.cart-summary-section .cart-section-label');
    if (orderSummary) orderSummary.innerHTML = T.orderSummary;
    const cartVA = document.querySelector('.cart-va-label');
    if (cartVA) cartVA.textContent = T.cartVA;
    const cartPay = document.querySelector('.cart-summary-section .btn-gold');
    if (cartPay) cartPay.textContent = T.cartPay;

    // ── AI Advisor page ────────────────────────────────────
    const aiGreeting = document.getElementById('ai-greeting-msg');
    if (aiGreeting) aiGreeting.innerHTML = T.aiGreeting;
    const btnAutoDetect = document.querySelector('.btn-scan');
    if (btnAutoDetect) btnAutoDetect.textContent = T.btnAutoDetect;
    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.placeholder = T.chatInput;

    const quickBtns = document.querySelectorAll('.ai-quick-btn');
    const qrKeys = ['qrMakeup','qrHair','qrFashion','qrSkin','qrFree'];
    quickBtns.forEach((btn, i) => {
        if (qrKeys[i]) btn.textContent = T[qrKeys[i]];
    });

    // ── Settings drawer ────────────────────────────────────
    const noVoucher = document.getElementById('drawer-voucher-status');
    if (noVoucher && !activePromoCode) noVoucher.innerHTML =
        `<span style="color:#555;">${T.noVoucher}</span>`;

    const btnDash = document.querySelector('[onclick*="openAdmin"]');
    if (btnDash) btnDash.textContent = T.btnDashboard;
    const btnShare = document.querySelector('[onclick*="openShareDiscount"]');
    if (btnShare) btnShare.textContent = T.btnShare;
    // ── Render ulang cart jika sedang di halaman keranjang ─
    if (document.getElementById('page-keranjang')?.classList.contains('active')) {
        renderCartPage();
    }
    
    // ── Tutup settings drawer setelah ganti bahasa ──────────
    setTimeout(() => {
        closeSettingsDrawer();
    }, 200);
}
    
    }
function setCurrency(curr) {
    currentCurrency = curr;
    const idrBtn = document.getElementById('curr-idr-btn');
    const usdBtn = document.getElementById('curr-usd-btn');
    if (idrBtn) {
        idrBtn.style.borderColor = curr === 'IDR' ? '#FFD700' : 'rgba(255,255,255,0.15)';
        idrBtn.style.color = curr === 'IDR' ? '#FFD700' : '#aaa';
        idrBtn.style.background = curr === 'IDR' ? 'rgba(255,215,0,0.12)' : 'transparent';
    }
    if (usdBtn) {
        usdBtn.style.borderColor = curr === 'USD' ? '#FFD700' : 'rgba(255,255,255,0.15)';
        usdBtn.style.color = curr === 'USD' ? '#FFD700' : '#aaa';
        usdBtn.style.background = curr === 'USD' ? 'rgba(255,215,0,0.12)' : 'transparent';
    }

    document.querySelectorAll('.product-price').forEach(el => {
        const rawPrice = parseInt(el.dataset.price || '0');
        const valEl = el.querySelector('.price-val');
        const currEl = el.querySelector('.price-currency');
        if (!valEl || !currEl) return;
        if (curr === 'USD') {
            currEl.textContent = '$';
            valEl.textContent = (rawPrice / USD_RATE).toFixed(2);
        } else {
            currEl.textContent = 'Rp';
            valEl.textContent = formatRupiah(rawPrice);
        }
    });
    toast(curr === 'USD' ? '💱 Harga tampil dalam USD' : '💱 Harga tampil dalam Rupiah', 'info');
}

function renderDrawerVoucher() {
    const el = document.getElementById('drawer-voucher-status');
    if (!el) return;
    if (activePromoCode && activeDiscount > 0) {
        el.innerHTML = `<span style="color:#4CAF50;font-weight:700;">✅ ${activePromoCode}</span> <span style="color:#aaa;">— Diskon ${Math.round(activeDiscount*100)}% aktif</span>
        <button onclick="activePromoCode=null;activeDiscount=0;renderDrawerVoucher();toast('Voucher dihapus.','info');" style="margin-left:8px;background:none;border:none;color:#ff4444;font-size:0.8em;cursor:pointer;">✕ Hapus</button>`;
    } else {
        el.innerHTML = '<span style="color:#555;">Belum ada voucher aktif. Pilih kode di bawah:</span>';
    }
}

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ SW terdaftar:', reg.scope))
            .catch(err => console.warn('⚠️ SW gagal:', err));
    });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    syncCartBadge();
});
// ── Ripple effect ──
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const circle = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  circle.style.cssText = `
    position:absolute;
    border-radius:50%;
    background:rgba(255,255,255,0.25);
    width:${size}px;height:${size}px;
    left:${e.clientX - rect.left - size/2}px;
    top:${e.clientY - rect.top - size/2}px;
    transform:scale(0);
    animation:ripple-anim 0.5s ease-out forwards;y
    pointer-events:none;
  `;
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 500);
});
// ── Auto add btn-live class ──
setTimeout(function() {
  document.querySelectorAll('.btn-ghost').forEach(btn => {
    const text = btn.textContent.trim();
    if (
      text.includes('Coba Live') ||
      text.includes('Try Live') ||
      text.includes('Coba Makeup') ||
      text.includes('Try Makeup') ||
      text.includes('Coba AI') ||
      text.includes('Try AI') ||
      text.includes('Analisis Kulit') ||
      text.includes('Skin Analysis') ||
      text.includes('Coba Warna')
    ) {
      btn.classList.add('btn-live');
    }
  });
}, 500);
// ── Auto add btn-cart class ──
setTimeout(function() {
  document.querySelectorAll('.btn-white').forEach(btn => {
    const text = btn.textContent.trim();
    if (
      text.includes('Keranjang') ||
      text.includes('Add to Cart') ||
      text.includes('+ Keranjang')
    ) {
      btn.classList.add('btn-cart');
    }
  });
}, 500);
// ════════════════════════════════════════════
// HALAMAN ANALISIS KULIT — Standalone
// ════════════════════════════════════════════

function kulitPreviewPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('kulit-preview-img').src = e.target.result;
    document.getElementById('kulit-preview-wrap').style.display = 'block';
    document.getElementById('kulit-btn-analisis').style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

function kulitBukaKamera() {
  const temp = document.createElement('input');
  temp.type = 'file';
  temp.accept = 'image/*';
  temp.capture = 'environment';
  temp.onchange = function() {
    if (this.files && this.files[0]) {
      const dt = new DataTransfer();
      dt.items.add(this.files[0]);
      document.getElementById('kulit-photo-input').files = dt.files;
      kulitPreviewPhoto(document.getElementById('kulit-photo-input'));
    }
  };
  temp.click();
}

function kulitTampilState(state) {
  ['awal','loading','hasil','error'].forEach(s => {
    const el = document.getElementById('kulit-state-' + s);
    if (el) el.style.display = s === state ? 'block' : 'none';
  });
}

async function jalankanAnalisisKulit() {
  const input = document.getElementById('kulit-photo-input');
  if (!input.files || !input.files[0]) {
    toast('Upload foto dulu!', 'error');
    return;
  }
  kulitTampilState('loading');
  setTimeout(() => {
    const bar = document.getElementById('kulit-progress-bar');
    if (bar) bar.style.width = '90%';
  }, 100);
  try {
    const base64 = await fileToBase64(input.files[0]);
    const imageUrl = await uploadToImgBB(base64);
    const res = await fetch('/api/youcam?action=skin-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_image_url: imageUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal analisis');
    const scores = data?.data?.results || data?.data?.data?.results || data?.results || {};
    kulitTampilHasil(scores);
  } catch (err) {
    kulitTampilState('error');
    document.getElementById('kulit-error-msg').textContent = err.message;
  }
}

function kulitTampilHasil(scores) {
  kulitTampilState('hasil');
  const labels = {
    acne:     '🔴 Jerawat',
    moisture: '💧 Kelembapan',
    pores:    '⭕ Pori-pori',
    wrinkles: '〰️ Kerutan',
    radiance: '✨ Kecerahan',
  };
  let skorHTML = '';
  let hasScore = false;
  for (const [key, label] of Object.entries(labels)) {
    const raw = scores?.[key]?.score ?? scores?.[key] ?? null;
    if (raw !== null) {
      hasScore = true;
      const pct = Math.min(100, Math.round(Number(raw)));
      skorHTML += `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="color:#aaa;font-size:0.85em;">${label}</span>
            <span style="color:#FFD700;font-weight:700;font-size:0.85em;">${pct}/100</span>
          </div>
          <div style="background:#2a2a2a;border-radius:8px;height:6px;">
            <div style="background:linear-gradient(90deg,#FFD700,#fffae6);border-radius:8px;height:6px;width:${pct}%;"></div>
          </div>
        </div>`;
    }
  }
  if (!hasScore) skorHTML = '<p style="color:#aaa;text-align:center;">Analisis selesai ✨</p>';
  document.getElementById('kulit-skor-content').innerHTML = skorHTML;

  const acne     = Number(scores?.acne?.score     ?? 50);
const moisture = Number(scores?.moisture?.score  ?? 50);
const radiance = Number(scores?.radiance?.score  ?? 50);

  let tipeKulit = '';
  let produkRek = [];

  if (acne > 60) {
    tipeKulit = '⚠️ Kulit berjerawat — butuh perawatan khusus';
    produkRek = [
      { id:'p13', nama:'Skincare Jerawat',  harga:195000, alasan:'Formula anti-jerawat efektif' },
      { id:'p33', nama:'Serum Niacinamide', harga:165000, alasan:'Kontrol pori & minyak berlebih' },
      { id:'p37', nama:'Clay Mask',         harga:95000,  alasan:'Bersihkan pori mendalam' },
    ];
  } else if (moisture < 40) {
    tipeKulit = '💧 Kulit kering — butuh hidrasi ekstra';
    produkRek = [
      { id:'p35', nama:'Moisturizer Gel', harga:175000, alasan:'Hidrasi intensif untuk kulit kering' },
      { id:'p36', nama:'Toner AHA BHA',   harga:145000, alasan:'Eksfoliasi & hidrasi sekaligus' },
    ];
  } else if (radiance < 50) {
    tipeKulit = '🌑 Kulit kusam — butuh pencerahan';
    produkRek = [
      { id:'p14', nama:'Skincare Pemutih', harga:215000, alasan:'Brightening & glow booster' },
      { id:'p34', nama:'Sunscreen SPF 50', harga:125000, alasan:'Proteksi UV agar tidak kusam' },
    ];
  } else {
    tipeKulit = '😊 Kulit normal & seimbang!';
    produkRek = [
      { id:'p34', nama:'Sunscreen SPF 50', harga:125000, alasan:'Proteksi harian wajib' },
      { id:'p35', nama:'Moisturizer Gel',  harga:175000, alasan:'Jaga keseimbangan kulit' },
    ];
  }

  document.getElementById('kulit-tipe-text').textContent = tipeKulit;

  const listEl = document.getElementById('kulit-produk-list');
  listEl.innerHTML = '';
  produkRek.forEach(p => {
    let imgSrc = '';
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.getAttribute('data-id') === p.id) {
        const img = card.querySelector('img');
        if (img) imgSrc = img.src;
      }
    });
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:12px;align-items:center;padding:12px;background:#111;border:1.5px solid rgba(255,215,0,0.15);border-radius:14px;';
    div.innerHTML = `
      ${imgSrc ? `<img src="${imgSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0;">` : '<span style="font-size:2em;">🧴</span>'}
      <div style="flex:1;min-width:0;">
        <p style="color:#fff;font-weight:600;font-size:0.9em;margin:0 0 3px;">${p.nama}</p>
        <p style="color:#aaa;font-size:0.76em;margin:0 0 6px;">${p.alasan}</p>
        <p style="color:#FFD700;font-weight:700;font-size:0.85em;margin:0 0 8px;">Rp ${formatRupiah(p.harga)}</p>
        <button onclick="addToCart('${p.nama}',${p.harga})" style="padding:6px 14px;border-radius:8px;border:1.5px solid #FFD700;background:rgba(255,215,0,0.1);color:#FFD700;font-size:0.76em;font-family:inherit;cursor:pointer;">
          + Keranjang
        </button>
      </div>`;
    listEl.appendChild(div);
  });
}

function kulitReset() {
  kulitTampilState('awal');
  document.getElementById('kulit-preview-wrap').style.display = 'none';
  document.getElementById('kulit-btn-analisis').style.display = 'none';
  document.getElementById('kulit-photo-input').value = '';
  const bar = document.getElementById('kulit-progress-bar');
  if (bar) bar.style.width = '0%';
}
