import { createClient } from "npm:@supabase/supabase-js@2.75.1";
const url=Deno.env.get("SUPABASE_URL")||"";
function bundle(name:string){try{return JSON.parse(Deno.env.get(name)||"{}").default||"";}catch{return "";}}
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||bundle("SUPABASE_SECRET_KEYS");
const resend=Deno.env.get("RESEND_API_KEY")||"";
const sender=Deno.env.get("PASSWORD_RESET_FROM")||"";
const secret=Deno.env.get("OTP_QUEUE_ENCRYPTION_KEY")||"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-supabase-api-version","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const encoder=new TextEncoder();
const generic="Jika email tertaut, permintaan OTP diterima. Cek email dan spam. Jika kuota penuh, pengiriman dicoba kembali setiap jam.";
const invalid="Kode tidak valid, belum dikirim, sudah digunakan, atau kedaluwarsa. Minta kode baru.";
function sameSecret(a:string,b:string){if(!a||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function sign(message:string){const key=await crypto.subtle.importKey("raw",Uint8Array.from(secret.match(/../g)!.map(s=>parseInt(s,16))),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(message)));}
async function otp(generation:string){for(let i=0;i<16;i++){const bytes=await sign("otp:"+generation+":"+i);const n=new DataView(bytes.buffer).getUint32(0);if(n<4294000000)return String(n%1000000).padStart(6,"0");}throw Error("OTP generation failure");}
async function digest(generation:string,code:string){return Array.from(await sign("verify:"+generation+":"+code),x=>x.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Metode tidak didukung."},405);
 if(!url||!service||!resend||!sender||!/^[0-9a-f]{64}$/i.test(secret))return reply({error:"Pengiriman OTP belum dikonfigurasi. Hubungi pengelola."},503);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 try{
  const raw=await req.text();if(raw.length>2048)return reply({error:"Permintaan tidak valid."},400);
  const body=JSON.parse(raw);
  async function drain(){
   const {data,error}=await admin.rpc("wifi_resend_claim");if(error)throw error;
   const job=data?.[0];if(!job)return {processed:0};
   const code=await otp(job.generation), hash=await digest(job.generation,code);
   let response:Response|undefined;let receipt:any;
   try{response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+resend,"Content-Type":"application/json","Idempotency-Key":"wifi-otp-"+job.generation},body:JSON.stringify({from:sender,to:[job.email],subject:"Kode OTP WiFi Pro",text:"Kode OTP WiFi Pro: "+code+"\nBerlaku 10 menit setelah pengiriman. Jangan bagikan kode ini."}),signal:AbortSignal.timeout(12000)});receipt=await response.json().catch(()=>null);}catch{}
   const accepted=Boolean(response?.ok&&typeof receipt?.id==="string"&&receipt.id);
   const retryable=!response||response.status===408||response.status===409||response.status===429||response.status>=500||response.ok;
   const now=new Date();
   const patch=accepted?{status:"sent",sent_at:now.toISOString(),verify_attempts:0,otp_digest:hash,provider_id:receipt.id}:{status:retryable&&job.attempts<8?"pending":"failed",next_attempt_at:new Date(now.getTime()+3600000).toISOString(),otp_digest:null};
   const updated=await admin.from("wifi_recovery_queue").update(patch).eq("id",job.id).eq("generation",job.generation).eq("attempts",job.attempts).eq("status","sending");if(updated.error)throw updated.error;
   if(response?.status===429){const c=await admin.from("wifi_recovery_worker_control").update({next_send_at:new Date(now.getTime()+3600000).toISOString()}).eq("singleton",true);if(c.error)throw c.error;}
   return {processed:1};
  }
  if(body.action==="worker"){
   const control=await admin.from("wifi_recovery_worker_control").select("secret").eq("singleton",true).single();
   if(control.error||!sameSecret(req.headers.get("x-worker-secret")||"",control.data.secret))return reply({error:"Tidak diizinkan."},403);
   return reply({ok:true,...await drain()});
  }
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"Masukkan email yang valid."},400);
  if(body.action==="request"){
   const {error}=await admin.rpc("wifi_resend_enqueue",{p_email:email});if(error)throw error;
   // Worker owns sending; a public request never directly spends email quota.
   return reply({ok:true,message:generic});
  }
  if(body.action==="verify"){
   const token=typeof body.token==="string"?body.token.trim():"",password=typeof body.password==="string"?body.password:"";
   if(!/^\d{6}$/.test(token)||password.length<8||password.length>128||password!==body.confirmation)return reply({error:"Isi OTP 6 digit dan password baru yang sama (8–128 karakter)."},400);
   const job=await admin.from("wifi_recovery_queue").select("generation").eq("email",email).maybeSingle();
   if(job.error)throw job.error;
   if(!job.data)return reply({error:invalid},400);
   const {data:userId,error}=await admin.rpc("wifi_resend_consume",{p_email:email,p_generation:job.data.generation,p_digest:await digest(job.data.generation,token)});
   if(error)throw error;if(!userId)return reply({error:invalid},400);
   const {error:resetError}=await admin.auth.admin.updateUserById(userId,{password});
   if(resetError)return reply({error:"Password belum dapat diubah. Minta kode baru atau hubungi dukungan."},503);
   return reply({ok:true,message:"Password berhasil diubah. Masuk dengan username dan password baru."});
  }
  return reply({error:"Aksi tidak dikenal."},400);
 }catch{return reply({error:"Layanan pemulihan sementara tidak tersedia. Coba lagi nanti."},503);}
});