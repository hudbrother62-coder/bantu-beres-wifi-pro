import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL || 'https://ypekuhwyjvyyzvedncqh.supabase.co';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lW5aaP9gPZh8flBAB4Hvug_Z_sC46yq';
const sb=createClient(url,key);
const $=(id)=>document.getElementById(id);
const setup=new URLSearchParams(location.search).get('mode')==='setup';
$('title').textContent=setup?'Siapkan kode pemulihan':'Lupa password?';
$('description').textContent=setup?'Buat kode pemulihan yang dapat digunakan sekali bila lupa password. Konfirmasi password saat ini.':'Masukkan kode pemulihan yang sebelumnya kamu simpan. Email buatan sistem tidak dapat menerima OTP.';
$('old-pass').hidden=!setup;$('new-pass').hidden=setup;$('recovery-code').hidden=setup;
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
