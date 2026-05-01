// ============================================================
// LuxArc AI — script.js v2025050106 (FINAL + SKIN ANALYSIS)
// ============================================================

const IMGBB_API_KEY = 'f38d35d294b0887931317043aa4ce731';

function formatRupiah(number) {
    const num = typeof number === 'string'
        ? parseInt(number.replace(/\D/g, ''), 10)
        : Number(number);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// ── Upload ke ImgBB → dapat URL publik ───────────────────────
async function uploadToImgBB(base64) {
    const formData = new FormData();
    formData.append('image', base64.split(',')[1]);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error('Gagal upload foto ke server: ' + JSON.stringify(data));
    return data.data.url;
}

// ── Helper ambil URL hasil dari berbagai format response ─────
function getOutputUrl(data) {
    return data?.result_url        // ← ini yang dikirim api/youcam.js
        || data?.data?.output_url
        || data?.data?.result_url
        || data?.data?.image_url
        || data?.data?.dst_file_url
        || null;
}

// ── YouCam Service ────────────────────────────────────────────
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

// ── Convert file ke base64 ────────────────────────────────────
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

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
        <p style="color:#aaa; margin-bottom:15px;">Upload foto dirimu (tampak depan full body), AI akan memakaikan ${productName}!</p>
        <label style="display:block; background:#1a1a1a; border:1px dashed #FFD700; border-radius:12px; padding:20px; text-align:center; cursor:pointer; margin-bottom:15px;">
            📷 Pilih Foto Dirimu
            <input type="file" accept="image/*" id="user-photo-input" style="display:none;" onchange="previewPhoto(this,'user-photo-img','user-photo-preview')">
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

async function runAIClothes(productImgSrc, productName) {
    const userInput = document.getElementById('user-photo-input');
    if (!userInput || !userInput.files[0]) { toast('Upload foto dirimu dulu!', 'error'); return; }

    const resultArea = document.getElementById('ai-result-area');
    resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ Mengupload foto...<br><small>Mohon tunggu sebentar</small></div>`;

    try {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);

        resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ AI sedang memproses...<br><small>Mohon tunggu 15-30 detik</small></div>`;

        const clothUrl = productImgSrc.startsWith('http')
            ? productImgSrc
            : window.location.origin + '/' + productImgSrc.replace(/^\//, '');

        const res = await fetch('/api/youcam?action=ai-clothes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_image_url: userImageUrl,
                cloth_image_url: clothUrl,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));

        const outputUrl = getOutputUrl(data);
        if (outputUrl) {
            resultArea.innerHTML = `
                <p style="color:#FFD700; margin-bottom:10px;">✅ Hasil AI Clothes:</p>
                <img src="${outputUrl}" style="width:100%; border-radius:12px; margin-bottom:15px;">
                <div style="display:flex; gap:10px;">
                    <a href="${outputUrl}" download="luxarc-ai-clothes.jpg" class="btn btn-gold shimmer-btn" style="flex:1; text-align:center; text-decoration:none;">⬇️ Unduh</a>
                    <button class="btn btn-ghost" style="flex:1;" onclick="window.open('https://api.whatsapp.com/send?text=Lihat gayaku dari LuxArc AI! ${outputUrl}','_blank')">📲 Share WA</button>
                </div>`;
            lookbookImages.push(outputUrl);
        } else {
            throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
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
            <input type="file" accept="image/*" id="hair-photo-input" style="display:none;" onchange="previewPhoto(this,'hair-photo-img','hair-photo-preview')">
        </label>
        <div id="hair-photo-preview" style="display:none; margin-bottom:15px;">
            <img id="hair-photo-img" style="width:100%; border-radius:12px; max-height:250px; object-fit:cover;">
        </div>
        <p style="color:#aaa; margin-bottom:8px;">Pilih Gaya:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:15px;">
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'natural')" style="font-size:0.85em; border-color:#FFD700;">🌿 Natural</button>
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

function selectHairStyle(btn, style) {
    document.querySelectorAll('.hair-style-btn').forEach(b => b.style.borderColor = '');
    btn.style.borderColor = '#FFD700';
    document.getElementById('selected-hair-style').value = style;
}

async function runAIHairstyle() {
    const input = document.getElementById('hair-photo-input');
    const style = document.getElementById('selected-hair-style').value;
    if (!input || !input.files[0]) { toast('Upload foto dulu!', 'error'); return; }

    const resultArea = document.getElementById('hair-result-area');
    resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ Mengupload foto...<br><small>Mohon tunggu sebentar</small></div>`;

    try {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);

        resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ AI sedang mengubah gaya rambut...<br><small>Mohon tunggu 15-30 detik</small></div>`;

        const res = await fetch('/api/youcam?action=ai-hairstyle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl, style }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));

        const outputUrl = getOutputUrl(data);
        if (outputUrl) {
            resultArea.innerHTML = `
                <p style="color:#FFD700; margin-bottom:10px;">✅ Hasil AI Hairstyle:</p>
                <img src="${outputUrl}" style="width:100%; border-radius:12px; margin-bottom:15px;">
                <a href="${outputUrl}" download="luxarc-hairstyle.jpg" class="btn btn-gold shimmer-btn" style="width:100%; text-align:center; text-decoration:none; display:block;">⬇️ Unduh Foto</a>`;
            lookbookImages.push(outputUrl);
        } else {
            throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
        }
    } catch (err) {
        resultArea.innerHTML = `<p style="color:#ff4444;">❌ Error: ${err.message}</p>`;
    }
}

// ── Fitur Photo Enhancer ──────────────────────────────────────
function openPhotoEnhancer() {
    showAIModal('🌟 AI Photo Enhancer', `
        <p style="color:#aaa; margin-bottom:15px;">Upload foto, AI akan mempercantiknya!</p>
        <label style="display:block; background:#1a1a1a; border:1px dashed #FFD700; border-radius:12px; padding:20px; text-align:center; cursor:pointer; margin-bottom:15px;">
            🖼️ Pilih Foto
            <input type="file" accept="image/*" id="enhance-photo-input" style="display:none;" onchange="previewPhoto(this,'enhance-photo-img','enhance-photo-preview')">
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

async function runPhotoEnhancer() {
    const input = document.getElementById('enhance-photo-input');
    if (!input || !input.files[0]) { toast('Upload foto dulu!', 'error'); return; }

    const resultArea = document.getElementById('enhance-result-area');
    resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ Mengupload foto...<br><small>Mohon tunggu sebentar</small></div>`;

    try {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);

        resultArea.innerHTML = `<div style="text-align:center; padding:20px; color:#FFD700;">⏳ AI sedang memperindah foto...<br><small>Mohon tunggu 15-30 detik</small></div>`;

        const res = await fetch('/api/youcam?action=photo-enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));

        const outputUrl = getOutputUrl(data);
        if (outputUrl) {
            resultArea.innerHTML = `
                <p style="color:#FFD700; margin-bottom:10px;">✅ Hasil Enhanced:</p>
                <img src="${outputUrl}" style="width:100%; border-radius:12px; margin-bottom:15px;">
                <a href="${outputUrl}" download="luxarc-enhanced.jpg" class="btn btn-gold shimmer-btn" style="width:100%; text-align:center; text-decoration:none; display:block;">⬇️ Unduh Foto</a>`;
            lookbookImages.push(outputUrl);
        } else {
            throw new Error('Hasil tidak ditemukan. Response: ' + JSON.stringify(data));
        }
    } catch (err) {
        resultArea.innerHTML = `<p style="color:#ff4444;">❌ Error: ${err.message}</p>`;
    }
}

// ── State & Variables ─────────────────────────────────────────
let cart = [];
let wishlist = [];
let lookbookImages = [];
let currentCamera = 'user';
let streamReference = null;
let currentViewingImageIndex = null;
let currentLang = 'id';

// ── Data Produk LuxArc untuk AI Advisor ──────────────────────
const luxarcProducts = [
    { name: 'Kalung Mutiara',  sub: 'Classic White Pearl',  img: 'kalung-mutiara.jpg',  imgId: 'img-kalung-mutiara', price: 350000,  tags: ['kulit cerah','oval','bulat','cool','kalung','mutiara','putih','pesta'] },
    { name: 'Kalung Emas 211', sub: 'Pure Gold 24k',         img: 'kalung-emas-211.jpg', imgId: 'img-kalung-emas',    price: 2500000, tags: ['warm','sawo','gelap','oval','kalung','emas','mewah','pesta'] },
    { name: 'Blouse 2245',     sub: 'Elegant Striped Top',   img: '1000027250.jpg',       imgId: 'img-blouse',         price: 185000,  tags: ['pakaian','blouse','casual','bergaris','elegan','baju'] },
    { name: 'Rok Mini Hitam',  sub: 'Chic Black Skirt',      img: 'rok-mini-hitam.jpg',  imgId: 'img-rok-hitam',      price: 120000,  tags: ['pakaian','rok','hitam','chic','kasual','baju'] },
    { name: 'Rok Levis 121',   sub: 'Vintage Denim',          img: 'rok-levis-121.jpg',   imgId: 'img-rok-levis',      price: 165000,  tags: ['pakaian','rok','denim','vintage','kasual','baju'] },
    { name: 'Topi xx',         sub: 'Streetwear Cap',         img: 'topi-xx.jpg',         imgId: 'img-topi-xx',        price: 85000,   tags: ['aksesoris','topi','streetwear','kasual'] },
    { name: 'Kaca Mata gc',    sub: 'UV Protect',             img: 'kacamata-gc.jpg',     imgId: 'img-kacamata-gc',    price: 150000,  tags: ['aksesoris','kacamata','uv','kasual','pantai'] },
];

function findProducts(keywords) {
    const kw = keywords.map(k => k.toLowerCase());
    return luxarcProducts.filter(p =>
        kw.some(k => p.tags.some(t => t.includes(k)) || p.name.toLowerCase().includes(k))
    ).slice(0, 2);
}

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
            card.style.opacity = '0'; setTimeout(() => card.style.display = 'none', 200);
        }
    });
});
