# Bantu Beres WiFi Pro

Aplikasi operasional untuk usaha penyedia layanan WiFi. Mengelola pelanggan, paket internet, tagihan bulanan, pembayaran, dan template pesan WhatsApp dalam satu dashboard responsif.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Project Supabase sudah memiliki skema awal dari `supabase/migrations/20260928073000_initial_wifi_pro_schema.sql`. Aplikasi memakai URL project dan publishable key Supabase yang tersedia sebagai nilai default di `src/main.js`; keduanya memang digunakan oleh browser dan dilindungi oleh Row Level Security pada database. Nilai bisa diganti melalui `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.

## Fitur

- Login dan daftar melalui username + kata sandi. Username dipetakan menjadi identitas email internal di Supabase Auth; pengguna tidak perlu memasukkan alamat email.
- Semua menu operasional memakai route hash privat (contoh `#/dashboard`), dengan sesi diverifikasi melalui `auth.getUser()` dan pemisahan data per akun melalui RLS.
- Data pelanggan: kontak WhatsApp, alamat, paket, tarif, tanggal jatuh tempo, serta status layanan.
- Paket internet, tagihan bulanan tanpa duplikasi periode, pencatatan pembayaran, dan ringkasan pemasukan.
- Template pesan dengan variabel personalisasi. Tautan membuka WhatsApp dengan teks siap diperiksa dan dikirim oleh operator.
- Impor dan ekspor CSV pelanggan, tema gelap/terang, panduan penggunaan, dan layout mobile.

## Build

```bash
npm run build
```

## Pengaturan Auth untuk login tanpa email pengguna

Pada Supabase Dashboard > Authentication > Providers > Email, matikan **Confirm email** agar `signUp()` langsung mengembalikan sesi. Ini konfigurasi project Auth (bukan setting PostgreSQL/RLS) dan wajib dilakukan untuk alur username tanpa inbox email. Email internal memakai pola `<username>@wifi-users.bantuberes.com`; subdomain tersebut hanyalah alias akun, bukan email yang perlu dikonfirmasi pelanggan. Jangan nyalakan kembali konfirmasi email selama menggunakan alur ini.

Halaman publik: `#/login`, `#/register`. Halaman yang dilindungi: dashboard, pelanggan, paket, tagihan, pembayaran, pesan WhatsApp, pengaturan, dan panduan. Kunci yang dipakai di browser harus hanya publishable key; jangan pernah mengirim service_role/secret key ke klien. RLS pada database tetap menjadi kontrol akses utama meskipun route SPA menampilkan halaman login.
