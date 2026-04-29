# LuxArc
# LuxArc AI Suite

![LuxArc Banner](https://via.placeholder.com/1200x400/000000/ffd700?text=LuxArc+AI+Suite)

## Deskripsi
**LuxArc** adalah platform asisten AI premium yang dirancang dengan estetika *luxury business*. Aplikasi ini menggabungkan kecanggihan model bahasa AI terkini dengan antarmuka yang elegan, responsif, dan didukung oleh fungsionalitas PWA (*Progressive Web App*) agar dapat diakses dengan lancar di perangkat seluler maupun desktop.

## Fitur Utama
* **Luxury Aesthetic:** Desain *glassmorphism* dengan palet warna emas dan hitam yang eksklusif.
* **AI Intelligence:** Terintegrasi dengan model AI canggih (via Groq API) untuk respons yang cepat dan akurat.
* **PWA Ready:** Dapat diinstal langsung di perangkat seluler untuk pengalaman penggunaan seperti aplikasi *native*.
* **Secure Architecture:** Implementasi keamanan tingkat lanjut untuk perlindungan API Key dan data pengguna.

## Teknologi yang Digunakan
* **Frontend:** HTML5, CSS3 (Glassmorphism Effects), JavaScript (ES6+).
* **AI Integration:** Groq API (Llama3/Dolphin-Phi).
* **Deployment:** Netlify & GitHub.

## Persiapan Pengembangan (Lokal)
Untuk menjalankan proyek ini secara lokal, ikuti langkah berikut:

1.  **Clone repositori:**
    ```bash
    git clone [https://github.com/username-mu/LuxArc.git](https://github.com/username-mu/LuxArc.git)
    cd LuxArc
    ```
2.  **Konfigurasi API Key:**
    Buat file `.env` di root folder dan tambahkan kunci API kamu:
    ```text
    GROQ_API_KEY=gsk_kunci_api_kamu_di_sini
    ```
    *Catatan: File `.env` ini secara otomatis diabaikan oleh Git untuk keamanan.*

## Deployment
Proyek ini dikonfigurasi untuk *continuous deployment* melalui **Netlify**. Saat men-deploy, pastikan untuk menambahkan **Environment Variable** berikut di dasbor Netlify:
* `GROQ_API_KEY`: [API_KEY_KAMU]

## Lisensi
Hak Cipta © 2026 Vivi Gioncyn. Proyek ini dikembangkan sebagai solusi bisnis cerdas untuk manajemen profesional.
