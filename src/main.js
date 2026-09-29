import { createClient } from '@supabase/supabase-js';
import './style.css';
import { downloadCustomerTemplate, exportCustomerData, readCustomerFile, validateCustomerRows } from './customer-transfer.js';

const cfg = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://ypekuhwyjvyyzvedncqh.supabase.co',
  key: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lW5aaP9gPZh8flBAB4Hvug_Z_sC46yq'
};
const supabase = cfg.url && cfg.key ? createClient(cfg.url, cfg.key) : null;
const app = document.querySelector('#app');
const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
const dateFmt = d => d ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${String(d).slice(0,10)}T00:00:00`)) : '—';
const monthFmt = d => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${String(d).slice(0,7)}-01T00:00:00`));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = new Date().toISOString().slice(0,10);
const periodNow = `${today.slice(0,7)}-01`;
const state = { user: null, profile: null, page: 'dashboard', customers: [], packages: [], invoices: [], payments: [], templates: [], search: '', modal: null, theme: localStorage.getItem('wifi-theme') || 'light', loading: false, period: periodNow, authChecked: false };
state.importDraft=null;
document.documentElement.dataset.theme = state.theme;

const brand = `<span class="brand-mark"><img src="/bantu-beres-icon.svg" alt="Logo Bantu Beres" width="46" height="52" /></span>`;
const nav = [ ['dashboard','Ringkasan','▦'], ['customers','Pelanggan','♙'], ['packages','Paket internet','◉'], ['invoices','Tagihan','▤'], ['payments','Pembayaran','↗'], ['messages','Pesan WhatsApp','◌'] ];

function toast(message, kind='success') { const el=document.createElement('div'); el.className=`toast ${kind}`; el.textContent=message; document.body.append(el); setTimeout(()=>el.remove(),3200); }
function initials(name='Bantu Beres') { return name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(); }
function loadingView() { return `<main class="loading-screen"><div class="spinner"></div><p>Menyiapkan ruang kerja WiFi Pro…</p></main>`; }
function authView() {
  if (!supabase) return `<main class="auth-layout"><section class="auth-art"><div class="auth-brand">${brand}<div><b>Bantu Beres</b><span>WiFi Pro</span></div></div><div class="art-copy"><span class="eyebrow">OPERASIONAL WIFI DALAM SATU TEMPAT</span><h1>Pelanggan terdata.<br><span>Tagihan terkendali.</span></h1><p>Rapikan layanan internet Anda: dari data pelanggan sampai pesan pengingat, semua lebih mudah dipantau.</p><div class="art-chips"><span>Data pelanggan</span><span>Tagihan bulanan</span><span>Pesan WhatsApp</span></div></div><div class="art-bottom">Bantu Beres WiFi Pro <span>•</span> Kelola usaha dengan lebih ringan</div></section><section class="auth-side"><button type="button" class="icon-button theme-toggle auth-theme-toggle" title="Ganti tema" aria-label="Ganti tema">${state.theme==='light'?'☾':'☼'}</button><div class="auth-mobile-brand">${brand}<b>Bantu Beres WiFi Pro</b></div><div class="auth-card"><span class="eyebrow">MULAI DARI SINI</span><h2>Hubungkan database</h2><p>Konfigurasi Supabase belum terpasang. Tambahkan URL dan publishable key sebagai environment variable Vercel.</p><div class="setup-note"><b>Environment variables</b><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code><span>Setelah ditambahkan, build ulang aplikasi.</span></div></div><footer>© ${new Date().getFullYear()} Bantu Beres</footer></section></main>`;
  return `<main class="auth-layout"><section class="auth-art"><div class="auth-brand">${brand}<div><b>Bantu Beres</b><span>WiFi Pro</span></div></div><div class="art-copy"><span class="eyebrow">OPERASIONAL WIFI DALAM SATU TEMPAT</span><h1>Pelanggan terdata.<br><span>Tagihan terkendali.</span></h1><p>Rapikan layanan internet Anda: dari data pelanggan sampai pesan pengingat, semua lebih mudah dipantau.</p><div class="art-chips"><span>Data pelanggan</span><span>Tagihan bulanan</span><span>Pesan WhatsApp</span></div></div><div class="art-bottom">Bantu Beres WiFi Pro <span>•</span> Kelola usaha dengan lebih ringan</div></section><section class="auth-side"><button type="button" class="icon-button theme-toggle auth-theme-toggle" title="Ganti tema" aria-label="Ganti tema">${state.theme==='light'?'☾':'☼'}</button><div class="auth-mobile-brand">${brand}<b>Bantu Beres WiFi Pro</b></div><div class="auth-card"><span class="eyebrow">SELAMAT DATANG</span><h2 id="auth-title">Masuk ke akun</h2><p id="auth-desc">Kelola layanan WiFi Anda dengan lebih rapi.</p><form id="auth-form"><label>Username<input type="text" name="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]{3,32}" title="Gunakan 3–32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung." placeholder="contoh: kepsek" autocomplete="username"></label><small class="field-note">Masuk dengan username dan kata sandi, tanpa email.</small><label>Kata sandi<input type="password" name="password" required minlength="6" placeholder="Minimal 6 karakter" autocomplete="current-password"></label><div class="auth-extra" id="signup-extra" hidden><label>Nama usaha<input name="business" placeholder="Contoh: WiFi Berkah"></label><label>Nama pemilik<input name="owner" placeholder="Nama Anda"></label></div><button class="btn primary full" id="auth-submit">Masuk</button></form><div class="auth-switch"><span id="auth-switch-text">Belum punya akun?</span> <button type="button" class="text-button" id="auth-switch">Daftar sekarang</button></div><div class="secure-note"><span>●</span> Data usaha Anda terlindungi per akun</div></div><footer>© ${new Date().getFullYear()} Bantu Beres</footer></section></main>`;
}

function statusPill(status) { const map={active:['Aktif','green'],isolated:['Terisolir','amber'],inactive:['Nonaktif','gray'],paid:['Lunas','green'],unpaid:['Belum bayar','red'],partial:['Sebagian','amber']}; const [label,color]=map[status]||[status,'gray']; return `<span class="pill ${color}">${label}</span>`; }
function shell() {
  const activeCustomers=state.customers.filter(c=>c.status==='active').length;
  const unpaid=state.invoices.filter(i=>i.status!=='paid');
  const currentPayments=state.payments.filter(p=>String(p.paid_at).slice(0,7)===today.slice(0,7)).reduce((a,p)=>a+Number(p.amount),0);
  return `<div class="app-shell"><aside class="sidebar"><div class="side-brand">${brand}<div><b>Bantu Beres</b><span>WiFi Pro</span></div></div><div class="workspace-card"><span class="workspace-icon">${initials(state.profile?.business_name)}</span><div><b>${esc(state.profile?.business_name||'WiFi Saya')}</b><span>Ruang kerja</span></div><span class="chevron">⌄</span></div><span class="nav-caption">MENU UTAMA</span><nav class="side-nav">${nav.map(([id,label,icon])=>`<button class="nav-item ${state.page===id?'selected':''}" data-page="${id}"><span class="nav-icon">${icon}</span><span>${label}</span>${id==='invoices'&&unpaid.length?`<small>${unpaid.length}</small>`:''}</button>`).join('')}</nav><div class="side-bottom"><button class="nav-item ${state.page==='settings'?'selected':''}" data-page="settings"><span class="nav-icon">⚙</span><span>Pengaturan</span></button><div class="side-help"><div class="help-icon">?</div><b>Perlu bantuan?</b><span>Panduan WiFi Pro</span><button data-page="guide">Lihat panduan <span>→</span></button></div><div class="user-card"><span class="avatar">${initials(state.profile?.owner_name||state.user.email)}</span><div class="user-meta"><b>${esc(state.profile?.owner_name||'Pemilik')}</b><span>${esc(state.user.user_metadata?.username||state.user.email)}</span></div><button class="icon-button logout" title="Keluar" aria-label="Keluar">↪</button></div></div></aside><div class="main-column"><header class="topbar"><button class="icon-button mobile-menu" aria-label="Buka menu">☰</button><div class="breadcrumbs">Bantu Beres <span>/</span> <b>${nav.find(n=>n[0]===state.page)?.[1]|| (state.page==='guide'?'Panduan':'Pengaturan')}</b></div><div class="top-actions"><span class="today-label">${new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span><button class="icon-button theme-toggle" title="Ganti tema">${state.theme==='light'?'☾':'☼'}</button><button class="help-top" data-page="guide">Panduan</button></div></header><main class="content">${pageContent()}</main></div><nav class="mobile-nav">${nav.filter(n=>['dashboard','customers','invoices','payments','messages'].includes(n[0])).map(([id,label,icon])=>`<button class="${state.page===id?'selected':''}" data-page="${id}"><span>${icon}</span><small>${label==='Pelanggan'?'Data':label==='Pembayaran'?'Bayar':label==='Pesan WhatsApp'?'Pesan':label==='Ringkasan'?'Beranda':'Tagihan'}</small></button>`).join('')}<button data-page="settings" class="${state.page==='settings'?'selected':''}"><span>⚙</span><small>Pengaturan</small></button></nav></div>${state.modal?modalView():''}`;
}
function pageHead(kicker,title,description,action='') { return `<div class="page-head"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`; }
function pageContent() {
 if(state.page==='dashboard') return dashboard();
 if(state.page==='customers') return customerPage();
 if(state.page==='packages') return packagePage();
 if(state.page==='invoices') return invoicePage();
 if(state.page==='payments') return paymentsPage();
 if(state.page==='messages') return messagePage();
 if(state.page==='settings') return settingsPage();
 if(state.page==='guide') return guidePage();
 return dashboard();
}
function dashboard() {
 const activeCustomers=state.customers.filter(c=>c.status==='active').length;
 const currentPayments=state.payments.filter(p=>String(p.paid_at).slice(0,7)===today.slice(0,7)).reduce((sum,p)=>sum+Number(p.amount),0);
 const open=state.invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+Number(i.amount),0);
 const late=state.invoices.filter(i=>i.status!=='paid'&&i.due_date<today).length;
 const latest=[...state.payments].sort((a,b)=>new Date(b.paid_at)-new Date(a.paid_at)).slice(0,5);
 const due=state.invoices.filter(i=>i.status!=='paid').sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,5);
 return `${pageHead('RINGKASAN USAHA',`Halo, ${esc((state.profile?.owner_name||'Teman').split(' ')[0])} 👋`,`Ini ringkasan layanan WiFi Anda hari ini.`,`<button class="btn primary" data-action="generate-invoices">＋ Buat tagihan bulanan</button>`)}<div class="welcome-strip"><div class="welcome-mark">${brand}</div><div><b>${esc(state.profile?.business_name||'WiFi Saya')}</b><span>Pantau pelanggan, pembayaran, dan layanan dari satu tempat.</span></div><button class="text-button" data-page="settings">Atur profil usaha →</button></div><section class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Total pelanggan aktif</span><span class="stat-icon purple">♙</span></div><strong>${activeCustomers}</strong><small>dari ${state.customers.length} pelanggan terdata</small></article><article class="stat-card"><div class="stat-top"><span>Pemasukan bulan ini</span><span class="stat-icon blue">↗</span></div><strong>${money(currentPayments)}</strong><small>Pembayaran tercatat bulan ini</small></article><article class="stat-card"><div class="stat-top"><span>Tagihan belum lunas</span><span class="stat-icon amber">▤</span></div><strong>${money(open)}</strong><small>${state.invoices.filter(i=>i.status!=='paid').length} tagihan menunggu pembayaran</small></article><article class="stat-card"><div class="stat-top"><span>Tagihan terlambat</span><span class="stat-icon red">◷</span></div><strong>${late}</strong><small>Perlu tindak lanjut pelanggan</small></article></section><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Tagihan perlu ditindaklanjuti</h2><p>Prioritaskan tagihan yang jatuh tempo lebih dulu.</p></div><button class="text-button" data-page="invoices">Semua tagihan →</button></div>${due.length?`<div class="table-wrap"><table><thead><tr><th>Pelanggan</th><th>Jatuh tempo</th><th>Jumlah</th><th>Status</th><th></th></tr></thead><tbody>${due.map(i=>{const c=state.customers.find(x=>x.id===i.customer_id);return `<tr><td><b>${esc(c?.full_name||'Pelanggan')}</b><small>${esc(c?.phone||'')}</small></td><td>${dateFmt(i.due_date)}</td><td>${money(i.amount)}</td><td>${statusPill(i.status)}</td><td><button class="mini-action" data-message-invoice="${i.id}" title="Kirim pengingat WhatsApp">↗</button></td></tr>`}).join('')}</tbody></table></div>`:`<div class="empty-state"><span class="empty-icon">✓</span><b>Belum ada tagihan tertunggak</b><p>Tagihan yang perlu ditindaklanjuti muncul di sini.</p></div>`}</section><section class="panel"><div class="panel-head"><div><h2>Pembayaran terbaru</h2><p>Aktivitas pembayaran terakhir.</p></div><button class="text-button" data-page="payments">Lihat semua →</button></div>${latest.length?`<div class="activity-list">${latest.map(p=>{const c=state.customers.find(x=>x.id===p.customer_id);return `<div class="activity-row"><span class="activity-check">✓</span><div><b>${esc(c?.full_name||'Pelanggan')}</b><span>${dateFmt(String(p.paid_at).slice(0,10))} · ${esc(p.method||'Tunai')}</span></div><strong>${money(p.amount)}</strong></div>`}).join('')}</div>`:`<div class="empty-state compact"><span class="empty-icon">↗</span><b>Belum ada pembayaran</b><p>Catat pembayaran pertama Anda.</p><button class="btn secondary small" data-modal="payment">Catat pembayaran</button></div>`}</section></div><div class="quick-row"><button class="quick-card" data-modal="customer"><span class="quick-icon purple">＋</span><span><b>Tambah pelanggan</b><small>Catat pelanggan baru</small></span><span class="quick-arrow">→</span></button><button class="quick-card" data-modal="package"><span class="quick-icon blue">◉</span><span><b>Tambah paket</b><small>Atur pilihan layanan</small></span><span class="quick-arrow">→</span></button><button class="quick-card" data-action="export-customers"><span class="quick-icon green">↓</span><span><b>Ekspor data</b><small>Unduh data pelanggan</small></span><span class="quick-arrow">→</span></button></div>`;
}
function toolbar(placeholder, action, label) {
 return `<div class="table-toolbar customer-transfer-toolbar">
   <label class="searchbox"><span>⌕</span><input id="table-search" placeholder="${placeholder}" value="${esc(state.search)}"></label>
   <div class="toolbar-actions transfer-actions">
     <button class="btn secondary" data-template-format="csv" type="button">↓ Template CSV</button>
     <button class="btn secondary" data-template-format="xlsx" type="button">↓ Template Excel</button>
     <button class="btn secondary" data-export-format="csv" type="button">↧ Ekspor CSV</button>
     <button class="btn secondary" data-export-format="xlsx" type="button">↧ Ekspor Excel</button>
     <label class="btn secondary file-button">↑ <span>Impor CSV / Excel</span><input type="file" id="customer-import-file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
     <button class="btn primary" data-modal="${action}" type="button">＋ ${label}</button>
   </div>
  </div><div class="transfer-help">Isi file menggunakan template resmi. Paket harus sudah dibuat di menu Paket internet; harga akan mengikuti harga paket. Sebelum impor, sistem menampilkan pratinjau dan memeriksa format data.</div>`;
}
function customerPage() {
 const q=state.search.toLowerCase(); const rows=state.customers.filter(c=>`${c.full_name} ${c.phone} ${c.address}`.toLowerCase().includes(q));
 return `${pageHead('DATA LAYANAN','Pelanggan','Simpan kontak dan informasi layanan setiap pelanggan.',`<button class="btn primary" data-modal="customer">＋ Tambah pelanggan</button>`)}<div class="summary-line"><span class="summary-count"><b>${state.customers.length}</b> pelanggan terdata</span><div class="status-legend"><span>Aktif <b>${state.customers.filter(c=>c.status==='active').length}</b></span><span>Terisolir <b>${state.customers.filter(c=>c.status==='isolated').length}</b></span><span>Nonaktif <b>${state.customers.filter(c=>c.status==='inactive').length}</b></span></div></div>${toolbar('Cari nama, nomor, atau alamat…','customer','Tambah pelanggan')}<section class="panel table-panel"><div class="table-wrap"><table><thead><tr><th>PELANGGAN</th><th>PAKET</th><th>TAGIHAN / BULAN</th><th>JATUH TEMPO</th><th>STATUS</th><th></th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr><td><div class="person-cell"><span class="avatar">${initials(c.full_name)}</span><span><b>${esc(c.full_name)}</b><small>${esc(c.phone||'Nomor belum diisi')}</small></span></div></td><td>${esc(state.packages.find(p=>p.id===c.package_id)?.name||'—')}</td><td><b>${money(c.monthly_price)}</b></td><td>Tanggal ${c.due_day}</td><td>${statusPill(c.status)}</td><td><div class="row-actions"><button title="Pesan WhatsApp" data-message-customer="${c.id}">↗</button><button title="Edit" data-edit="customer:${c.id}">✎</button><button title="Hapus" data-delete="customer:${c.id}">×</button></div></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty-state"><b>${q?'Data tidak ditemukan':'Belum ada pelanggan'}</b><p>${q?'Coba kata kunci lain.':'Tambahkan pelanggan untuk mulai mengelola layanan.'}</p></div></td></tr>`}</tbody></table></div></section>`;
}
function packagePage() {
 return `${pageHead('LAYANAN','Paket internet','Atur paket dan harga layanan yang Anda tawarkan.',`<button class="btn primary" data-modal="package">＋ Tambah paket</button>`)}<div class="package-grid">${state.packages.length?state.packages.map(p=>`<article class="package-card"><div class="package-top"><span class="package-symbol">◉</span><button class="more-button" data-edit="package:${p.id}">✎</button></div><h2>${esc(p.name)}</h2><div class="package-speed">${esc(p.speed||'Kecepatan belum diatur')}</div><div class="package-price">${money(p.monthly_price)}<span> / bulan</span></div><p>${esc(p.description||'Paket internet bulanan')}</p><div class="package-bottom"><span>${state.customers.filter(c=>c.package_id===p.id&&c.status==='active').length} pelanggan aktif</span>${statusPill(p.is_active?'active':'inactive')}<button title="Hapus paket" data-delete="package:${p.id}">×</button></div></article>`).join(''):`<div class="panel empty-state package-empty"><span class="empty-icon">◉</span><b>Belum ada paket internet</b><p>Tambahkan pilihan paket beserta harga bulanannya.</p><button class="btn primary" data-modal="package">＋ Buat paket pertama</button></div>`}</div>`;
}
function invoicePage() {
 const q=state.search.toLowerCase(); const rows=state.invoices.filter(i=>{const c=state.customers.find(x=>x.id===i.customer_id);return `${c?.full_name} ${c?.phone} ${i.status}`.toLowerCase().includes(q)}).sort((a,b)=>b.period.localeCompare(a.period)||a.due_date.localeCompare(b.due_date));
 return `${pageHead('PENAGIHAN','Tagihan pelanggan','Buat tagihan bulanan dan pantau status pembayaran.',`<button class="btn primary" data-action="generate-invoices">＋ Buat tagihan bulanan</button>`)}<div class="invoice-summary"><div><span>Belum lunas</span><b>${money(state.invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+Number(i.amount),0))}</b></div><div><span>Lunas</span><b>${state.invoices.filter(i=>i.status==='paid').length} tagihan</b></div><div><span>Total tagihan</span><b>${state.invoices.length}</b></div></div><div class="table-toolbar"><label class="searchbox"><span>⌕</span><input id="table-search" placeholder="Cari pelanggan…" value="${esc(state.search)}"></label><div class="toolbar-actions"><label class="period-picker"><span>Periode</span><input type="month" id="invoice-period" value="${state.period.slice(0,7)}"></label></div></div><section class="panel table-panel"><div class="table-wrap"><table><thead><tr><th>PELANGGAN</th><th>PERIODE</th><th>JATUH TEMPO</th><th>JUMLAH</th><th>STATUS</th><th></th></tr></thead><tbody>${rows.length?rows.map(i=>{const c=state.customers.find(x=>x.id===i.customer_id);return `<tr><td><div class="person-cell"><span class="avatar">${initials(c?.full_name||'?')}</span><span><b>${esc(c?.full_name||'Pelanggan')}</b><small>${esc(c?.phone||'')}</small></span></div></td><td>${monthFmt(i.period)}</td><td>${dateFmt(i.due_date)}</td><td><b>${money(i.amount)}</b></td><td>${statusPill(i.status)}</td><td><div class="row-actions">${i.status!=='paid'?`<button title="Catat lunas" data-pay-invoice="${i.id}">✓</button><button title="Kirim pengingat WhatsApp" data-message-invoice="${i.id}">↗</button>`:''}<button title="Hapus" data-delete="invoice:${i.id}">×</button></div></td></tr>`}).join(''):`<tr><td colspan="6"><div class="empty-state"><b>Belum ada tagihan untuk ditampilkan</b><p>Gunakan tombol “Buat tagihan bulanan” untuk membuat tagihan pelanggan aktif.</p></div></td></tr>`}</tbody></table></div></section>`;
}
function paymentsPage() {
 const rows=[...state.payments].sort((a,b)=>new Date(b.paid_at)-new Date(a.paid_at)); const total=rows.filter(p=>String(p.paid_at).slice(0,7)===today.slice(0,7)).reduce((s,p)=>s+Number(p.amount),0);
 return `${pageHead('ARUS KAS','Pembayaran','Catat uang masuk dan lihat riwayat pembayaran.',`<button class="btn primary" data-modal="payment">＋ Catat pembayaran</button>`)}<div class="invoice-summary"><div><span>Pemasukan bulan ini</span><b>${money(total)}</b></div><div><span>Transaksi bulan ini</span><b>${rows.filter(p=>String(p.paid_at).slice(0,7)===today.slice(0,7)).length}</b></div><div><span>Total transaksi</span><b>${rows.length}</b></div></div><section class="panel table-panel"><div class="panel-head"><div><h2>Riwayat pembayaran</h2><p>Semua pembayaran yang dicatat pada akun ini.</p></div><label class="searchbox"><span>⌕</span><input id="table-search" placeholder="Cari pelanggan…" value="${esc(state.search)}"></label></div><div class="table-wrap"><table><thead><tr><th>PELANGGAN</th><th>TANGGAL</th><th>METODE</th><th>CATATAN</th><th>JUMLAH</th></tr></thead><tbody>${rows.length?rows.map(p=>`<tr><td><b>${esc(state.customers.find(c=>c.id===p.customer_id)?.full_name||'Pelanggan')}</b></td><td>${dateFmt(String(p.paid_at).slice(0,10))}</td><td>${esc(p.method||'Tunai')}</td><td>${esc(p.note||'—')}</td><td><b class="positive">+ ${money(p.amount)}</b></td></tr>`).join(''):`<tr><td colspan="5"><div class="empty-state"><b>Belum ada pembayaran tercatat</b><p>Pembayaran yang Anda catat akan tampil di sini.</p></div></td></tr>`}</tbody></table></div></section>`;
}
function messagePage() {
 return `${pageHead('KOMUNIKASI','Pesan WhatsApp','Pilih pelanggan, siapkan pesan, lalu kirim langsung melalui WhatsApp.',`<button class="btn primary" data-modal="template">＋ Buat template</button>`)}<div class="message-layout"><section class="panel message-compose"><div class="panel-head"><div><h2>Kirim pesan ke pelanggan</h2><p>Pesan terbuka di WhatsApp agar Anda bisa memeriksanya sebelum dikirim.</p></div><span class="wa-badge">WA</span></div><label>Pilih pelanggan<select id="message-customer"><option value="">Pilih pelanggan…</option>${state.customers.filter(c=>c.phone).map(c=>`<option value="${c.id}">${esc(c.full_name)} · ${esc(c.phone)}</option>`).join('')}</select></label><label>Gunakan template<select id="message-template"><option value="">Tulis pesan sendiri</option>${state.templates.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></label><label>Isi pesan<textarea id="message-body" rows="6" placeholder="Halo {nama}, kami mengingatkan bahwa…"></textarea><small class="field-hint">Variabel tersedia: {nama}, {usaha}, {paket}, {tagihan}</small></label><button class="btn whatsapp full" data-action="send-message">Buka WhatsApp ↗</button><div class="send-note">WhatsApp akan terbuka dengan pesan terisi. Tekan kirim di aplikasi WhatsApp Anda.</div></section><section class="panel templates-panel"><div class="panel-head"><div><h2>Template pesan</h2><p>Simpan pesan yang sering digunakan.</p></div></div>${state.templates.length?state.templates.map(t=>`<article class="template-card"><div><span class="template-type">${esc(t.category)}</span><b>${esc(t.title)}</b></div><p>${esc(t.message)}</p><div><button class="text-button" data-edit="template:${t.id}">Edit</button><button class="text-button danger-text" data-delete="template:${t.id}">Hapus</button></div></article>`).join(''):`<div class="empty-state compact"><span class="empty-icon">◌</span><b>Template belum tersedia</b><p>Buat template pengingat agar mengirim pesan lebih praktis.</p><button class="btn secondary small" data-modal="template">＋ Tambah template</button></div>`}</section></div>`;
}
function settingsPage() {
 const p=state.profile||{};
 const input=(label,key,{type='text',placeholder='',required=false,wide=false,maxlength=120,hint=''}={})=>`<label class="${wide?'wide':''}">${label}<input type="${type}" name="${key}" maxlength="${maxlength}" value="${esc(p[key]||'')}" placeholder="${esc(placeholder)}" ${required?'required':''}>${hint?`<small class="field-hint">${hint}</small>`:''}</label>`;
 const area=(label,key,placeholder,maxlength=500)=>`<label class="wide">${label}<textarea name="${key}" rows="3" maxlength="${maxlength}" placeholder="${esc(placeholder)}">${esc(p[key]||'')}</textarea></label>`;
 const username=state.user.user_metadata?.username||state.user.email?.split('@')[0]||'—';
 const essentials=['business_name','owner_name','business_whatsapp','business_address','business_city','service_area'];
 const completed=essentials.filter(key=>String(p[key]||'').trim()).length;
 return `${pageHead('PREFERENSI','Pengaturan usaha','Lengkapi identitas pemilik dan bisnis agar informasi usaha lebih rapi dan mudah ditemukan.','')}
 <div class="settings-layout">
   <section class="panel settings-panel expanded-settings">
     <div class="settings-heading"><div class="settings-heading-icon">⚙</div><div><span class="eyebrow">PROFIL & IDENTITAS</span><h2>Informasi pengguna dan bisnis</h2><p>Semua detail tersimpan pada profil akun Anda. Kolom selain nama usaha bersifat opsional.</p></div></div>
     <form id="settings-form" class="settings-form">
       <section class="settings-group"><div class="settings-group-title"><span class="settings-step">01</span><div><h3>Informasi pengguna</h3><p>Identitas pemilik atau pengelola utama usaha WiFi.</p></div></div>
         <div class="settings-fields">
           ${input('Nama pemilik / pengelola','owner_name',{placeholder:'Nama lengkap'})}
           ${input('Jabatan / peran','owner_role',{placeholder:'Contoh: Pemilik / Admin'})}
           ${input('Nomor HP pribadi','owner_phone',{type:'tel',placeholder:'08xxxxxxxxxx',maxlength:25})}
           <label>Username untuk masuk<input type="text" value="${esc(username)}" readonly class="readonly-field"><small class="field-hint">Hanya ditampilkan. Mengubah profil tidak mengganti username atau kata sandi.</small></label>
         </div>
       </section>
       <section class="settings-group"><div class="settings-group-title"><span class="settings-step">02</span><div><h3>Identitas bisnis</h3><p>Kontak dan informasi utama layanan internet.</p></div></div>
         <div class="settings-fields">
           ${input('Nama usaha / brand','business_name',{placeholder:'Contoh: WiFi Berkah',required:true})}
           <label>Jenis usaha<input name="business_type" list="business-type-options" maxlength="80" value="${esc(p.business_type||'')}" placeholder="Pilih atau tulis jenis usaha"><datalist id="business-type-options"><option value="RT/RW Net"></option><option value="Penyedia Internet"></option><option value="Reseller WiFi"></option><option value="Hotspot / Voucher"></option></datalist></label>
           ${input('Nomor telepon bisnis','business_phone',{type:'tel',placeholder:'Nomor layanan pelanggan',maxlength:25})}
           ${input('WhatsApp bisnis','business_whatsapp',{type:'tel',placeholder:'08xxxxxxxxxx',maxlength:25})}
           ${input('Email bisnis','business_email',{type:'email',placeholder:'kontak@bisnis.com',maxlength:160})}
           ${input('Website bisnis','business_website',{type:'url',placeholder:'https://contoh.com',maxlength:220})}
           ${input('Kode negara WhatsApp','whatsapp_country_code',{placeholder:'62',maxlength:5,hint:'Gunakan 62 untuk nomor Indonesia pada tautan WhatsApp.'})}
           ${input('Jam operasional','operating_hours',{placeholder:'Senin–Sabtu, 08.00–21.00',maxlength:120})}
           ${area('Deskripsi singkat usaha','business_description','Layanan atau keunggulan usaha Anda.',500)}
         </div>
       </section>
       <section class="settings-group"><div class="settings-group-title"><span class="settings-step">03</span><div><h3>Alamat dan jangkauan</h3><p>Lokasi operasional dan wilayah layanan pelanggan.</p></div></div>
         <div class="settings-fields">
           ${area('Alamat usaha','business_address','Jalan, nomor, RT/RW, dan patokan.',300)}
           ${input('Desa / Kelurahan','business_village',{placeholder:'Nama desa atau kelurahan'})}
           ${input('Kecamatan','business_district',{placeholder:'Nama kecamatan'})}
           ${input('Kota / Kabupaten','business_city',{placeholder:'Contoh: Malang'})}
           ${input('Provinsi','business_province',{placeholder:'Contoh: Jawa Timur'})}
           ${input('Kode pos','business_postal_code',{placeholder:'65100',maxlength:10})}
           ${area('Area layanan / cakupan jaringan','service_area','Contoh: Sawojajar, Mangliawan, dan sekitarnya.',350)}
         </div>
       </section>
       <section class="settings-group"><div class="settings-group-title"><span class="settings-step">04</span><div><h3>Informasi pembayaran</h3><p>Opsional, untuk mempermudah pencatatan dan penyusunan pesan pembayaran.</p></div></div>
         <div class="settings-fields">
           ${input('Nama bank / penyedia pembayaran','bank_name',{placeholder:'Contoh: BRI, BCA, DANA'})}
           ${input('Nomor rekening / akun pembayaran','bank_account_number',{placeholder:'Nomor rekening atau e-wallet',maxlength:60})}
           ${input('Atas nama','bank_account_holder',{placeholder:'Nama penerima'})}
           ${area('Petunjuk pembayaran','payment_instructions','Contoh: Kirim bukti transfer ke WhatsApp admin.',350)}
         </div>
       </section>
       <div class="settings-save"><p>Perubahan tersimpan di akun dan dapat diedit kapan saja.</p><button class="btn primary" type="submit">✓ Simpan perubahan</button></div>
     </form>
   </section>
   <aside class="settings-side">
     <section class="panel preferences-card"><h2>Tampilan aplikasi</h2><p>Pilih tema yang nyaman digunakan.</p><div class="theme-options"><button class="theme-option ${state.theme==='light'?'chosen':''}" data-theme-set="light"><span>☼</span><b>Terang</b></button><button class="theme-option ${state.theme==='dark'?'chosen':''}" data-theme-set="dark"><span>☾</span><b>Gelap</b></button></div><hr><h2>Keamanan data</h2><p>Informasi profil hanya dapat diakses oleh pemilik akun melalui perlindungan database.</p><span class="security-chip">✓ Perlindungan aktif</span></section>
     <section class="panel profile-progress"><span class="eyebrow">KELENGKAPAN PROFIL</span><strong>${completed} dari ${essentials.length} informasi utama</strong><div class="profile-progress-track"><span style="width:${completed/essentials.length*100}%"></span></div><p>Lengkapi nama usaha, pemilik, WhatsApp bisnis, alamat, kota, dan area layanan.</p></section>
   </aside>
 </div>`;
}
function guidePage() {
 const steps=[['01','Siapkan paket internet','Buat daftar paket dan harga bulanan agar mudah dipilih saat menambahkan pelanggan.'],['02','Catat pelanggan','Masukkan nama, nomor WhatsApp, alamat, paket, tarif, dan tanggal jatuh tempo.'],['03','Buat tagihan bulanan','Pilih bulan yang ditagihkan. Sistem membuat satu tagihan untuk setiap pelanggan aktif yang belum memiliki tagihan periode tersebut.'],['04','Catat pembayaran','Tandai tagihan lunas melalui tombol centang atau catat pembayaran dengan metode dan tanggal.'],['05','Kirim pengingat','Pilih pelanggan dan template. Pesan akan dibuka di WhatsApp untuk Anda periksa lalu kirim sendiri.'],['06','Impor dan ekspor data','Unduh template CSV/Excel terlebih dahulu, isi sheet Pelanggan, lalu impor CSV/XLSX. Periksa pratinjau sebelum menyimpan. Harga mengikuti paket yang terdaftar.']];
 return `${pageHead('PUSAT BANTUAN','Panduan penggunaan','Langkah singkat menjalankan operasional WiFi Pro dari awal.',`<button class="btn secondary" data-action="export-customers">↓ Ekspor data pelanggan</button>`)}<div class="guide-grid">${steps.map(([n,t,d])=>`<article class="guide-card"><span>${n}</span><div><h2>${t}</h2><p>${d}</p></div></article>`).join('')}</div><section class="panel guide-note"><span class="note-icon">i</span><div><b>Catatan privasi</b><p>Aplikasi tidak mengirim pesan otomatis. Anda selalu meninjau lalu mengirim pesan melalui akun WhatsApp Anda sendiri.</p></div></section>`;
}
function modalView() {
 const m=state.modal;
 if(m.type==='import-preview'){
  const d=state.importDraft;
  if(!d)return `<div class="modal-backdrop"><section class="modal-card"><div class="modal-fields"><p>File impor tidak tersedia.</p><button class="btn secondary" data-close-modal>Tutup</button></div></section></div>`;
  const hasError=d.errors.length>0, canImport=!hasError&&d.records.length>0;
  return `<div class="modal-backdrop"><section class="modal-card import-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
   <header><div><span class="eyebrow">PRATINJAU IMPOR</span><h2 id="import-title">Periksa data pelanggan</h2></div><button class="icon-button" data-close-modal aria-label="Tutup">×</button></header>
   <div class="modal-fields">
    <p class="modal-intro">File: <b>${esc(d.filename)}</b>. Impor hanya menambahkan pelanggan baru, bukan menimpa data yang ada.</p>
    <div class="import-preview-stats"><div><strong>${d.total}</strong><span>Baris dibaca</span></div><div><strong>${d.records.length}</strong><span>Siap diimpor</span></div><div><strong>${d.skipped.length}</strong><span>Duplikat dilewati</span></div><div class="${hasError?'has-errors':''}"><strong>${d.errors.length}</strong><span>Baris bermasalah</span></div></div>
    ${hasError?`<div class="import-error-list"><b>Perbaiki file, lalu impor ulang:</b>${d.errors.slice(0,8).map(x=>`<p>• ${esc(x)}</p>`).join('')}${d.errors.length>8?`<p>Dan ${d.errors.length-8} masalah lainnya.</p>`:''}</div>`:''}
    ${d.skipped.length?`<div class="soft-callout">${d.skipped.length} data dengan nama dan nomor yang sama tidak akan diduplikasi.</div>`:''}
    ${d.records.length?`<div class="import-sample"><b>Contoh data yang akan masuk:</b>${d.records.slice(0,4).map(x=>`<div><span>${esc(x.full_name)}<small>${esc(state.packages.find(p=>p.id===x.package_id)?.name||'')}</small></span><strong>${money(x.monthly_price)}</strong></div>`).join('')}</div>`:''}
    <p class="field-hint">Harga mengikuti paket yang ada. Tanggal jatuh tempo tetap mengikuti kolom jatuh_tempo, bukan tanggal impor.</p>
   </div>
   <footer class="import-preview-actions"><button type="button" class="btn secondary" data-close-modal>Batal</button><button type="button" class="btn primary" data-confirm-import ${canImport?'':'disabled'}>${hasError?'Perbaiki file terlebih dahulu':d.records.length?'Impor '+d.records.length+' pelanggan':'Tidak ada data baru'}</button></footer>
  </section></div>`;
 }
 if(m.type==='confirm-delete') {
   const [type,id]=String(m.token||'').split(':');
   const configs={
     customer:{label:'pelanggan',records:state.customers,name:x=>x.full_name,detail:x=>{const invoiceCount=state.invoices.filter(i=>i.customer_id===x.id).length,paymentCount=state.payments.filter(p=>p.customer_id===x.id).length;return `Data pelanggan, ${invoiceCount} tagihan, dan ${paymentCount} pembayaran terkait akan terhapus permanen.`;}},
     package:{label:'paket internet',records:state.packages,name:x=>x.name,detail:x=>`${state.customers.filter(c=>c.package_id===x.id).length} pelanggan pengguna paket ini akan kehilangan pilihan paketnya; data pelanggan dan tarif tersimpan tetap ada.`},
     invoice:{label:'tagihan',records:state.invoices,name:x=>`${state.customers.find(c=>c.id===x.customer_id)?.full_name||'Pelanggan'} · ${monthFmt(x.period)}`,detail:x=>`${state.payments.filter(p=>p.invoice_id===x.id).length} pembayaran yang terkait tetap tersimpan tetapi tidak lagi terhubung dengan tagihan ini.`},
     template:{label:'template WhatsApp',records:state.templates,name:x=>x.title,detail:()=> 'Template ini akan dihapus dari daftar pesan dan tidak dapat digunakan lagi.'}
   };
   const config=configs[type],record=config?.records.find(x=>x.id===id);
   if(!record)return `<div class="modal-backdrop"><section class="modal-card delete-dialog" role="alertdialog" aria-modal="true"><div class="delete-dialog-body"><h2>Data tidak ditemukan</h2><p>Data mungkin sudah dihapus.</p><button type="button" class="btn secondary" data-close-modal>Tutup</button></div></section></div>`;
   return `<div class="modal-backdrop"><section class="modal-card delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description"><div class="delete-dialog-body"><div class="delete-icon" aria-hidden="true">!</div><span class="eyebrow">KONFIRMASI PENGHAPUSAN</span><h2 id="delete-dialog-title">Yakin ingin menghapus ${config.label}?</h2><p id="delete-dialog-description">Anda akan menghapus <strong>${esc(config.name(record))}</strong>.</p><div class="delete-warning"><span aria-hidden="true">⚠</span><span>${esc(config.detail(record))} <b>Tindakan ini tidak dapat dibatalkan.</b></span></div></div><footer class="delete-dialog-actions"><button type="button" class="btn secondary" data-close-modal>Batal, simpan data</button><button type="button" class="btn danger" data-confirm-delete="${esc(m.token)}">Ya, hapus permanen</button></footer></section></div>`;
 }
 let title='',fields='',submit='Simpan';
 if(m.type==='customer') {
   const c=m.data||{}, pkg=state.packages.find(p=>p.id===c.package_id);
   const dueDay=Number(c.due_day)||10;
   title=c.id?'Edit pelanggan':'Tambah pelanggan';
   fields=`<label>Nama lengkap<input name="full_name" required value="${esc(c.full_name||'')}" placeholder="Nama pelanggan"></label><div class="form-grid two"><label>Nomor WhatsApp<input name="phone" value="${esc(c.phone||'')}" placeholder="08xxxxxxxxxx"></label><label>Status<select name="status">${['active','isolated','inactive'].map(s=>`<option value="${s}" ${c.status===s?'selected':''}>${s==='active'?'Aktif':s==='isolated'?'Terisolir':'Nonaktif'}</option>`).join('')}</select></label></div><label>Alamat pemasangan<input name="address" value="${esc(c.address||'')}" placeholder="Alamat lengkap"></label><div class="form-grid two"><label>Paket internet<select name="package_id" id="customer-package" required><option value="">Pilih paket…</option>${state.packages.filter(p=>p.is_active!==false||p.id===c.package_id).map(p=>`<option value="${p.id}" ${c.package_id===p.id?'selected':''}>${esc(p.name)} · ${money(p.monthly_price)}${p.is_active===false?' (nonaktif)':''}</option>`).join('')}</select>${!state.packages.length?'<small class="field-hint">Buat paket internet terlebih dahulu di menu Paket internet.</small>':''}</label><label>Harga bulanan (otomatis)<input id="customer-monthly-price" name="monthly_price" type="number" min="0" value="${pkg?Number(pkg.monthly_price):''}" placeholder="Pilih paket dahulu" readonly required><small class="field-hint">Harga terisi otomatis sesuai paket yang dipilih.</small></label></div><div class="form-grid two"><label>Tanggal jatuh tempo setiap bulan<select name="due_day" required>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${dueDay===i+1?'selected':''}>Tanggal ${i+1}</option>`).join('')}</select><small class="field-hint">Bebas diubah; tidak mengikuti tanggal pelanggan dimasukkan. Tanggal 29–31 menyesuaikan hari terakhir bulan yang lebih pendek.</small></label><label>Tanggal mulai layanan<input name="started_at" type="date" value="${c.started_at||today}"><small class="field-hint">Hanya informasi mulai layanan, bukan penentu jatuh tempo.</small></label></div><label>Catatan opsional<textarea name="notes" rows="2">${esc(c.notes||'')}</textarea></label>`;
  }
  if(m.type==='package') { const p=m.data||{}; title=p.id?'Edit paket':'Tambah paket internet'; fields=`<label>Nama paket<input name="name" required value="${esc(p.name||'')}" placeholder="Paket Hemat"></label><div class="form-grid two"><label>Kecepatan<input name="speed" value="${esc(p.speed||'')}" placeholder="Contoh: 20 Mbps"></label><label>Harga per bulan<input name="monthly_price" type="number" min="0" required value="${esc(p.monthly_price??'')}" placeholder="150000"></label></div><label>Deskripsi<input name="description" value="${esc(p.description||'')}" placeholder="Keterangan paket"></label><label>Status<select name="is_active"><option value="true" ${p.is_active!==false?'selected':''}>Aktif</option><option value="false" ${p.is_active===false?'selected':''}>Nonaktif</option></select></label>`; }
 if(m.type==='payment') { title='Catat pembayaran'; fields=`<label>Pelanggan<select name="customer_id" required id="payment-customer"><option value="">Pilih pelanggan…</option>${state.customers.map(c=>`<option value="${c.id}">${esc(c.full_name)}</option>`).join('')}</select></label><label>Tagihan terkait<select name="invoice_id" id="payment-invoice"><option value="">Tanpa tagihan khusus</option>${state.invoices.filter(i=>i.status!=='paid').map(i=>`<option value="${i.id}" data-customer="${i.customer_id}" data-amount="${i.amount}">${esc(state.customers.find(c=>c.id===i.customer_id)?.full_name||'Pelanggan')} · ${monthFmt(i.period)} · ${money(i.amount)}</option>`).join('')}</select></label><div class="form-grid two"><label>Jumlah dibayar<input name="amount" type="number" min="1" required></label><label>Metode<select name="method"><option>Tunai</option><option>Transfer bank</option><option>E-wallet</option><option>Lainnya</option></select></label></div><label>Tanggal pembayaran<input name="paid_at" type="date" value="${today}" required></label><label>Catatan<input name="note" placeholder="Opsional"></label>`; }
 if(m.type==='template') {
    const t=m.data||{}, categories=[...new Map(['tagihan','gangguan','informasi',...state.templates.map(x=>x.category).filter(Boolean)].map(x=>[String(x).trim().toLocaleLowerCase('id'),String(x).trim()])).values()];
    title=t.id?'Edit template':'Buat template pesan';
    fields=`<label>Judul template<input name="title" required value="${esc(t.title||'')}" placeholder="Pengingat tagihan"></label><label>Kategori<input name="category" list="template-category-options" maxlength="40" required value="${esc(t.category||'tagihan')}" placeholder="Pilih atau ketik kategori baru" autocomplete="off"><datalist id="template-category-options">${categories.map(c=>`<option value="${esc(c)}"></option>`).join('')}</datalist><small class="field-hint">Pilih dari saran atau ketik nama kategori baru (misalnya: Promo, Perawatan, atau Pemberitahuan). Kategori yang disimpan dapat digunakan lagi.</small></label><label>Isi pesan<textarea name="message" rows="6" required placeholder="Halo {nama}, tagihan internet bulan ini sebesar {tagihan}…">${esc(t.message||'')}</textarea><small class="field-hint">Gunakan {nama}, {usaha}, {paket}, dan {tagihan} sebagai variabel.</small></label>`;
  }
  if(m.type==='generate') { title='Buat tagihan bulanan'; submit='Buat tagihan'; fields=`<p class="modal-intro">Buat tagihan untuk pelanggan aktif pada bulan terpilih. Tanggal jatuh tempo mengikuti pilihan masing-masing pelanggan, bukan tanggal input data.</p><label>Periode tagihan<input type="month" name="period" value="${state.period.slice(0,7)}" required></label><div class="soft-callout">${state.customers.filter(c=>c.status==='active').length} pelanggan aktif · Tagihan yang sudah ada tidak akan diduplikasi.</div>`; }
 return `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true" aria-label="${title}"><header><div><span class="eyebrow">BANTU BERES WIFI PRO</span><h2>${title}</h2></div><button class="icon-button" data-close-modal aria-label="Tutup">×</button></header><form id="modal-form" data-type="${m.type}" data-id="${m.data?.id||''}"><div class="modal-fields">${fields}</div><footer><button type="button" class="btn secondary" data-close-modal>Batal</button><button class="btn primary">${submit}</button></footer></form></section></div>`;
}


const protectedPages = new Set(['dashboard','customers','packages','invoices','payments','messages','settings','guide']);
const publicPages = new Set(['login','register']);
let intendedPage = 'dashboard';
function routeName() {
 const name = decodeURIComponent((window.location.hash || '').replace(/^#\/?/, '').split('?')[0]).replace(/^\//, '');
 return publicPages.has(name) || protectedPages.has(name) ? name : (state.user ? 'dashboard' : 'login');
}
function goTo(page) {
 window.location.hash = '/'+page;
 syncRoute();
}
function syncRoute() {
 if (!state.authChecked) { app.innerHTML = loadingView(); return; }
 let route = routeName();
 if (state.user) {
  if (publicPages.has(route)) {
   route = 'dashboard';
   window.history.replaceState(null, '', '#/dashboard');
  }
  state.page = route;
 } else if (!publicPages.has(route)) {
  intendedPage = route;
  route = 'login';
  window.history.replaceState(null, '', '#/login');
 }
 render();
}
function render() {
 if (!state.authChecked) { app.innerHTML = loadingView(); return; }
 if (state.user) { try { app.innerHTML = shell(); } catch (error) { console.error('WiFi Pro render error', error); app.innerHTML = `<main class="loading-screen"><div class="error-recovery"><h2>Halaman belum dapat ditampilkan</h2><p>Terjadi kendala saat memuat dashboard. Data akun Anda tetap tersimpan.</p><button class="btn primary" id="recover-reload">Muat ulang aplikasi</button><button class="btn secondary" id="recover-logout">Keluar akun</button></div></main>`; } return; }
 app.innerHTML = authView();
 const signup = routeName() === 'register';
 const extra = document.querySelector('#signup-extra');
 if (!extra) return;
 extra.hidden = !signup;
 document.querySelector('#auth-title').textContent = signup ? 'Buat akun WiFi Pro' : 'Masuk ke akun';
 document.querySelector('#auth-desc').textContent = signup ? 'Daftarkan usaha Anda untuk mulai mengelola pelanggan.' : 'Kelola layanan WiFi Anda dengan lebih rapi.';
 document.querySelector('#auth-submit').textContent = signup ? 'Daftar akun' : 'Masuk';
 document.querySelector('#auth-switch-text').textContent = signup ? 'Sudah punya akun?' : 'Belum punya akun?';
 document.querySelector('#auth-switch').textContent = signup ? 'Masuk' : 'Daftar sekarang';
 document.querySelector('[name=password]').autocomplete = signup ? 'new-password' : 'current-password';
}
window.addEventListener('hashchange', syncRoute);
async function loadData() {
 state.loading=true; render();
 const uid=state.user.id;
 try {
  let {data:profile}=await supabase.from('profiles').select('*').eq('id',uid).maybeSingle();
  if(!profile) { const meta=state.user.user_metadata||{}; const {data,error}=await supabase.from('profiles').insert({id:uid,business_name:meta.business_name||'WiFi Saya',owner_name:meta.owner_name||null}).select().single(); if(error) throw error; profile=data; }
  if (state.user?.id !== uid) return;
  state.profile=profile;
  const names=['customers','internet_packages','invoices','payments','message_templates'];
  const results=await Promise.all(names.map(n=>supabase.from(n).select('*').order(n==='payments'?'paid_at':'created_at',{ascending:false}).limit(1500)));
  if (state.user?.id !== uid) return;
  results.forEach((r,i)=>{if(r.error)throw r.error;state[{customers:'customers',internet_packages:'packages',invoices:'invoices',payments:'payments',message_templates:'templates'}[names[i]]]=r.data||[];});
  if(!state.templates.length){const defaults=[{title:'Pengingat tagihan',category:'tagihan',message:'Halo {nama}, kami mengingatkan tagihan layanan internet dari {usaha} sebesar {tagihan}. Silakan konfirmasi setelah melakukan pembayaran. Terima kasih.'},{title:'Informasi layanan',category:'informasi',message:'Halo {nama}, kami dari {usaha} ingin menyampaikan informasi terkait layanan internet paket {paket} Anda. Terima kasih.'},{title:'Informasi gangguan',category:'gangguan',message:'Halo {nama}, saat ini kami sedang menangani kendala jaringan di area Anda. Mohon maaf atas ketidaknyamanannya. Kami akan memberi kabar setelah layanan kembali normal.'}].map(x=>({...x,user_id:uid}));const {data,error}=await supabase.from('message_templates').insert(defaults).select();if(error)throw error;state.templates=data||[];}
 } catch(e) { toast(e.message||'Data belum berhasil dimuat. Muat ulang untuk mencoba lagi.','error'); }
 state.loading=false; if (state.user?.id === uid) render();
}
async function refresh() { await loadData(); }
function formObj(form) { return Object.fromEntries(new FormData(form).entries()); }
async function saveRecord(form) {
 const type=form.dataset.type, id=form.dataset.id, v=formObj(form), uid=state.user.id; let table, payload;
 if(type==='customer'){
   const pkg=state.packages.find(p=>p.id===v.package_id),dueDay=Number(v.due_day);
   if(!pkg)throw new Error('Pilih paket internet terlebih dahulu agar harga pelanggan terisi otomatis.');
   if(!Number.isInteger(dueDay)||dueDay<1||dueDay>31)throw new Error('Pilih tanggal jatuh tempo antara 1 sampai 31.');
   table='customers';
   payload={...v,user_id:uid,package_id:pkg.id,monthly_price:Number(pkg.monthly_price),due_day:dueDay};
  }
 if(type==='package'){table='internet_packages';payload={...v,user_id:uid,monthly_price:Number(v.monthly_price),is_active:v.is_active==='true'};}
 if(type==='template'){
   const category=String(v.category||'').trim().replace(/\s+/g,' ');
   if(category.length<2||category.length>40)throw new Error('Nama kategori harus terdiri dari 2–40 karakter.');
   const existing=['tagihan','gangguan','informasi',...state.templates.map(t=>t.category)].find(c=>String(c||'').toLocaleLowerCase('id')===category.toLocaleLowerCase('id'));
   table='message_templates';payload={...v,user_id:uid,category:existing||category};
  }
 if(type==='payment'){
  const inv=state.invoices.find(i=>i.id===v.invoice_id); const amount=Number(v.amount);
  const {error}=await supabase.from('payments').insert({user_id:uid,customer_id:v.customer_id,invoice_id:v.invoice_id||null,amount,method:v.method,paid_at:`${v.paid_at}T12:00:00`,note:v.note||null}); if(error)throw error;
  if(inv && amount>=Number(inv.amount)) {const {error:e}=await supabase.from('invoices').update({status:'paid'}).eq('id',inv.id);if(e)throw e;}
  else if(inv) {const {error:e}=await supabase.from('invoices').update({status:'partial'}).eq('id',inv.id);if(e)throw e;}
  toast('Pembayaran berhasil dicatat');state.modal=null;await refresh();return;
 }
 if(type==='generate') {
  const [year,month]=v.period.split('-').map(Number); state.period=`${v.period}-01`;
  const active=state.customers.filter(c=>c.status==='active'); const existed=new Set(state.invoices.map(i=>`${i.customer_id}:${i.period.slice(0,7)}`));
  const records=active.filter(c=>!existed.has(`${c.id}:${v.period}`)).map(c=>({user_id:uid,customer_id:c.id,period:`${v.period}-01`,amount:Number(c.monthly_price),due_date:`${v.period}-${String(Math.min(Number(c.due_day)||1,new Date(year,month,0).getDate())).padStart(2,'0')}`,status:'unpaid'}));
  if(!records.length){toast('Tidak ada tagihan baru. Pelanggan mungkin sudah memiliki tagihan periode ini.','error');state.modal=null;render();return;}
  const {error}=await supabase.from('invoices').insert(records);if(error)throw error;toast(`${records.length} tagihan berhasil dibuat`);state.modal=null;await refresh();return;
 }
 const result=id?await supabase.from(table).update(payload).eq('id',id):await supabase.from(table).insert(payload);
 if(result.error)throw result.error; state.modal=null;toast('Data berhasil disimpan');await refresh();
}
async function saveSettings(form) {
 const v=formObj(form);
 const fields=['owner_name','owner_phone','owner_role','business_name','business_type','business_phone','business_whatsapp','business_email','business_website','business_address','business_village','business_district','business_city','business_province','business_postal_code','service_area','business_description','operating_hours','bank_name','bank_account_number','bank_account_holder','payment_instructions','whatsapp_country_code'];
 const payload=Object.fromEntries(fields.map(key=>[key,String(v[key]||'').trim()]));
 if(!payload.business_name)throw new Error('Nama usaha wajib diisi.');
 if(payload.whatsapp_country_code&&!/^\d{1,5}$/.test(payload.whatsapp_country_code))throw new Error('Kode negara WhatsApp hanya boleh berisi angka, contohnya 62.');
 if(payload.business_website&&!/^https?:\/\/\S+$/i.test(payload.business_website))throw new Error('Alamat website harus dimulai dengan https:// atau http://.');
 payload.whatsapp_country_code=payload.whatsapp_country_code||'62';
 payload.updated_at=new Date().toISOString();
 const button=form.querySelector('button[type=submit]');
 if(button){button.disabled=true;button.textContent='Menyimpan…';}
 try{
   const {data,error}=await supabase.from('profiles').update(payload).eq('id',state.user.id).select().single();
   if(error)throw error;
   state.profile=data;
   toast('Profil pengguna dan bisnis berhasil disimpan');
   render();
 }finally{if(button?.isConnected){button.disabled=false;button.textContent='✓ Simpan perubahan';}}
}
async function deleteRecord(token) {
 const [type,id]=String(token||'').split(':');
 const map={customer:'customers',package:'internet_packages',invoice:'invoices',template:'message_templates'};
 if(!map[type]||!id)return false;
 const {error}=await supabase.from(map[type]).delete().eq('id',id).eq('user_id',state.user.id);
 if(error){toast(error.message,'error');return false;}
 state.modal=null;
 toast('Data berhasil dihapus');
 await refresh();
 return true;
}
function waNumber(phone,country) { let n=String(phone||'').replace(/\D/g,'');if(n.startsWith('0'))n=(country||'62')+n.slice(1);else if(!n.startsWith(country||'62'))n=(country||'62')+n;return n; }
function openWhatsApp(c,message) { if(!c?.phone){toast('Nomor WhatsApp pelanggan belum diisi.','error');return;}const p=state.profile||{};const pkg=state.packages.find(x=>x.id===c.package_id);const text=String(message||'').replaceAll('{nama}',c.full_name||'').replaceAll('{usaha}',p.business_name||'').replaceAll('{paket}',pkg?.name||'').replaceAll('{tagihan}',money(c.monthly_price));window.open(`https://wa.me/${waNumber(c.phone,p.whatsapp_country_code)}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer'); }
function messageInvoice(id){const i=state.invoices.find(x=>x.id===id);const c=state.customers.find(x=>x.id===i?.customer_id);if(!c)return;const defaultMsg=`Halo ${c.full_name}, kami mengingatkan tagihan WiFi bulan ${monthFmt(i.period)} sebesar ${money(i.amount)} jatuh tempo ${dateFmt(i.due_date)}. Terima kasih.`;openWhatsApp(c,defaultMsg);}
async function prepareCustomerImport(file) {
 try {
  const items=await readCustomerFile(file);
  const draft=validateCustomerRows(items,state.packages,state.customers,state.user.id,today);
  state.importDraft={...draft,filename:file.name};
  state.modal={type:'import-preview'};
  render();
 } catch(err){toast(err.message||'Gagal membaca file pelanggan.','error');}
}

app.addEventListener('click', async e=>{
 const page=e.target.closest('[data-page]');if(page){if(!state.user)return;state.search='';goTo(page.dataset.page);return;}
 if(e.target.closest('.mobile-menu')){document.querySelector('.sidebar')?.classList.toggle('mobile-open');return;}
 if(e.target.closest('.theme-toggle')){state.theme=state.theme==='light'?'dark':'light';localStorage.setItem('wifi-theme',state.theme);document.documentElement.dataset.theme=state.theme;render();return;}
 const theme=e.target.closest('[data-theme-set]');if(theme){state.theme=theme.dataset.themeSet;localStorage.setItem('wifi-theme',state.theme);document.documentElement.dataset.theme=state.theme;render();return;}
 const modal=e.target.closest('[data-modal]');if(modal){state.modal={type:modal.dataset.modal};render();return;}
 if(e.target.closest('button[data-close-modal]')){state.modal=null;render();return;}
 const edit=e.target.closest('[data-edit]');if(edit){const [type,id]=edit.dataset.edit.split(':');const map={customer:'customers',package:'packages',template:'templates'};state.modal={type,data:state[map[type]].find(x=>x.id===id)};render();return;}
 const del=e.target.closest('[data-delete]');if(del){state.modal={type:'confirm-delete',token:del.dataset.delete};render();return;}
 const confirmDelete=e.target.closest('[data-confirm-delete]');
 if(confirmDelete){
   if(confirmDelete.disabled)return;
   confirmDelete.disabled=true;confirmDelete.textContent='Menghapus…';
   try { const ok=await deleteRecord(confirmDelete.dataset.confirmDelete);if(!ok){confirmDelete.disabled=false;confirmDelete.textContent='Ya, hapus permanen';} }
   catch(err){toast(err.message||'Penghapusan gagal. Coba lagi.','error');confirmDelete.disabled=false;confirmDelete.textContent='Ya, hapus permanen';}
   return;
 }
 const templateDownload=e.target.closest('[data-template-format]');
 if(templateDownload){const btn=templateDownload;btn.disabled=true;try{await downloadCustomerTemplate(btn.dataset.templateFormat);toast('Template berhasil diunduh.');}catch(err){toast(err.message||'Gagal mengunduh template.','error');}finally{btn.disabled=false;}return;}
 const exportButton=e.target.closest('[data-export-format]');
 if(exportButton){const btn=exportButton;btn.disabled=true;try{await exportCustomerData(btn.dataset.exportFormat,state.customers,state.packages,today);toast('Data pelanggan berhasil diekspor.');}catch(err){toast(err.message||'Gagal mengekspor data.','error');}finally{btn.disabled=false;}return;}
 const importButton=e.target.closest('[data-confirm-import]');
 if(importButton){
   const draft=state.importDraft;
   if(importButton.disabled||!draft||draft.errors.length||!draft.records.length)return;
   importButton.disabled=true;importButton.textContent='Mengimpor…';
   try{
     const {error}=await supabase.from('customers').insert(draft.records);
     if(error)throw error;
     const count=draft.records.length;
     state.importDraft=null;state.modal=null;toast(count+' pelanggan berhasil diimpor.');
     await refresh();
   }catch(err){toast(err.message||'Impor gagal. Tidak ada konfirmasi sukses.','error');importButton.disabled=false;importButton.textContent='Coba impor lagi';}
   return;
 }
 const generate=e.target.closest('[data-action="generate-invoices"]');if(generate){state.modal={type:'generate'};render();return;}
 if(e.target.closest('[data-action="export-customers"]')){await exportCustomerData('csv',state.customers,state.packages,today);return;}
 const mi=e.target.closest('[data-message-invoice]');if(mi){messageInvoice(mi.dataset.messageInvoice);return;}
 const mc=e.target.closest('[data-message-customer]');if(mc){const c=state.customers.find(x=>x.id===mc.dataset.messageCustomer);openWhatsApp(c,`Halo ${c.full_name}, kami dari ${state.profile?.business_name||'WiFi kami'}. Ada informasi terkait layanan internet Anda. Terima kasih.`);return;}
 const pi=e.target.closest('[data-pay-invoice]');if(pi){state.modal={type:'payment',invoice:pi.dataset.payInvoice};render();setTimeout(()=>{const i=state.invoices.find(x=>x.id===pi.dataset.payInvoice);const c=document.querySelector('[name=customer_id]');const inv=document.querySelector('[name=invoice_id]');if(i&&c&&inv){c.value=i.customer_id;inv.value=i.id;const amt=document.querySelector('[name=amount]');if(amt)amt.value=i.amount;}},0);return;}
 if(e.target.closest('[data-action="send-message"]')){const id=document.querySelector('#message-customer')?.value;const c=state.customers.find(x=>x.id===id);const t=document.querySelector('#message-body')?.value||'';if(!c||!t){toast('Pilih pelanggan dan isi pesan terlebih dahulu.','error');return;}openWhatsApp(c,t);return;}
 if(e.target.closest('.logout')){const {error}=await supabase.auth.signOut();if(error){toast(error.message,'error');return;}clearPrivateState();goTo('login');return;}
 if(e.target.closest('#auth-switch')){goTo(routeName()==='register'?'login':'register');return;}
});
app.addEventListener('click',async e=>{
 if(e.target.closest('#recover-reload')) { window.location.reload(); return; }
 if(e.target.closest('#recover-logout')) { await supabase.auth.signOut(); clearPrivateState(); goTo('login'); }
});
app.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;
 if(f.id==='auth-form'){const fd=new FormData(f),identifier=String(fd.get('username')||'').trim().toLowerCase(),password=fd.get('password'),signup=!document.querySelector('#signup-extra').hidden;const btn=document.querySelector('#auth-submit');btn.disabled=true;btn.textContent='Memproses…';try{if(signup&&!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(identifier))throw new Error('Username harus 3–32 karakter dan hanya memakai huruf, angka, titik, garis bawah, atau tanda hubung.');const email=signup?`${identifier}@wifi-users.bantuberes.com`:(identifier.includes('@')?identifier:`${identifier}@wifi-users.bantuberes.com`);if(signup){const {data:created,error:registerError}=await supabase.functions.invoke('register-owner',{body:{username:identifier,password:String(password),businessName:String(fd.get('business')||'').trim(),ownerName:String(fd.get('owner')||'').trim()}});if(registerError||!created?.ok){let detail=created?.error||'';if(!detail&&registerError){try{detail=String((await registerError.context?.json?.())?.error||'')}catch{/* Keep a safe fallback. */}}throw new Error(detail||'Pendaftaran belum berhasil. Silakan coba lagi.');}const {data:loggedIn,error:loginError}=await supabase.auth.signInWithPassword({email,password:String(password)});if(loginError||!loggedIn.user)throw new Error('Akun berhasil dibuat. Silakan masuk menggunakan username dan kata sandi yang sama.');state.user=loggedIn.user;goTo(intendedPage);await loadData();}else{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;state.user=data.user;goTo(intendedPage);await loadData();}}catch(err){const message=String(err?.message||'');toast(message||'Tidak dapat memproses akun.','error');}finally{if(btn){btn.disabled=false;btn.textContent=signup?'Daftar akun':'Masuk';}}return;}
 if(f.id==='modal-form'){const b=f.querySelector('button[type=submit],button:not([type])');if(b){b.disabled=true;b.textContent='Menyimpan…';}try{await saveRecord(f);}catch(err){toast(err.message||'Tidak dapat menyimpan data.','error');if(b){b.disabled=false;b.textContent='Simpan';}}return;}
 if(f.id==='settings-form'){try{await saveSettings(f);}catch(err){toast(err.message||'Tidak dapat menyimpan pengaturan.','error');}return;}
});
app.addEventListener('input',e=>{if(e.target.id==='table-search'){const pos=e.target.selectionStart;state.search=e.target.value;render();const x=document.querySelector('#table-search');x?.focus();x?.setSelectionRange(pos,pos);}});
app.addEventListener('change',async e=>{
  if(e.target.id==='customer-package'){
    const pkg=state.packages.find(p=>p.id===e.target.value),price=document.querySelector('#customer-monthly-price');
    if(price)price.value=pkg?Number(pkg.monthly_price):'';
    return;
  }
 if(e.target.id==='customer-import-file'&&e.target.files?.[0]){const file=e.target.files[0];e.target.value='';await prepareCustomerImport(file);return;}
 if(e.target.id==='invoice-period'){state.period=`${e.target.value}-01`;render();}
 if(e.target.id==='message-template'){const t=state.templates.find(x=>x.id===e.target.value);const body=document.querySelector('#message-body');if(t&&body)body.value=t.message;}
 if(e.target.id==='payment-invoice'){const opt=e.target.selectedOptions[0], customer=document.querySelector('#payment-customer'),amount=document.querySelector('[name=amount]');if(opt?.dataset.customer&&customer)customer.value=opt.dataset.customer;if(opt?.dataset.amount&&amount)amount.value=opt.dataset.amount;}
});

function clearPrivateState() {
 state.user=null; state.profile=null; state.customers=[]; state.packages=[];
 state.invoices=[]; state.payments=[]; state.templates=[]; state.modal=null; state.importDraft=null;
 state.search=''; state.authChecked=true;
}
async function boot(){
 if (!supabase) { state.authChecked=true; syncRoute(); return; }
 const {data, error} = await supabase.auth.getUser();
 state.authChecked = true;
 if (!error && data.user) {
  state.user = data.user;
  syncRoute();
  await loadData();
 } else {
  clearPrivateState();
  syncRoute();
 }
 supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
   clearPrivateState();
   goTo('login');
  } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user && (!state.user || state.user.id !== session.user.id)) {
   // Supabase warns against awaiting another Auth API inside this callback.
   setTimeout(async () => {
    const {data: verified, error: verifyError} = await supabase.auth.getUser();
    if (!verifyError && verified.user && !state.user) {
     state.user = verified.user;
     state.authChecked = true;
     goTo(intendedPage);
     await loadData();
    }
   }, 0);
  }
 });
}
boot();
