// ============================================================
// LuxArc AI — script.js CLEAN v13
// Terhubung ke: /api/youcam (Vercel Tanpa Server)
// Fitur: Pakaian AI, Warna Rambut, Riasan, Analisis Kulit,
// Gaya Rambut, Aksesori, Pencerah Foto, Topi, Anting
// BERSIH v13:
// [1] Hapus 3x duplikat override window.openCheckout → 1 fungsi bersih
// [2] Hapus injectBudgetFilterUI() — CSS sudah ada di style.css
// [3] Hapus injectShareDiscountUI() — konflik dengan navigasi HTML
// [4] Hapus toggleLanguage() — tidak dipanggil dari mana pun
// [5] Hapus mockupVoiceSearch() & mockupVisualSearch() — tidak dipakai
// [6] Hapus referensi openCheckout_original — tidak pernah didefinisikan
// [7] Hapus _origOpenCheckoutHTML — override rusak sebelum fungsi ada
// [8] Perbaiki syncCartBadge() — lencana disembunyikan saat hitungan 0 saat dimuat
// ============================================================

const IMGBB_API_KEY = 'f38d35d294b0887931317043aa4ce731';

// ── Format Rupiah ────────────────────────────────────────────
fungsi formatRupiah(angka) {
    const num = typeof number === 'string' ? parseInt(number.replace(/\D/g, ''), 10) : Number(number);
    jika (isNaN(num)) kembalikan '0';
    kembalikan new Intl.NumberFormat('id-ID').format(num);
}

// ── Ubah ukuran gambar sebelum diunggah (maks 1800px) ─────────────────
fungsi resizeImage(base64, maxSize = 1800) {
    kembalikan Promise baru ((resolve) => {
        const img = new Image();
        img.onload = () => {
            misalkan { lebar, tinggi } = img;
            jika (lebar <= ukuran maksimum && tinggi <= ukuran maksimum) {
                menyelesaikan (base64);
                kembali;
            }
            konstanta rasio = Math.min(ukuran maksimum / lebar, ukuran maksimum / tinggi);
            lebar = Math.round(lebar * rasio);
            tinggi = Math.round(tinggi * rasio);
            const canvas = document.createElement('canvas');
            kanvas.lebar = lebar;
            kanvas.tinggi = tinggi;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.src = base64;
    });
}

// ── Unggah foto ke ImgBB — ubah ukurannya dulu ────────────────────────
fungsi asinkron uploadToImgBB(base64) {
    const resized = await resizeImage(base64, 1800);
    const formData = FormData baru();
    formData.append('image', resized.split(',')[1]);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        metode: 'POST', isi: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error('Gagal upload foto: ' + JSON.stringify(data));
    kembalikan data.data.url;
}

// ── Unggah gambar dari URL lokal / eksternal ke ImgBB ────────
fungsi asinkron uploadUrlToImgBB(url) {
    const absoluteUrl = url.startsWith('http')
        URL
        : window.location.origin + '/' + url.replace(/^\//, '');

    const fetchRes = await fetch(absoluteUrl);
    if (!fetchRes.ok) throw new Error(`Gagal mengambil gambar produk: ${absoluteUrl}`);
    const blob = await fetchRes.blob();

    kembalikan Promise baru ((resolve, reject) => {
        const reader = new FileReader();
        pembaca.onload = async (e) => {
            mencoba {
                const publicUrl = await uploadToImgBB(e.target.result);
                menyelesaikan(publicUrl);
            } tangkap (kesalahan) {
                tolak(kesalahan);
            }
        };
        pembaca.onerror = tolak;
        pembaca.readAsDataURL(blob);
    });
}

// ── Ubah file ke base64 ──────────────────────────────────────
fungsi fileToBase64(file) {
    kembalikan Promise baru ((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        pembaca.onerror = tolak;
        pembaca.bacaSebagaiURLData(file);
    });
}

// ── Ekstrak URL hasil dari respon YouCam ────────────────────
fungsi getOutputUrl(data) {
    kembalikan data?.result_url
        || data?.data?.hasil?.url
        || data?.data?.hasil?.[0]?.url
        || data?.data?.result_url
        || data?.data?.output_url
        || data?.data?.dst_file_url
        || data?.data?.image_url
        || null;
}

// ═════════════════════════════════════════════════════════
// ── PEMBANTU UI ───────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════

fungsi showAIModal(judul, html) {
    let modal = document.getElementById('youcam-modal');
    jika (!modal) {
        modal = document.createElement('div');
        modal.id = 'youcam-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-sheet glass-panel" style="max-height:90vh;overflow-y:auto;">
                <button class="modal-close" onclick="closeModal('youcam-modal')">✕</button>
                <p class="modal-title" id="youcam-modal-title"></p>
                <div id="youcam-modal-body"></div>
            </div>`;
        dokumen.badan.tambahkanAnak(modal);
    }
    document.getElementById('youcam-modal-title').innerText = title;
    document.getElementById('youcam-modal-body').innerHTML = html;
    openModal('youcam-modal');
}

fungsi uploadPhotoHTML(inputId, imgId, previewId, btnLabel, btnOnclick) {
    kembali `
        <div id="${previewId}" style="display:none;margin-bottom:12px;">
            <img id="${imgId}" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover;">
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">

            <!-- Tombol Buka Kamera -->
            <button onclick="openCameraForAI('${inputId}','${imgId}','${previewId}')"
                style="width:100%;padding:12px;border-radius:12px;
                batas:1,5px putus-putus #FFD700; latar belakang:transparan;
                warna:#FFD700;ukuran-font:0.88em;keluarga-font:warisi;
                kursor:penunjuk;tampilan:fleksibel;sejajarkan item:tengah;ratakan konten:tengah;celah:8px;">
                📸 Buka Kamera
            </button>

            <!-- Tombol Pilih dari Galeri -->
            <label style="width:100%;padding:12px;border-radius:12px;
                batas:1.5px garis putus-putus rgba(255,255,255,0.2);latar belakang:transparan;
                warna:#fff;ukuran-font:0.88em;keluarga-font:warisi;
                kursor:penunjuk;tampilan:fleksibel;sejajarkan item:tengah;ratakan konten:tengah;celah:8px;">
                🖼️ Pilih dari Galeri
                <input type="file" accept="image/*" id="${inputId}"
                    gaya="tampilan:tidak ada;"
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
fungsi showAIResult(containerId, outputUrl, filename) {
    const container = document.getElementById(containerId);
    kontainer.innerHTML = `
        <p style="color:#FFD700;margin-bottom:10px;">✅ Hasil AI:</p>
        <img src="${outputUrl}" style="width:100%;border-radius:12px;margin-bottom:15px;object-fit:contain;max-height:400px;background:#111;">
        <div style="display:flex;gap:10px;">
            <a href="${outputUrl}" download="${filename}.jpg" class="btn btn-gold shimmer-btn" style="flex:1;text-align:center;text-decoration:none;">⬇️ Unduh</a>
            <tombol class="btn btn-ghost" style="flex:1;" onclick="window.open('https://api.whatsapp.com/send?text=Lihat hasilku dari LuxArc AI! ${encodeURIComponent(outputUrl)}','_blank')">📲 Bagikan WA</button>
        </div>`;
    lookbookImages.push(outputUrl);
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    const inputIds = [
        'input-foto-pengguna', 'input-foto-rias-wajah', 'input-foto-warna-rambut',
        'input-foto-kulit', 'input-foto-akurasi', 'input-foto-peningkatan',
        'autodetect-photo-input','hat-photo-input','earring-photo-input'
    ];
    biarkan beforeUrl = null;
    untuk (konstanta id dari inputIds) {
        const imgEl = document.getElementById(id.replace('-input', '-img'));
        Jika (imgEl && imgEl.src && !imgEl.src.endsWith('/')) { beforeUrl = imgEl.src; break; }
    }
    jika (sebelumUrl) {
        beforeAfterPairs.push({ before: beforeUrl, after: outputUrl, label: filename || 'Hasil AI' });
    }
}
// Fungsi kamera khusus untuk modal AI
fungsi openCameraForAI(inputId, imgId, previewId) {
    const input = document.getElementById(inputId);
    jika (!input) kembalikan;

    // Buat input file sementara dengan capture=camera
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.capture = 'lingkungan';
    tempInput.onchange = function() {
        jika (this.files && this.files[0]) {
            // memindahkan file ke input asli
            const dt = new DataTransfer();
            dt.items.add(this.files[0]);
            input.files = dt.files;
            // Pratinjau
            const reader = new FileReader();
            pembaca.muat = e => {
                document.getElementById(imgId).src = e.target.result;
                document.getElementById(previewId).style.display = 'block';
            };
            pembaca.readAsDataURL(this.files[0]);
        }
    };
    tempInput.click();
}

fungsi previewPhoto(input, imgId, previewId) {
    jika (input.files && input.files[0]) {
        const reader = new FileReader();
        pembaca.muat = e => {
            document.getElementById(imgId).src = e.target.result;
            document.getElementById(previewId).style.display = 'block';
        };
        pembaca.readAsDataURL(input.files[0]);
    }
}

fungsi uploadPhotoHTML(inputId, imgId, previewId, btnLabel, btnOnclick) {
    kembali `
        <div id="${previewId}" style="display:none;margin-bottom:12px;">
            <img id="${imgId}" style="width:100%;border-radius:12px;max-height:350px;object-fit:contain;background:#111;">
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            <button onclick="openCameraForAI('${inputId}','${imgId}','${previewId}')"
                style="width:100%;padding:12px;border-radius:12px;
                batas:1,5px putus-putus #FFD700; latar belakang:transparan;
                warna:#FFD700;ukuran-font:0.88em;keluarga-font:warisi;
                kursor:penunjuk;tampilan:fleksibel;sejajarkan item:tengah;ratakan konten:tengah;celah:8px;">
                📸 Buka Kamera
            </button>
            <label style="width:100%;padding:12px;border-radius:12px;
                batas:1.5px garis putus-putus rgba(255,255,255,0.2);latar belakang:transparan;
                warna:#fff;ukuran-font:0.88em;keluarga-font:warisi;
                kursor:penunjuk;tampilan:fleksibel;sejajarkan item:tengah;ratakan konten:tengah;celah:8px;">
                🖼️ Pilih dari Galeri
                <input type="file" accept="image/*" id="${inputId}"
                    gaya="tampilan:tidak ada;"
                    onchange="previewPhoto(this,'${imgId}','${previewId}')">
            </label>
        </div>

        <button class="btn btn-gold shimmer-btn"
            style="width:100%;padding:12px;" onclick="${btnOnclick}">
            ${btnLabel}
        </button>

        <div id="ai-result-area" style="margin-top:20px;"></div>`;
}

fungsi showAILoading(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
        <div style="text-align:center;padding:20px;color:#FFD700;">
            ⏳ ${msg><br><small style="color:#888;">Mohon tunggu 15–30 detik...</small>
        </div>`;
}

fungsi showAIError(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
        <p style="color:#ff4444;padding:10px;background:rgba(255,68,68,0.1);border-radius:10px;">❌ ${msg}</p>`;
}

// ═════════════════════════════════════════════════════════
// ── 1. AI CLOTHES — Coba Pakai Pakaian Secara Virtual ──────────────────
// ═════════════════════════════════════════════════════════
fungsi startSeamlessVTO(imgId) {
    const imgEl = document.getElementById(imgId);
    const src = imgEl ? imgEl.src : '';
    const name = imgEl ? imgEl.alt : 'Produk';
    openAIClothes(src, name);
}

fungsi openAIClothes(productImgSrc, productName) {
    showAIModal(`✨ Pakaian AI — ${productName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto Anda (tampak depan), AI akan memakai <b>${productName</b>!</p>
        ${uploadPhotoHTML('user-photo-input','user-photo-img','user-photo-preview',
            '🤖 Coba Sekarang dengan AI',
            `runAIClothes('${productImgSrc}','${productName}')`
        )}`);
}

fungsi asinkron runAIClothes(productImgSrc, productName) {
    const userInput = document.getElementById('user-photo-input');
    if (!userInput?.files[0]) { toast('Upload foto dirimu dulu!', 'error'); kembali; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang memproses pakaian...');
        const clothUrl = productImgSrc.startsWith('http')
            ? productImgSrc
            : window.location.origin + '/' + productImgSrc.replace(/^\//, '');
        const res = await fetch('/api/youcam?action=ai-clothes', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({ user_image_url: userImageUrl, cloth_image_url: clothUrl }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-clothes');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 2. AKSESORI AI — Kalung & Topi ───────────────────────────
// ═════════════════════════════════════════════════════════
fungsi openAIAccessory(accessoryImgSrc, accessoryName, accessoryType = 'necklace') {
    showAIModal(`💎 Aksesori AI — ${accessoryName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto Anda, AI akan memakaikan <b>${accessoryName</b>!</p>
        ${uploadPhotoHTML('acc-photo-input','acc-photo-img','acc-photo-preview',
            '🤖 Coba Aksesoris dengan AI',
            `runAIAccessory('${accessoryImgSrc}','${accessoryName}','${accessoryType}')`
        )}`);
}

fungsi asinkron runAIAccessory(accessoryImgSrc, accessoryName, accessoryType) {
    const userInput = document.getElementById('acc-photo-input');
    if (!userInput?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang memakai ${accessoryName}...`);
        const accUrl = accessoryImgSrc.startsWith('http')
            ? accessoryImgSrc
            : window.location.origin + '/' + accessoryImgSrc.replace(/^\//, '');

        const res = await fetch('/api/youcam?action=ai-necklace', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({
                URL_gambar_pengguna: URL_gambar_pengguna,
                URL gambar kalung: accUrl,
            }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-accessory');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 3. WARNA RAMBUT AI — Kucing Rambut ─────────────────────────────
// ═════════════════════════════════════════════════════════
const PETA WARNA RAMBUT = {
    'hitam': '#1C1C1C',
    'coklat': '#6B3A2A',
    'merah': '#B22222',
    'oranye': '#FF6600',
    'kuning': '#FFD700',
    'hijau': '#2E8B57',
    'biru': '#1565C0',
    'ungu': '#7B2D8B',
    'merah muda': '#FF69B4',
    'abu': '#9E9E9E',
    'perak': '#C0C0C0',
    'pirang': '#F5DEB3',
    'platinum': '#E8E8D0',
    'merah anggur': '#800020',
    'lavender': '#B57EDC',
    'biru kehijauan': '#008080',
    'tembaga': '#B87333',
    'emas mawar': '#B76E79',
};

fungsi openHairColorYoucam(colorName, colorHex) {
    showAIModal(`🎨 Pewarna Rambut AI — ${colorName}`, `
        <div style="display:flex;align-items:center;gap:10px;background:#1a1a1a;border-radius:10px;padding:12px;margin-bottom:15px;">
            <span style="width:28px;height:28px;border-radius:50%;background:${colorHex};border:2px solid rgba(255,255,255,0.2);flex-shrink:0;display:inline-block;"></span>
            <b style="color:#FFD700;font-size:1.05em;">${colorName}</b>
        </div>
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto wajahmu, AI akan mengubah warna rambutmu menjadi <b>${colorName</b>!</p>
        ${uploadPhotoHTML(
            'masukan foto warna rambut', 'gambar foto warna rambut', 'pratinjau foto warna rambut',
            `💇 Coba Warna ${colorName} dengan AI`,
            `runAIHairColor('${colorName}','${colorHex}')`
        )}`);
}

fungsi asinkron runAIHairColor(colorName, colorHex) {
    const userInput = document.getElementById('hair-color-photo-input');
    if (!userInput?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang mengubah warna rambut menjadi ${colorName}...`);

        const key = colorName.toLowerCase();
        const finalHex = (colorHex && colorHex.startsWith('#'))
            ? warnaHex
            : (HAIR_COLOR_MAP[key] || '#7B2D8B');

        const payload = {
            URL_gambar_pengguna: URL_gambar_pengguna,
            nama_warna: nama_warna,
            warna: finalHex,
            palet: [{
                warna: finalHex,
                Intensitas warna: 80,
            }],
        };

        const res = await fetch('/api/youcam?action=ai-hair-color', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify(payload),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) showAIResult('ai-result-area', outputUrl, `luxarc-hair-${colorName.toLowerCase()}`);
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 4. AI MAKEUP — Blush, Lipstik & Eyeshadow ───────────────
// ═════════════════════════════════════════════════════════
const MAKEUP_CATEGORY_CONFIG = {
    pipi merona: {
        kategori: 'merah pipi',
        pola: { nama: '1warna1' },
        defaultColor: '#E8A0A0',
    },
    warna_bibir: {
        kategori: 'warna_bibir',
        bentuk: { nama: 'asli' },
        gaya: { tipe: 'penuh' },
        defaultColor: '#CC3355',
    },
    eyeshadow: {
        kategori: 'eyeshadow',
        pola: { nama: '1warna1' },
        defaultColor: '#4B0082',
    },
    eyeliner: {
        kategori: 'eyeliner',
        pola: { nama: 'Arabic3' },
        defaultColor: '#000000',
    },
};

fungsi detectMakeupColor(makeupName, defaultColor) {
    const n = makeupName.toLowerCase();
    Jika n.includes('rose')) kembalikan '#E8A0A0';
    Jika n menyertakan 'pink', kembalikan '#FF69B4';
    Jika n menyertakan 'peach', kembalikan '#FFCBA4';
    Jika n menyertakan 'coral', kembalikan '#FF7F7F';
    Jika n.includes('mauve')) kembalikan '#D8A0C0';
    Jika n.includes('bronze')) kembalikan '#8B6914';
    Jika n.includes('gold')) kembalikan '#CFB53B';
    Jika n.includes('coklat') || n.includes('brown')) kembalikan '#8B4513';
    Jika n.includes('merah') || n.includes('red')), kembalikan '#CC0000';
    Jika n.includes('nude') || n.includes('natural')), kembalikan '#C8956C';
    Jika n.includes('ungu') || n.includes('purple')) kembalikan '#7B2D8B';
    Jika n.includes('biru') || n.includes('biru')) kembalikan '#1565C0';
    Jika n.includes('hitam') || n.includes('hitam')), kembalikan '#1a1a1a';
    kembalikan warna default;
}

fungsi tryMakeupYoucam(makeupImgSrc, zone, makeupName, customColor = null) {
    misalkan kategori = zona;
    jika (zona === 'bibir' || zona === 'bibir') kategori = 'warna_bibir';
    Jika (zona === 'mata' || zona === 'mata') kategori = 'eye_shadow';
    jika (zona === 'liner') kategori = 'eyeliner';

    const config = MAKEUP_CATEGORY_CONFIG[category] || MAKEUP_CATEGORY_CONFIG['blush'];
    const color = customColor || detectMakeupColor(makeupName, config.defaultColor);

    showAIModal(`💄 AI Makeup — ${makeupName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto wajahmu, AI akan menerapkan <b>${makeupName}</b>!</p>
        ${uploadPhotoHTML('input-foto-makeup','gambar-foto-makeup','pratinjau-foto-makeup',
            `💄 Coba Makeup dengan AI`,
            `runAIMakeup('${category}','${color}','${makeupName}')`
        )}`);
}

fungsi asinkron runAIMakeup(kategori, warna, nama makeup) {
    const userInput = document.getElementById('makeup-photo-input');
    if (!userInput?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang menerapkan ${makeupName}...`);

        const config = MAKEUP_CATEGORY_CONFIG[category] || MAKEUP_CATEGORY_CONFIG['blush'];

        let effectObject = { category };

        jika (kategori === 'blush') {
            effectObject = {
                kategori: 'merah pipi',
                pola: config.pattern,
                palet: [{ warna, tekstur: 'matte', intensitas warna: 65 }],
            };
        } jika tidak (kategori === 'warna_bibir') {
            effectObject = {
                kategori: 'warna_bibir',
                bentuk: config.shape,
                gaya: config.style,
                palet: [{ warna, tekstur: 'matte', intensitas warna: 80 }],
            };
        } jika tidak (kategori === 'eye_shadow') {
            effectObject = {
                kategori: 'eyeshadow',
                pola: config.pattern,
                palet: [{ warna, tekstur: 'matte', intensitas warna: 60 }],
            };
        } else if (category === 'eyeliner') {
            effectObject = {
                kategori: 'eyeliner',
                pola: config.pattern,
                palet: [{ warna, tekstur: 'matte', intensitas warna: 90 }],
            };
        }

        const res = await fetch('/api/youcam?action=ai-makeup', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({
                URL_gambar_pengguna: URL_gambar_pengguna,
                kategori,
                warna,
                nama_makeup: nama_makeup,
                efek: effectObject,
            }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-makeup');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 5. ANALISIS KULIT ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════
fungsi analyzeSkincareYoucam(productId, productName) {
    showAIModal(`✨ Analisis Kulit — ${productName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto wajahmu, AI akan menganalisis kulitmu dan merekomendasikan <b>${productName</b>!</p>
        ${uploadPhotoHTML('skin-photo-input','skin-photo-img','skin-photo-preview',
            '🔬 Analisis Kulitku',
            `runSkinAnalysis('${productName}')`
        )}`);
}

fungsi asinkron runSkinAnalysis(productName) {
    const userInput = document.getElementById('skin-photo-input');
    if (!userInput?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang menganalisis kulitmu...');
        const res = await fetch('/api/youcam?action=skin-analysis', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));

        const scores = data?.data?.results || data?.data?.data?.results || {};
        const label = {
            jerawat: '🔴 Jerawat', kelembapan: '💧 Kelembapan',
            pori-pori: '⭕ Pori-pori', kerutan: '〰️ Kerutan',
            radiance: '✨ Kecerahan', skin_tone: '🎨 Warna Kulit'
        };

        biarkan resultHTML = `<p style="color:#FFD700;margin-bottom:12px;">✅ Hasil Analisis Kulit:</p>
            <div style="background:#1a1a1a;border-radius:12px;padding:15px;margin-bottom:15px;">`;

        biarkan hasScore = false;
        untuk (konstanta [kunci, label] dari Object.entries(label)) {
            const score = scores[key]?.score ?? scores[key] ?? null;
            jika (skor !== null) {
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
        jika (!hasScore) {
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

jika (skor jerawat < 60) {
    Produk yang direkomendasikan.push(
        { nama: 'Skincare Jerawat', harga: 'Rp 195.000', alasan: 'Cocok untuk kulit berjerawat' },
        { nama: 'Serum Niacinamide', harga: 'Rp 165.000', alasan: 'Mengontrol pori-pori & jerawat' },
        { nama: 'Clay Mask', harga: 'Rp 95.000', alasan: 'Membersihkan pori-pori secara mendalam' }
    );
} jika tidak (skor kelembaban < 60) {
    Produk yang direkomendasikan.push(
        { nama: 'Moisturizer Gel', harga: 'Rp 175.000', alasan: 'Melembabkan kulit kering' },
        { nama: 'Toner AHA BHA', harga: 'Rp 145.000', alasan: 'Eksfoliasi & hidrasi kulit' }
    );
} jika tidak (radianceScore < 60) {
    Produk yang direkomendasikan.push(
        { nama: 'Skincare Pemutih', harga: 'Rp 215.000', alasan: 'Mencerahkan & glowing' },
        { nama: 'Tabir surya SPF 50', harga: 'Rp 125.000', alasan: 'Proteksi UV harian' }
    );
} kalau tidak {
    Produk yang direkomendasikan.push(
        { name: 'Sunscreen SPF 50', harga: 'Rp 125.000', alasan: 'Proteksi UV setiap hari' },
        { nama: 'Moisturizer Gel', harga: 'Rp 175.000', alasan: 'Menjaga kelembapan kulit' }
    );
}

jika (recommendedProducts.length > 0) {
    const recTitle = document.createElement('p');
    recTitle.style.cssText = 'color:#FFD700;font-weight:600;margin:16px 0 8px;';
    recTitle.textContent = '🎯 Produk Rekomendasi untuk Kulitmu:';
    document.getElementById('ai-result-area').appendChild(recTitle);
    renderAIProductCards(recommendedProducts);
}
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 6. GAYA RAMBUT AI ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════
fungsi openAIHairstyle() {
    showAIModal('💇 AI Hairstyle Generator', `
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto wajahmu, AI akan mengubah gaya rambutmu!</p>
        <label style="display:block;background:#1a1a1a;border:1.5px dashed #FFD700;border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
            📷 Pilih Foto Wajahmu
            <input type="file" accept="image/*" id="hair-photo-input" style="display:none;" onchange="previewPhoto(this,'hair-photo-img','hair-photo-preview')">
        </label>
        <div id="hair-photo-preview" style="display:none;margin-bottom:15px;">
            <img id="hair-photo-img" style="width:100%;border-radius:12px;max-height:160px;object-fit:cover;">
        </div>
        <p style="color:#aaa;margin-bottom:8px;font-size:0.88em;">Pilih Gaya:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px;">
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'natural')" style="font-size:0.82em;border-color:#FFD700;">🌿 Alami</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'curly')" style="font-size:0.82em;">🌀 Keriting</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'straight')" style="font-size:0.82em;">📏 Lurus</button>
            <button class="btn btn-ghost hair-style-btn" onclick="selectHairStyle(this,'wavy')" style="font-size:0.82em;">〰️ Bergelombang</button>
        </div>
        <input type="hidden" id="selected-hair-style" value="natural">
        <button class="btn btn-gold shimmer-btn" style="width:100%;" onclick="runAIHairstyle()">🤖 Hasilkan Gaya Rambut</button>
        <div id="ai-result-area" style="margin-top:20px;"></div>`);
}

fungsi pilihGayaRambut(tombol, gaya) {
    document.querySelectorAll('.hair-style-btn').forEach(b => b.style.borderColor = '');
    btn.style.borderColor = '#FFD700';
    document.getElementById('selected-hair-style').value = style;
}

fungsi asinkron runAIHairstyle() {
    const input = document.getElementById('hair-photo-input');
    const style = document.getElementById('selected-hair-style')?.value || 'natural';
    if (!input?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang mengubah gaya rambut...');
        const res = await fetch('/api/youcam?action=ai-hairstyle', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({ user_image_url: userImageUrl, style }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-hairstyle');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 7. PENINGKAT FOTO ────────────────────────────────────────
// ═════════════════════════════════════════════════════════
fungsi openPhotoEnhancer() {
    showAIModal('🌟 Peningkat Foto AI', `
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto, AI akan mempercantik & meningkatkan kualitasnya!</p>
        ${uploadPhotoHTML('enhance-photo-input','enhance-photo-img','enhance-photo-preview',
            '✨ Tingkatkan dengan AI',
            'runPhotoEnhancer()'
        )}`);
}

fungsi asinkron runPhotoEnhancer() {
    const input = document.getElementById('enhance-photo-input');
    if (!input?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang memperindah foto...');
        const res = await fetch('/api/youcam?action=photo-enhance', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({ user_image_url: userImageUrl }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-enhanced');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 8. AI HAT — Topi Coba Pakai Virtual ─────────────────────────
// ═════════════════════════════════════════════════════════
fungsi openAIHat(hatImgSrc, hatName) {
    showAIModal(`🎩 Topi AI — ${hatName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Upload foto dirimu, AI akan memakai <b>${hatName</b> ke kepalamu!</p>
        ${uploadPhotoHTML('input-foto-topi','gambar-foto-topi','pratinjau-foto-topi',
            '🎩 Coba Topi dengan AI',
            `runAIHat('${hatImgSrc}','${hatName}')`
        )}`);
}

fungsi asinkron runAIHat(hatImgSrc, hatName) {
    const userInput = document.getElementById('hat-photo-input');
    if (!userInput?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `AI sedang memakai ${hatName}...`);
        const hatUrl = hatImgSrc.startsWith('http')
            ? hatImgSrc
            : window.location.origin + '/' + hatImgSrc.replace(/^\//, '');
        const res = await fetch('/api/youcam?action=ai-hat', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({
                URL_gambar_pengguna: URL_gambar_pengguna,
                URL gambar topi: URL topi,
                jenis kelamin: 'perempuan',
            }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-hat');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── 9. AI EARRING — Coba Pakai Anting Secara Virtual ───────────────────
// ═════════════════════════════════════════════════════════
fungsi openAIEarring(earringImgSrc, earringName) {
    showAIModal(`💎 Anting AI — ${earringName}`, `
        <p style="color:#aaa;margin-bottom:15px;">Unggah foto diri Anda (tampak depan), AI akan memakaikan <b>${earringName</b>!</p>
        ${uploadPhotoHTML('input-foto-anting','gambar-foto-anting','pratinjau-foto-anting',
            '💎 Coba Anting dengan AI',
            `runAIEarring('${earringImgSrc}','${earringName}')`
        )}`);
}

fungsi asinkron runAIEarring(earringImgSrc, earringName) {
    const userInput = document.getElementById('earring-photo-input');
    if (!userInput?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(userInput.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', `Mengupload gambar anting...`);
        const earringPublicUrl = await uploadUrlToImgBB(earringImgSrc);
        showAILoading('ai-result-area', `AI sedang memakai ${earringName}...`);
        const res = await fetch('/api/youcam?action=ai-earring', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({
                URL_gambar_pengguna: URL_gambar_pengguna,
                URL gambar anting: URL Publik anting,
            }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || JSON.stringify(data));
        const outputUrl = getOutputUrl(data);
        Jika (outputUrl) menampilkan hasil AI ('ai-result-area', outputUrl, 'luxarc-earring');
        else throw new Error('Hasil tidak ditemukan: ' + JSON.stringify(data));
    } catch (err) { showAIError('ai-result-area', err.message); }
}

// ═════════════════════════════════════════════════════════
// ── PENASIHAT AI — Obrolan & Balasan Cepat (Didukung oleh Groq) ─────
// ═════════════════════════════════════════════════════════
const chatHistory = document.getElementById('chat-history');

biarkan groqChatHistory = [];

fungsi appendMessage(pengirim, teks) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.innerHTML = teks;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

fungsi appendTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'bot pesan obrolan';
    el.id = 'indikator-pengetikan';
    el.innerHTML = `<span style="color:#FFD700;">✨ LuxArc AI sedang mengetik</span>
        <span style="animation:blink 1s infinite;">...</span>`;
    chatHistory.appendChild(el);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

fungsi removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

fungsi appendProductCard(productName, desc, imgSrc) {
    const card = document.createElement('div');
    card.className = 'ai-product-rec';
    card.innerHTML = `
        <img src="${imgSrc}" alt="${productName}">
        <div class="ai-product-rec-info">
            <div class="ai-product-rec-name">${productName}</div>
            <div class="ai-product-rec-desc">${desc}</div>
            <button class="ai-product-rec-btn" onclick="openAIClothes('${imgSrc}','${productName}')">✨ Coba AI</button>
        </div>`;
    chatHistory.appendChild(kartu);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

fungsi asinkron sendToGroq(userMessage) {
    mencoba {
        const res = await fetch('/api/groq', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({
                pesan: userMessage,
                riwayat: groqChatHistory.slice(-10),
            }),
        });
        const data = await res.json();
        Jika (!res.ok) throw new Error(data.error || 'Groq error');
        kembalikan { balasan: data.balasan, produk: data.produk || [] };
    } tangkap (kesalahan) {
        console.error('[Kesalahan Obrolan Groq]', err);
        return { reply: 'Maaf, AI Advisor sedang tidak tersedia. Coba lagi ya! 😊', produk: [] };
    }
}

fungsi handleQuickReply(tipe) {
    const qr = document.getElementById('ai-quick-replies');
    jika (qr) qr.style.display = 'none';
    ['submenu-makeup','submenu-cat-rambut','submenu-skin','submenu-anting','submenu-topi'].forEach(id => {
        const el = document.getElementById(id);
        jika (el) el.style.display = 'none';
    });

    jika (tipe === 'makeup') {
        appendMessage('user', '💄 Rekomendasi Makeup');
        setTimeout(() => {
            appendMessage('bot', 'Pilih produk makeup yang ingin kamu coba secara virtual! 💋');
            const s = document.getElementById('submenu-makeup');
            jika s.style.display = 'block';
        }, 500);
    } else if (type === 'cat-rambut') {
        appendMessage('user', '🎨 Coba Warna Kucing Rambut');
        setTimeout(() => {
            appendMessage('bot', 'Pilih warna kucing rambutmu — AI YouCam akan melihat pratinjau di fotomu! 💇');
            const s = document.getElementById('submenu-cat-rambut');
            jika s.style.display = 'block';
        }, 500);
    } jika tidak (tipe === 'fashion') {
        appendMessage('user', '👗 Cari Pakaian & Perhiasan');
        setTimeout(() => {
            appendMessage('bot', 'Pilih produk di Beranda lalu klik "Coba Live" untuk uji coba virtual! 🛍️');
            switchPage('beranda');
        }, 500);
    } else if (ketik === 'analisis kulit') {
        appendMessage('user', '🔬 Analisis Kulit Saya');
        setTimeout(() => {
            appendMessage('bot', 'Pilih perhatian kulit yang ingin dijelaskan!');
            const s = document.getElementById('submenu-skin');
            jika s.style.display = 'block';
        }, 500);
    } else if (type === 'free') {
        appendMessage('pengguna', '💬 Tanya Bebas');
        setTimeout(() => {
            appendMessage('bot', 'Silakan tanya apa saja tentang fashion, kecantikan, atau produk LuxArc AI! ✨');
        }, 500);
    }
}

fungsi closeSubmenu() {
    ['submenu-makeup','submenu-cat-rambut','submenu-skin','submenu-anting','submenu-topi'].forEach(id => {
        const el = document.getElementById(id);
        jika (el) el.style.display = 'none';
    });
    const qr = document.getElementById('ai-quick-replies');
    jika (qr) {
        qr.style.display = 'flex';
        qr.style.flexDirection = 'column';
    }
}

fungsi asinkron sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    jika (!teks) kembalikan;

    appendMessage('user', text);
    input.value = '';
    input.disabled = true;

    const lower = text.toLowerCase();

    if (lower.includes('cat rambut') || lower.includes('warna rambut')) {
        appendMessage('bot', 'Mau preview warna kucing rambut? Pilih warnanya! 🎨');
        setTimeout(() => { const s = document.getElementById('submenu-cat-rambut'); if(s) s.style.display='block'; }, 300);
        input.disabled = false;
        kembali;
    }
    jika (lower.includes('coba makeup') || lower.includes('coba lipstik') || lower.includes('coba eyeshadow')) {
        appendMessage('bot', 'Mau coba makeup virtual? Pilih produknya! 💄');
        setTimeout(() => { const s = document.getElementById('submenu-makeup'); if(s) s.style.display='block'; }, 300);
        input.disabled = false;
        kembali;
    }
    if (lower.includes('analisis kulit') || lower.includes('cek kulit')) {
        appendMessage('bot', 'Mau menganalisis kondisi kulitmu? Pilih perhatian-mu! 🔬');
        setTimeout(() => { const s = document.getElementById('submenu-skin'); if(s) s.style.display='block'; }, 300);
        input.disabled = false;
        kembali;
    }
    jika (lower.includes('ganti gaya rambut') || lower.includes('hairstyle')) {
        appendMessage('bot', 'Mau coba gaya rambut baru? Ayo! 💇');
        setTimeout(() => openAIHairstyle(), 500);
        input.disabled = false;
        kembali;
    }

 tambahkanIndikatorPengetikan();
const result = await sendToGroq(text);
removeTypingIndicator();
appendMessage('bot', result.reply);

jika (hasil.produk && hasil.panjang.produk > 0) {
    renderAIProductCards(result.products);
}

groqChatHistory.push({ role: 'user', text });
groqChatHistory.push({ role: 'bot', text: result.reply });
    Jika groqChatHistory.length > 20, maka groqChatHistory akan dipotong (-20);

    input.disabled = false;
    input.focus();
}
fungsi renderAIProductCards(produk) {
    Jika (!products || products.length === 0) kembalikan;
    produk.forEach(produk => {
        biarkan imgSrc = '';
        misalkan dataHarga = 0;
        biarkan targetCard = null;

        document.querySelectorAll('.product-card').forEach(card => {
            const cardName = (card.getAttribute('data-name') || '').toLowerCase();
            const prodName = product.name.toLowerCase();
            if (cardName.includes(prodName.split(' ')[0]) ||
                prodName.includes(cardName.split(' ')[0])) {
                const img = card.querySelector('img');
                jika (img) imgSrc = img.src;
                const priceEl = card.querySelector('[data-price]');
                if (priceEl) dataPrice = parseInt(priceEl.getAttribute('data-price')) || 0;
                targetCard = kartu;
            }
        });

        // Ambil tombol "Coba AI" dari kartu asli
        biarkan tryAIBtn = '';
        jika (targetCard) {
            const ghostBtn = targetCard.querySelector('.btn-ghost');
            jika (tombol hantu) {
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
                `<img src="${imgSrc}" alt="${product.name}">`
                : `<span style="font-size:2em;">🛍️</span>`}
            <div class="ai-product-rec-info">
                <div class="ai-product-rec-name">${product.name}</div>
                <div class="ai-product-rec-desc">${product.reason || ''}</div>
                <div style="color:#FFD700;font-size:0.82em;font-weight:700;margin-bottom:6px;">
                    ${harga produk}
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
        chatHistory.appendChild(kartu);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    });
}
        
fungsi askAIAbaoutProduct(productName) {
    switchPage('ai');
    setTimeout(() => {
        appendMessage('user', `Berikan saran untuk ${productName}`);
        setTimeout(() => {
            appendMessage('bot', `${productName} adalah pilihan yang sangat bagus! ✨ Mau coba langsung secara virtual?`);
        }, 800);
    }, 400);
}

// ═════════════════════════════════════════════════════════
// ── DETEKSI OTOMATIS ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════
fungsi triggerAutoDetect() {
    appendMessage('user', '📷 Deteksi Otomatis');
    appendMessage('bot', 'Oke! Upload foto wajahmu untuk analisis kulit dan rekomendasi produk yang tepat. 🔬');

    setTimeout(() => {
        showAIModal('📷 Deteksi Otomatis', `
            <p style="color:#aaa;margin-bottom:15px;">
                Upload foto wajahmu, AI akan menganalisis kulitmu dan memberikannya
                rekomendasi produk yang sesuai! 💄
            </p>
            <label style="display:block;background:#1a1a1a;border:1.5px dashed #FFD700;
                border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:15px;">
                📷 Pilih Foto Wajahmu
                <input type="file" accept="image/*" id="autodetect-photo-input"
                    gaya="tampilan:tidak ada;"
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

fungsi asinkron runAutoDetectAnalysis() {
    const input = document.getElementById('autodetect-photo-input');
    if (!input?.files[0]) { toast('Unggah foto dulu!', 'error'); return; }
    showAILoading('ai-result-area', 'Mengupload foto...');
    mencoba {
        const userBase64 = await fileToBase64(input.files[0]);
        const userImageUrl = await uploadToImgBB(userBase64);
        showAILoading('ai-result-area', 'AI sedang menganalisis kulitmu... 🔬');

        const res = await fetch('/api/youcam?action=skin-analysis', {
            metode: 'POST',
            header: { 'Content-Type': 'application/json' },
            isi: JSON.stringify({ user_image_url: userImageUrl }),
        });

        biarkan data;
        mencoba {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error('Respon bukan JSON dari server: ' + jsonErr.message);
        }

        jika (!res.ok) {
            throw new Error(data?.error || data?.message || `Kesalahan server ${res.status}`);
        }

        const scores = data?.data?.results
            || data?.data?.data?.hasil
            || data?.hasil
            || {};

        const acne = Number(scores?.acne?.score ?? scores?.acne ?? 80);
        const moisture = Number(scores?.moisture?.score ?? scores?.moisture ?? 50);
        const radiance = Number(scores?.radiance?.score ?? scores?.radiance ?? 50);

        biarkan skinType = '';
        biarkan rekomendasi = [];

        jika (jerawat < 50) {
            skinType = '⚠️ Kulit cenderung berjerawat';
            rekomendasi.push('💆 Gunakan alas bedak ringan & nonkomedogenik');
            rekomendasi.push('🌿 Blush On warna nude/peach lebih cocok');
        } jika tidak (kelembapan < 50) {
            skinType = '💧 Kulit cenderung kering';
            rekomendasi.push('✨ Gunakan highlighter untuk tampilan glowing');
            recommendations.push('💄 Warna bibir dengan formula pelembap');
        } jika (radiance > 70) {
            skinType = '✨ Kulit cerah & sehat';
            rekomendasi.push('🌸 Blush On rose atau coral untuk warna segar');
            rekomendasi.push('💋 Warna bibir tebal sangat cocok untuk Anda!');
        } kalau tidak {
            skinType = '😊 Kulit normal & seimbang';
            rekomendasi.push('💄 Semua warna makeup cocok untuk kulitmu!');
            rekomendasi.push('🌸 Coba Blush On Collection untuk tampilan natural');
        }

        const label = {
            jerawat: '🔴 Jerawat',
            kelembapan: '💧 Kelembapan',
            pori-pori: '⭕ Pori-pori',
            kerutan: '〰️ Kerutan',
            pancaran: '✨ Kecerahan',
            kemerahan: '🔥 Kemerahan',
        };

        biarkan resultHTML = `
            <p style="color:#FFD700;margin-bottom:10px;font-weight:600;">✅ Hasil Analisis Kulit:</p>
            <p style="color:#aaa;font-size:0.9em;margin-bottom:12px;">${skinType}</p>
            <div style="background:#1a1a1a;border-radius:12px;padding:15px;margin-bottom:15px;">`;

        biarkan hasScore = false;
        untuk (konstanta [kunci, label] dari Object.entries(label)) {
            const rawScore = scores?.[key]?.score ?? scores?.[key] ?? null;
            jika (rawScore !== null && rawScore !== undefined) {
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

        jika (!hasScore) {
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
                appendMessage('bot', `Analisis selesai! ✨<br>${skinType<br><br>${recommendations.join('<br>')}<br><br>Pilih produk di Beranda untuk virtual try-on! 💄`);
            }, 400);
        }, 1500);

    } tangkap (kesalahan) {
        const container = document.getElementById('ai-result-area');
        jika (wadah) {
            showAIError('ai-result-area', err.message);
        } kalau tidak {
            toast('❌ ' + err.message, 'error');
        }
    }
}

// ═════════════════════════════════════════════════════════
// ── FILTER ANGGARAN ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════
biarkan budgetFilterActive = false;
misalkan currentBudgetMin = 0;
misalkan currentBudgetMax = 9999999;

fungsi toggleBudgetPanel() {
    const panel = document.getElementById('budget-filter-panel');
    jika (!panel) kembali;
    budgetFilterActive = !budgetFilterActive;
    panel.style.display = budgetFilterActive ? 'block' : 'none';
    document.getElementById('btn-budget-filter').classList.toggle('active', budgetFilterActive);
    Jika (!budgetFilterActive) { currentBudgetMin = 0; currentBudgetMax = 9999999; terapkanBudgetFilter(); }
}

fungsi setBudgetPreset(btn, min, max) {
    document.querySelectorAll('.budget-preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('aktif');
    Anggaran Minimum saat ini = minimum;
    Anggaran Maksimum saat ini = maks;
    const minEl = document.getElementById('budget-range-min');
    const maxEl = document.getElementById('budget-range-max');
    jika (minEl) minEl.value = Math.min(min, 2500000);
    jika (maxEl) maxEl.value = Math.min(max, 2500000);
    updateBudgetLabels();
    terapkanFilterAnggaran();
}

fungsi onBudgetRangeChange() {
    const minEl = document.getElementById('budget-range-min');
    const maxEl = document.getElementById('budget-range-max');
    currentBudgetMin = parseInt(minEl.value);
    currentBudgetMax = parseInt(maxEl.value);
    jika (anggaran minimum saat ini > anggaran maksimum saat ini) {
        Anggaran Maksimum saat ini = Anggaran Minimum saat ini;
        Nilai elemen maksimum = Anggaran Minimum saat ini;
    }
    updateBudgetLabels();
    document.querySelectorAll('.budget-preset-btn').forEach(b => b.classList.remove('active'));
    terapkanFilterAnggaran();
}

fungsi updateBudgetLabels() {
    const minLbl = document.getElementById('budget-min-label');
    const maxLbl = document.getElementById('budget-max-label');
    if (minLbl) minLbl.textContent = formatRupiah(currentBudgetMin);
    Jika (maxLbl) maxLbl.textContent = currentBudgetMax >= 2500000 ? '2.500.000+' : formatRupiah(currentBudgetMax);
}

fungsi applyBudgetFilter() {
    misalkan jumlah = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        const priceEl = card.querySelector('.product-price');
        harga const = hargaEl ? parseInt(priceEl.dataset.price || '0') : 0;
        const inRange = price >= currentBudgetMin && price <= currentBudgetMax;
        card.classList.toggle('budget-hidden', !inRange);
        jika (dalamRentang) {
            card.style.display = '';
            hitung++;
        } kalau tidak {
            card.style.display = 'none';
        }
    });
    const msg = document.getElementById('budget-result-msg');
    if (msg) msg.textContent = `${count} produk dalam anggaran ini`;
    document.getElementById('product-count').innerText = `${count} produk`;
}

fungsi resetBudgetFilter() {
    Anggaran Minimum saat ini = 0; Anggaran Maksimum saat ini = 9999999;
    const minEl = document.getElementById('budget-range-min');
    const maxEl = document.getElementById('budget-range-max');
    jika (minEl) minEl.value = 0;
    jika (maxEl) maxEl.value = 2500000;
    updateBudgetLabels();
    document.querySelectorAll('.budget-preset-btn').forEach(b => b.classList.remove('active'));
    const firstBtn = document.querySelector('.budget-preset-btn');
    jika (firstBtn) firstBtn.classList.add('active');
    terapkanFilterAnggaran();
}

// ═════════════════════════════════════════════════════════
// ── BAGIKAN & DISKON ───────────────────────────────────────────────
// ═════════════════════════════════════════════════════════
const PROMO_CODES = [
    { kode: 'LUXARC10', diskon: 0.10, label: 'DISKON 10%', deskripsi: 'Diskon 10% semua produk' },
    { kode: 'VIVI15', diskon: 0.15, label: 'DISKON 15%', deskripsi: 'Khusus untuk Vivi! Diskon 15%' },
    { code: 'BEAUTY20', discount: 0.20, label: 'Diskon 20%', desc: 'Hari Kecantikan! Diskon 20% untuk makeup & perawatan kulit' },
    { kode: 'SHARE5', diskon: 0,05, label: 'DISKON 5%', deskripsi: 'Terima kasih sudah berbagi! Diskon 5%' },
];

biarkan activePromoCode = null;
misalkan activeDiscount = 0;

fungsi openShareDiscount() {
    const totalCartVal = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const hasCart = cart.length > 0;

    let promoListHTML = PROMO_CODES.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:12px;border:1.5px solid rgba(255,215,0,0.2);border-radius:12px;margin-bottom:8px;
            latar belakang:rgba(255,215,0,0.04);">
            <div>
                <span style="color:#FFD700;font-weight:700;font-size:0.95em;letter-spacing:1px;">${p.code}</span>
                <p style="color:#aaa;font-size:0.78em;margin:2px 0 0;">${p.desc}</p>
            </div>
            <button onclick="applyPromo('${p.code}')" class="btn btn-ghost" style="font-size:0.78em;padding:6px 14px;">
                Pakai
            </button>
        </div>`).join('');

    showAIModal('🎁 Bagikan & Diskon Otomatis', `
        <p style="color:#aaa;margin-bottom:14px;font-size:0.9em;">
            Bagikan ke WhatsApp dan dapatkan <b style="color:#FFD700;">kode diskon eksklusif</b> untuk belanja!
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
            <button class="btn btn-gold shimmer-btn" onclick="shareToWhatsApp()" style="font-size:0.82em;padding:10px 0;">
                📲 Bagikan ke WA
            </button>
            <button class="btn btn-ghost" onclick="copyShareLink()" style="font-size:0.82em;padding:10px 0;">
                🔗 Salin Tautan
            </button>
        </div>
        <p style="color:#FFD700;font-weight:600;margin-bottom:10px;font-size:0.9em;">🏷️ Kode Promo Tersedia:</p>
        ${promoListHTML}
        <div style="display:flex;gap:8px;margin-top:14px;">
            <input type="text" id="promo-code-input" placeholder="Masukkan kode promo..."
                style="flex:1;background:#1a1a1a;border:1.5px solid #333;border-radius:10px;
                    warna:#fff;padding:10px 12px;ukuran-font:0.88em;keluarga-font:warisi;garis-luar:tidak ada;">
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

fungsi applyPromo(kode) {
    const promo = PROMO_CODES.find(p => p.code === code.toUpperCase().trim());
    jika (!promo) {
        showPromoFeedback('❌ Kode promo tidak valid!', 'error');
        kembali;
    }
    activePromoCode = promo.code;
    activeDiscount = promo.discount;
    toast(`🎉 Kode <b>${promo.code</b> aktif! Diskon ${promo.label}`, 'info');
    showPromoFeedback(`✅ Kode <b>${promo.code</b> berhasil dipakai! Diskon <b>${promo.label</b> akan diterapkan saat checkout.`, 'success');
}

fungsi applyPromoFromInput() {
    const val = document.getElementById('promo-code-input')?.value || '';
    terapkanPromo(val);
}

fungsi showPromoFeedback(pesan, ketik) {
    const el = document.getElementById('promo-feedback');
    jika (!el) kembali;
    el.innerHTML = `<p style="color:${type === 'error' ? '#ff4444' : '#4CAF50'};font-size:0.85em;
        padding:10px;background:${type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(76,175,80,0.1)'};
        border-radius:10px;">${msg}</p>`;
}

fungsi shareToWhatsApp() {
    const productList = Array.from(document.querySelectorAll('.product-card'))
        .iris(0, 3)
        .map(c => '• ' + (c.querySelector('.product-name')?.innerText || ''))
        .join('\n');
    const msg = encodeURIComponent(
        `✨ *LuxArc AI — Toko Premium*\n\n` +
        `Halo! Cek koleksi terbaru kami:\n${productList}\n\n` +
        `🛍️ ${window.location.href}\n\n` +
        `Gunakan kode *SHARE5* untuk diskon 5%! 🎁`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    toast('📲 Membuka WhatsApp...', 'info');
    setTimeout(() => applyPromo('SHARE5'), 1500);
}

fungsi copyShareLink() {
    const text = `✨ LuxArc AI — ${window.location.href} | Kode diskon: SHARE5`;
    navigator.clipboard?.writeText(text)
        .then(() => toast('🔗 Link didinginkan! Kode SHARE5 bisa dipakai.', 'info'))
        .catch(() => toast('Manual Salin: ' + window.location.href, 'info'));
}

// ═════════════════════════════════════════════════════════
// ── LOOKBOOK + SEBELUM/SESUDAH ───────────────────────────────────
// ═════════════════════════════════════════════════════════
misalkan beforeAfterPairs = [];

fungsi openLookbook() {
    const gallery = document.getElementById('lookbook-gallery');
    const hasBA = beforeAfterPairs.length > 0;

    gallery.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;grid-column:1/-1;">
            <button class="lookbook-tab-btn active" onclick="switchLookbookTab('gallery',this)" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #FFD700;background:rgba(255,215,0,0.12);color:#FFD700;font-family:inherit;font-size:0.82em;cursor:pointer;">📸 Lookbook</button>
            <button class="lookbook-tab-btn" onclick="switchLookbookTab('compare',this)" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid rgba (255,255,255,0.15);background:transparent;color:#aaa;font-family:inherit;font-size:0.82em;cursor:pointer;">✨ Sebelum/Setelah</button>
        </div>
        <div id="lookbook-tab-gallery" style="display:contents;">
            ${lookbookImages.length === 0
                ? '<p style="grid-column:1/-1;text-align:center;color:#888;padding:20px;">Ada foto di Lookbook.</p>'
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

fungsi switchLookbookTab(tab, btn) {
    document.querySelectorAll('.lookbook-tab-btn').forEach(b => {
        b.style.borderColor = 'rgba(255,255,255,0.15)';
        b.style.background = 'transparan';
        b.style.color = '#aaa';
        b.classList.remove('active');
    });
    btn.style.borderColor = '#FFD700';
    btn.style.background = 'rgba(255,215,0,0.12)';
    tombol.gaya.warna = '#FFD700';
    btn.classList.add('aktif');

    const galleryEl = document.getElementById('lookbook-tab-gallery');
    const compareEl = document.getElementById('lookbook-tab-compare');
    jika (galleryEl) galleryEl.style.display = tab === 'gallery' ? 'contents' : 'none';
    jika (compareEl) compareEl.style.display = tab === 'compare' ? 'block' : 'none';
}

fungsi renderBeforeAfterCard(pair, index) {
    kembali `
        <div style="margin-bottom:20px;border:1.5px solid rgba(255,215,0,0.15);border-radius:14px;overflow:hidden;background:#0d0d0d;">
            <div style="padding:10px 14px;border-bottom:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#FFD700;font-size:0.82em;font-weight:600;">✨ ${pair.label.replace(/-/g,' ').replace(/luxarc /gi,'')}</span>
                <button onclick="deleteBeforeAfter(${index})" style="background:none;border:none;color:#555;font-size:0.8em;cursor:pointer;">🗑</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;">
                <div style="position:relative;">
                    <img src="${pair.before}" style="width:100%;aspect-ratio:1;object-fit:cover;">
                    <span style="position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,0.7);color:#aaa;font-size:0.7em;padding:2px 8px;border-radius:8px;">SEBELUM</span>
                </div>
                <div style="position:relative;border-left:2px solid #FFD700;">
                    <img src="${pair.after}" style="width:100%;aspect-ratio:1;object-fit:cover;">
                    <span style="position:absolute;bottom:6px;right:6px;background:rgba(255,215,0,0.85);color:#000;font-size:0.7em;padding:2px 8px;border-radius:8px;font-weight:700;">SETELAH ✨</span>
                </div>
            </div>
            <div style="display:flex;gap:8px;padding:10px 12px;">
                <a href="${pair.after}" download="luxarc-after.jpg" class="btn btn-gold shimmer-btn" style="flex:1;text-align:center;text-decoration:none;font-size:0.8em;padding:8px;">⬇️ Unduh</a>
                <button class="btn btn-ghost" onclick="shareBeforeAfterWA(${index})" style="flex:1;font-size:0.8em;padding:8px;">📲 Bagikan WA</button>
            </div>
        </div>`;
}

fungsi deleteBeforeAfter(indeks) {
    beforeAfterPairs.splice(indeks, 1);
    bukaLookbook();
}

fungsi shareBeforeAfterWA(indeks) {
    const pair = beforeAfterPairs[index];
    jika (!pasangan) kembalikan;
    const msg = encodeURIComponent(`✨ Lihat transformasiku dengan LuxArc AI!\n\nHasil AI: ${pair.after}\n\n🛍️ ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

// ═════════════════════════════════════════════════════════
// ── STATUS & VARIABEL ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════
biarkan keranjang = [];
biarkan daftar keinginan = [];
biarkan lookbookImages = [];
biarkan currentCamera = 'user';
biarkan streamReference = null;
biarkan currentViewingImageIndex = null;
misalkan currentLang = 'id';

// ── Dwibahasa ────────────────────────────────────────────────
konstanta terjemahan = {
    pengenal: {
        heroLabel:"Suite Bisnis Eksklusif",
        selamat datang:"Selamat Datang,<br><em>Vivi Gioncyn.</em>",
        heroSub:"Penasihat Gaya AI · Inventaris Cerdas · Kecerdasan Bisnis",
        statLive:"Live <b>AI</b> Aktif", statCol:"Koleksi", statStock:"Stok",
        searchPlaceholder:"Tanya AI: 'Rok pesta malam'...",
        catAll:"Semua Koleksi", catClothes:"Pakaian", catJewelry:"Perhiasan Mewah", catAcc:"Aksesoris",
        secJudul:"Koleksi Terpilih", btnCoba:"✨ Coba Live", btnAddCart:"+ Keranjang", btnSaran:"🤖 Minta Saran AI",
        btnAutoDetect:"📷 Deteksi Otomatis", chatInput:"Tanya AI...",
        navHome:"Beranda", navAI:"AI Advisor",
        cartJudul:"Keranjang Belanja", cartTotal:"Total Tagihan:", btnPay:"✓ Selesai Bayar",
        toastCamFlip:"🔄 Memutar kamera...", toastCamErr:"Gagal membuka kamera!",
        toastCart:"masuk ke keranjang!", toastPay:"Pembayaran Berhasil! 🎉"
    },
    bahasa Inggris: {
        heroLabel:"Suite Bisnis Eksklusif",
        selamat datang:"Selamat datang,<br><em>Vivi Gioncyn.</em>",
        heroSub:"Penasihat Gaya AI · Inventaris Cerdas · Kecerdasan Bisnis",
        statLive:"AI Aktif Langsung", statCol:"Koleksi", statStock:"Saham",
        searchPlaceholder:"Tanya AI: 'Gaun malam'...",
        catAll:"Semua Koleksi", catClothes:"Pakaian", catJewelry:"Perhiasan Mewah", catAcc:"Aksesoris",
        secTitle:"Pilihan Terkurasi", btnTry:"✨ Coba Langsung", btnAddCart:"+ Tambahkan ke Keranjang", btnSaran:"🤖 Tanya AI",
        btnAutoDetect:"📷 Deteksi Otomatis", chatInput:"Tanyakan pada AI...",
        navHome:"Beranda", navAI:"Penasihat AI",
        cartTitle:"Keranjang Belanja", cartTotal:"Total Tagihan:", btnPay:"✓ Selesaikan Pembayaran",
        toastCamFlip:"🔄 Membalik kamera...", toastCamErr:"Akses kamera gagal!",
        toastCart:"Ditambahkan ke keranjang!", toastPay:"Pembayaran Berhasil! 🎉"
    }
};

fungsi toast(msg, tipe = 'info') {
    const stack = document.getElementById('toast-stack');
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.background = type === 'error' ? 'rgba(255,68,68,0.95)' : 'rgba(255,215,0,0.95)';
    el.style.color = type === 'error' ? '#fff' : '#000';
    el.innerHTML = msg;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

fungsi switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
    document.getElementById('nav-' + pageId)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pageId === 'keranjang') renderCartPage();
}

// ═════════════════════════════════════════════════════════
// ── HALAMAN KERANJANG (halaman penuh) ──────────────────────────────
// ═════════════════════════════════════════════════════════
fungsi renderCartPage() {
    const itemsEl = document.getElementById('cart-page-items');
    const voucherEl = document.getElementById('cart-voucher-section');
    const summaryEl = document.getElementById('cart-summary-section');
    const countEl = document.getElementById('cart-page-item-count');
    const emptyMsg = document.getElementById('cart-empty-msg');
    jika (!itemsEl) kembalikan;

    jika (countEl) countEl.textContent = cart.length + ' item';

    const bannerEl = document.getElementById('cart-page-promo-banner');
    jika (bannerEl) {
        jika (kode promo aktif && diskon aktif > 0) {
            const promo = PROMO_CODES.find(p => p.code === activePromoCode);
            document.getElementById('cart-page-promo-label').textContent = `Kode: ${activePromoCode} — Diskon ${Math.round(activeDiscount*100)}%`;
            document.getElementById('cart-page-promo-desc').textContent = promo ? promo.desc : '';
            bannerEl.style.display = 'flex';
        } kalau tidak {
            bannerEl.style.display = 'none';
        }
    }

    jika (cart.length === 0) {
        jika (emptyMsg) emptyMsg.style.display = 'block';
        Array.from(itemsEl.querySelectorAll('.cart-page-item')).forEach(el => el.remove());
        jika (voucherEl) voucherEl.style.display = 'none';
        jika (summaryEl) summaryEl.style.display = 'none';
        kembali;
    }

    jika (emptyMsg) emptyMsg.style.display = 'none';

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

    jika (voucherEl) voucherEl.style.display = 'block';
    jika (summaryEl) summaryEl.style.display = 'block';

    document.querySelectorAll('.voucher-chip').forEach(chip => {
        const chipCode = chip.textContent.split(' ')[0].trim();
        chip.classList.toggle('active-chip', chipCode === activePromoCode);
    });

    const rawTotal = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const discountAmt = activeDiscount > 0 ? Math.round(rawTotal * activeDiscount) : 0;
    const finalTotal = rawTotal - diskonAmt;

    const subtotalEl = document.getElementById('cart-page-subtotal');
    const discountRowEl = document.getElementById('cart-summary-discount-row');
    const discountEl = document.getElementById('cart-page-discount');
    const totalEl = document.getElementById('cart-page-total');
    const vaEl = document.getElementById('cart-page-va');

    if (subtotalEl) subtotalEl.textContent = 'Rp ' + formatRupiah(rawTotal);
    jika (discountRowEl) discountRowEl.style.display = activeDiscount > 0 ? 'flex' : 'none';
    jika (discountEl) discountEl.textContent = '- Rp ' + formatRupiah(discountAmt);
    if (totalEl) totalEl.textContent = 'Rp ' + formatRupiah(finalTotal);
    jika (vaEl) vaEl.textContent = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
}

fungsi processPaymentPage() {
    toast('⏳ Memverifikasi...');
    setTimeout(() => {
        toast(translations[currentLang].toastPay);
        keranjang = [];
        activePromoCode = null;
        activeDiscount = 0;
        syncCartBadge();
        renderCartPage();
    }, 1500);
}

fungsi applyPromoPage(kode) {
    const promo = PROMO_CODES.find(p => p.code === code.toUpperCase().trim());
    const feedbackEl = document.getElementById('cart-page-promo-feedback');
    jika (!promo) {
        if (feedbackEl) feedbackEl.innerHTML = `<p style="color:#ff4444;font-size:0.82em;margin-top:6px;">❌ Kode promo tidak valid!</p>`;
        kembali;
    }
    activePromoCode = promo.code;
    activeDiscount = promo.discount;
    if (feedbackEl) feedbackEl.innerHTML = `<p style="color:#4CAF50;font-size:0.82em;margin-top:6px;">✅ Kode <b>${promo.code}</b> aktif! Diskon <b>${promo.label}</b></p>`;
    toast(`🎉 Kode <b>${promo.code</b> aktif! Diskon ${promo.label}`, 'info');
    renderCartPage();
}

fungsi applyPromoPageFromInput() {
    const val = document.getElementById('cart-page-promo-input')?.value || '';
    terapkanPromoPage(val);
}

fungsi removePromoPage() {
    activePromoCode = null;
    activeDiscount = 0;
    toast('Kode promo dihapus.', 'info');
    renderCartPage();
}

// ── Pencarian ────────────────────────────────────────────────────
document.getElementById('search-input')?.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    misalkan jumlah = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        const match = card.innerText.toLowerCase().includes(term) || card.dataset.name?.includes(term);
        card.style.display = match ? 'flex' : 'none';
        jika (cocok) count++;
    });
    document.getElementById('product-count').innerText = `${count} produk`;
});

fungsi filterProduk(kategori, tombol) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('aktif');
    misalkan jumlah = 0;
    document.querySelectorAll('.product-card').forEach(card => {
        biarkan show = false;
        jika (kategori === 'semua') {
            tampilkan = benar;
        } else if (kategori === 'pakaian') {
            show = ['pakaian','atasan','dress'].includes(card.dataset.category);
        } kalau tidak {
            tampilkan = kartu.dataset.kategori === kategori;
        }
        card.style.display = show ? 'flex' : 'none';
        jika (tampilkan) hitung++;
    });
    document.getElementById('product-count').innerText = `${count} produk`;
}

// ── Kamera ───────────────────────────────────────────────────
fungsi asinkron bukaKamera(isAutoDetect = false) {
    const view = document.getElementById('camera-view');
    const badge = document.getElementById('ai-match-score');
    const controls = document.getElementById('cam-ui-controls');
    tampilan.gaya.tampilan = 'fleksibel';
    jika (isAutoDetect) {
        controls.style.display = 'none';
        badge.style.display = 'flex';
        badge.innerText = '🔍 Memindai Biometrik...';
    } kalau tidak {
        controls.style.display = 'flex';
        badge.style.display = 'flex';
        badge.innerText = '🤖 Sedang mengkalibrasi...';
        setTimeout(() => { badge.innerText = `✨ Skor Pertandingan: ${Math.floor(Math.random()*15)+85}%`; }, 2000);
    }
    mencoba {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
        document.getElementById('video-stream').srcObject = stream;
        Referensi aliran = aliran;
    } tangkap (kesalahan) {
        toast(translations[currentLang].toastCamErr, 'error');
        tutupKamera();
    }
}

fungsi closeCamera() {
    jika (streamReference) streamReference.getTracks().forEach(t => t.stop());
    document.getElementById('camera-view').style.display = 'none';
    document.getElementById('ai-match-score').style.display = 'none';
    streamReference = null;
}

fungsi asinkron flipCamera() {
    jika (streamReference) streamReference.getTracks().forEach(t => t.stop());
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    toast(translations[currentLang].toastCamFlip);
    mencoba {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera } });
        document.getElementById('video-stream').srcObject = stream;
        Referensi aliran = aliran;
    } catch (err) { toast(translations[currentLang].toastCamErr, 'error'); }
}

// ── Cuplikan & Lookbook ───────────────────────────────────────
fungsi takeSnapshot() {
    const v = document.getElementById('video-stream');
    const c = document.getElementById('snapshot-canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    lookbookImages.push(c.toDataURL('image/jpeg'));
    toast('📸 Foto disimpan ke Lookbook!');
}

fungsi openFullImage(indeks) {
    currentViewingImageIndex = index;
    document.getElementById('full-img-display').src = lookbookImages[index];
    document.getElementById('btn-delete-img').onclick = () => {
        lookbookImages.splice(currentViewingImageIndex, 1);
        closeModal('full-img-modal');
        bukaLookbook();
    };
    document.getElementById('btn-share-wa').onclick = () => {
        window.open(`https://api.whatsapp.com/send?text=Lihat gayaku dari LuxArc AI!`, '_blank');
    };
    openModal('full-img-modal');
}

fungsi closeFullImage() { closeModal('full-img-modal'); currentViewingImageIndex = null; }

// ── Modal ─────────────────────────────────────────────────────────
fungsi openModal(id) {
    const el = document.getElementById(id);
    jika (!el) kembali;
    el.style.display = 'flex';
    setTimeout(() => el.classList.add('open'), 10);
}

fungsi closeModal(id) {
    const el = document.getElementById(id);
    jika (!el) kembali;
    el.classList.remove('open');
    setTimeout(() => { el.style.display = 'none'; }, 300);
}

// ── Keranjang ───────────────────────────────────────────────────────
fungsi addToCart(nama, harga) {
    const safePrice = typeof price === 'number' ? price : parseInt(String(price).replace(/\D/g,''), 10) || 0;
    cart.push({ name, price: safePrice });
    syncCartBadge();
    // Efek btn-cart ditambahkan
document.querySelectorAll('.btn-cart').forEach(btn => {
  const orig = btn.innerHTML;
  btn.innerHTML = '✓ Ditambahkan!';
  btn.classList.add('ditambahkan');
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove('added');
  }, 1500);
});
    toast(`🛒 ${name} ${translations[currentLang].toastCart}`);
    Jika (document.getElementById('page-keranjang')?.classList.contains('active')) renderCartPage();
}

// FIX: badge selalu sinkron — tersembunyi saat 0, tampil saat > 0
fungsi syncCartBadge() {
    konstanta jumlah = panjang keranjang;
    const navBadge = document.getElementById('cart-count');
    jika (navBadge) navBadge.innerText = count;
    const bnavBadge = document.getElementById('bnav-cart-count');
    jika (bnavBadge) {
        bnavBadge.innerText = count;
        bnavBadge.style.display = count > 0 ? 'flex' : 'none';
        jika (jumlah > 0) {
            bnavBadge.classList.add('bump');
            setTimeout(() => bnavBadge.classList.remove('bump'), 250);
        }
    }
}

fungsi openCheckout() {
    const div = document.getElementById('cart-items');
    const totalSection = document.getElementById('cart-total-section');
    jika (!div) kembali;

    jika (cart.length === 0) {
        div.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Keranjang kosong</p>';
        totalSection.style.display = 'none';
    } kalau tidak {
        div.innerHTML = cart.map((item, idx) => `
            <div style="padding:10px 0;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:0.9em;">${item.name}</span>
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="color:#FFD700;font-weight:600;">Rp ${formatRupiah(item.price)}</span>
                    <button onclick="removeFromCart(${idx})" style="background:none;border:none;color:#ff4444;font-size:1.1em;cursor:pointer;">🗑</button>
                </div>
            </div>`).join('');

        misalkan rawTotal = cart.reduce((a, b) => a + (Number(b.price) || 0), 0);
        const totalEl = document.getElementById('total-price');

        jika (activeDiscount > 0) {
            const discounted = Math.round(rawTotal * (1 - activeDiscount));
            konstanta tabungan = total mentah - diskon;
            jika (totalEl) {
                totalEl.innerHTML = `
                    <span style="text-decoration:line-through;color:#888;font-size:0.85em;">Rp ${formatRupiah(rawTotal)}</span>
                    <span style="color:#4CAF50;font-size:0.8em;margin:0 4px;">−${Math.round(activeDiscount*100)}%</span>
                    <br><span style="color:#FFD700;">Rp ${formatRupiah(diskon)}</span>
                    <small style="color:#4CAF50;display:block;font-size:0.75em;">Hemat Rp ${formatRupiah(saving)} 🎉</small>`;
            }
        } kalau tidak {
            if (totalEl) totalEl.innerText = 'Rp ' + formatRupiah(rawTotal);
        }

        // Banner promo aktif di modal checkout
        const banner = document.getElementById('active-promo-banner');
        jika (spanduk) {
            jika (kode promo aktif && diskon aktif > 0) {
                const promo = PROMO_CODES.find(p => p.code === activePromoCode);
                document.getElementById('active-promo-label').textContent = `Kode: ${activePromoCode} — Diskon ${Math.round(activeDiscount*100)}%`;
                document.getElementById('active-promo-desc').textContent = promo ? promo.desc : '';
                banner.style.display = 'flex';
            } kalau tidak {
                banner.style.display = 'none';
            }
        }

        document.getElementById('va-number').innerText = `8801 ${Math.floor(10000000 + Math.random() * 90000000)}`;
        totalSection.style.display = 'block';
    }
    openModal('checkout-modal');
}

fungsi removeFromCart(i) {
    cart.splice(i, 1);
    syncCartBadge();
    openCheckout();
}

fungsi removeFromCartPage(i) {
    cart.splice(i, 1);
    syncCartBadge();
    renderCartPage();
}

fungsi processPayment() {
    toast('⏳ Memverifikasi...');
    setTimeout(() => {
        toast(translations[currentLang].toastPay);
        keranjang = [];
        activePromoCode = null;
        activeDiscount = 0;
        syncCartBadge();
        closeModal('checkout-modal');
    }, 1500);
}

fungsi removePromo() {
    activePromoCode = null;
    activeDiscount = 0;
    openCheckout();
    toast('Kode promo dihapus.', 'info');
}

// ── Daftar Keinginan ───────────────────────────────────────────────────
fungsi toggleWishlist(btn, name) {
    const idx = wishlist.indexOf(name);
    if (idx === -1) { wishlist.push(name); btn.innerText = '❤️'; toast(`❤️ ${name} ditambahkan ke Wishlist`); }
    else { wishlist.splice(idx, 1); btn.innerText = '🤍'; }
}

fungsi openWishlist() {
    document.getElementById('wishlist-items').innerHTML = wishlist.length === 0
        ? '<p style="text-align:center;color:#888;padding:20px;">Daftar Keinginan Kosong</p>'
        : wishlist.map(n => `<div style="padding:10px 0;border-bottom:1px solid #222;font-size:0.9em;">❤️ ${n}</div>`).join('');
    openModal('wishlist-modal');
}

// ── Dasbor Admin ───────────────────────────────────────────
fungsi openAdmin() {
    const revenue = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    document.getElementById('dash-revenue').innerText = `Rp ${formatRupiah(revenue)}`;
    document.getElementById('dash-wishlist-count').innerText = wishlist.length;
    const data = Array.from({ length: 7 }, () => Math.floor(Math.random() * 60) + 30);
    document.getElementById('mini-chart').innerHTML = data.map(() =>
        `<div class="chart-bar" style="height:0%;flex:1;transition:height 0.8s ease-out;background:linear-gradient(to top,#FFD700,#fffae6);border-radius:4px 4px 0 0;"></div>`
    ).bergabung('');
    openModal('admin-modal');
    setTimeout(() => {
        document.querySelectorAll('.chart-bar').forEach((bar, i) => { bar.style.height = `${data[i]}%`; });
    }, 100);
}

// ═════════════════════════════════════════════════════════
// ── LACI PENGATURAN ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════
misalkan currentCurrency = 'IDR';
konstanta USD_RATE = 16400;

fungsi openSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('settings-overlay');
    jika (!laci) kembali;
    renderDrawerVoucher();
    laci.gaya.tampilan = 'blok';
    overlay.style.display = 'block';
    setTimeout(() => { drawer.style.transform = 'translateX(0)'; }, 10);
}

fungsi closeSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('settings-overlay');
    jika (!laci) kembali;
    drawer.style.transform = 'translateX(100%)';
    setTimeout(() => {
        laci.gaya.tampilan = 'tidak ada';
        overlay.style.display = 'none';
    }, 300);
}

fungsi setLanguage(lang) {
    Bahasa saat ini = bahasa;

    // ── Pergantian mata uang otomatis ───────────────────────────────
    jika (lang === 'en') atur Mata Uang ('USD');
    jika tidak, atur mata uang ('IDR');

    // ── Perbarui tombol bahasa di laci ─────────────────────
    const idBtn = document.getElementById('lang-id-btn');
    const enBtn = dokumen.getElementById('lang-en-btn');
    jika (idBtn) {
        idBtn.style.borderColor = lang === 'id' ? '#FFD700' : 'rgba(255,255,255,0.15)';
        idBtn.style.color = lang === 'id' ? '#FFD700' : '#aaa';
        idBtn.style.background = lang === 'id' ? 'rgba(255,215,0,0.12)' : 'transparan';
    }
    jika (enBtn) {
        enBtn.style.borderColor = lang === 'en' ? '#FFD700' : 'rgba(255,255,255,0.15)';
        enBtn.style.color = lang === 'en' ? '#FFD700' : '#aaa';
        enBtn.style.background = lang === 'en' ? 'rgba(255,215,0,0.12)' : 'transparan';
    }

    // ── Terjemahan lengkap ──────────────────────────────────
    konstanta t = {
        pengenal: {
            // Pahlawan
            heroLabel: 'Suite Bisnis Eksklusif',
            heroSub: 'Penasihat Gaya AI · Inventaris Cerdas · Kecerdasan Bisnis',
            statCol: 'Koleksi', statStock: 'Stok',

            // Pencarian & Penyaringan
            searchPlaceholder: "Tanya AI: 'Rok pesta malam'...",
            catAll: 'Semua Koleksi', catClothes: 'Pakaian',
            Judul Bagian: 'Koleksi Terpilih',

            // Tombol produk
            btnTryLive: '✨ Coba Live',
            tombolTambahKeranjang: '+ Keranjang',
            btnAskAI: '🤖 Minta Saran AI',
            btnTryMakeup: '💄 Coba Riasan',
            btnTryHat: '🎩 Coba AI',
            btnSkinAnalysis: '✨ Analisis Kulit',
            btnTryHair: '💇 Coba Warna Rambut dengan AI',

            // Navigasi
            navHome: 'Beranda', navAI: 'AI Advisor',

            // Keranjang
            cartJudul: 'Keranjang Belanja',
            cartEmpty: 'Keranjang Kosong',
            cartEmptySub: 'Tambahkan produk dari halaman Beranda',
            cartShopNow: 'Belanja Sekarang',
            Subtotal keranjang: 'Subtotal',
            cartDiskon: 'Voucher Diskon',
            cartTotal: 'Total Tagihan',
            cartVA: 'Transfer Akun Virtual',
            cartPay: '✓ Selesai Bayar',
            cartItemCount: 'item',

            // Voucher
            Judul voucher: '🏷️ Voucher & Promo',
            voucherInput: 'Masukkan kode voucher...',
            voucherApply: 'Pakai',
            orderSummary: '📋 Ringkasan Pesanan',

            // Penasihat AI
            aiGreeting: 'Halo <b>Vivi!</b> 👋 Saya <b>LuxArc AI</b> — asisten gaya personalmu.<br>Apa yang bisa saya bantu hari ini?',
            btnAutoDetect: '📷 Deteksi Otomatis',
            chatInput: 'Tanya AI...',
            qrMakeup: '💄 Rekomendasi Riasan',
            qrHair: '🎨 Coba Warna Kucing Rambut',
            qrFashion: '👗 Cari Pakaian & Perhiasan',
            qrSkin: '🔬 Analisis Kulit Saya',
            qrFree: '💬 Tanya Bebas',

            // Pengaturan
            settingsTitle: '⚙️ Pengaturan',
            langLabel: '🌐 Bahasa',
            currLabel: '💱 Tampilan Harga',
            voucherAktif: '🏷️ Voucher Aktif',
            noVoucher: 'Belum ada voucher aktif. Pilih kode di bawah:',
            btnDashboard: '📊 Dasbor Bisnis',
            btnBagikan: '🎁 Bagikan & Diskon',

            // Roti panggang
            toastCart: 'masuk ke keranjang!',
            toastPay: 'Pembayaran Berhasil! 🎉',
            toastCamFlip: '🔄 Memutar kamera...',
            toastCamErr: 'Gagal membuka kamera!',
        },
        bahasa Inggris: {
            // Pahlawan
            heroLabel: 'Suite Bisnis Eksklusif',
            heroSub: 'Penasihat Gaya AI · Inventaris Cerdas · Kecerdasan Bisnis',
            statCol: 'Koleksi', statStock: 'Stok',

            // Pencarian & Penyaringan
            searchPlaceholder: "Tanya AI: 'Gaun pesta malam'...",
            catAll: 'Semua Koleksi', catClothes: 'Pakaian',
            secTitle: 'Pilihan Terkurasi',

            // Tombol produk
            btnTryLive: '✨ Coba Live',
            btnAddCart: '+ Tambahkan ke Keranjang',
            btnAskAI: '🤖 Tanya AI',
            btnTryMakeup: '💄 Coba Rias Wajah',
            btnTryHat: '🎩 Coba AI',
            btnSkinAnalysis: '✨ Analisis Kulit',
            btnTryHair: '💇 Coba Warna Rambut dengan AI',

            // Navigasi
            navHome: 'Beranda', navAI: 'Penasihat AI',

            // Keranjang
            cartTitle: 'Keranjang Belanja',
            cartEmpty: 'Keranjang belanja kosong',
            cartEmptySub: 'Tambahkan produk dari halaman Beranda',
            cartShopNow: 'Belanja Sekarang',
            Subtotal keranjang: 'Subtotal',
            cartDiscount: 'Diskon Voucher',
            cartTotal: 'Total Tagihan',
            cartVA: 'Transfer Akun Virtual',
            cartPay: '✓ Selesaikan Pembayaran',
            cartItemCount: 'items',

            // Voucher
            Judul voucher: '🏷️ Voucher & Promo',
            voucherInput: 'Masukkan kode voucher...',
            voucherApply: 'Terapkan',
            orderSummary: '📋 Ringkasan Pesanan',

            // Penasihat AI
            aiGreeting: 'Halo <b>Vivi!</b> 👋 Saya <b>LuxArc AI</b> — asisten gaya pribadi Anda.<br>Bagaimana saya dapat membantu Anda hari ini?',
            btnAutoDetect: '📷 Deteksi Otomatis',
            chatInput: 'Tanyakan pada AI...',
            qrMakeup: '💄 Rekomendasi Makeup',
            qrHair: '🎨 Coba Warna Rambut',
            qrFashion: '👗 Temukan Pakaian & Perhiasan',
            qrSkin: '🔬 Analisis Kulit Saya',
            qrFree: '💬 Bertanya dengan Bebas',

            // Pengaturan
            settingsTitle: '⚙️ Pengaturan',
            langLabel: '🌐 Bahasa',
            currLabel: '💱 Tampilan Harga',
            voucherActive: '🏷️ Voucher Aktif',
            noVoucher: 'Tidak ada voucher aktif. Pilih kode di bawah ini:',
            btnDashboard: '📊 Dasbor Bisnis',
            btnShare: '🎁 Bagikan & Diskon',

            // Roti panggang
            toastCart: 'ditambahkan ke keranjang!',
            toastPay: 'Pembayaran Berhasil! 🎉',
            toastCamFlip: '🔄 Membalik kamera...',
            toastCamErr: 'Akses kamera gagal!',
        }
    };

    konstanta T = t[lang];

    // ── Perbarui objek terjemahan (untuk toast dll) ───────
    jika (terjemahan[lang]) {
        terjemahan[lang].toastCart = T.toastCart;
        terjemahan[lang].toastPay = T.toastPay;
        terjemahan[lang].toastCamFlip = T.toastCamFlip;
        terjemahan[lang].toastCamErr = T.toastCamErr;
    }

    // ── Pahlawan ───────────────────────────────────────────────
    const heroSub = document.querySelector('.hero-sub');
    jika (heroSub) heroSub.textContent = T.heroSub;
    const heroLabel = document.querySelector('.hero-label');
    if (heroLabel) heroLabel.textContent = T.heroLabel;

    // ── Statistik ──────────────────────────────────────────────
    document.querySelectorAll('[data-i18n="statCol"]').forEach(el => el.textContent = T.statCol);
    document.querySelectorAll('[data-i18n="statStock"]').forEach(el => el.textContent = T.statStock);

    // ── Pencarian ─────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    jika (searchInput) searchInput.placeholder = T.searchPlaceholder;

    // ── Tombol kategori ────────────────────────────────────
    const catAll = document.querySelector('[onclick*="semua"]');
    jika (catAll) catAll.textContent = T.catAll;
    const catClothes = document.querySelector('[onclick*="pakaian"]');
    jika (catClothes) catClothes.textContent = T.catClothes;

    // ── Judul Bagian ───────────────────────────────────────
    const secTitle = document.querySelector('.section-title');
    jika (secTitle) secTitle.textContent = T.secTitle;

    // ── Semua tombol produk ─────────────────────────────────
    document.querySelectorAll('.product-card').forEach(card => {
        const btns = card.querySelectorAll('.btn');
        btns.forEach(btn => {
            const txt = btn.textContent.trim();
            jika (txt.includes('Coba Live') || txt.includes('Try Live'))
                btn.textContent = T.btnTryLive;
            jika (txt.includes('Keranjang') || txt.includes('Tambahkan ke Keranjang'))
                btn.textContent = T.btnAddCart;
            else if (txt.includes('Minta Saran AI') || txt.includes('Ask AI'))
                btn.textContent = T.btnAskAI;
            jika (txt.includes('Coba Makeup') || txt.includes('Try Makeup'))
                btn.textContent = T.btnTryMakeup;
            jika (txt.includes('Coba AI') || txt.includes('Try AI'))
                btn.textContent = T.btnTryHat;
            else if (txt.includes('Analisis Kulit') || txt.includes('Skin Analysis'))
                btn.textContent = T.btnSkinAnalysis;
        });

        // Tombol coba rambut
        const hairBtn = card.querySelector('.btn-try-hair');
        jika (hairBtn && (hairBtn.textContent.includes('Coba Warna') || hairBtn.textContent.includes('Try Hair'))) {
            hairBtn.textContent = T.btnTryHair;
        }
    });

    // ── Navigasi bawah ──────────────────────────────────────────
    const navHome = document.querySelector('#nav-beranda span:last-child');
    if (navHome) navHome.textContent = T.navHome;
    const navAI = document.querySelector('#nav-ai span:last-child');
    if (navAI) navAI.textContent = T.navAI;

    // ── Halaman Keranjang ───────────────────────────────────────────
    const cartTitle = document.querySelector('.cart-page-title');
    jika cartTitle.innerHTML cartTitle = lang === 'id'
        ? 'Keranjang <span>Belanja</span>'
        : 'Keranjang Belanja';

    const cartEmpty = document.querySelector('.cart-empty-title');
    jika (cartEmpty) cartEmpty.textContent = T.cartEmpty;
    const cartEmptySub = document.querySelector('.cart-empty-sub');
    jika (cartEmptySub) cartEmptySub.textContent = T.cartEmptySub;
    const cartShopNow = document.querySelector('.cart-empty-state .btn-gold');
    jika (cartShopNow) cartShopNow.textContent = T.cartShopNow;

    const cartVoucherTitle = document.querySelector('.cart-voucher-section .cart-section-label');
    jika (cartVoucherTitle) cartVoucherTitle.innerHTML = T.voucherTitle;
    const voucherInput = document.getElementById('cart-page-promo-input');
    jika (voucherInput) voucherInput.placeholder = T.voucherInput;
    const voucherApply = document.querySelector('.voucher-apply-btn');
    jika (voucherApply) voucherApply.textContent = T.voucherApply;

    const orderSummary = document.querySelector('.cart-summary-section .cart-section-label');
    jika (orderSummary) orderSummary.innerHTML = T.orderSummary;
    const cartVA = document.querySelector('.cart-va-label');
    jika (cartVA) cartVA.textContent = T.cartVA;
    const cartPay = document.querySelector('.cart-summary-section .btn-gold');
    jika (cartPay) cartPay.textContent = T.cartPay;

    // ── Halaman Penasihat AI ─────────────────────────────────────
    const aiGreeting = document.getElementById('ai-greeting-msg');
    jika (aiGreeting) aiGreeting.innerHTML = T.aiGreeting;
    const btnAutoDetect = document.querySelector('.btn-scan');
    jika (btnAutoDetect) btnAutoDetect.textContent = T.btnAutoDetect;
    const chatInput = document.getElementById('chat-input');
    jika (chatInput) chatInput.placeholder = T.chatInput;

    const quickBtns = document.querySelectorAll('.ai-quick-btn');
    const qrKeys = ['qrMakeup','qrHair','qrFashion','qrSkin','qrFree'];
    quickBtns.forEach((btn, i) => {
        jika (qrKeys[i]) btn.textContent = T[qrKeys[i]];
    });

    // ── Laci Pengaturan ─────────────────────────────────────
    const noVoucher = document.getElementById('drawer-voucher-status');
    jika (noVoucher && !activePromoCode) noVoucher.innerHTML =
        `<span style="color:#555;">${T.noVoucher}</span>`;

    const btnDash = document.querySelector('[onclick*="openAdmin"]');
    jika (btnDash) btnDash.textContent = T.btnDashboard;
    const btnShare = document.querySelector('[onclick*="openShareDiscount"]');
    if (btnShare) btnShare.textContent = T.btnShare;

    // ── Render ulang keranjang jika sedang di halaman keranjang ─
    jika (document.getElementById('page-keranjang')?.classList.contains('active')) {
        renderCartPage();
    }
}

fungsi setCurrency(curr) {
    Mata uang saat ini = curr;
    const idrBtn = document.getElementById('curr-idr-btn');
    const usdBtn = document.getElementById('curr-usd-btn');
    jika (idrBtn) {
        idrBtn.style.borderColor = curr === 'IDR' ? '#FFD700' : 'rgba(255,255,255,0.15)';
        idrBtn.style.color = curr === 'IDR' ? '#FFD700' : '#aaa';
        idrBtn.style.background = curr === 'IDR' ? 'rgba(255,215,0,0.12)' : 'transparan';
    }
    jika (usdBtn) {
        usdBtn.style.borderColor = curr === 'USD' ? '#FFD700' : 'rgba(255,255,255,0.15)';
        usdBtn.style.color = curr === 'USD' ? '#FFD700' : '#aaa';
        usdBtn.style.background = curr === 'USD' ? 'rgba(255,215,0,0.12)' : 'transparan';
    }

    document.querySelectorAll('.product-price').forEach(el => {
        const rawPrice = parseInt(el.dataset.price || '0');
        const valEl = el.querySelector('.price-val');
        const currEl = el.querySelector('.price-currency');
        jika (!valEl || !currEl) kembali;
        jika (curr === 'USD') {
            currEl.textContent = '$';
            valEl.textContent = (rawPrice / USD_RATE).toFixed(2);
        } kalau tidak {
            currEl.textContent = 'Rp';
            valEl.textContent = formatRupiah(Harga mentah);
        }
    });
    toast(curr === 'USD' ? '💱 Harga tampil dalam USD' : '💱 Harga tampil dalam Rupiah', 'info');
}

fungsi renderDrawerVoucher() {
    const el = document.getElementById('drawer-voucher-status');
    jika (!el) kembali;
    jika (kode promo aktif && diskon aktif > 0) {
        el.innerHTML = `<span style="color:#4CAF50;font-weight:700;">✅ ${activePromoCode}</span> <span style="color:#aaa;">— Diskon ${Math.round(activeDiscount*100)}% aktif</span>
        <button onclick="activePromoCode=null;activeDiscount=0;renderDrawerVoucher();toast('Voucher dihapus.','info');" style="margin-left:8px;background:none;border:none;color:#ff4444;font-size:0.8em;cursor:pointer;">✕ Hapus</button>`;
    } kalau tidak {
        el.innerHTML = '<span style="color:#555;">Voucher sudah aktif. Pilih kode di bawah:</span>';
    }
}

// ── Pekerja Layanan ─────────────────────────────────────────────
if ('serviceWorker' di navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ SW terenkripsi:', reg.scope))
            .catch(err => console.warn('⚠️ SW gagal:', err));
    });
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    syncCartBadge();
});
// ── Efek riak ──
document.addEventListener('klik', function(e) {
  const btn = e.target.closest('.btn');
  jika (!btn) kembali;

  const circle = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  circle.style.cssText = `
    posisi:absolut;
    radius-batas:50%;
    latar belakang:rgba(255,255,255,0.25);
    lebar:${ukuran}px;tinggi:${ukuran}px;
    kiri:${e.clientX - rect.left - size/2}px;
    atas:${e.clientY - rect.top - size/2}px;
    transformasi: skala(0);
    animasi:ripple-anim 0.5s ease-out forwards;
    pointer-events:none;
  `;
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 500);
});
// ── Tambahkan kelas btn-live secara otomatis ──
setTimeout(function() {
  document.querySelectorAll('.btn-ghost').forEach(btn => {
    const teks = btn.textContent.trim();
    jika (
      teks.menyertakan('Coba Live') ||
      text.includes('Coba Langsung') ||
      teks.includes('Riasan Coba') ||
      text.includes('Coba Rias Wajah') ||
      teks.includes('Coba AI') ||
      teks.menyertakan('Coba AI') ||
      text.includes('Analisis Kulit') ||
      text.includes('Analisis Kulit') ||
      teks.include('Coba Warna')
    ) {
      btn.classList.add('btn-live');
    }
  });
}, 500);
// ── Tambahkan kelas btn-cart secara otomatis ──
setTimeout(function() {
  document.querySelectorAll('.btn-white').forEach(btn => {
    const teks = btn.textContent.trim();
    jika (
      teks.menyertakan('Keranjang') ||
      teks.menyertakan('Tambahkan ke Keranjang') ||
      teks.menyertakan('+ Keranjang')
    ) {
      btn.classList.add('btn-cart');
    }
  });
}, 500);
