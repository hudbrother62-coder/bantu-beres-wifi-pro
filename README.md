# Bantu Beres WiFi Pro

Aplikasi operasional untuk usaha penyedia layanan WiFi. Mengelola pelanggan, paket internet, tagihan bulanan, pembayaran, dan template pesan WhatsApp dalam satu dashboard responsif.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Project Supabase sudah memiliki skema awal dari `supabase/migrations/20260928073000_initial_wifi_pro_schema.sql`. Aplikasi memakai URL project dan publishable key Supabase yang tersedia sebagai nilai default di `src/main.js`; keduanya memang digunakan oleh browser dan dilindungi oleh Row Level Security pada database. Nilai bisa diganti melalui `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.

## Fitur

- Akun email dan kata sandi, dengan pemisahan data per akun melalui Supabase Auth dan RLS.
- Data pelanggan: kontak WhatsApp, alamat, paket, tarif, tanggal jatuh tempo, serta status layanan.
- Paket internet, tagihan bulanan tanpa duplikasi periode, pencatatan pembayaran, dan ringkasan pemasukan.
- Template pesan dengan variabel personalisasi. Tautan membuka WhatsApp dengan teks siap diperiksa dan dikirim oleh operator.
- Impor dan ekspor CSV pelanggan, tema gelap/terang, panduan penggunaan, dan layout mobile.

## Build

```bash
npm run build
```
