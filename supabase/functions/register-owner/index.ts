// Public username registration. Only this Edge Function may use the service role.
// The browser must NEVER receive a service-role/secret key.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const allowedOrigins = new Set([
  "https://bantu-beres-wifi-pro.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
// This is the PUBLIC publishable key, not a secret. Authorization is enforced by
// input validation, duplicate protection, scoped operations and request throttling.
const publishableKey = "sb_publishable_lW5aaP9gPZh8flBAB4Hvug_Z_sC46yq";
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://bantu-beres-wifi-pro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const response = (body: Record<string, unknown>, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const normalize = (value: unknown) => String(value ?? "").trim();
const encoder = new TextEncoder();

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (request.method !== "POST") return response({ error: "Metode tidak diizinkan." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return response({ error: "Asal permintaan tidak diizinkan." }, 403, origin);
  if (request.headers.get("apikey") !== publishableKey) return response({ error: "Aplikasi tidak terverifikasi. Muat ulang halaman." }, 403, origin);

  try {
    const payloadText = await request.text();
    if (payloadText.length > 2048) return response({ error: "Data pendaftaran terlalu panjang." }, 413, origin);
    let data: Record<string, unknown>;
    try { data = JSON.parse(payloadText); } catch { return response({ error: "Format pendaftaran tidak valid." }, 400, origin); }
    const username = normalize(data.username).toLowerCase();
    const password = String(data.password ?? "");
    const businessName = normalize(data.businessName);
    const ownerName = normalize(data.ownerName);
    if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(username))
      return response({ error: "Username harus 3–32 karakter (huruf, angka, titik, _ atau -)." }, 400, origin);
    if (password.length < 8 || password.length > 128)
      return response({ error: "Kata sandi harus 8–128 karakter." }, 400, origin);
    if (!businessName || businessName.length > 120 || !ownerName || ownerName.length > 120)
      return response({ error: "Nama usaha dan nama pemilik wajib diisi (maksimal 120 karakter)." }, 400, origin);

    const url = Deno.env.get("SUPABASE_URL");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !secret) return response({ error: "Konfigurasi server belum tersedia." }, 503, origin);
    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rawIp = normalize(request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]);
    let attemptKey: string | null = null;
    if (rawIp) {
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(rawIp + ":" + secret));
      attemptKey = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
    }
    const usernameCount = await admin.from("registration_attempts").select("id", { count: "exact", head: true })
      .eq("username", username).gte("attempted_at", since);
    if (usernameCount.error) return response({ error: "Pendaftaran sementara belum tersedia. Coba sebentar lagi." }, 503, origin);
    if ((usernameCount.count ?? 0) >= 5) return response({ error: "Terlalu banyak percobaan untuk username ini. Coba lagi dalam satu jam." }, 429, origin);
    if (attemptKey) {
      const ipCount = await admin.from("registration_attempts").select("id", { count: "exact", head: true })
        .eq("attempt_key", attemptKey).gte("attempted_at", since);
      if (ipCount.error) return response({ error: "Pendaftaran sementara belum tersedia. Coba sebentar lagi." }, 503, origin);
      if ((ipCount.count ?? 0) >= 10) return response({ error: "Terlalu banyak pendaftaran. Coba lagi dalam satu jam." }, 429, origin);
    }
    const { error: logError } = await admin.from("registration_attempts").insert({ attempt_key: attemptKey, username });
    if (logError) return response({ error: "Pendaftaran sementara belum tersedia. Coba sebentar lagi." }, 503, origin);

    const email = `${username}@wifi-users.bantuberes.com`;
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, business_name: businessName, owner_name: ownerName }
    });
    if (userError || !created.user) {
      const conflict = /already|exists|registered|duplicate/i.test(userError?.message ?? "");
      return response({ error: conflict ? "Username sudah digunakan. Masuk dengan akun tersebut atau pilih username lain." : "Akun belum berhasil dibuat. Coba lagi." }, conflict ? 409 : 400, origin);
    }
    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id, business_name: businessName, owner_name: ownerName
    });
    if (profileError) {
      // Roll back only this newly-created account; never touch other users.
      await admin.auth.admin.deleteUser(created.user.id);
      return response({ error: "Data usaha belum berhasil disiapkan. Coba lagi." }, 500, origin);
    }
    return response({ ok: true }, 201, origin);
  } catch (error) {
    console.error("register-owner failure:", error instanceof Error ? error.name : "unknown");
    return response({ error: "Pendaftaran sementara belum dapat diproses. Coba lagi." }, 500, origin);
  }
});
