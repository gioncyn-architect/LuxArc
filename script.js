// GANTI BAGIAN ATAS DENGAN INI
class YouCamService {
    static async init() {
        try {
            // Memanggil kunci dari brankas Netlify (Sangat Aman)
            const response = await fetch('/.netlify/functions/get-youcam-token');
            const data = await response.json();
            console.log("YouCam API Berhasil Terhubung secara Rahasia");
            return data; 
        } catch (err) {
            console.error("Gagal mengambil kunci AI:", err);
        }
    }
    static applyFilter(stream, productId) {
        console.log(`Applying AR Filter for product: ${productId}`);
    }

// --- State & Variables ---
let cart = [];
let wishlist = [];
let lookbookImages = [];
let currentCamera = 'environment'; 
let streamReference = null;
let currentViewingImageIndex = null;
let currentLang = 'id';
const EXCHANGE_RATE = 15000; // Rp 15.000 = $1 USD

// --- Bilingual Dictionary ---
const translations = {
    id: {
        heroLabel: "Exclusive Business Suite", welcome: "Selamat Datang,<br><em>Vivi Gioncyn.</em>", heroSub: "AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive: "Live <b>AI</b> Active", statCol: "Koleksi", statStock: "Stok",
        searchPlaceholder: "Tanya AI: 'Rok pesta malam'...", catAll: "Semua Koleksi", catClothes: "Pakaian", catJewelry: "Perhiasan Mewah", catAcc: "Aksesoris",
        secTitle: "Koleksi Terpilih", btnTry: "✨ Coba Live", btnAddCart: "+ Keranjang", btnSaran: "🤖 Minta Saran AI",
        btnAutoDetect: "📷 Deteksi Otomatis", aiWelcome: "Halo Vivi! Saya Luxarc AI. Diskusikan gaya yang kamu cari, atau gunakan 'Deteksi Otomatis' agar saya bisa menganalisis wajah dan warna kulitmu.", chatInput: "Tanya AI...",
        navHome: "Beranda", navAI: "AI Advisor", cartTitle: "Keranjang Belanja", cartTotal: "Total Tagihan:", btnPay: "✓ Selesai Bayar",
        toastCamFlip: "🔄 Memutar kamera...", toastCamErr: "Gagal membuka kamera!", toastCart: "masuk ke keranjang!", toastPay: "Pembayaran Berhasil! Transaksi tercatat. 🎉",
        prodCount: "produk", lookbookTitle: "Virtual Lookbook", btnDelete: "🗑 Hapus", dashRev: "Pendapatan Est.", emptyCart: "Keranjang kosong", emptyWishlist: "Kosong",
        micStart: "🎙️ Mendengarkan...", micErr: "Browser tidak mendukung pencarian suara."
    },
    en: {
        heroLabel: "Exclusive Business Suite", welcome: "Welcome,<br><em>Vivi Gioncyn.</em>", heroSub: "AI Style Advisor · Smart Inventory · Business Intelligence",
        statLive: "Live <b>AI</b> Active", statCol: "Collections", statStock: "Stock",
        searchPlaceholder: "Ask AI: 'Evening dress'...", catAll: "All Collections", catClothes: "Apparel", catJewelry: "Luxury Jewelry", catAcc: "Accessories",
        secTitle: "Curated Picks", btnTry: "✨ Try Live", btnAddCart: "+ Add to Cart", btnSaran: "🤖 Ask AI",
        btnAutoDetect: "📷 Auto Detect", aiWelcome: "Hi Vivi! I'm Luxarc AI. Discuss the style you want, or use 'Auto Detect' so I can analyze your facial features and skin tone.", chatInput: "Ask AI...",
        navHome: "Home", navAI: "AI Advisor", cartTitle: "Shopping Cart", cartTotal: "Total Bill:", btnPay: "✓ Complete Payment",
        toastCamFlip: "🔄 Flipping camera...", toastCamErr: "Camera access failed!", toastCart: "added to cart!", toastPay: "Payment Successful! Transaction recorded. 🎉",
        prodCount: "products", lookbookTitle: "Virtual Lookbook", btnDelete: "🗑 Delete", dashRev: "Est. Revenue", emptyCart: "Cart is empty", emptyWishlist: "Empty",
        micStart: "🎙️ Listening...", micErr: "Browser doesn't support voice search."
    }
};

function formatCurrency(idrAmount) {
    // Baris ini sangat penting agar tidak muncul NaN lagi
    const amount = Number(idrAmount) || 0; 

    if (currentLang === 'en') {
        const usdAmount = (amount / EXCHANGE_RATE).toFixed(2);
        return '$ ' + usdAmount;
    } else {
        return 'Rp ' + new Intl.NumberFormat('id-ID').format(amount);
    }
}


function updatePricesOnScreen() {
    document.querySelectorAll('.product-price').forEach(el => {
        const basePrice = parseInt(el.getAttribute('data-price'));
        el.innerText = formatCurrency(basePrice);
    });
}

function toggleLanguage() {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    document.getElementById('btn-lang').innerText = currentLang.toUpperCase();
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if(translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if(translations[currentLang][key]) el.placeholder = translations[currentLang][key];
    });
    
    updatePricesOnScreen();
    // Update product count translation
    const currentCount = document.getElementById('products').querySelectorAll('.product-card[style*="display: block"], .product-card:not([style])').length;
    document.getElementById('product-count').innerText = `${currentCount} ${translations[currentLang].prodCount}`;
}

// --- Toast System ---
function toast(msg, type = 'info') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast`;
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
        if(card.innerText.toLowerCase().includes(term) || card.dataset.name.includes(term)) {
            card.style.display = 'block'; setTimeout(() => card.style.opacity = '1', 50); count++;
        } else {
            card.style.opacity = '0'; setTimeout(() => card.style.display = 'none', 400);
        }
    });
    document.getElementById('product-count').innerText = `${count} ${translations[currentLang].prodCount}`;
});

// FIX: Implement Web Speech API untuk Pencarian Suara
function mockupVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        toast(translations[currentLang].micErr, "error");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'id' ? 'id-ID' : 'en-US';
    recognition.onstart = () => toast(translations[currentLang].micStart, "info");
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const searchInput = document.getElementById('search-input');
        searchInput.value = transcript;
        // Trigger pencarian
        searchInput.dispatchEvent(new Event('input'));
    };
    recognition.start();
}

// FIX: Hubungkan kamera pencarian dengan sistem Auto-Detect
function mockupVisualSearch() { 
    toast('📷 AI Visual Scanner...', 'info'); 
    setTimeout(() => { openCamera(true); }, 500);
}

function filterProducts(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const products = document.querySelectorAll('.product-card');
    let count = 0;
    products.forEach(card => {
        if(category === 'semua' || card.dataset.category === category) {
            card.style.display = 'block'; setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 50); count++;
        } else {
            card.style.opacity = '0'; card.style.transform = 'scale(0.95)'; setTimeout(() => card.style.display = 'none', 400);
        }
    });
    document.getElementById('product-count').innerText = `${count} ${translations[currentLang].prodCount}`;
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
    if(!text) return;
    appendMessage('user', text);
    input.value = '';
    setTimeout(() => {
        const lower = text.toLowerCase();
        if(lower.includes('mana') || lower.includes('rekomendasi') || lower.includes('where') || lower.includes('recommend')) {
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
        appendMessage('user', currentLang === 'id' ? `AI, tolong berikan saran untuk ${productName}.` : `AI, please advise me on ${productName}.`);
        setTimeout(() => {
            appendMessage('bot', currentLang === 'id' ? `Pilihan bagus! ${productName} sangat menawan. Tekan tombol "Deteksi Otomatis" untuk scanning.` : `Great choice! ${productName} is stunning. Press "Auto Detect" for scanning.`);
        }, 1000);
    }, 400);
}

// --- VTO CAMERA LENGKAP ---
async function openCamera(isAutoDetect = false) {
  document.getElementById('camera-view').style.display = 'flex';
  const video = document.getElementById('video-stream');
  const badge = document.getElementById('ai-match-score');
  const uiControls = document.getElementById('cam-ui-controls');
  
  if(isAutoDetect) {
      uiControls.style.display = 'none';
      badge.style.display = 'flex';
      badge.innerText = currentLang === 'id' ? '🔍 Memindai Biometrik...' : '🔍 Scanning Biometrics...';
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
    YouCamService.applyFilter(stream, "PRODUCT_ID_MOCK"); 
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

// FIX: Pembersihan memori sempurna sebelum switch kamera
async function flipCamera() {
    if (streamReference) {
        streamReference.getTracks().forEach(track => {
            track.stop();
        });
        document.getElementById('video-stream').srcObject = null;
    }
    
    // Toggle kamera: jika belakang ganti depan, sebaliknya.
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    toast(translations[currentLang].toastCamFlip, "info");
    
    // Beri jeda sedikit agar perangkat keras melepaskan kunci kamera
    setTimeout(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
            document.getElementById('video-stream').srcObject = stream;
            streamReference = stream;
        } catch(err) {
            toast(translations[currentLang].toastCamErr, "error");
        }
    }, 200);
}

function startSeamlessVTO(imgId) {
    const img = document.getElementById(imgId);
    if(img) { img.classList.add('fade-out-luxury'); setTimeout(() => img.classList.remove('fade-out-luxury'), 1000); }
    toast("Mempersiapkan AI AR Camera...", "info");
    setTimeout(() => openCamera(false), 800);
}

function triggerAutoDetect() {
    appendMessage('bot', currentLang === 'id' ? 'Mengaktifkan AI Visual Scanner...' : 'Activating AI Visual Scanner...');
    setTimeout(() => {
        openCamera(true);
        setTimeout(() => {
            closeCamera();
            const msg = currentLang === 'id' 
                ? 'Analisis Selesai! ✨\n- Warna Kulit: Warm Undertone\n- Bentuk Wajah: Oval.\nEmas murni sangat cocok.'
                : 'Analysis Complete! ✨\n- Skin Tone: Warm Undertone\n- Face Shape: Oval.\nPure gold suits you best.';
            appendMessage('bot', msg);
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
  gallery.innerHTML = lookbookImages.length === 0 ? `<p style="grid-column:1/-1; text-align:center; color:#888;">${currentLang==='id'?'Belum ada foto.':'No photos yet.'}</p>` 
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

function addToCart(name, price) {
  cart.push({ name, price });
  document.getElementById('cart-count').innerText = cart.length;
  toast(`${name} ${translations[currentLang].toastCart}`, 'success');
}

function openCheckout() {
    const div = document.getElementById('cart-items');
    const totalSection = document.getElementById('cart-total-section');
    if (cart.length === 0) {
        div.innerHTML = `<p style="text-align:center; padding:20px; color:#888;">${translations[currentLang].emptyCart}</p>`;
        totalSection.style.display = 'none';
    } else {
        div.innerHTML = cart.map((i, idx) => `
          <div style="padding:10px 0; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
            <span>${i.name}</span> 
            <div><span style="color:#FFD700; margin-right:15px;">${formatCurrency(i.price)}</span>
            <button onclick="removeFromCart(${idx})" style="background:none; border:none; color:#ff4444; font-size:1.2em;">🗑</button></div>
          </div>`).join('');
          
        const total = cart.reduce((a,b)=>a+b.price,0);
        document.getElementById('total-price').innerText = formatCurrency(total);
        document.getElementById('va-number').innerText = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
        totalSection.style.display = 'block';
    }
    openModal('checkout-modal');
}
function removeFromCart(i) { cart.splice(i, 1); document.getElementById('cart-count').innerText = cart.length; openCheckout(); }
function processPayment() { 
    toast(currentLang === 'id' ? 'Memverifikasi...' : 'Verifying...', 'info'); 
    setTimeout(() => { toast(translations[currentLang].toastPay, 'success'); cart = []; document.getElementById('cart-count').innerText = "0"; closeModal('checkout-modal'); }, 1500); 
}
function toggleWishlist(btn, name) {
  const idx = wishlist.indexOf(name);
  if (idx === -1) { wishlist.push(name); btn.innerText = '❤️'; } else { wishlist.splice(idx, 1); btn.innerText = '🤍'; }
}
function openWishlist() {
    document.getElementById('wishlist-items').innerHTML = wishlist.length === 0 ? `<p style="text-align:center; color:#888;">${translations[currentLang].emptyWishlist}</p>` : wishlist.map(n => `<div style="padding:10px 0; border-bottom:1px solid #333;">${n}</div>`).join('');
    openModal('wishlist-modal');
}
function openAdmin() { 
    const total = cart.reduce((s, i) => s + i.price, 0);
    document.getElementById('dash-revenue').innerText = formatCurrency(total); 
    document.getElementById('dash-wishlist-count').innerText = wishlist.length;
    const data = Array.from({length: 7}, () => Math.floor(Math.random() * 60) + 30);
    document.getElementById('mini-chart').innerHTML = data.map(v => `<div class="chart-bar" style="height:0%; flex:1; transition: height 0.8s ease-out; background: linear-gradient(to top, #FFD700, #fffae6); border-radius: 4px 4px 0 0;"></div>`).join('');
    openModal('admin-modal');
    setTimeout(() => { document.querySelectorAll('.chart-bar').forEach((bar, i) => { bar.style.height = `${data[i]}%`; }); }, 100);
}

// Init harga saat pertama kali dimuat
updatePricesOnScreen();

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker terdaftar di scope:', reg.scope))
      .catch((err) => console.log('Service Worker gagal didaftarkan:', err));
  });
}
