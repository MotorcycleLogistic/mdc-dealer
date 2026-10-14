# Panduan Deployment MDC Dealer ke Vercel

Dokumen ini memuat panduan lengkap menghubungkan frontend **MDC Dealer (Mobile)** di **Vercel** dengan tetap memakai **Google Apps Script (GAS)** sebagai backend dan **Google Spreadsheet** sebagai database.

---

## 1. Arsitektur Terpasang

- **Frontend Mobile (Dealer)**: Di-deploy di Vercel (React 19 + TypeScript + Vite + TailwindCSS).
- **Backend API Proxy**: Vercel Serverless Function di `/api/gas` (`api/gas.ts`).
  - Mengamankan komunikasi data.
  - Mengatasi kendala CORS dan Google HTTP 302 redirect.
  - Meneruskan aksi (action) langsung ke Google Apps Script Web App.
- **Backend Core**: Google Apps Script (`Code_GAS_saat_ini.gs`).
  - `doGet(e)`: Menyajikan portal **WebMD Desktop** untuk pihak Main Dealer / Repairman.
  - `doPost(e)`: Menerima aksi dari Vercel via JSON dan membaca/menulis ke Google Sheets.
- **Frontend Desktop (Main Dealer)**: Tetap di-host di Google Apps Script (`WebMD GAS sebagai html mode desktop saat ini.html`), tidak terganggu sedikit pun.

---

## 2. Persiapan di Google Apps Script (GAS)

1. Buka project Google Apps Script Anda di [script.google.com](https://script.google.com).
2. Perbarui kode di `Code.gs` dengan file terbaru [`Code_GAS_saat_ini.gs`](./Code_GAS_saat_ini.gs) yang sudah dilengkapi aksi:
   - `checkDataVersion`
   - `getAppUrl`
   - `dealerKonfirmasiRetur`
   - `hapusKlaim`
3. Klik tombol **Deploy** > **Manage deployments** (Kelola penerapan).
4. Klik ikon pensil (Edit), pilih **New version** (Versi baru).
5. Pastikan pengaturan penerapan:
   - **Execute as (Jalankan sebagai)**: `Me (email Anda)`
   - **Who has access (Siapa yang memiliki akses)**: `Anyone (Siapa saja)`
6. Klik **Deploy** dan salin **Web App URL** Anda:
   *(Format: `https://script.google.com/macros/s/.../exec`)*.

---

## 3. Langkah Deploy ke Vercel

### Metode A: Menggunakan Vercel CLI (Paling Cepat)
1. Buka terminal di folder project ini:
   ```bash
   npx vercel
   ```
2. Ikuti instruksi di layar (pilih scope akun Anda, link to existing project: No).
3. Untuk deploy ke production:
   ```bash
   npx vercel --prod
   ```

### Metode B: Menggunakan GitHub / GitLab / Bitbucket
1. Push repository project ini ke GitHub Anda.
2. Buka dashboard [vercel.com](https://vercel.com) > **Add New Project**.
3. Import repository GitHub tersebut.
4. Pada bagian **Environment Variables**, tambahkan:
   - **`GAS_WEBAPP_URL`**: `[Paste URL Web App GAS Anda]`
   - **`VITE_GAS_URL`**: `[Paste URL Web App GAS Anda]`
5. Klik **Deploy**.

---

## 4. Pengujian Fitur Pasca Deploy

1. **Uji Frontend Mobile di Vercel**:
   - Buka URL Vercel yang telah aktif di smartphone atau browser.
   - Lakukan login / registrasi user.
   - Buat klaim baru (uji panel **DIKIRIM LANGSUNG** dan **DITITIP** sesuai aturan Panel 3 Klaim).
   - Simpan draft dan buka kembali untuk memastikan fitur **Resume Draft Dinamis (Step 1/2/3)** berfungsi.
   - Kirim ke MD.
2. **Uji Sisi Main Dealer di Desktop**:
   - Buka URL Web App Google Apps Script di desktop.
   - Pastikan klaim yang diajukan dari Vercel langsung muncul di tabel klaim Main Dealer secara real-time.
