import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL || 'https://ypekuhwyjvyyzvedncqh.supabase.co';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lW5aaP9gPZh8flBAB4Hvug_Z_sC46yq';
const sb=createClient(url,key);
const $=(id)=>document.getElementById(id);
const setup=new URLSearchParams(location.search).get('mode')==='setup';
$('title').textContent=setup?'Siapkan kode pemulihan':'Lupa password?';
$('description').textContent=setup?'Buat kode pemulihan yang dapat digunakan sekali bila lupa password. Konfirmasi password saat ini.':'Gunakan tautan yang dikirim ke email tertaut, atau buka opsi kode pemulihan di bawahnya.';
$('old-pass').hidden=!setup;$('new-pass').hidden=setup;$('recovery-code').hidden=setup;
$('code-details').open=setup;
$('email-panel').hidden=setup;
$('submit').textContent=setup?'Buat kode pemulihan':'Ganti password';
function message(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';}
if(setup)sb.auth.getUser().then(({data,error})=>{if(error||!data.user){$('submit').disabled=true;message('Silakan login melalui aplikasi terlebih dahulu untuk membuat kode pemulihan.',true);}});
$('form').onsubmit=async(event)=>{
 event.preventDefault();$('submit').disabled=true;message('Memproses...');
 try{
  const payload=setup?{action:'issue',password:$('current').value}:{action:'redeem',code:$('code').value.trim(),password:$('password').value,confirmation:$('confirmation').value};
  const {data,error}=await sb.functions.invoke('account-recovery',{body:payload});
  if(error||!data?.ok){
   let reason=data?.error||'Layanan pemulihan belum dapat dihubungi.';
   if(error?.context?.json){try{const x=await error.context.json();reason=x.error||reason;}catch{}}
   throw new Error(reason);
  }
  $('form').hidden=true;
  if(setup){$('success').hidden=false;$('code-result').textContent=data.code;message('Kode berhasil dibuat. Simpan secara privat; kode lama otomatis tidak berlaku.');}
  else message('Password berhasil diganti. Kembali ke login menggunakan password baru.');
 }catch(err){message(err.message||'Permintaan gagal.',true);}finally{$('submit').disabled=false;}
};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('code-result').textContent);message('Kode disalin. Simpan di tempat yang aman.');}catch{message('Gagal menyalin otomatis. Salin kode di atas secara manual.',true);}};

const emailRequestForm = $('email-request-form');
emailRequestForm.onsubmit = async (event) => {
  event.preventDefault();
  const button = $('email-request-button');
  button.disabled = true;
  try {
    const email = $('recovery-email').value.trim().toLowerCase();
    const { data, error } = await sb.functions.invoke('account-recovery', { body: { action: 'request-email-link', email } });
    if (error || !data?.ok) {
      let reason = data?.error || 'Permintaan pemulihan belum berhasil.';
      if (error?.context?.json) {
        try { reason = (await error.context.json()).error || reason; } catch { /* Keep safe fallback. */ }
      }
      throw new Error(reason);
    }
    message('Jika email tertaut ke akun WiFi Pro, tautan pemulihan akan dikirim. Cek kotak masuk dan spam.');
  } catch (error) {
    message(error.message || 'Tidak dapat mengirim permintaan reset. Coba lagi nanti.', true);
  } finally { button.disabled = false; }
};

let emailRecoverySession = false;
const incomingType = new URLSearchParams(location.hash.slice(1)).get('type');
const incomingMode = new URLSearchParams(location.search).get('mode');
const incomingEmailReset = incomingType === 'recovery';
const incomingAliasReset = incomingMode === 'verify-email' || incomingType === 'magiclink' || incomingType === 'signup';
function showEmailResetForm() {
  emailRecoverySession = true;
  $('email-panel').hidden = true;
  $('code-details').hidden = true;
  $('form').hidden = true;
  $('email-update-section').hidden = false;
  $('title').textContent = 'Atur ulang password';
  $('description').textContent = 'Email sudah diverifikasi. Silakan buat password baru untuk akun WiFi Pro.';
  message('');
}
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' || ((incomingEmailReset || incomingAliasReset) && session?.user)) {
    showEmailResetForm();
  }
});
if (incomingAliasReset) {
  sb.auth.getUser().then(({ data, error }) => {
    if (!error && data.user) showEmailResetForm();
  });
}
if (new URLSearchParams(location.search).has('code')) {
  // Supports PKCE links in addition to standard implicit-flow recovery links.
  sb.auth.exchangeCodeForSession(new URLSearchParams(location.search).get('code'))
    .then(({ data, error }) => {
      if (!error && data.session) showEmailResetForm();
      else message('Tautan reset sudah tidak berlaku. Mintalah tautan baru.', true);
    });
}
$('email-update-form').onsubmit = async (event) => {
  event.preventDefault();
  const button = $('email-update-button');
  button.disabled = true;
  try {
    if (!emailRecoverySession) throw new Error('Sesi pemulihan tidak valid.');
    const password = $('email-new-password').value;
    if (password.length < 8 || password !== $('email-confirm-password').value) {
      throw new Error('Password harus minimal 8 karakter dan kedua isian harus sama.');
    }
    if (incomingAliasReset) {
      const { data, error } = await sb.functions.invoke('account-recovery', {
        body: { action: 'redeem-email', password, confirmation: $('email-confirm-password').value }
      });
      if (error || !data?.ok) {
        let reason = data?.error || 'Permintaan reset belum berhasil.';
        if (error?.context?.json) {
          try { reason = (await error.context.json()).error || reason; } catch { /* Keep safe fallback. */ }
        }
        throw new Error(reason);
      }
    } else {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    }
    await sb.auth.signOut();
    $('email-update-section').hidden = true;
    $('title').textContent = 'Password telah diperbarui';
    message('Password berhasil diganti. Anda dapat masuk kembali ke WiFi Pro.');
  } catch (error) { message(error.message || 'Gagal mengganti password.', true); }
  finally { button.disabled = false; }
};
