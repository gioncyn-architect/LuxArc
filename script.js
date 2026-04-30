// ============================================================
// LuxArc AI — script.js v2025050103
// FULL YouCam API Integration: AI Clothes, Hairstyle, Photo Enhancer
// ============================================================

function formatRupiah(number) {
    const num = typeof number === 'string'
        ? parseInt(number.replace(/\D/g, ''), 10)
        : Number(number);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// ── YouCam Service ────────────────────────────────────────────
class YouCamService {
    constructor() {
        this.apiKey    = null;
        this.apiSecret = null;
        this.ready     = false;
    }

    async init() {
        try {
            const res = await fetch('/api/get-youcam-key');
            if (!res.ok) throw new Error('Gagal ambil API key.');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            this.apiKey    = data.apiKey;
            this.apiSecret = data.apiSecret;
            this.ready     = true;
            console.log('✅ YouCam API siap.');
        } catch (err) {
            console.warn('⚠️ YouCam:', err.message);
            this.ready = false;
        }
    }

    // Upload gambar ke YouCam, return file_id
    async uploadImage(file) {
        // Step 1: Minta upload URL
        const urlRes = await fetch('/api/youcam?action=get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type }),
        });
        const urlData = await urlRes.json();
        if (!urlData.requests?.url) throw new Error('Gagal mendapat URL upload.');

        // Step 2: Upload file ke URL yang diberikan
        await fetch(urlData.requests.url, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
        });

        return urlData.file_id;
    }

    // Poll sampai task selesai
    async pollTask(task_id, task_type, maxTry = 20) {
        for (let i = 0; i < maxTry; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const res = await fetch(`/api/youcam?action=task-status&task_id=${task_id}&task_type=${task_type}`);
            const data = await res.json();
            if (data.task_status === 'success') return data;
            if (data.task_status === 'error') throw new Error('Tugas AI gagal.');
        }
        throw new Error('Waktu habis menunggu AI.');
    }

    // AI Clothes
    async aiClothes(userFile, clothFile) {
        const [userFileId, clothFileId] = await Promise.all([
            this.uploadImage(userFile),
            this.uploadImage(clothFile),
        ]);
        const res = await fetch('/api/youcam?action=ai-clothes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: userFileId, cloth_file_id: clothFileId }),
        });
        const data = await res.json();
        return await this.pollTask(data.task_id, 'ai-clothes');
    }

    // AI Hairstyle
    async aiHairstyle(userFile, style) {
        const fileId = await this.uploadImage(userFile);
        const res = await fetch('/api/youcam?action=ai-hairstyle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, style }),
        });
        const data = await res.json();
        return await this.pollTask(data.task_id, 'ai-hairstyle-generator');
    }

    // Photo Enhancer
    async photoEnhance(userFile) {
        const fileId = await this.uploadImage(userFile);
        const res = await fetch('/api/youcam?action=photo-enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId }),
        });
        const data = await res.json();
        return await this.pollTask(data.task_id, 'photo-enhancer');
    }
}

const youCamService = new YouCamService();
youCamService.init();

// ── AI Modal Helper ───────────────────────────────────────────
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

// ── Fitur AI Clothes ──────────────────────────────────────────
function openAIClothes(productImgSrc, productName) {
    showAIModal(`✨ AI Clothes — ${productName}`, `
        <p style="color:#aaa; margin-bottom:15px;">Upload foto dirimu, AI akan memakaikan ${productName} untukmu!</p>
        <label style="display:block; background:#1a1a1a; border:1px dashed #FFD700; border-radius:12px; padding:20px; text-align:center; cursor:pointer; margin-bottom:15px;">
            📷 Pilih Foto Dirimu
            <input type="file" accept="image/*" id="user-photo-input" style="display:none;" onchange="previewUserPhoto(this)">
        </label>
        <div id="user-photo-preview" style="display:none; margin-bottom:15px;">
            <img id="user-photo-img" style="width:100%; border-radius:12px; max-height:250px; object-fit:cover;">
        </div>
        <button class="btn btn-gold shimmer-btn" style="width:100%;" onclick="runAIClothes('${productImgSrc}', '${productName}')">
            🤖 Coba Sekarang dengan AI
        </button>
        <div id="ai-result-area" style="margin-top:20px;"></div>
    `);
}

function previewUserPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('user-photo-img').src = e.target.result;
            document.getElementById('user-photo-preview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function runAIClothes(productImgSrc, productName) {
    const userInput = document.getElementById('user-photo-input');
    if (!userInput || !userInput.files[0]) {
        toast('Upload foto dirimu dulu!', 'error'); return;
    }
    if (!youCamService.ready) {
        toast('⚠️ YouCam API belum siap.', 'error'); return;
    }

    const resultArea = document.getElementById('ai-result-area');
    resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ AI sedang memproses...<br><small>Mohon tunggu 10-30 detik</small></div>`;

    try {
        // Ambil cloth image dari src produk sebagai file
        const clothResp = await fetch(productImgSrc);
        const clothBlob = await clothResp.blob();
        const clothFile = new File([clothBlob], 'cloth.jpg', { type: 'image/jpeg' });

        const result = await youCamService.aiClothes(userInput.files[0], clothFile);
        const outputUrl = result.output_file?.url || result.result_url;

        if (outputUrl) {
            resultArea.innerHTML = `
                <p style="color:#FFD700; margin-bottom:10px;">✅ Hasil AI Clothes:</p>
                <img src="${outputUrl}" style="width:100%; border-radius:12px; margin-bottom:15px;">
                <div style="display:flex; gap:10px;">
                    <a href="${outputUrl}" download="luxarc-ai-clothes.jpg" class="btn btn-gold shimmer-btn" style="flex:1; text-align:center; text-decoration:none;">⬇️ Unduh</a>
                    <button class="btn btn-ghost" style="flex:1;" onclick="shareToWA('${outputUrl}')">📲 Share WA</button>
                </div>`;
            lookbookImages.push(outputUrl);
        } else {
            throw new Error('Hasil tidak ditemukan.');
        }
    } catch (err) {
        resultArea.innerHTML = `<p style="color:#ff4444;">❌ Error: ${err.message}</p>`;
    }
}

// ── Fitur AI Hairstyle ────────────────────────────────────────
function openAIHairstyle() {
    showAIModal('💇 AI Hairstyle Generator', `
        <p style="color:#aaa; margin-bottom:15px;">Upload foto wajahmu, AI akan mengubah gaya rambutmu!</p>
        <label style="display:block; background:#1a1a1a; border:1px dashed #FFD700; border-radius:12px; padding:20px; text-align:center; cursor:pointer; margin-bottom:15px;">
            📷 Pilih Foto Wajahmu
            <input type="file" accept="image/*" id="hair-photo-input" style="display:none;" onchange="previewHairPhoto(this)">
        </label>
        <div id="hair-photo-preview" style="display:none; margin-bottom:15px;">
            <img id="hair-photo-img" style="width:100%; border-radius:12px; max-height:250px; object-fit:cover;">
        </div>
        <p style="color:#aaa; margin-bottom:8px;">Pilih Gaya:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:15px;">
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'natural')" style="font-size:0.85em;">🌿 Natural</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'curly')" style="font-size:0.85em;">🌀 Curly</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'straight')" style="font-size:0.85em;">📏 Straight</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'wavy')" style="font-size:0.85em;">〰️ Wavy</button>
        </div>
        <input type="hidden" id="selected-hair-style" value="natural">
        <button class="btn btn-gold shimmer-btn" style="width:100%;" onclick="runAIHairstyle()">
            🤖 Generate Hairstyle
        </button>
        <div id="hair-result-area" style="margin-top:20px;"></div>
    `);
}

function previewHairPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('hair-photo-img').src = e.target.result;
            document.getElementById('hair-photo-preview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function selectHairStyle(btn, style) {
    document.querySelectorAll('.hair-style-btn').forEach(b => b.style.borderColor = '');
    btn.style.borderColor = '#FFD700';
    document.getElementById('selected-hair-style').value = style;
}

async function runAIHairstyle() {
    const input = document.getElementById('hair-photo-input');
    const style = document.getElementById('selected-hair-style').value;
    if (!input || !input.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    if (!youCamService.ready) { toast('⚠️ YouCam API belum siap.', 'error'); return; }

    const resultArea = document.getElementById('hair-result-area');
    resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ AI sedang mengubah gaya rambut...<br><small>Mohon tunggu 10-30 detik</small></div>`;

    try {
        const result = await youCamService.aiHairstyle(input.files[0], style);
        const outputUrl = result.output_file?.url || result.result_url;
        if (outputUrl) {
            resultArea.innerHTML = `
                <p style="color:#FFD700; margin-bottom:10px;">✅ Hasil AI Hairstyle:</p>
                <img src="${outputUrl}" style="width:100%; border-radius:12px; margin-bottom:15px;">
                <a href="${outputUrl}" download="luxarc-hairstyle.jpg" class="btn btn-gold shimmer-btn" style="width:100%; text-align:center; text-decoration:none; display:block;">⬇️ Unduh Foto</a>`;
            lookbookImages.push(outputUrl);
        } else {
            throw new Error('Hasil tidak ditemukan.');
        }
    } catch (err) {
        resultArea.innerHTML = `<p style="color:#ff4444;">❌ Error: ${err.message}</p>`;
    }
}

// ── Fitur Photo Enhancer ──────────────────────────────────────
function openPhotoEnhancer() {
    showAIModal('🌟 AI Photo Enhancer', `
        <p style="color:#aaa; margin-bottom:15px;">Upload foto produk atau selfie, AI akan mempercantiknya!</p>
        <label style="display:block; background:#1a1a1a; border:1px dashed #FFD700; border-radius:12px; padding:20px; text-align:center; cursor:pointer; margin-bottom:15px;">
            🖼️ Pilih Foto
            <input type="file" accept="image/*" id="enhance-photo-input" style="display:none;" onchange="previewEnhancePhoto(this)">
        </label>
        <div id="enhance-photo-preview" style="display:none; margin-bottom:15px;">
            <img id="enhance-photo-img" style="width:100%; border-radius:12px; max-height:250px; object-fit:cover;">
        </div>
        <button class="btn btn-gold shimmer-btn" style="width:100%;" onclick="runPhotoEnhancer()">
            ✨ Enhance dengan AI
        </button>
        <div id="enhance-result-area" style="margin-top:20px;"></div>
    `);
}

function previewEnhancePhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('enhance-photo-img').src = e.target.result;
            document.getElementById('enhance-photo-preview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function runPhotoEnhancer() {
    const input = document.getElementById('enhance-photo-input');
    if (!input || !input.files[0]) { toast('Upload foto dulu!', 'error'); return; }
    if (!youCamService.ready) { toast('⚠️ YouCam API belum siap.', 'error'); return; }

    const resultArea = document.getElementById('enhance-result-area');
    resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ AI sedang memperindah foto...<br><small>Mohon tunggu 10-30 detik</small></div>`;

    try {
        const result = await youCamService.photoEnhance(input.files[0]);
        const outputUrl = result.output_file?.url || result.result_url;
        if (outputUrl) {
            resultArea.innerHTML = `
                <p style="color:#FFD700; margin-bottom:10px;">✅ Hasil Enhanced:</p>
                <img src="${outputUrl}" style="width:100%; border-radius:12px; margin-bottom:15px;">
                <a href="${outputUrl}" download="luxarc-enhanced.jpg" class="btn btn-gold shimmer-btn" style="width:100%; text-align:center; text-decoration:none; display:block;">⬇️ Unduh Foto</a>`;
            lookbookImages.push(outputUrl);
        } else {
            throw new Error('Hasil tidak ditemukan.');
        }
    } catch (err) {
        resultArea.innerHTML = `<p style="color:#ff4444;">❌ Error: ${err.message}</p>`;
    }
}

function shareToWA(url) {
    window.open(`https://api.whatsapp.com/send?text=Lihat gayaku dari LuxArc AI! ${url}`, '_blank');
}

// ── State & Variables ─────────────────────────────────────────
let cart = [];
let wishlist = [];
let lookbookImages = [];
let currentCamera = 'environment';
let streamReference = null;
let currentViewingImageIndex = null;
let currentLang = 'id';

// ── Bilingual Dictionary ──────────────────────────────────────
const translations = {
    id: {
        heroLabel: "Exclusive Business Suite", welcome: "Selamat Datang,<br><em>Vivi Gioncyn.</em>", heroSub: "AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive: "Live <b>AI</b> Active", statCol: "Koleksi", statStock: "Stok",
        searchPlaceholder: "Tanya AI: 'Rok pesta malam'...", catAll: "Semua Koleksi", catClothes: "Pakaian", catJewelry: "Perhiasan Mewah", catAcc: "Aksesoris",
        secTitle: "Koleksi Terpilih", btnTry: "✨ Coba Live", btnAddCart: "+ Keranjang", btnSaran: "🤖 Minta Saran AI",
        btnAutoDetect: "📷 Deteksi Otomatis", aiWelcome: "Halo Vivi! Saya Luxarc AI. Gunakan tombol di bawah untuk mencoba fitur AI.", chatInput: "Tanya AI...",
        navHome: "Beranda", navAI: "AI Advisor", cartTitle: "Keranjang Belanja", cartTotal: "Total Tagihan:", btnPay: "✓ Selesai Bayar",
        toastCamFlip: "🔄 Memutar kamera...", toastCamErr: "Gagal membuka kamera!", toastCart: "masuk ke keranjang!", toastPay: "Pembayaran Berhasil! Transaksi tercatat. 🎉"
    },
    en: {
        heroLabel: "Exclusive Business Suite", welcome: "Welcome,<br><em>Vivi Gioncyn.</em>", heroSub: "AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive: "Live <b>AI</b> Active", statCol: "Collections", statStock: "Stock",
        searchPlaceholder: "Ask AI: 'Evening dress'...", catAll: "All Collections", catClothes: "Apparel", catJewelry: "Luxury Jewelry", catAcc: "Accessories",
        secTitle: "Curated Picks", btnTry: "✨ Try Live", btnAddCart: "+ Add to Cart", btnSaran: "🤖 Ask AI",
        btnAutoDetect: "📷 Auto Detect", aiWelcome: "Hi Vivi! I'm Luxarc AI. Use the buttons below to try AI features.", chatInput: "Ask AI...",
        navHome: "Home", navAI: "AI Advisor", cartTitle: "Shopping Cart", cartTotal: "Total Bill:", btnPay: "✓ Complete Payment",
        toastCamFlip: "🔄 Flipping camera...", toastCamErr: "Camera access failed!", toastCart: "added to cart!", toastPay: "Payment Successful! Transaction recorded. 🎉"
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
        if (card.innerText.toLowerCase().includes(term) || card.dataset.name.includes(term)) {
            card.style.display = 'block'; setTimeout(() => card.style.opacity = '1', 50); count++;
        } else {
            card.style.opacity = '0'; setTimeout(() => card.style.display = 'none', 400);
        }
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
        if (category === 'semua' || card.dataset.category === category) {
            card.style.display = 'block'; setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 50); count++;
        } else {
            card.style.opacity = '0'; card.style.transform = 'scale(0.95)'; setTimeout(() => card.style.display = 'none', 400);
        }
    });
    document.getElementById('product-count').innerText = `${count} produk`;
}

// ── AI Chat ───────────────────────────────────────────────────
const chatHistory = document.getElementById('chat-history');
function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.innerText = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
function appendProductCard(productName, desc, imgSrc, imgId) {
    const card = document.createElement('div');
    card.className = 'chat-product-card bot';
    card.innerHTML = `
        <div class="chat-product-info">
            <img src="${imgSrc}" alt="${productName}">
            <div class="chat-product-text"><h4>${productName}</h4><p>${desc}</p></div>
        </div>
        <button class="btn btn-ghost" onclick="openAIClothes('${imgSrc}', '${productName}')">✨ Coba AI Clothes</button>
    `;
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
        if (lower.includes('mana') || lower.includes('rekomendasi')) {
            appendMessage('bot', 'Tentu, ini produk yang cocok untukmu!');
            appendProductCard('Kalung Emas 211', 'Emas murni yang kontras dengan kulit.', 'kalung-emas-211.jpg', 'img-kalung-emas');
        } else if (lower.includes('rambut') || lower.includes('hairstyle')) {
            appendMessage('bot', 'Mau coba gaya rambut baru? Gunakan AI Hairstyle!');
            setTimeout(() => openAIHairstyle(), 500);
        } else if (lower.includes('foto') || lower.includes('enhance')) {
            appendMessage('bot', 'Mau perbaiki foto? Gunakan AI Photo Enhancer!');
            setTimeout(() => openPhotoEnhancer(), 500);
        } else {
            appendMessage('bot', 'Menarik! Coba fitur AI kami: AI Clothes, Hairstyle, atau Photo Enhancer.');
        }
    }, 800);
}
function askAIAbaoutProduct(productName) {
    switchPage('ai');
    setTimeout(() => {
        appendMessage('user', `AI, tolong berikan saran untuk ${productName}.`);
        setTimeout(() => {
            appendMessage('bot', `Pilihan bagus! ${productName} sangat menawan. Mau coba langsung dengan AI Clothes?`);
        }, 1000);
    }, 400);
}

// ── VTO Camera (fallback) ─────────────────────────────────────
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
        setTimeout(() => { badge.innerText = `✨ Match Score: ${Math.floor(Math.random() * 15) + 85}%`; }, 2000);
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
    } catch (err) {
        toast(translations[currentLang].toastCamErr, 'error');
    }
}

function startSeamlessVTO(imgId) {
    const imgEl = document.getElementById(imgId);
    const src = imgEl ? imgEl.src : '';
    const name = imgEl ? imgEl.alt : 'Produk';
    openAIClothes(src, name);
}

function triggerAutoDetect() {
    appendMessage('bot', 'Mengaktifkan AI Visual Scanner...');
    setTimeout(() => {
        openCamera(true);
        setTimeout(() => {
            closeCamera();
            appendMessage('bot', 'Analisis Selesai! ✨\n- Warna Kulit: Warm Undertone\n- Bentuk Wajah: Oval.\nEmas murni sangat cocok.');
            setTimeout(() => appendProductCard('Kalung Emas 211', 'Kalung Emas 24k', 'kalung-emas-211.jpg', 'img-kalung-emas'), 1000);
        }, 3500);
    }, 500);
}

// ── Lookbook ──────────────────────────────────────────────────
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
        ? '<p style="grid-column:1/-1; text-align:center; color:#888;">Belum ada foto.</p>'
        : lookbookImages.map((img, i) => `<div class="lookbook-item" onclick="openFullImage(${i})"><img src="${img}"></div>`).join('');
    openModal('lookbook-modal');
}
function openFullImage(index) {
    currentViewingImageIndex = index;
    document.getElementById('full-img-display').src = lookbookImages[index];
    document.getElementById('btn-delete-img').onclick = () => { lookbookImages.splice(currentViewingImageIndex, 1); closeModal('full-img-modal'); openLookbook(); };
    document.getElementById('btn-share-wa').onclick = () => shareToWA(lookbookImages[index]);
    openModal('full-img-modal');
}
function closeFullImage() { closeModal('full-img-modal'); currentViewingImageIndex = null; }

// ── Cart & Modal ──────────────────────────────────────────────
function openModal(id) { document.getElementById(id).style.display = 'flex'; setTimeout(() => document.getElementById(id).classList.add('open'), 10); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); setTimeout(() => { document.getElementById(id).style.display = 'none'; }, 300); }

function addToCart(name, price) {
    const safePrice = (typeof price === 'number' && !isNaN(price)) ? price : parseInt(String(price).replace(/\D/g, ''), 10) || 0;
    cart.push({ name, price: safePrice });
    document.getElementById('cart-count').innerText = cart.length;
    toast(`${name} ${translations[currentLang].toastCart}`, 'success');
}

function openCheckout() {
    const div = document.getElementById('cart-items');
    const totalSection = document.getElementById('cart-total-section');
    if (cart.length === 0) {
        div.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Keranjang kosong</p>';
        totalSection.style.display = 'none';
    } else {
        div.innerHTML = cart.map((item, idx) => `
          <div style="padding:10px 0; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
            <span>${item.name}</span>
            <div>
              <span style="color:#FFD700; margin-right:15px;">Rp ${formatRupiah(item.price)}</span>
              <button onclick="removeFromCart(${idx})" style="background:none; border:none; color:#ff4444; font-size:1.2em;">🗑</button>
            </div>
          </div>`).join('');
        const total = cart.reduce((a, b) => a + (Number(b.price) || 0), 0);
        document.getElementById('total-price').innerText = 'Rp ' + formatRupiah(total);
        document.getElementById('va-number').innerText = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
        totalSection.style.display = 'block';
    }
    openModal('checkout-modal');
}

function removeFromCart(i) { cart.splice(i, 1); document.getElementById('cart-count').innerText = cart.length; openCheckout(); }

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
    if (idx === -1) { wishlist.push(name); btn.innerText = '❤️'; } else { wishlist.splice(idx, 1); btn.innerText = '🤍'; }
}

function openWishlist() {
    document.getElementById('wishlist-items').innerHTML = wishlist.length === 0
        ? '<p style="text-align:center; color:#888;">Kosong</p>'
        : wishlist.map(n => `<div style="padding:10px 0; border-bottom:1px solid #333;">${n}</div>`).join('');
    openModal('wishlist-modal');
}

function openAdmin() {
    const revenue = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    document.getElementById('dash-revenue').innerText = `Rp ${formatRupiah(revenue)}`;
    document.getElementById('dash-wishlist-count').innerText = wishlist.length;
    const data = Array.from({ length: 7 }, () => Math.floor(Math.random() * 60) + 30);
    document.getElementById('mini-chart').innerHTML = data.map(() => `<div class="chart-bar" style="height:0%; flex:1; transition: height 0.8s ease-out; background: linear-gradient(to top, #FFD700, #fffae6); border-radius: 4px 4px 0 0;"></div>`).join('');
    openModal('admin-modal');
    setTimeout(() => { document.querySelectorAll('.chart-bar').forEach((bar, i) => { bar.style.height = `${data[i]}%`; }); }, 100);
}

// ── PWA ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW terdaftar:', reg.scope))
            .catch(err => console.log('SW gagal:', err));
    });
}
