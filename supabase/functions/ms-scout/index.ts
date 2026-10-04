// ms-scout · Mr. Space fikir avcisi
// Her gece Reddit, Hacker News ve kucuk isletme sitelerini tarar.
// Yapay zeka kullanmaz, maliyeti sifir. Bulduklarini ms_ideas tablosuna yazar.
// Supabase'de "Enforce JWT verification" KAPALI olmali; giris x-ms-secret ile korunur.

import { createClient } from "jsr:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const UA = "Mozilla/5.0 (compatible; mrspace-scout/1.0; +https://mrspace.online)";
const BUDGET_MS = 120_000;   // ucretsiz planin suresine sigsin diye
const MAX_SITES = 10;        // gece basina taranan site
const MAX_REDDIT = 12;       // gece basina okunan subreddit (en eski okunanlardan)

// Musteri sitesinde etkilesimli arac oldugunu gosteren ifadeler
const TOOL_PHRASES = [
  "build your own", "design your own", "create your own", "make your own",
  "customize your", "customise your", "personalize your", "personalise your",
  "configurator", "customizer", "design your cake", "cake builder",
  "bouquet builder", "build a bouquet", "build your bouquet", "outfit builder",
  "virtual try", "try it on", "3d preview", "live preview", "fit finder",
  "size finder", "price calculator", "quote calculator", "book a fitting",
  "choose your fabric", "pick your fabric", "monogram",
];

// Cizim / tasarim araci kutuphaneleri
const TOOL_LIBS: { name: string; re: RegExp }[] = [
  { name: "fabric.js", re: /fabric(\.min)?\.js|fabric@\d/i },
  { name: "konva", re: /konva(\.min)?\.js|konva@\d/i },
  { name: "three.js", re: /three(\.module)?(\.min)?\.js|three@\d/i },
  { name: "babylon", re: /babylon(\.min)?\.js/i },
  { name: "p5.js", re: /p5(\.min)?\.js/i },
  { name: "paper.js", re: /paper-(full|core)(\.min)?\.js/i },
  { name: "pixi", re: /pixi(\.min)?\.js/i },
  { name: "model-viewer", re: /<model-viewer/i },
  { name: "canvas", re: /<canvas/i },
];

// Reddit / HN gonderisinin bizimle ilgili olup olmadigi
const POST_WORDS = [
  "website", "web site", "online store", "tool", "app", "booking", "appointment",
  "customer", "orders", "pre-order", "slogan", "tagline", "logo", "menu",
  "pos", "shopify", "square", "squarespace", "wix", "instagram", "qr",
  "label", "inventory", "price list", "quote", "custom order",
];

const SKIP_HOST = /(^|\.)(reddit\.com|redd\.it|youtube\.com|youtu\.be|imgur\.com|twitter\.com|x\.com|instagram\.com|facebook\.com|tiktok\.com|amazon\.[a-z.]+|etsy\.com|ebay\.[a-z.]+|github\.com|google\.[a-z.]+|apple\.com|wikipedia\.org|medium\.com|substack\.com|ycombinator\.com|pinterest\.[a-z.]+|linkedin\.com)$/i;

type Idea = {
  kind: "tool" | "phrase" | "theme" | "post";
  sector: string;
  title: string;
  url: string | null;
  source: string;
  signals: Record<string, unknown>;
  score: number;
};

// ---------- yardimcilar ----------
async function get(url: string, ms = 8000, accept = "*/*") {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": accept },
    signal: AbortSignal.timeout(ms),
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r;
}
function decode(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function clean(s: string) {
  return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function strip(html: string) {
  return clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
}
function meta(html: string, name: string) {
  const tag = html.match(new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*>`, "i"));
  if (!tag) return "";
  const c = tag[0].match(/content=["']([^"']*)["']/i);
  return c ? clean(c[1]) : "";
}
function firstTag(html: string, t: string) {
  const m = html.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i"));
  return m ? clean(m[1]) : "";
}
function okSite(u: string) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return false;
    if (SKIP_HOST.test(x.hostname)) return false;
    if (/\.(jpe?g|png|gif|webp|mp4|pdf|zip)$/i.test(x.pathname)) return false;
    return true;
  } catch { return false; }
}
function wordsIn(text: string, list: string[]) {
  const t = text.toLowerCase();
  return list.filter((w) => w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(t) : t.includes(w));
}

// ---------- renk ve yazi tipi sinyalleri ----------
function topColors(css: string) {
  const count = new Map<string, number>();
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if ((r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) continue;
    count.set("#" + h, (count.get("#" + h) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
}
const GENERIC_FONTS = /^(inherit|initial|unset|sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|apple color emoji|segoe ui emoji|var\(.*)$/i;
function fontsOf(css: string, html: string) {
  const count = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").replace(/!important/i, "").trim();
    if (!first || GENERIC_FONTS.test(first)) continue;
    count.set(first, (count.get(first) || 0) + 1);
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) {
    for (const f of decode(m[1]).matchAll(/family=([^:&]+)/g)) {
      const name = decodeURIComponent(f[1]).replace(/\+/g, " ").trim();
      count.set(name, (count.get(name) || 0) + 5);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f);
}

// ---------- kaynaklar ----------
type Post = { title: string; text: string; ups: number; link: string; out: string | null };

async function reddit(sub: string): Promise<Post[]> {
  try {
    const j = await (await get(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=25`, 8000, "application/json")).json();
    return (j?.data?.children || []).map((c: any) => ({
      title: c.data.title || "",
      text: c.data.selftext || "",
      ups: c.data.ups || 0,
      link: "https://www.reddit.com" + c.data.permalink,
      out: c.data.is_self ? null : c.data.url || null,
    }));
  } catch {
    // JSON engellenirse RSS dene (oy sayisi yok)
    const x = await (await get(`https://www.reddit.com/r/${sub}/top/.rss?t=day&limit=25`, 8000, "application/atom+xml")).text();
    return [...x.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
      const e = m[1];
      const content = decode((e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || "");
      const outs = [...content.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((a) => a[1]).filter(okSite);
      return {
        title: clean((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""),
        text: clean(content),
        ups: 0,
        link: (e.match(/<link href="([^"]+)"/) || [])[1] || "",
        out: outs[0] || null,
      };
    });
  }
}

async function hn(q: string) {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const u = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=show_hn&numericFilters=created_at_i>${since},points>5&hitsPerPage=15`;
  const j = await (await get(u, 8000, "application/json")).json();
  return (j?.hits || []).map((h: any) => ({
    title: h.title || "",
    points: h.points || 0,
    link: `https://news.ycombinator.com/item?id=${h.objectID}`,
    out: h.url || null,
  }));
}

async function scanSite(url: string, sector: string): Promise<Idea[]> {
  const out: Idea[] = [];
  const r = await get(url, 8000, "text/html");
  if (!(r.headers.get("content-type") || "").includes("html")) return out;
  const html = (await r.text()).slice(0, 800_000);
  const base = new URL(r.url);
  const host = base.hostname.replace(/^www\./, "");
  const siteTitle = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || host).slice(0, 90);
  const text = strip(html);

  // 1) Arac
  const libs = TOOL_LIBS.filter((l) => l.re.test(html)).map((l) => l.name);
  const phrases = wordsIn(text, TOOL_PHRASES);
  const strong = libs.some((l) => l !== "canvas");
  if (strong || phrases.length) {
    out.push({
      kind: "tool", sector, url: base.href, source: "site",
      title: `${siteTitle} : ${phrases[0] || libs.find((l) => l !== "canvas") || libs[0]}`,
      signals: { host, libs, phrases },
      score: 20 + libs.length * 10 + phrases.length * 5,
    });
  }

  // 2) Sozler (sadece ilham, birebir kullanilmaz)
  const seen = new Set<string>();
  const cands: [string, string][] = [
    ["h1", firstTag(html, "h1")],
    ["og", meta(html, "og:description")],
    ["meta", meta(html, "description")],
    ["h2", firstTag(html, "h2")],
  ];
  for (const [where, c] of cands) {
    if (!c || seen.has(c.toLowerCase())) continue;
    const n = c.split(/\s+/).length;
    if (n < 3 || n > 14) continue;
    if (/cookie|javascript|privacy|copyright|©|log ?in|sign ?up|cart|404|not found/i.test(c)) continue;
    seen.add(c.toLowerCase());
    out.push({ kind: "phrase", sector, url: base.href, source: "site", title: c.slice(0, 200), signals: { host, where, site: siteTitle }, score: 10 });
    if (seen.size >= 2) break;
  }

  // 3) Tema sinyalleri
  let css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("\n") + " " + (html.match(/style="[^"]*"/gi) || []).join(" ");
  const sheets = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((m) => (m[0].match(/href=["']([^"']+)["']/i) || [])[1]).filter(Boolean).slice(0, 3);
  for (const h of sheets) {
    try {
      const u = new URL(h!, base);
      if (u.hostname.includes("fonts.googleapis")) continue;
      css += "\n" + (await (await get(u.href, 5000, "text/css")).text()).slice(0, 400_000);
    } catch { /* stil dosyasi acilmadiysa gec */ }
  }
  const colors = topColors(css);
  const fonts = fontsOf(css, html);
  if (colors.length >= 3) {
    out.push({ kind: "theme", sector, url: base.href, source: "site", title: host, signals: { host, colors, fonts, site: siteTitle }, score: 5 + colors.length + fonts.length });
  }
  return out;
}

// ---------- ana is ----------
async function run() {
  const t0 = Date.now();
  const left = () => BUDGET_MS - (Date.now() - t0);
  const ideas: Idea[] = [];
  const queue = new Map<string, string>();      // site adresi -> sektor
  const touched: number[] = [];
  const errors: string[] = [];
  let scanned = 0;

  const { data: sources } = await db.from("ms_scout_sources").select("*").eq("active", true)
    .order("last_run", { ascending: true, nullsFirst: true });
  const all = sources || [];

  // Reddit (sirayla, kibar)
  for (const s of all.filter((x) => x.kind === "reddit").slice(0, MAX_REDDIT)) {
    if (left() < 60_000) break;
    try {
      for (const p of await reddit(s.ref)) {
        const blob = p.title + " " + p.text;
        const tool = wordsIn(blob, TOOL_PHRASES);
        const hits = wordsIn(blob, POST_WORDS);
        if (!tool.length && hits.length < 2) continue;
        ideas.push({
          kind: tool.length ? "tool" : "post", sector: s.sector, url: p.link, source: `reddit:r/${s.ref}`,
          title: p.title.slice(0, 200),
          signals: { ups: p.ups, words: [...tool, ...hits].slice(0, 8), out: p.out },
          score: Math.round(Math.log10(p.ups + 1) * 10 + hits.length * 5 + tool.length * 15),
        });
        if (p.out && okSite(p.out)) queue.set(p.out, s.sector);
      }
      touched.push(s.id);
    } catch (e) { errors.push(`r/${s.ref}: ${(e as Error).message}`); }
    await new Promise((r) => setTimeout(r, 1200));
  }

  // Hacker News
  for (const s of all.filter((x) => x.kind === "hn")) {
    if (left() < 50_000) break;
    try {
      for (const h of await hn(s.ref)) {
        const tool = wordsIn(h.title, TOOL_PHRASES);
        ideas.push({
          kind: tool.length || /builder|configurator|customi[sz]er|designer|editor/i.test(h.title) ? "tool" : "post",
          sector: s.sector, url: h.link, source: "hn", title: h.title.slice(0, 200),
          signals: { points: h.points, out: h.out, query: s.ref },
          score: Math.round(Math.log10(h.points + 1) * 10 + tool.length * 15),
        });
      }
      touched.push(s.id);
    } catch (e) { errors.push(`hn ${s.ref}: ${(e as Error).message}`); }
  }

  // Siteler: kayitli olanlardan en eski okunanlar + bu gece bulunanlar
  const siteSources = all.filter((x) => x.kind === "site").slice(0, 5);
  for (const s of siteSources) { queue.set(s.ref, s.sector); touched.push(s.id); }
  for (const [url, sector] of [...queue.entries()].slice(0, MAX_SITES)) {
    if (left() < 15_000) break;
    try { ideas.push(...await scanSite(url, sector)); scanned++; }
    catch (e) { errors.push(`${new URL(url).hostname}: ${(e as Error).message}`); }
  }

  // Yeni bulunan siteleri kaynak listesine ekle (liste kendi buyur)
  const newSites = [...queue.entries()]
    .filter(([u]) => !siteSources.some((s) => s.ref === u))
    .map(([u, sector]) => ({ kind: "site", ref: new URL(u).origin + "/", sector }));
  if (newSites.length) await db.from("ms_scout_sources").upsert(newSites, { onConflict: "kind,ref", ignoreDuplicates: true });

  // Kaydet
  let added = 0;
  if (ideas.length) {
    const { data, error } = await db.from("ms_ideas").upsert(ideas, { onConflict: "fp", ignoreDuplicates: true }).select("id");
    if (error) errors.push(`save: ${error.message}`);
    added = data?.length || 0;
  }
  if (touched.length) await db.from("ms_scout_sources").update({ last_run: new Date().toISOString() }).in("id", touched);

  await db.from("ms_activity").insert({
    site: null, who: "auto",
    action: `Scout: ${added} new ideas`,
    meta: { scanned_sites: scanned, seconds: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 6) },
  });
}

Deno.serve(async (req) => {
  const { data } = await db.from("ms_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!data || req.headers.get("x-ms-secret") !== data.value) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  EdgeRuntime.waitUntil(run().catch(async (e) => {
    await db.from("ms_activity").insert({ site: null, who: "auto", action: `Scout failed: ${String(e).slice(0, 150)}` });
  }));
  return new Response(JSON.stringify({ ok: true, started: true }), { headers: { "Content-Type": "application/json" } });
});
