// Secure server-side bridge from the Mr. Space admin panel to Heron's existing admin API.
// Uses a verified current admin JWT, or an existing legacy HERON_ADMIN_PASSWORD server secret.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "../../../assets/ms-render.js";
import { createDraft } from "../../../ms/draft-render.mjs";

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
  status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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

async function prepareDrafts() {
  const prepared: { id: number; status: string }[] = [];
  for (let n = 0; n < 2; n++) {
    const { data: job, error: claimError } = await db.rpc("ms_claim_draft");
    if (claimError) return json({ error: "draft_claim_failed" }, 503);
    if (!job) break;
    let html = null, error = null;
    try { html = createDraft(job, (globalThis as unknown as { MsRender: unknown }).MsRender); }
    catch (e) { error = ["invalid_brief", "human_implementation_required", "invalid_kind"].includes((e as Error).message) ? (e as Error).message : "preparation_failed"; }
    const { error: saveError } = await db.rpc("ms_complete_draft", { p_id: job.id, p_html: html, p_error: error });
    if (saveError) return json({ error: "draft_save_failed" }, 503);
    prepared.push({ id: job.id, status: error ? "failed" : "review" });
  }
  return json({ ok: true, prepared });
}

async function checkConnections(jwt: string, site: string, email: string) {
  if (!/^[a-z0-9_-]{1,80}$/.test(site)) return json({ error: "invalid_site" }, 400);
  const { data: found, error: siteError } = await db.from("ms_sites").select("slug").eq("slug", site).maybeSingle();
  if (siteError || !found) return json({ error: "unknown_site" }, 404);
  const client = createClient(URL, SERVICE_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const rows: { site: string; service: string; state: string; checked_at: string; error_code: string | null }[] = [];
  const record = (service: string, state: string, code: string | null = null) => rows.push({ site, service, state, checked_at: new Date().toISOString(), error_code: code });
  const { error: requestError } = await client.rpc("ms_workspace_snapshot", { p_site: site });
  record("requests", requestError ? "error" : "connected", requestError ? "workspace_rpc_unavailable" : null);
  if (site === "heron") {
    {
      try {
        const r = await fetch("https://wvvizyrroqejwrfadbpx.supabase.co/functions/v1/heron-shop", {
          method: "POST", headers: { "Content-Type": "application/json", ...(HERON_PASSWORD?{"x-admin-password":HERON_PASSWORD}:{"x-mrspace-token":jwt}) },
          body: JSON.stringify({ action: "admin_list" }), signal: AbortSignal.timeout(8000),
        });
        const data = await r.json();
        record("heron", r.ok && !data.error ? "connected" : r.status===401&&!HERON_PASSWORD?"setup":"error", r.ok && !data.error ? null : r.status===401&&!HERON_PASSWORD?"heron_bridge_update_required":"heron_read_failed");
      } catch { record("heron", "error", "heron_unreachable"); }
    }
  } else if (site === "laloo") {
    const { data: nativeAdmin, error: nativeError } = await db.from("admins").select("email").eq("email", email.toLowerCase()).maybeSingle();
    if (nativeError || !nativeAdmin) record("laloo", "setup", "native_access_missing");
    else { const { error } = await client.from("cities").select("id").limit(1); record("laloo", error ? "error" : "connected", error ? "laloo_read_failed" : null); }
  } else if (site === "rufcut") {
    try {
      const r = await fetch(`${URL}/functions/v1/ms-square`, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: "status", site }), signal: AbortSignal.timeout(8000) });
      const data = await r.json(); record("square", r.ok ? data.connected ? "connected" : "setup" : "error", r.ok ? data.connected ? null : "square_not_connected" : "square_status_failed");
    } catch { record("square", "error", "square_unreachable"); }
    try {
      const r = await fetch(`${URL}/functions/v1/ms-repair`, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: "list" }), signal: AbortSignal.timeout(8000) });
      const data = await r.json(); record("repair", r.ok && Array.isArray(data.jobs) ? "connected" : "error", r.ok && Array.isArray(data.jobs) ? null : "repair_read_failed");
    } catch { record("repair", "error", "repair_unreachable"); }
  } else {
    const { error } = await client.from("ms_builds").select("id").eq("site", site).limit(1);
    record("builder", error ? "error" : "connected", error ? "builder_read_failed" : null);
  }
  const { error: saveError } = await db.from("ms_service_connections").upsert(rows, { onConflict: "site,service" });
  if (saveError) return json({ error: "connection_status_not_saved" }, 503);
  return json({ ok: true, checks: rows });
}

async function previewSnapshot(site: string) {
  const { data: s, error } = await db.from("ms_sites").select("url").eq("slug", site).maybeSingle();
  if (error || !s?.url) return json({ error: "preview_unavailable" }, 404);
  const hosts = new Set(["mrspace.online", "www.mrspace.online", "heronca.com", "www.heronca.com", "laloo.org", "www.laloo.org"]);
  let url = new globalThis.URL(s.url);
  for (let i = 0; i < 3; i++) {
    if (url.protocol !== "https:" || !hosts.has(url.hostname) || url.port || url.username || url.password) return json({ error: "preview_host_not_allowed" }, 400);
    const r = await fetch(url.href, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = new globalThis.URL(r.headers.get("location")!, url); continue; }
    if (!r.ok || !r.headers.get("content-type")?.includes("text/html")) return json({ error: "preview_fetch_failed" }, 502);
    const reader = r.body?.getReader(); if (!reader) return json({ error: "preview_fetch_failed" }, 502);
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > 1_000_000) { await reader.cancel(); return json({ error: "preview_too_large" }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return json({ html: new TextDecoder().decode(bytes), source_url: url.href, fetched_at: new Date().toISOString() });
  }
  return json({ error: "preview_redirect_limit" }, 502);
}

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
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "prepare_drafts") return await prepareDrafts();
    if (action === "check_connections") return await checkConnections(jwt, String(body.site || ""), user.email);
    if (action === "preview_snapshot") return await previewSnapshot(String(body.site || ""));
    if (!HERON_ACTIONS.has(action)) return json({ error: "action_not_allowed" }, 400);
    const response = await fetch("https://wvvizyrroqejwrfadbpx.supabase.co/functions/v1/heron-shop", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(HERON_PASSWORD?{"x-admin-password":HERON_PASSWORD}:{"x-mrspace-token":jwt}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let result: unknown;
    try { result = text ? JSON.parse(text) : {}; } catch { result = { error: "invalid_heron_response" }; }
    if (!response.ok) return json({ error: response.status===401&&!HERON_PASSWORD?"heron_bridge_update_required":"heron_action_failed" }, response.status===401&&!HERON_PASSWORD?503:response.status);
    if (response.ok && HERON_WRITES.has(action)) {
      try { await db.from("ms_activity").insert({ site: "heron", who: "uzay", action: `Site control: ${action}` }); } catch {}
    }
    return json(result, response.status);
  } catch (e) {
    console.error("site-control request failed");
    return json({ error: "site_control_failed" }, 500);
  }
});
