// Secure server-side bridge from the Mr. Space admin panel to Heron's existing admin API.
// Set HERON_ADMIN_PASSWORD as a Supabase Function secret. Never expose it to the browser.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HERON_PASSWORD = Deno.env.get("HERON_ADMIN_PASSWORD") || "";
const db = createClient(URL, SERVICE_KEY);
const CORS = {
  "Access-Control-Allow-Origin": "https://mrspace.online",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...CORS, "Content-Type": "application/json" },
});

const HERON_ACTIONS = new Set([
  "admin_list", "admin_create", "admin_offers", "admin_offer_answer", "admin_queue",
  "admin_queue_set", "admin_import", "admin_add_photos", "admin_general", "admin_reprice",
  "admin_consign", "admin_mark_sold", "admin_ebay_photos", "admin_recent", "admin_cash_sale",
  "admin_receipts", "admin_receipt_log",
]);
const HERON_WRITES = new Set([
  "admin_create", "admin_offer_answer", "admin_queue_set", "admin_import", "admin_add_photos",
  "admin_general", "admin_reprice", "admin_consign", "admin_mark_sold", "admin_ebay_photos",
  "admin_cash_sale", "admin_receipt_log",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: { user }, error } = await db.auth.getUser(jwt);
    if (error || !user?.email) return json({ error: "unauthorized" }, 401);
    const { data: admin } = await db.from("ms_admins").select("email").eq("email", user.email.toLowerCase()).maybeSingle();
    if (!admin) return json({ error: "forbidden" }, 403);
    if (!HERON_PASSWORD) return json({ error: "heron_bridge_not_configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (!HERON_ACTIONS.has(action)) return json({ error: "action_not_allowed" }, 400);
    const response = await fetch("https://wvvizyrroqejwrfadbpx.supabase.co/functions/v1/heron-shop", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": HERON_PASSWORD },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let result: unknown;
    try { result = text ? JSON.parse(text) : {}; } catch { result = { error: "invalid_heron_response" }; }
    if (response.ok && HERON_WRITES.has(action)) {
      await db.from("ms_activity").insert({ site: "heron", who: "uzay", action: `Site control: ${action}` }).catch(() => {});
    }
    return json(result, response.status);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
