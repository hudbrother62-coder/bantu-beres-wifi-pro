import { createClient } from "npm:@supabase/supabase-js@2.75.1";
const url = Deno.env.get("SUPABASE_URL") || "";
// Supabase projects may expose either legacy keys or the new key bundles.
function bundledKey(name: string): string {
 try { const keys=JSON.parse(Deno.env.get(name)||"{}"); return typeof keys.default==="string"?keys.default:""; }
 catch { return ""; }
}
const anon = Deno.env.get("SUPABASE_ANON_KEY") || bundledKey("SUPABASE_PUBLISHABLE_KEYS") || "sb_publishable_lW5aaP9gPZh8flBAB4Hvug_Z_sC46yq";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || bundledKey("SUPABASE_SECRET_KEYS");
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function respond(value: Record<string, unknown>, status = 200) {
 return new Response(JSON.stringify(value), {status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function generateCode() {
 const data=crypto.getRandomValues(new Uint8Array(32));
 return btoa(String.fromCharCode(...data)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function sha256(value: string){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async (request: Request) => {
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST")return respond({error:"Method not allowed"},405);
 if(!url||!anon||!serviceKey)return respond({error:"Layanan pemulihan belum tersedia."},503);
 let body: Record<string, unknown>;
 try{ body=await request.json(); }catch{return respond({error:"Data tidak valid."},400);}
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const action=body?.action;

 // The email login alias is assigned by an administrator. Only the inbox owner
 // can follow its Supabase magic link and request a password update.
 if(action==="request-email-link"){
  const email=String(body.email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return respond({error:"Masukkan alamat email yang valid."},400);
  const {data:alias,error:aliasError}=await admin.from("account_login_aliases").select("user_id").eq("login_email",email).maybeSingle();
  if(aliasError)return respond({error:"Layanan pemulihan sementara tidak tersedia."},503);
  if(alias?.user_id){
   const otp=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
   const {error:otpError}=await otp.auth.signInWithOtp({
    email,options:{shouldCreateUser:true,emailRedirectTo:"https://bantu-beres-wifi-pro.vercel.app/recovery.html?mode=verify-email"}
   });
   if(otpError){
    if(/rate|limit|too many/i.test(otpError.message))return respond({error:"Batas pengiriman email tercapai. Coba lagi nanti; tautan sebelumnya tetap berlaku sampai kedaluwarsa."},429);
    return respond({error:"Email pemulihan belum dapat dikirim. Coba lagi nanti."},503);
   }
  }
  // Identical success response for existing and unknown emails.
  return respond({ok:true,message:"Jika email ini tertaut ke akun, tautan pemulihan akan dikirim."});
 }
 if(action==="redeem-email"){
  const bearer=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!bearer)return respond({error:"Tautan pemulihan sudah tidak berlaku."},401);
  const {data:{user},error:sessionError}=await admin.auth.getUser(bearer);
  if(sessionError||!user?.email||!user.email_confirmed_at||!user.last_sign_in_at)return respond({error:"Verifikasi email belum valid."},401);
  // A magic-link sign-in must be recent. Old sessions cannot reset passwords.
  const signedInAt=Date.parse(user.last_sign_in_at);
  if(!Number.isFinite(signedInAt)||Date.now()-signedInAt>10*60*1000||signedInAt-Date.now()>60*1000)
   return respond({error:"Tautan pemulihan sudah kedaluwarsa. Minta tautan baru."},401);
  const email=user.email.trim().toLowerCase();
  const {data:alias,error:aliasError}=await admin.from("account_login_aliases").select("user_id").eq("login_email",email).maybeSingle();
  if(aliasError||!alias?.user_id||alias.user_id===user.id)return respond({error:"Pemulihan akun belum tersedia."},401);
  const password=typeof body.password==="string"?body.password:"";
  const confirmation=typeof body.confirmation==="string"?body.confirmation:"";
  if(password.length<8||password.length>128||password!==confirmation)return respond({error:"Password baru harus 8–128 karakter dan kedua isian harus sama."},400);
  const {error:consumed}=await admin.from("account_email_recovery_redemptions").insert({
   verifier_user_id:user.id,signed_in_at:user.last_sign_in_at,recovered_user_id:alias.user_id
  });
  if(consumed)return respond({error:"Tautan pemulihan sudah digunakan. Mintalah tautan baru."},409);
  const {error:resetError}=await admin.auth.admin.updateUserById(alias.user_id,{password});
  if(resetError)return respond({error:"Password belum dapat diubah. Mintalah tautan baru atau hubungi dukungan."},503);
  return respond({ok:true,message:"Password akun WiFi Pro berhasil diperbarui."});
 }
 if(action==="issue"){
  const bearer=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!bearer)return respond({error:"Silakan login terlebih dahulu."},401);
  const {data:{user},error:userError}=await admin.auth.getUser(bearer);
  if(userError||!user?.email)return respond({error:"Sesi login tidak valid."},401);
  const password=typeof body.password==="string"?body.password:"";
  if(!password||password.length>128)return respond({error:"Password saat ini wajib diisi."},400);
  const loginClient=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:verified,error:passwordError}=await loginClient.auth.signInWithPassword({email:user.email,password});
  if(passwordError||verified.user?.id!==user.id)return respond({error:"Password saat ini tidak sesuai."},401);
  const code=generateCode(),code_hash=await sha256(code);
  const {error}=await admin.from("account_recovery_codes").upsert({user_id:user.id,code_hash,created_at:new Date().toISOString(),used_at:null},{onConflict:"user_id"});
  if(error)return respond({error:"Gagal menyimpan kode pemulihan."},503);
  return respond({ok:true,code,message:"Simpan kode ini. Kode lama tidak berlaku dan kode baru hanya tampil sekali."});
 }
 if(action==="redeem"){
  const code=typeof body.code==="string"?body.code.trim():"";
  const password=typeof body.password==="string"?body.password:"";
  const confirmation=typeof body.confirmation==="string"?body.confirmation:"";
  if(!/^[A-Za-z0-9_-]{43}$/.test(code))return respond({error:"Kode pemulihan tidak valid atau sudah digunakan."},400);
  if(password.length<8||password.length>128||confirmation!==password)return respond({error:"Password baru harus 8–128 karakter dan konfirmasi sama."},400);
  const code_hash=await sha256(code);
  // Atomic consume: concurrent requests cannot redeem the same code twice.
  const {data:used,error:useError}=await admin.from("account_recovery_codes")
    .update({used_at:new Date().toISOString()}).eq("code_hash",code_hash)
    .is("used_at",null).select("user_id").maybeSingle();
  if(useError||!used?.user_id)return respond({error:"Kode pemulihan tidak valid atau sudah digunakan."},400);
  const {error:resetError}=await admin.auth.admin.updateUserById(used.user_id,{password});
  if(resetError)return respond({error:"Pemulihan belum dapat diselesaikan. Hubungi dukungan resmi."},503);
  return respond({ok:true,message:"Password diperbarui. Masuk menggunakan password baru."});
 }
 return respond({error:"Aksi tidak dikenal."},400);
});
