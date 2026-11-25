import { createClient } from "npm:@supabase/supabase-js@2.75.1";
const url=Deno.env.get("SUPABASE_URL")||"";
function bundle(name:string){try{return JSON.parse(Deno.env.get(name)||"{}").default||"";}catch{return "";}}
const anon=Deno.env.get("SUPABASE_ANON_KEY")||bundle("SUPABASE_PUBLISHABLE_KEYS");
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||bundle("SUPABASE_SECRET_KEYS");
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-supabase-api-version","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const generic="Jika email tertaut, kode atau tautan pemulihan akan dikirim. Jika kuota penuh, sistem mencoba kembali setiap jam.";
function sameSecret(a:string,b:string){if(!a||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Metode tidak didukung."},405);
 if(!url||!anon||!service)return reply({error:"Layanan sementara tidak tersedia."},503);
 const admin=createClient(url,service,options);
 const auth=createClient(url,anon,options);
 try{
  const raw=await req.text();if(raw.length>2048)return reply({error:"Permintaan tidak valid."},400);
  const body=JSON.parse(raw);
  if(body.action==="worker"){
   const control=await admin.from("wifi_recovery_worker_control").select("secret").eq("singleton",true).single();
   if(control.error||!sameSecret(req.headers.get("x-worker-secret")||"",control.data.secret))return reply({error:"Tidak diizinkan."},403);
   const {data,error}=await admin.rpc("wifi_claim_recovery");
   if(error)throw error;
   const job=data?.[0];if(!job)return reply({ok:true,processed:0});
   const alias=await admin.from("account_login_aliases").select("user_id").eq("login_email",job.email).maybeSingle();
   if(alias.error)throw alias.error;
   if(!alias.data){const r=await admin.from("wifi_recovery_queue").update({status:"failed"}).eq("id",job.id).eq("attempts",job.attempts);if(r.error)throw r.error;return reply({ok:true,processed:1});}
   const {error:sendError}=await auth.auth.signInWithOtp({email:job.email,options:{shouldCreateUser:true,emailRedirectTo:"https://bantu-beres-wifi-pro.vercel.app/recovery.html?mode=verify-email"}});
   const now=new Date();
   const patch=sendError?{status:job.attempts>=24?"failed":"pending",next_attempt_at:new Date(now.getTime()+3600000).toISOString()}:{status:"sent",sent_at:now.toISOString(),verify_attempts:0};
   const updated=await admin.from("wifi_recovery_queue").update(patch).eq("id",job.id).eq("attempts",job.attempts).eq("status","sending");
   if(updated.error)throw updated.error;
   if(sendError && (sendError.status===429||/rate|limit|too many/i.test(sendError.message))){
    const cooldown=await admin.from("wifi_recovery_worker_control").update({next_send_at:new Date(now.getTime()+3600000).toISOString()}).eq("singleton",true);
    if(cooldown.error)throw cooldown.error;
   }
   return reply({ok:true,processed:1,result:sendError?"retry":"sent"});
  }
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"Masukkan email yang valid."},400);
  if(body.action==="request"){
   const {error}=await admin.rpc("wifi_enqueue_recovery",{p_email:email});
   if(error)throw error;
   return reply({ok:true,message:generic});
  }
  if(body.action==="verify"){
   const token=typeof body.token==="string"?body.token.trim():"";
   const password=typeof body.password==="string"?body.password:"";
   if(!/^\d{6}$/.test(token)||password.length<8||password.length>128||password!==body.confirmation)return reply({error:"Isi OTP 6 digit dan password baru yang sama (8–128 karakter)."},400);
   const {data:allowed,error:attemptError}=await admin.rpc("wifi_take_verify_attempt",{p_email:email});
   if(attemptError)throw attemptError;
   const invalid="Kode tidak valid, kedaluwarsa, belum dikirim, atau batas percobaan tercapai. Coba kembali setelah menerima kode baru.";
   if(!allowed)return reply({error:invalid},400);
   const alias=await admin.from("account_login_aliases").select("user_id").eq("login_email",email).maybeSingle();
   if(alias.error)throw alias.error;
   if(!alias.data)return reply({error:invalid},400);
   const {data:verified,error:verifyError}=await auth.auth.verifyOtp({email,token,type:"email"});
   if(verifyError||!verified.user?.email_confirmed_at||verified.user.email?.toLowerCase()!==email||!verified.user.last_sign_in_at)return reply({error:invalid},400);
   const {error:consumeError}=await admin.from("account_email_recovery_redemptions").insert({verifier_user_id:verified.user.id,signed_in_at:verified.user.last_sign_in_at,recovered_user_id:alias.data.user_id});
   if(consumeError)return reply({error:"Kode sudah digunakan atau tidak dapat diproses. Minta kode baru."},409);
   const {error:resetError}=await admin.auth.admin.updateUserById(alias.data.user_id,{password});
   if(resetError)return reply({error:"Password belum dapat diubah. Minta kode baru atau hubungi dukungan."},503);
   await admin.from("wifi_recovery_queue").update({verify_attempts:5}).eq("email",email).eq("status","sent");
   return reply({ok:true,message:"Password berhasil diubah. Masuk dengan username dan password baru."});
  }
  return reply({error:"Aksi tidak dikenal."},400);
 }catch{return reply({error:"Layanan pemulihan sementara tidak tersedia. Coba lagi nanti."},503);}
});