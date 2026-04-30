// ============================================================
// LuxArc AI — script.js v2025050101
// FIX: formatRupiah didefinisikan PERTAMA agar tidak undefined
//      Fix NaN di semua kalkulasi harga
//      YouCam API Key dari Netlify Function (aman)
// ============================================================

// --- FIX HARGA NaN: Definisikan formatRupiah PALING ATAS ---
function formatRupiah(number) {
    const num = typeof number === 'string'
        ? parseInt(number.replace(/\D/g, ''), 10)
        : Number(number);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// --- YouCam API Service (Key dari Netlify, bukan hardcode) ---
class YouCamService {
    constructor() {
        this.apiKey    = null;
        this.apiSecret = null;
        this.ready     = false;
    }

    async init() {
        try {
            const res = await fetch('/.netlify/functions/get-youcam-key');
            if (!res.ok) throw new Error('Gagal ambil API key dari server.');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            this.apiKey    = data.apiKey;
            this.apiSecret = data.apiSecret;
            this.ready     = true;
            console.log('✅ YouCam API siap.');
            return true;
        } catch (err) {
            console.warn('⚠️ YouCam API:', err.message);
            this.ready = false;
            return false;
        }
    }

    applyFilter(stream, productId) {
        if (!this.ready) {
            console.warn('YouCam belum siap — mode simulasi aktif.');
            return;
        }
        // Titik integrasi SDK YouCam sesungguhnya
        console.log(`✅ YouCam AR aktif — Produk: ${productId}`);
        console.log(`   Key: ${this.apiKey.slice(0,6)}*** | Secret: ${this.apiSecret.slice(0,4)}***`);
    }
}

const youCamService = new YouCamService();
youCamService.init();

// --- State & Variables ---
let cart = [];
let wishlist = [];
let lookbookImages = [];
let currentCamera = 'environment';
let streamReference = null;
let currentViewingImageIndex = null;
let currentLang = 'id';

// --- Bilingual Dictionary ---
const translations = {
    id: {
        heroLabel: "Exclusive Business Suite", welcome: "Selamat Datang,<br><em>Vivi Gioncyn.</em>", heroSub: "AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive: "Live <b>AI</b> Active", statCol: "Koleksi", statStock: "Stok",
        searchPlaceholder: "Tanya AI: 'Rok pesta malam'...", catAll: "Semua Koleksi", catClothes: "Pakaian", catJewelry: "Perhiasan Mewah", catAcc: "Aksesoris",
        secTitle: "Koleksi Terpilih", btnTry: "✨ Coba Live", btnAddCart: "+ Keranjang", btnSaran: "🤖 Minta Saran AI",
        btnAutoDetect: "📷 Deteksi Otomatis", aiWelcome: "Halo Vivi! Saya Luxarc AI. Diskusikan gaya yang kamu cari, atau gunakan 'Deteksi Otomatis' agar saya bisa menganalisis wajah dan warna kulitmu.", chatInput: "Tanya AI...",
        navHome: "Beranda", navAI: "AI Advisor", cartTitle: "Keranjang Belanja", cartTotal: "Total Tagihan:", btnPay: "✓ Selesai Bayar",
        toastCamFlip: "🔄 Memutar kamera...", toastCamErr: "Gagal membuka kamera!", toastCart: "masuk ke keranjang!", toastPay: "Pembayaran Berhasil! Transaksi tercatat. 🎉"
    },
    en: {
        heroLabel: "Exclusive Business Suite", welcome: "Welcome,<br><em>Vivi Gioncyn.</em>", heroSub: "AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive: "Live <b>AI</b> Active", statCol: "Collections", statStock: "Stock",
        searchPlaceholder: "Ask AI: 'Evening dress'...", catAll: "All Collections", catClothes: "Apparel", catJewelry: "Luxury Jewelry", catAcc: "Accessories",
        secTitle: "Curated Picks", btnTry: "✨ Try Live", btnAddCart: "+ Add to Cart", btnSaran: "🤖 Ask AI",
        btnAutoDetect: "📷 Auto Detect", aiWelcome: "Hi Vivi! I'm Luxarc AI. Discuss the style you want, or use 'Auto Detect' so I can analyze your facial features and skin tone.", chatInput: "Ask AI...",
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

// --- Toast System ---
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

// --- SPA System ---
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.getElementById('nav-' + pageId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Search & Filter ---
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

// --- AI CHAT LOGIC ---
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
            <div class="chat-product-text">
                <h4>${productName}</h4><p>${desc}</p>
            </div>
        </div>
        <button class="btn btn-ghost" onclick="startSeamlessVTO('${imgId}')">✨ Coba Produk Ini</button>
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
            appendMessage('bot', currentLang === 'id' ? 'Tentu, ini produk yang cocok dengan profilmu.' : 'Sure, here is a product that fits your profile.');
            appendProductCard('Kalung Emas 211', 'Emas murni yang kontras dengan kulit.', 'kalung-emas-211.jpg', 'img-kalung-emas');
        } else {
            appendMessage('bot', currentLang === 'id' ? 'Menarik! Gunakan Deteksi Otomatis untuk hasil akurat.' : 'Interesting! Use Auto Detect for accurate results.');
        }
    }, 800);
}
function askAIAbaoutProduct(productName) {
    switchPage('ai');
    setTimeout(() => {
        appendMessage('user', `AI, tolong berikan saran untuk ${productName}.`);
        setTimeout(() => {
            appendMessage('bot', `Pilihan bagus! ${productName} sangat menawan. Tekan tombol "Deteksi Otomatis" untuk scanning.`);
        }, 1000);
    }, 400);
}

// --- VTO CAMERA ---
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
        youCamService.applyFilter(stream, "PRODUCT_ID_MOCK");
    } catch (err) {
        toast(translations[currentLang].toastCamErr, 'error');
        closeCamera();
    }
}

function closeCamera() {
    if (streamReference) streamReference.getTracks().forEach(track => track.stop());
    document.getElementById('camera-view').style.display = 'none';
    document.getElementById('ai-match-score').style.display = 'none';
}

async function flipCamera() {
    if (streamReference) streamReference.getTracks().forEach(track => track.stop());
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    toast(translations[currentLang].toastCamFlip, "info");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
        document.getElementById('video-stream').srcObject = stream;
        streamReference = stream;
    } catch (err) {
        toast(translations[currentLang].toastCamErr, "error");
    }
}

function startSeamlessVTO(imgId) {
    const img = document.getElementById(imgId);
    if (img) { img.classList.add('fade-out-luxury'); setTimeout(() => img.classList.remove('fade-out-luxury'), 1000); }
    toast("Mempersiapkan AI AR Camera...", "info");
    setTimeout(() => openCamera(false), 800);
}

function triggerAutoDetect() {
    appendMessage('bot', 'Mengaktifkan AI Visual Scanner...');
    setTimeout(() => {
        openCamera(true);
        setTimeout(() => {
            closeCamera();
            appendMessage('bot', 'Analisis Selesai! ✨\n- Warna Kulit: Warm Undertone\n- Bentuk Wajah: Oval.\nEmas murni sangat cocok.');
            setTimeout(() => { appendProductCard('Kalung Emas 211', 'Kalung Emas 24k', 'kalung-emas-211.jpg', 'img-kalung-emas'); }, 1000);
        }, 3500);
    }, 500);
}

// --- Capture & Lookbook ---
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
    document.getElementById('btn-share-wa').onclick = () => { window.open(`https://api.whatsapp.com/send?text=Lihat gayaku!`, '_blank'); };
    openModal('full-img-modal');
}
function closeFullImage() { closeModal('full-img-modal'); currentViewingImageIndex = null; }

// --- Cart & Modals ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; setTimeout(() => document.getElementById(id).classList.add('open'), 10); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); setTimeout(() => { document.getElementById(id).style.display = 'none'; }, 300); }

// FIX NaN: Pastikan price selalu number murni sebelum masuk cart
function addToCart(name, price) {
    const safePrice = (typeof price === 'number' && !isNaN(price))
        ? price
        : parseInt(String(price).replace(/\D/g, ''), 10) || 0;
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

        // FIX NaN: Number() || 0 pastikan tidak NaN
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
        document.getElementById('cart-count').innerText = "0";
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
    // FIX NaN: Amankan kalkulasi revenue
    const revenue = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    document.getElementById('dash-revenue').innerText = `Rp ${formatRupiah(revenue)}`;
    document.getElementById('dash-wishlist-count').innerText = wishlist.length;
    const data = Array.from({ length: 7 }, () => Math.floor(Math.random() * 60) + 30);
    document.getElementById('mini-chart').innerHTML = data.map(v => `<div class="chart-bar" style="height:0%; flex:1; transition: height 0.8s ease-out; background: linear-gradient(to top, #FFD700, #fffae6); border-radius: 4px 4px 0 0;"></div>`).join('');
    openModal('admin-modal');
    setTimeout(() => { document.querySelectorAll('.chart-bar').forEach((bar, i) => { bar.style.height = `${data[i]}%`; }); }, 100);
}

// --- PWA SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW terdaftar:', reg.scope))
            .catch(err => console.log('SW gagal:', err));
    });
}
