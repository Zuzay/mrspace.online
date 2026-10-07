import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, key);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "";
const cors = { "Access-Control-Allow-Origin": "https://mrspace.online", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const garments = new Set(["jeans", "pants", "skirt", "dress", "shirt", "jacket", "other"]);
const genders = new Set(["women", "men", "unisex"]);
const actions = new Set(["shorten", "lengthen", "take_in", "let_out", "repair", "patch", "zipper", "other"]);
const svgTags = new Set(["svg", "defs", "linearGradient", "radialGradient", "stop", "ellipse", "g", "path", "circle"]);
const svgAttrs = new Set(["xmlns", "viewBox", "role", "aria-label", "x1", "x2", "y1", "y2", "stop-color", "offset", "stop-opacity", "cx", "cy", "rx", "ry", "fill", "opacity", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "stroke-dasharray", "d", "r", "id"]);
function safePreview(value: unknown) {
  const svg = clean(value, 160_000);
  if (!svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') || !svg.endsWith("</svg>") || /\b(?:on[a-z]+|href|src|style)\s*=|javascript:|url\(\s*(?!#)|<!--|<!/i.test(svg)) return "";
  const tags = Array.from(svg.matchAll(/<\/?([A-Za-z]+)/g), m => m[1].toLowerCase());
  const attrs = Array.from(svg.matchAll(/\s([A-Za-z_:][\w:.-]*)\s*=/g), m => m[1]);
  return tags.length && tags.every(t => Array.from(svgTags).some(a => a.toLowerCase() === t)) && attrs.every(a => svgAttrs.has(a)) ? svg : "";
}

async function staff(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: admin } = await db.from("ms_admins").select("email").eq("email", email).maybeSingle();
  if (admin) return true;
  const { data: member } = await db.from("ms_site_users").select("email").eq("email", email).eq("site", "rufcut").maybeSingle();
  return !!member;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("origin") && req.headers.get("origin") !== "https://mrspace.online") return reply({ error: "origin_not_allowed" }, 403);
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    if (body.action === "submit") {
      if (clean(body.website, 120)) return reply({ ok: true }); // Honeypot
      const name = clean(body.name, 100), email = clean(body.email, 160).toLowerCase(), phone = clean(body.phone, 40);
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const preview = safePreview(body.preview_svg);
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || !rawItems.length || rawItems.length > 8 || !preview) return reply({ error: "invalid_request" }, 400);
      const items = rawItems.map((raw: unknown) => {
        const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const garment = clean(it.garment, 20), gender = clean(it.gender, 20);
        const work = Array.isArray(it.actions) ? it.actions.map(x => clean(x, 20)) : [];
        const markup = safePreview(it.preview_svg);
        const marks = (it.marks && typeof it.marks === "object" ? it.marks : {}) as Record<string, unknown>;
        const cleanMarks: Record<string, number[]> = {};
        for (const [action, point] of Object.entries(marks)) {
          if (!actions.has(action) || !Array.isArray(point) || point.length !== 2) return null;
          const x = Number(point[0]), y = Number(point[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 360 || y < 0 || y > 500) return null;
          cleanMarks[action] = [x, y];
        }
        if (!garments.has(garment) || !genders.has(gender) || !work.length || work.length > 8 || work.some(x => !actions.has(x)) || !markup) return null;
        return { garment, gender, actions: work, marks: cleanMarks, inches: clean(it.inches, 20), note: clean(it.note, 600), preview_svg: markup };
      });
      if (items.some(x => !x)) return reply({ error: "invalid_request" }, 400);
      const ticket = "RC-" + Array.from(crypto.getRandomValues(new Uint8Array(7)), x => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");
      const { data, error } = await db.from("ms_repair_jobs").insert({ ticket, site: "rufcut", customer_name: name, customer_email: email, customer_phone: phone, items, preview_svg: preview }).select("ticket").single();
      if (error) throw error;
      if (RESEND_KEY && RESEND_FROM) {
        const summary = items.map((it: Record<string, unknown>, i: number) => `${i + 1}. ${clean(it.garment, 40)} (${clean(it.gender, 20)}): ${Array.isArray(it.actions) ? it.actions.map(x => clean(x, 40)).join(", ") : ""}${it.inches ? `, ${clean(it.inches, 20)} in` : ""}${it.note ? `\n   ${clean(it.note, 600)}` : ""}`).join("\n");
        const send = (to: string, subject: string, text: string) => fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text }) });
        const results = await Promise.allSettled([send(email, `Rufcut repair ticket ${data.ticket}`, `Hi ${name},\n\nYour repair request has reached Rufcut.\nTicket: ${data.ticket}\n\n${summary}\n\nTrack its status at https://mrspace.online/rufcut/#order`), send("shop@rufcut.com", `New repair work order ${data.ticket}`, `Customer: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\nTicket: ${data.ticket}\n\n${summary}`)]);
        if (results.every(r => r.status === "fulfilled" && r.value.ok)) await db.from("ms_repair_jobs").update({ email_sent: true }).eq("ticket", data.ticket);
        else console.error("Repair order saved, but one or more email notifications failed", results);
      }
      return reply({ ticket: data.ticket });
    }
    if (body.action === "track") {
      const ticket = clean(body.ticket, 20).toUpperCase();
      const { data, error } = await db.from("ms_repair_jobs").select("ticket,status,created_at").eq("site", "rufcut").eq("ticket", ticket).maybeSingle();
      if (error) throw error;
      return data ? reply(data) : reply({ error: "not_found" }, 404);
    }
    if (!await staff(req)) return reply({ error: "unauthorized" }, 401);
    if (body.action === "list") {
      const { data, error } = await db.from("ms_repair_jobs").select("id,ticket,customer_name,customer_email,customer_phone,items,preview_svg,status,staff_notes,measurements,email_sent,created_at,updated_at").eq("site", "rufcut").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return reply({ jobs: data || [] });
    }
    if (body.action === "update") {
      const id = clean(body.id, 40), status = clean(body.status, 20);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !["received", "in_progress", "finishing", "ready", "completed"].includes(status)) return reply({ error: "invalid_update" }, 400);
      const { data: job, error: readError } = await db.from("ms_repair_jobs").select("ticket,customer_name,customer_email,status").eq("id", id).eq("site", "rufcut").maybeSingle();
      if (readError) throw readError;
      if (!job) return reply({ error: "not_found" }, 404);
      const { error } = await db.from("ms_repair_jobs").update({ status, staff_notes: clean(body.staff_notes, 3000), measurements: clean(body.measurements, 2000), updated_at: new Date().toISOString() }).eq("id", id).eq("site", "rufcut");
      if (error) throw error;
      if (RESEND_KEY && RESEND_FROM && status !== job.status) {
        const messages: Record<string, string> = { received: "Your repair request reached the shop.", in_progress: "Work has started on your repair.", finishing: "Your repair is in its finishing stage. It should be ready tomorrow. Check its status with your ticket number.", ready: "Your repair is ready for pickup at Rufcut.", completed: "Your repair work order is complete." };
        const send = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: RESEND_FROM, to: [job.customer_email], subject: `Rufcut repair update ${job.ticket}`, text: `Hi ${job.customer_name},\n\n${messages[status]}\n\nTicket: ${job.ticket}\nTrack it at https://mrspace.online/rufcut/#order` }) });
        if (!send.ok) console.error("Repair status saved, but customer email failed", send.status);
      }
      return reply({ ok: true });
    }
    return reply({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("ms-repair", e);
    return reply({ error: "repair_service_unavailable" }, 500);
  }
});
