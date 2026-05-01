// ============================================================
// LuxArc AI — script.js FINAL
// Fitur: AI Clothes, Wig, Makeup, Skincare, Hairstyle, Enhancer
// ============================================================

const IMGBB_API_KEY = 'f38d35d294b0887931317043aa4ce731';

function formatRupiah(number) {
    const num = typeof number === 'string' ? parseInt(number.replace(/\D/g, ''), 10) : Number(number);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// ── Upload foto ke ImgBB → dapat URL publik ──────────────────
async function uploadToImgBB(base64) {
    const formData = new FormData();
    formData.append('image', base64.split(',')[1]);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST', body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error('Gagal upload foto: ' + JSON.stringify(data));
    return data.data.url;
}

// ── Helper ambil URL hasil dari response Perfect Corp ────────
function getOutputUrl(data) {
    return data?.result_url
        || data?.data?.results?.url
        || data?.data?.results?.[0]?.url
        || data?.data?.result_url
        || data?.data?.output_url
        || null;
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

// ── AI Modal Helper ──────────────────────────────────────────
function showAIModal(title, html) {
    let modal = document.getElementById('youcam-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'youcam-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-sheet glass-panel" style="max-height:90vh; overflow-y:auto;">
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

// ── Template upload foto untuk semua modal AI ────────────────
function uploadPhotoHTML(inputId, imgId, previewId, btnLabel, btnOnclick) {
    return `
        <label style="display:block;background:#1a1a1a;border:1px dashed #FFD700;border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
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

// ── Tampilkan hasil AI ───────────────────────────────────────
function showAIResult(containerId, outputUrl, filename) {
    document.getElementById(containerId).innerHTML = `
        <p style="color:#FFD700;margin-bottom:10px;">✅ Hasil AI:</p>
        <img src="${outputUrl}" style="width:100%;border-radius:12px;margin-bottom:15px;">
        <div style="display:flex;gap:10px;">
            <a href="${outputUrl}" download="${filename}.jpg" class="btn btn-gold shimmer-btn" style="flex:1;text-align:center;text-decoration:none;">⬇️ Unduh</a>
            <button class="btn btn-ghost" style="flex:1;" onclick="window.open('https://api.whatsapp.com/send?text=Lihat hasilku dari LuxArc AI! ${outputUrl}','_blank')">📲 Share WA</button>
        </div>`;
    lookbookImages.push(outputUrl);
}

function showAILoading(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
        <div style="text-align:center;padding:20px;color:#FFD700;">⏳ ${msg}<br><small>Mohon tunggu 15-30 detik</small></div>`;
}

function showAIError(containerId, msg) {
    document.getElementById(containerId).innerHTML = `<p style="color:#ff4444;">❌ Error: ${msg}</p>`;
}

// ════════════════════════════════════════════════════════════
// ── 1. AI CLOTHES (Virtual Try-On Pakaian & Aksesoris) ──────
// ════════════════════════════════════════════════════════════
function openAIClothes(productImgSrc, productName) {
    showAIModal(`✨ AI Clothes — ${productName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto dirimu (tampak depan full body), AI akan memakaikan ${productName}!</p>
        ${uploadPhotoHTML('user-photo-input','user-photo-img','user-photo-preview','🤖 Coba Sekarang dengan AI',`runAIClothes('${productImgSrc}','${productName}')`)}`);
}

async function runAIClothes(productImgSrc, productName) {
    const userInput = document.getElementById('user-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dirimu dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang memproses pakaian...');
        const clothUrl = productImgSrc.startsWith('http') ? productImgSrc : window.location.origin + '/' + productImgSrc.replace(/^\//, '');
        const res = await fetch('/api/youcam?action=ai-clothes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, cloth_image_url: clothUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-clothes');
        else throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// Dipakai oleh tombol "Coba Live" produk lama
function startSeamlessVTO(imgId) {
    const imgEl = document.getElementById(imgId);
    const src = imgEl ? imgEl.src : '';
    const name = imgEl ? imgEl.alt : 'Produk';
    openAIClothes(src, name);
}

// ════════════════════════════════════════════════════════════
// ── 2. AI WIG ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function tryWigYoucam(wigImgSrc, wigName) {
    showAIModal(`💇 AI Wig — ${wigName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan memakaikan ${wigName}!</p>
        ${uploadPhotoHTML('wig-photo-input','wig-photo-img','wig-photo-preview','💇 Coba Wig dengan AI',`runAIWig('${wigImgSrc}','${wigName}')`)}`);
}

async function runAIWig(wigImgSrc, wigName) {
    const userInput = document.getElementById('wig-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang memakaikan wig...');
        const wigUrl = wigImgSrc.startsWith('http') ? wigImgSrc : window.location.origin + '/' + wigImgSrc.replace(/^\//, '');
        const res = await fetch('/api/youcam?action=ai-wig', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, wig_image_url: wigUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-wig');
        else throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 3. AI MAKEUP (Lipstik & Eyeshadow) ──────────────────────
// ════════════════════════════════════════════════════════════
function tryMakeupYoucam(makeupImgSrc, zone, makeupName) {
    // Tentukan warna dari nama produk
    let color = '#FF0000';
    if (makeupName.toLowerCase().includes('pink')) color = '#FF69B4';
    else if (makeupName.toLowerCase().includes('merah')) color = '#CC0000';
    else if (makeupName.toLowerCase().includes('eye') || zone === 'eyes') color = '#4B0082';

    showAIModal(`💄 AI Makeup — ${makeupName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan mengaplikasikan ${makeupName}!</p>
        ${uploadPhotoHTML('makeup-photo-input','makeup-photo-img','makeup-photo-preview','💄 Coba Makeup dengan AI',`runAIMakeup('${zone}','${color}','${makeupName}')`)}`);
}

async function runAIMakeup(zone, color, makeupName) {
    const userInput = document.getElementById('makeup-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang mengaplikasikan ${makeupName}...`);
        const res = await fetch('/api/youcam?action=ai-makeup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, zone, color }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-makeup');
        else throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 4. SKINCARE — Analisis Kulit ────────────────────────────
// ════════════════════════════════════════════════════════════
function analyzeSkincareYoucam(productId, productName) {
    showAIModal(`✨ Analisis Kulit — ${productName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan menganalisis kondisi kulitmu dan merekomendasikan ${productName}!</p>
        ${uploadPhotoHTML('skin-photo-input','skin-photo-img','skin-photo-preview','🔬 Analisis Kulitku',`runSkinAnalysis('${productName}')`)}`);
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));

        // Skin analysis mengembalikan data JSON, bukan gambar
        const skinData = data?.data || data;
        const scores = skinData?.results || skinData?.data?.results || {};

        let resultHTML = `<p style="color:#FFD700;margin-bottom:10px;">✅ Hasil Analisis Kulit:</p>
            <div style="background:#1a1a1a;border-radius:12px;padding:15px;margin-bottom:15px;">`;

        const labels = { acne: '🔴 Jerawat', moisture: '💧 Kelembapan', pores: '⭕ Pori-pori', wrinkles: '〰️ Kerutan', radiance: '✨ Kecerahan', skin_tone: '🎨 Warna Kulit' };
        let hasScore = false;
        for (const [key, label] of Object.entries(labels)) {
            const score = scores[key]?.score ?? scores[key] ?? null;
            if (score !== null) {
                hasScore = true;
                const pct = Math.round(score * 100) / 100;
                resultHTML += `<div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span style="color:#aaa;">${label}</span>
                        <span style="color:#FFD700;">${pct}/100</span>
                    </div>
                    <div style="background:#333;border-radius:8px;height:6px;">
                        <div style="background:#FFD700;border-radius:8px;height:6px;width:${pct}%;"></div>
                    </div>
                </div>`;
            }
        }
        if (!hasScore) {
            resultHTML += `<p style="color:#aaa;text-align:center;">Analisis selesai! Kulitmu dalam kondisi baik. ✨<br><small>Gunakan ${productName} untuk menjaga kondisi kulit.</small></p>`;
        }
        resultHTML += `</div>
            <p style="color:#aaa;font-size:0.9em;text-align:center;">Direkomendasikan: <b style="color:#FFD700;">${productName}</b></p>`;

        document.getElementById('ai-result-area').innerHTML = resultHTML;
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 5. AI HAIRSTYLE ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function openAIHairstyle() {
    showAIModal('💇 AI Hairstyle Generator', `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan mengubah gaya rambutmu!</p>
        <label style="display:block;background:#1a1a1a;border:1px dashed #FFD700;border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
            📷 Pilih Foto Wajahmu
            <input type="file" accept="image/*" id="hair-photo-input" style="display:none;" onchange="previewPhoto(this,'hair-photo-img','hair-photo-preview')">
        </label>
        <div id="hair-photo-preview" style="display:none;margin-bottom:15px;">
            <img id="hair-photo-img" style="width:100%;border-radius:12px;max-height:250px;object-fit:cover;">
        </div>
        <p style="color:#aaa;margin-bottom:8px;">Pilih Gaya:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px;">
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'natural')" style="font-size:0.85em;border-color:#FFD700;">🌿 Natural</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'curly')" style="font-size:0.85em;">🌀 Curly</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'straight')" style="font-size:0.85em;">📏 Straight</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'wavy')" style="font-size:0.85em;">〰️ Wavy</button>
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
    const style = document.getElementById('selected-hair-style').value;
    if (!input?.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    try {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang mengubah gaya rambut...');
        const res = await fetch('/api/youcam?action=ai-hairstyle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, style }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-hairstyle');
        else throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── 6. PHOTO ENHANCER ───────────────────────────────────────
// ════════════════════════════════════════════════════════════
function openPhotoEnhancer() {
    showAIModal('🌟 AI Photo Enhancer', `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto, AI akan mempercantiknya!</p>
        ${uploadPhotoHTML('enhance-photo-input','enhance-photo-img','enhance-photo-preview','✨ Enhance dengan AI','runPhotoEnhancer()')}`);
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        if (outputUrl) showAIResult('ai-result-area', outputUrl, 'luxarc-enhanced');
        else throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ════════════════════════════════════════════════════════════
// ── AI ADVISOR — Quick Replies & Submenu ────────────────────
// ════════════════════════════════════════════════════════════
function handleQuickReply(type) {
    // Sembunyikan quick replies
    const qr = document.getElementById('ai-quick-replies');
    if (qr) qr.style.display = 'none';

    // Sembunyikan semua submenu dulu
    ['submenu-makeup','submenu-wig','submenu-skin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (type === 'makeup') {
        appendMessage('user', '💄 Rekomendasi Makeup');
        setTimeout(() => {
            appendMessage('bot', 'Pilih produk makeup yang ingin kamu coba secara virtual!');
            const submenu = document.getElementById('submenu-makeup');
            if (submenu) submenu.style.display = 'block';
        }, 500);
    } else if (type === 'wig') {
        appendMessage('user', '💇 Coba Gaya Rambut / Wig');
        setTimeout(() => {
            appendMessage('bot', 'Pilih wig yang ingin kamu coba!');
            const submenu = document.getElementById('submenu-wig');
            if (submenu) submenu.style.display = 'block';
        }, 500);
    } else if (type === 'fashion') {
        appendMessage('user', '👗 Cari Pakaian & Perhiasan');
        setTimeout(() => {
            appendMessage('bot', 'Tentu! Kamu bisa coba pakaian dan perhiasan secara virtual. Pilih produk di halaman Beranda lalu klik "Coba Live" atau "Coba Wig"! 🛍️');
            switchPage('beranda');
        }, 500);
    } else if (type === 'skinanalysis') {
        appendMessage('user', '🔬 Analisis Kulit Saya');
        setTimeout(() => {
            appendMessage('bot', 'Pilih concern kulit yang ingin dianalisis!');
            const submenu = document.getElementById('submenu-skin');
            if (submenu) submenu.style.display = 'block';
        }, 500);
    } else if (type === 'free') {
        appendMessage('user', '💬 Tanya Bebas');
        setTimeout(() => {
            appendMessage('bot', 'Tentu! Silakan tanya apa saja tentang fashion, kecantikan, atau produk LuxArc AI. Saya siap membantu! ✨');
        }, 500);
    }
}

function closeSubmenu() {
    ['submenu-makeup','submenu-wig','submenu-skin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    // Tampilkan kembali quick replies
    const qr = document.getElementById('ai-quick-replies');
    if (qr) qr.style.display = 'flex';
}

// ════════════════════════════════════════════════════════════
// ── YouCam Service Init ──────────────────────────────────────
// ════════════════════════════════════════════════════════════
class YouCamService {
    constructor() { this.ready = false; }
    async init() {
        try {
            const res = await fetch('/api/get-youcam-key');
            if (!res.ok) throw new Error('Gagal ambil API key.');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            this.ready = true;
            console.log('✅ YouCam API siap.');
        } catch (err) {
            console.warn('⚠️ YouCam:', err.message);
            this.ready = false;
        }
    }
}
const youCamService = new YouCamService();
youCamService.init();

// ════════════════════════════════════════════════════════════
// ── State & Variables ────────────────────────────────────────
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
        heroLabel:"Exclusive Business Suite",welcome:"Selamat Datang,<br><em>Vivi Gioncyn.</em>",heroSub:"AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive:"Live <b>AI</b> Active",statCol:"Koleksi",statStock:"Stok",
        searchPlaceholder:"Tanya AI: 'Rok pesta malam'...",catAll:"Semua Koleksi",catClothes:"Pakaian",catJewelry:"Perhiasan Mewah",catAcc:"Aksesoris",
        secTitle:"Koleksi Terpilih",btnTry:"✨ Coba Live",btnAddCart:"+ Keranjang",btnSaran:"🤖 Minta Saran AI",
        btnAutoDetect:"📷 Deteksi Otomatis",aiWelcome:"Halo Vivi! Saya Luxarc AI.",chatInput:"Tanya AI...",
        navHome:"Beranda",navAI:"AI Advisor",cartTitle:"Keranjang Belanja",cartTotal:"Total Tagihan:",btnPay:"✓ Selesai Bayar",
        toastCamFlip:"🔄 Memutar kamera...",toastCamErr:"Gagal membuka kamera!",toastCart:"masuk ke keranjang!",toastPay:"Pembayaran Berhasil! 🎉"
    },
    en: {
        heroLabel:"Exclusive Business Suite",welcome:"Welcome,<br><em>Vivi Gioncyn.</em>",heroSub:"AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive:"Live <b>AI</b> Active",statCol:"Collections",statStock:"Stock",
        searchPlaceholder:"Ask AI: 'Evening dress'...",catAll:"All Collections",catClothes:"Apparel",catJewelry:"Luxury Jewelry",catAcc:"Accessories",
        secTitle:"Curated Picks",btnTry:"✨ Try Live",btnAddCart:"+ Add to Cart",btnSaran:"🤖 Ask AI",
        btnAutoDetect:"📷 Auto Detect",aiWelcome:"Hi Vivi! I'm Luxarc AI.",chatInput:"Ask AI...",
        navHome:"Home",navAI:"AI Advisor",cartTitle:"Shopping Cart",cartTotal:"Total Bill:",btnPay:"✓ Complete Payment",
        toastCamFlip:"🔄 Flipping camera...",toastCamErr:"Camera access failed!",toastCart:"added to cart!",toastPay:"Payment Successful! 🎉"
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
    el.style.background = type === 'error' ? '#ff4444' : 'rgba(255,215,0,0.9)';
    el.style.color = type === 'error' ? '#fff' : '#000';
    el.innerHTML = `<span>${msg}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.getElementById('nav-' + pageId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('search-input').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const products = document.querySelectorAll('.product-card');
    let count = 0;
    products.forEach(card => {
        const match = card.innerText.toLowerCase().includes(term) || card.dataset.name.includes(term);
        card.style.display = match ? 'block' : 'none';
        if (match) { setTimeout(() => card.style.opacity = '1', 50); count++; }
        else card.style.opacity = '0';
    });
    document.getElementById('product-count').innerText = `${count} produk`;
});

function mockupVoiceSearch() { toast('🎙️ AI Listening...', 'info'); }
function mockupVisualSearch() { toast('📷 AI Visual Scanner...', 'info'); }

function filterProducts(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const products = document.querySelectorAll('.product-card');
    let count = 0;
    products.forEach(card => {
        const show = category === 'semua' || card.dataset.category === category;
        card.style.display = show ? 'block' : 'none';
        if (show) { setTimeout(() => { card.style.opacity='1'; card.style.transform='scale(1)'; }, 50); count++; }
        else { card.style.opacity='0'; card.style.transform='scale(0.95)'; }
    });
    document.getElementById('product-count').innerText = `${count} produk`;
}

// ── AI Chat ──────────────────────────────────────────────────
const chatHistory = document.getElementById('chat-history');

function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.innerHTML = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendProductCard(productName, desc, imgSrc) {
    const card = document.createElement('div');
    card.className = 'chat-product-card bot';
    card.innerHTML = `
        <div class="chat-product-info">
            <img src="${imgSrc}" alt="${productName}">
            <div class="chat-product-text"><h4>${productName}</h4><p>${desc}</p></div>
        </div>
        <button class="btn btn-ghost" onclick="openAIClothes('${imgSrc}','${productName}')">✨ Coba AI Clothes</button>`;
    chatHistory.appendChild(card);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    appendMessage('user', text);
    input.value = '';
    setTimeout(() => {
        const lower = text.toLowerCase();
        if (lower.includes('wig')) {
            appendMessage('bot', 'Mau coba wig baru? Klik tombol di bawah!');
            setTimeout(() => { const s = document.getElementById('submenu-wig'); if(s) s.style.display='block'; }, 300);
        } else if (lower.includes('makeup') || lower.includes('lipstik') || lower.includes('eyeshadow')) {
            appendMessage('bot', 'Mau coba makeup virtual? Pilih produknya!');
            setTimeout(() => { const s = document.getElementById('submenu-makeup'); if(s) s.style.display='block'; }, 300);
        } else if (lower.includes('kulit') || lower.includes('skincare') || lower.includes('jerawat')) {
            appendMessage('bot', 'Mau analisis kondisi kulitmu?');
            setTimeout(() => { const s = document.getElementById('submenu-skin'); if(s) s.style.display='block'; }, 300);
        } else if (lower.includes('rambut') || lower.includes('hairstyle')) {
            appendMessage('bot', 'Mau coba gaya rambut baru? Buka AI Hairstyle!');
            setTimeout(() => openAIHairstyle(), 500);
        } else if (lower.includes('kalung') || lower.includes('perhiasan')) {
            appendMessage('bot', 'Ini koleksi perhiasan terbaik kami!');
            appendProductCard('Kalung Mutiara', 'Classic White Pearl', 'kalung-mutiara.jpg');
            appendProductCard('Kalung Emas 211', 'Pure Gold 24k', 'kalung-emas-211.jpg');
        } else if (lower.includes('pakaian') || lower.includes('baju') || lower.includes('rok') || lower.includes('blouse')) {
            appendMessage('bot', 'Ini koleksi pakaian yang sedang tren!');
            appendProductCard('Blouse 2245', 'Elegant Striped Top', '1000027250.jpg');
        } else {
            appendMessage('bot', 'Menarik! Coba fitur AI kami: Virtual Try-On pakaian, Wig, Makeup, atau Analisis Kulit. Ketik apa yang kamu inginkan! ✨');
        }
    }, 800);
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

// ── VTO Camera ───────────────────────────────────────────────
async function openCamera(isAutoDetect = false) {
    document.getElementById('camera-view').style.display = 'flex';
    const video = document.getElementById('video-stream');
    const badge = document.getElementById('ai-match-score');
    const uiControls = document.getElementById('cam-ui-controls');
    if (isAutoDetect) {
        uiControls.style.display = 'none';
        badge.style.display = 'flex';
        badge.innerText = '🔍 Memindai Biometrik...';
    } else {
        uiControls.style.display = 'flex';
        badge.style.display = 'flex';
        badge.innerText = '🤖 Calibrating...';
        setTimeout(() => { badge.innerText = `✨ Match Score: ${Math.floor(Math.random()*15)+85}%`; }, 2000);
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
        video.srcObject = stream;
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
}

async function flipCamera() {
    if (streamReference) streamReference.getTracks().forEach(t => t.stop());
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    toast(translations[currentLang].toastCamFlip, 'info');
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
            appendMessage('bot', 'Analisis Selesai! ✨\n- Warna Kulit: Warm Undertone\n- Bentuk Wajah: Oval\nEmas murni sangat cocok untukmu!');
            setTimeout(() => appendProductCard('Kalung Emas 211', 'Kalung Emas 24k', 'kalung-emas-211.jpg'), 1000);
        }, 3500);
    }, 500);
}

// ── Lookbook ─────────────────────────────────────────────────
function takeSnapshot() {
    const v = document.getElementById('video-stream');
    const c = document.getElementById('snapshot-canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    lookbookImages.push(c.toDataURL('image/jpeg'));
    toast('Foto disimpan! 📸', 'success');
}

function openLookbook() {
    const gallery = document.getElementById('lookbook-gallery');
    gallery.innerHTML = lookbookImages.length === 0
        ? '<p style="grid-column:1/-1;text-align:center;color:#888;">Belum ada foto.</p>'
        : lookbookImages.map((img, i) => `<div class="lookbook-item" onclick="openFullImage(${i})"><img src="${img}"></div>`).join('');
    openModal('lookbook-modal');
}

function openFullImage(index) {
    currentViewingImageIndex = index;
    document.getElementById('full-img-display').src = lookbookImages[index];
    document.getElementById('btn-delete-img').onclick = () => { lookbookImages.splice(currentViewingImageIndex, 1); closeModal('full-img-modal'); openLookbook(); };
    document.getElementById('btn-share-wa').onclick = () => { window.open(`https://api.whatsapp.com/send?text=Lihat gayaku dari LuxArc AI!`, '_blank'); };
    openModal('full-img-modal');
}

function closeFullImage() { closeModal('full-img-modal'); currentViewingImageIndex = null; }

// ── Cart & Modal ──────────────────────────────────────────────
function openModal(id) { document.getElementById(id).style.display='flex'; setTimeout(()=>document.getElementById(id).classList.add('open'),10); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); setTimeout(()=>{ document.getElementById(id).style.display='none'; },300); }

function addToCart(name, price) {
    const safePrice = (typeof price==='number'&&!isNaN(price)) ? price : parseInt(String(price).replace(/\D/g,''),10)||0;
    cart.push({ name, price: safePrice });
    document.getElementById('cart-count').innerText = cart.length;
    toast(`${name} ${translations[currentLang].toastCart}`, 'success');
}

function openCheckout() {
    const div = document.getElementById('cart-items');
    const totalSection = document.getElementById('cart-total-section');
    if (cart.length === 0) {
        div.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Keranjang kosong</p>';
        totalSection.style.display = 'none';
    } else {
        div.innerHTML = cart.map((item,idx) => `
            <div style="padding:10px 0;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
                <span>${item.name}</span>
                <div>
                    <span style="color:#FFD700;margin-right:15px;">Rp ${formatRupiah(item.price)}</span>
                    <button onclick="removeFromCart(${idx})" style="background:none;border:none;color:#ff4444;font-size:1.2em;">🗑</button>
                </div>
            </div>`).join('');
        const total = cart.reduce((a,b) => a+(Number(b.price)||0), 0);
        document.getElementById('total-price').innerText = 'Rp ' + formatRupiah(total);
        document.getElementById('va-number').innerText = `8801 ${Math.floor(10000000+Math.random()*90000000)}`;
        totalSection.style.display = 'block';
    }
    openModal('checkout-modal');
}

function removeFromCart(i) { cart.splice(i,1); document.getElementById('cart-count').innerText=cart.length; openCheckout(); }

function processPayment() {
    toast('Memverifikasi...', 'info');
    setTimeout(() => {
        toast(translations[currentLang].toastPay, 'success');
        cart = [];
        document.getElementById('cart-count').innerText = '0';
        closeModal('checkout-modal');
    }, 1500);
}

function toggleWishlist(btn, name) {
    const idx = wishlist.indexOf(name);
    if (idx===-1) { wishlist.push(name); btn.innerText='❤️'; } else { wishlist.splice(idx,1); btn.innerText='🤍'; }
}

function openWishlist() {
    document.getElementById('wishlist-items').innerHTML = wishlist.length===0
        ? '<p style="text-align:center;color:#888;">Kosong</p>'
        : wishlist.map(n=>`<div style="padding:10px 0;border-bottom:1px solid #333;">${n}</div>`).join('');
    openModal('wishlist-modal');
}

function openAdmin() {
    const revenue = cart.reduce((s,i)=>s+(Number(i.price)||0),0);
    document.getElementById('dash-revenue').innerText = `Rp ${formatRupiah(revenue)}`;
    document.getElementById('dash-wishlist-count').innerText = wishlist.length;
    const data = Array.from({length:7},()=>Math.floor(Math.random()*60)+30);
    document.getElementById('mini-chart').innerHTML = data.map(()=>`<div class="chart-bar" style="height:0%;flex:1;transition:height 0.8s ease-out;background:linear-gradient(to top,#FFD700,#fffae6);border-radius:4px 4px 0 0;"></div>`).join('');
    openModal('admin-modal');
    setTimeout(()=>{ document.querySelectorAll('.chart-bar').forEach((bar,i)=>{bar.style.height=`${data[i]}%`;}); },100);
}

// ── PWA ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW terdaftar:', reg.scope))
            .catch(err => console.log('SW gagal:', err));
    });
}
