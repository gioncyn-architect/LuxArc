// ============================================================
// LuxArc AI — script.js COMPLETE v3 (PATCHED)
// Terhubung ke: /api/youcam (Vercel Serverless)
// Fitur: AI Clothes, Hair Color, Makeup, Skin Analysis,
//        Hairstyle, Accessory, Photo Enhancer
// Patch: resizeImage, uploadToImgBB, runAIHairColor,
//        runAIMakeup, runAIAccessory (ai-necklace)
// Update: AI Advisor menggunakan Groq API (ganti dari Gemini)
// ============================================================

const IMGBB_API_KEY = 'f38d35d294b0887931317043aa4ce731';

// ── Format Rupiah ────────────────────────────────────────────
function formatRupiah(number) {
    const num = typeof number === 'string' ? parseInt(number.replace(/\D/g, ''), 10) : Number(number);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// ── [BARU] Resize gambar sebelum upload (max 1800px) ─────────
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

// ── [PATCHED] Upload foto ke ImgBB — resize dulu ─────────────
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

// ── Convert file ke base64 ───────────────────────────────────
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
        <label style="display:block;background:#1a1a1a;border:1.5px dashed #FFD700;border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
            📷 Pilih Foto Dirimu
            <input type="file" accept="image/*" id="${inputId}" style="display:none;" onchange="previewPhoto(this,'${imgId}','${previewId}')">
        </label>
        <div id="${previewId}" style="display:none;margin-bottom:15px;">
            <img id="${imgId}" style="width:100%;border-radius:12px;max-height:250px;object-fit:cover;">
        </div>
        <button class="btn btn-gold shimmer-btn" style="width:100%;" onclick="${btnOnclick}">
            ${btnLabel}
        </button>
        <div id="ai-result-area" style="margin-top:20px;"></div>`;
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

function showAIResult(containerId, outputUrl, filename) {
    document.getElementById(containerId).innerHTML = `
        <p style="color:#FFD700;margin-bottom:10px;">✅ Hasil AI:</p>
        <img src="${outputUrl}" style="width:100%;border-radius:12px;margin-bottom:15px;">
        <div style="display:flex;gap:10px;">
            <a href="${outputUrl}" download="${filename}.jpg" class="btn btn-gold shimmer-btn" style="flex:1;text-align:center;text-decoration:none;">⬇️ Unduh</a>
            <button class="btn btn-ghost" style="flex:1;" onclick="window.open('https://api.whatsapp.com/send?text=Lihat hasilku dari LuxArc AI! ${encodeURIComponent(outputUrl)}','_blank')">📲 Share WA</button>
        </div>`;
    lookbookImages.push(outputUrl);
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

// ── [PATCHED] runAIAccessory — action: ai-necklace ───────────
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

// ── [PATCHED] runAIHairColor — hanya 3 field, tanpa pattern ──
async function runAIHairColor(colorName, colorHex) {
    const userInput = document.getElementById('hair-color-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang mengubah warna rambut menjadi ${colorName}...`);
        const res = await fetch('/api/youcam?action=ai-hair-color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url: userImageUrl,
                color: colorHex,
                color_name: colorName,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, `luxarc-hair-${colorName.toLowerCase()}`);
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 4. AI MAKEUP — Lipstik & Eyeshadow ──────────────────────
// ════════════════════════════════════════════════════════════
function tryMakeupYoucam(makeupImgSrc, zone, makeupName) {
    let color = '#FF0000';
    const n = makeupName.toLowerCase();
    if (n.includes('pink'))   color = '#FF69B4';
    else if (n.includes('coklat') || n.includes('gold')) color = '#8B4513';
    else if (n.includes('merah')) color = '#CC0000';
    else if (zone === 'eyes' || n.includes('eye')) color = '#4B0082';

    showAIModal(`💄 AI Makeup — ${makeupName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan mengaplikasikan <b>${makeupName}</b>!</p>
        ${uploadPhotoHTML('makeup-photo-input','makeup-photo-img','makeup-photo-preview',
            '💄 Coba Makeup dengan AI',
            `runAIMakeup('${zone}','${color}','${makeupName}')`
        )}`);
}

// ── [PATCHED] runAIMakeup — resize otomatis via uploadToImgBB ─
async function runAIMakeup(zone, color, makeupName) {
    const userInput = document.getElementById('makeup-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang mengaplikasikan ${makeupName}...`);
        const res = await fetch('/api/youcam?action=ai-makeup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url: userImageUrl,
                zone,
                color,
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

        const scores = data?.data?.results || data?.data?.data?.results || {};
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
            <img id="hair-photo-img" style="width:100%;border-radius:12px;max-height:250px;object-fit:cover;">
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
// ── AI ADVISOR — Chat & Quick Replies (Powered by Groq) ─────
// ════════════════════════════════════════════════════════════
const chatHistory = document.getElementById('chat-history');

// Simpan riwayat chat untuk konteks Groq
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
    card.className = 'chat-msg bot';
    card.style.cssText = 'padding:10px;max-width:90%;';
    card.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            <img src="${imgSrc}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">
            <div><b style="font-size:0.9em;">${productName}</b><br><small style="color:#888;">${desc}</small></div>
        </div>
        <button class="btn btn-ghost" style="width:100%;font-size:0.78em;" onclick="openAIClothes('${imgSrc}','${productName}')">✨ Coba AI Clothes</button>`;
    chatHistory.appendChild(card);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// ── Kirim pesan ke Groq API ──────────────────────────────────
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
        return data.reply;
    } catch (err) {
        console.error('[Groq Chat Error]', err);
        return 'Maaf, AI Advisor sedang tidak tersedia. Coba lagi ya! 😊';
    }
}

function handleQuickReply(type) {
    const qr = document.getElementById('ai-quick-replies');
    if (qr) qr.style.display = 'none';
    ['submenu-makeup','submenu-cat-rambut','submenu-skin'].forEach(id => {
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
    ['submenu-makeup','submenu-cat-rambut','submenu-skin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const qr = document.getElementById('ai-quick-replies');
    if (qr) qr.style.display = 'flex';
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';

    // Disable input saat menunggu
    input.disabled = true;

    const lower = text.toLowerCase();

    // ── Tetap handle shortcut lokal untuk fitur AI YouCam ────
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

    // ── Semua pertanyaan lain → Groq AI ──────────────────────
    appendTypingIndicator();

    const reply = await sendToGroq(text);

    removeTypingIndicator();
    appendMessage('bot', reply);

    // Simpan ke history untuk konteks berikutnya
    groqChatHistory.push({ role: 'user', text });
    groqChatHistory.push({ role: 'bot', text: reply });

    // Batasi history maksimal 20 pesan
    if (groqChatHistory.length > 20) groqChatHistory = groqChatHistory.slice(-20);

    input.disabled = false;
    input.focus();
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

function toggleLanguage() {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    document.getElementById('btn-lang').innerText = currentLang.toUpperCase();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang][key]) el.placeholder = translations[currentLang][key];
    });
}

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
}

// ── Search ───────────────────────────────────────────────────
document.getElementById('search-input')?.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    let count = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        const match = card.innerText.toLowerCase().includes(term) || card.dataset.name?.includes(term);
        card.style.display = match ? 'block' : 'none';
        if (match) count++;
    });
    document.getElementById('product-count').innerText = `${count} produk`;
});

function mockupVoiceSearch() { toast('🎙️ AI Listening...'); }
function mockupVisualSearch() { toast('📷 AI Visual Scanner...'); }

function filterProducts(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    let count = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        const show = category === 'semua' || card.dataset.category === category;
        card.style.display = show ? 'block' : 'none';
        if (show) count++;
    });
    document.getElementById('product-count').innerText = `${count} produk`;
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

function triggerAutoDetect() {
    appendMessage('bot', 'Mengaktifkan AI Visual Scanner...');
    setTimeout(() => {
        openCamera(true);
        setTimeout(() => {
            closeCamera();
            appendMessage('bot', 'Analisis Selesai! ✨\n• Warna Kulit: Warm Undertone\n• Bentuk Wajah: Oval\nEmas murni sangat cocok untukmu!');
            setTimeout(() => appendProductCard('Kalung Emas 211', 'Kalung Emas 24k', 'kalung-emas-211.jpg'), 1000);
        }, 3500);
    }, 500);
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

function openLookbook() {
    const gallery = document.getElementById('lookbook-gallery');
    gallery.innerHTML = lookbookImages.length === 0
        ? '<p style="grid-column:1/-1;text-align:center;color:#888;padding:20px;">Belum ada foto.</p>'
        : lookbookImages.map((img, i) => `<div onclick="openFullImage(${i})" style="cursor:pointer;"><img src="${img}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;"></div>`).join('');
    openModal('lookbook-modal');
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
    document.getElementById('cart-count').innerText = cart.length;
    toast(`🛒 ${name} ${translations[currentLang].toastCart}`);
}

function openCheckout() {
    const div = document.getElementById('cart-items');
    const totalSection = document.getElementById('cart-total-section');
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
        const total = cart.reduce((a, b) => a + (Number(b.price) || 0), 0);
        document.getElementById('total-price').innerText = 'Rp ' + formatRupiah(total);
        document.getElementById('va-number').innerText = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
        totalSection.style.display = 'block';
    }
    openModal('checkout-modal');
}

function removeFromCart(i) {
    cart.splice(i, 1);
    document.getElementById('cart-count').innerText = cart.length;
    openCheckout();
}

function processPayment() {
    toast('⏳ Memverifikasi...');
    setTimeout(() => {
        toast(translations[currentLang].toastPay);
        cart = [];
        document.getElementById('cart-count').innerText = '0';
        closeModal('checkout-modal');
    }, 1500);
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

// ── PWA Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ SW terdaftar:', reg.scope))
            .catch(err => console.warn('⚠️ SW gagal:', err));
    });
}
