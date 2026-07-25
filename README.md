# SpiceGuard AI Vision: Deteksi Penyakit Daun Rempah (Zero-Shot Recognition)

Sistem web modern berbasis **Multimodal Generative AI (Google Gemini Vision API)** untuk mendeteksi penyakit dan hama pada daun tiga tanaman rempah utama: **Jahe, Kapulaga, dan Kencur**.

Proyek ini dibangun sebagai solusi alternatif canggih yang **sama sekali tidak memerlukan pengumpulan dataset lokal ataupun proses pelatihan (*training*) model CNN yang memakan waktu dan biaya besar**. Sistem langsung memanfaatkan basis pengetahuan visual global dari Google Gemini Vision untuk mengenali kondisi daun secara **Zero-Shot Recognition**.

---

## 🌟 Keunggulan Utama Arsitektur Ini (*Novelty Skripsi*)

1. **Tanpa Dataset & Tanpa Training Offline:** Tidak perlu lagi memotret ribuan daun di kebun atau melakukan anotasi manual. Aplikasi langsung pintar 100% hari ini juga!
2. **Akurasi Nyata di Lapangan:** Mampu mendiagnosis foto daun asli dengan latar belakang rumput, tangan, tanah, pencahayaan alami, atau resolusi kamera HP yang beragam tanpa kebingungan.
3. **Analisis Pakar Botani Mendalam:** Memberikan penjelasan lengkap dalam bahasa manusia:
   - Analisis visual ciri-ciri fisik daun yang sakit.
   - Identifikasi penyebab infeksi (jamur, bakteri, gulma, atau hama).
   - Resep penanganan secara organik (nabati) dan kimiawi ringan beserta dosis/cara aplikasinya agar mudah dipahami petani.
4. **Antarmuka Premium (Glassmorphism):** Didesain dengan estetika modern, mode gelap alam (*dark forest green*), micro-animations, dan visualisasi *circular progress gauge*.

---

## 🔑 Cara Mudah Mendapatkan API Key Gemini Gratis (1 Menit)

Agar aplikasi dapat melakukan diagnosis *real-time* di lapangan, Anda memerlukan **API Key gratis** dari Google. Ikuti langkah mudah berikut:

1. Buka browser dan kunjungi: **[https://aistudio.google.com/](https://aistudio.google.com/)**
2. Login menggunakan akun **Google / Gmail** biasa Anda.
3. Setelah masuk, di menu sebelah kiri (atau tombol biru di atas), klik **"Get API key"** atau **"Create API key"**.
4. Pilih **"Create API key in new project"**.
5. Dalam beberapa detik, sebuah kode panjang (dimulai dengan huruf `AIzaSy...`) akan muncul. Klik ikon **Copy (Salin)**.
6. **Selesai!** API Key Anda siap digunakan.

---

## 🚀 Cara Menggunakan Aplikasi

Ada 2 cara mudah untuk memasukkan API Key Anda ke dalam aplikasi:

### Cara 1: Melalui Antarmuka Web UI (Sangat Direkomendasikan untuk Sidang Skripsi)
1. Buka halaman web frontend di browser.
2. Klik menu **"🔑 Pengaturan API Key Gemini AI"** di bagian atas halaman.
3. Tempelkan (*paste*) API Key yang sudah Anda salin ke kolom input yang tersedia.
4. Klik tombol **"Simpan Key"**.
5. API Key tersimpan dengan aman di browser Anda. Sekarang, setiap foto yang diunggah akan langsung dianalisis oleh AI Google Gemini Vision secara *Real-Time*!

### Cara 2: Melalui File Environment Variable di Server (`.env`)
1. Buat berkas baru bernama `.env` di dalam folder root atau folder `backend/`.
2. Isi berkas tersebut dengan:
   ```env
   GEMINI_API_KEY=AIzaSyKodeKeyAndaYangPanjangDisini
   ```
3. Jalankan server backend, maka server otomatis mendeteksi API Key tersebut.

*(Catatan: Jika API Key belum dimasukkan sama sekali, aplikasi tetap bisa berjalan dengan aman dalam **Mode Simulasi / Mockup** untuk pengujian tampilan antarmuka).*

---

## 🛠️ Stack Teknologi & Dependensi

* **Backend Engine:** Python 3.10+, FastAPI, Uvicorn (ASGI Server), Pydantic.
* **AI Vision Engine:** Google GenAI SDK (`google-generativeai`), Model `gemini-1.5-flash` (Multimodal Vision).
* **Image Processing:** Pillow (PIL).
* **Frontend UI:** HTML5 Semantic, Vanilla CSS3 (Glassmorphism & CSS Variables), Vanilla JavaScript (Async Fetch & Local Storage API).

---

## 📥 Cara Menjalankan Proyek di Komputer Lokal

### 1. Persiapan Environment & Install Dependensi
Buka terminal (Command Prompt / PowerShell / VS Code Terminal), lalu instal dependensi super ringan proyek ini:

```bash
pip install -r requirements.txt
```

### 2. Jalankan Server Backend (FastAPI)
Masuk ke direktori backend dan aktifkan server lokal:

```bash
cd backend
python main.py
```
*(Server akan berjalan di `http://127.0.0.1:8000`. Dokumentasi interaktif Swagger UI dapat diakses di `http://127.0.0.1:8000/docs`).*

### 3. Buka Halaman Frontend
Anda cukup membuka berkas `index.html` langsung dari folder `frontend/` ke dalam browser Anda (Chrome / Firefox / Edge), atau gunakan ekstensi **Live Server** di VS Code.

---

## 📋 Contoh Hasil Keluaran JSON API (`POST /predict`)

Ketika frontend mengirimkan gambar daun ke endpoint `/predict`, backend akan membalas dengan struktur JSON berformat:

```json
{
  "status": "success",
  "plant": "Jahe",
  "class_name": "Bercak Daun",
  "confidence": 0.9642,
  "recommendation": "Terdeteksi gejala Bercak Daun pada daun Jahe. Pada foto terlihat bercak kuning kecokelatan yang membesar dengan tepi gelap. Rekomendasi: 1) Segera pangkas dan musnahkan daun yang terinfeksi, 2) Semprotkan fungisida nabati (ekstrak daun mimba) atau fungisida berbahan aktif mankozeb seminggu sekali, 3) Jaga drainase tanah agar tidak lembap berlebih.",
  "is_mock": false
}
```

---
*Dibuat oleh **Rivalram** (Tugas Akhir S1 Teknik Informatika) - 2026.*
