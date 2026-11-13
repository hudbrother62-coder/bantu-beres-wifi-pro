// Username accounts can optionally use an email login alias without changing their Auth identity.
// This endpoint NEVER sets passwords, confirms emails, or grants access without password verification.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.1";

const url = Deno.env.get("SUPABASE_URL") ?? "";
function bundle(name: string) {
  try {
    const parsed = JSON.parse(Deno.env.get(name) || "{}");
    return typeof parsed.default === "string" ? parsed.default : "";
  } catch { return ""; }
}
const anon = Deno.env.get("SUPABASE_ANON_KEY") || bundle("SUPABASE_PUBLISHABLE_KEYS") || "sb_publishable_lW5aaP9gPZh8flBAB4Hvug_Z_sC46yq";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || bundle("SUPABASE_SECRET_KEYS");
const origins = new Set(["https://bantu-beres-wifi-pro.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"]);
function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://bantu-beres-wifi-pro.vercel.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}
function response(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return response({ error: "Metode tidak didukung." }, 405, origin);
  if (origin && !origins.has(origin)) return response({ error: "Asal tidak diizinkan." }, 403, origin);
  if (req.headers.get("apikey") !== anon) return response({ error: "Aplikasi tidak dikenali." }, 403, origin);
  if (!url || !serviceKey) return response({ error: "Layanan login sementara tidak tersedia." }, 503, origin);
  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 600) return response({ error: "Permintaan tidak valid." }, 400, origin);
    input = JSON.parse(raw);
  } catch { return response({ error: "Permintaan tidak valid." }, 400, origin); }
  const email = String(input.email || "").trim().toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) {
    return response({ error: "Email atau password tidak sesuai." }, 401, origin);
  }
  try {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const found = await admin.from("account_login_aliases").select("user_id").eq("login_email", email).maybeSingle();
    if (found.error) return response({ error: "Layanan login sementara tidak tersedia." }, 503, origin);
    if (!found.data?.user_id) return response({ error: "Email atau password tidak sesuai." }, 401, origin);
    const user = await admin.auth.admin.getUserById(found.data.user_id);
    if (user.error || !user.data.user?.email) return response({ error: "Email atau password tidak sesuai." }, 401, origin);
    const auth = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
    const result = await auth.auth.signInWithPassword({ email: user.data.user.email, password });
    if (result.error || !result.data.session?.access_token || !result.data.session?.refresh_token) {
      return response({ error: "Email atau password tidak sesuai." }, 401, origin);
    }
    return response({
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token
    }, 200, origin);
  } catch {
    return response({ error: "Login sementara tidak dapat diproses." }, 503, origin);
  }
});
