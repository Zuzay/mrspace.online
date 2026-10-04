// ms-builder · Mr. Space kurucu fonksiyonu
// 1) action=check : gonderilen sitenin arka plan kontrolleri (zamanlayici sifresiyle)
// 2) action=upload: musteri / yonetici gorsel yukleme (sitenin gizli linkiyle)
// Supabase'de "Enforce JWT verification" KAPALI olmali.
// Istege bagli: GOOGLE_SAFE_BROWSING_KEY ortam degiskeni (ucretsiz) eklenirse link guvenligi de bakilir.

import { createClient } from "jsr:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SAFE_KEY = Deno.env.get("GOOGLE_SAFE_BROWSING_KEY") || "";
const UA = "Mozilla/5.0 (compatible; mrspace-check/1.0; +https://mrspace.online)";
const MEDIA = `${SB_URL}/storage/v1/object/public/ms-media/`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ms-secret, apikey, authorization",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Level = "pass" | "info" | "warn" | "fail";
type Check = { code: string; level: Level; message: string; details?: unknown };

// ---------- kelime listeleri ----------
const FAIL_WORDS = ["cocaine", "heroin", "methamphetamine", "kokain", "eroin", "escort", "porn", "porno",
  "xxx", "casino", "online betting", "bahis", "kumar", "firearms for sale", "ruhsatsız silah", "fake id"];
const WARN_WORDS = ["cannabis", "marijuana", "weed", "cbd", "thc", "vape", "kratom", "esrar",
  "guaranteed results", "garantili", "miracle cure", "mucize", "%100 garanti"];
const ALCOHOL = ["alcohol", "alkol", "beer", "bira", "wine", "şarap", "rakı", "raki", "vodka", "votka",
  "whisky", "whiskey", "viski", "gin", "tequila", "cocktail", "kokteyl", "happy hour", "shots"];
const PLACEHOLDER = /lorem ipsum|dolor sit amet|your (text|title|name|business) here|buraya (yaz|metin|başlık)|\bTODO\b|\bTBD\b|placeholder|example\.com|xxx-xxx|\[[^\]\n]{2,80}\]/i;

// ---------- yardimcilar ----------
function walk(v: unknown, path: string, out: { path: string; key: string; value: string }[]) {
  if (typeof v === "string") { out.push({ path, key: path.split(".").pop() || "", value: v }); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}.${i}`, out)); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, out);
}
const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());
const IMG_KEY = /(^|\.)(image|logo|src|photo|cover)$/i;
function hasWord(text: string, w: string) {
  const esc = w.replace(/[.*+?^${}()|[\]\\%]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}
async function fetchT(url: string, ms = 8000, init: RequestInit = {}) {
  return await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(ms), redirect: "follow" });
}
function hexToRgb(h: string) {
  const m = (h || "").replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let x = m[1]; if (x.length === 3) x = x.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
}
function lum(rgb: number[]) {
  const [r, g, b] = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return null;
  const l1 = lum(x), l2 = lum(y);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function shingles(text: string) {
  const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(" "));
  return s;
}

// ---------- kontroller ----------
async function runChecks(buildId: number) {
  const { data: b } = await db.from("ms_builds").select("*").eq("id", buildId).single();
  if (!b) return;
  const { data: s } = await db.from("ms_sites").select("*").eq("slug", b.site).single();
  const country = (s?.country || "").toUpperCase();
  const out: Check[] = [];

  const strings: { path: string; key: string; value: string }[] = [];
  walk(b.content, "", strings);
  const urls = strings.filter((x) => isUrl(x.value));
  const images = urls.filter((x) => IMG_KEY.test(x.path) || /\.images\.\d+\.url$/.test(x.path));
  const links = urls.filter((x) => !images.includes(x));
  const texts = strings.filter((x) => !isUrl(x.value));
  const allText = texts.map((x) => x.value).join("\n");

  // 1) Yasak ve riskli icerik
  const bad = FAIL_WORDS.filter((w) => hasWord(allText, w));
  const risky = WARN_WORDS.filter((w) => hasWord(allText, w));
  if (bad.length) out.push({ code: "content", level: "fail", message: "Yasak içerik kelimesi var.", details: { words: bad } });
  else if (risky.length) out.push({ code: "content", level: "warn", message: "Riskli ifade var, bağlamına bak.", details: { words: risky } });
  else out.push({ code: "content", level: "pass", message: "Yasak ya da riskli içerik bulunmadı." });

  // 1b) Alkol (Turkiye'de tanitim yasak)
  const alc = ALCOHOL.filter((w) => hasWord(allText, w));
  if (alc.length && country === "TR") {
    out.push({ code: "alcohol", level: "warn", message: "Türkiye'de alkol tanıtımı yasak. İçki kampanyası, indirim ve tanıtıcı dil olmamalı.", details: { words: alc } });
  } else if (alc.length && !country) {
    out.push({ code: "alcohol", level: "info", message: "Alkol geçiyor ve sitenin ülkesi girilmemiş. Ülkeyi gir, kurala göre bakılsın.", details: { words: alc } });
  }

  // 2) Doldurulmamis yerler
  const ph = texts.filter((x) => PLACEHOLDER.test(x.value)).map((x) => x.path);
  const missing: string[] = [];
  if (b.mode === "fill") {
    for (const f of (s?.field_schema?.fields || []) as any[]) {
      const v = b.content?.[String(f.key).replace(/\./g, "_")];
      if (f.required && (v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length))) missing.push(f.label || f.key);
      if (f.max && typeof v === "string" && v.length > f.max) missing.push(`${f.label || f.key} (çok uzun)`);
    }
  } else {
    const biz = b.content?.business || {};
    if (!biz.name?.trim()) missing.push("İşletme adı");
    if (!biz.phone?.trim() && !biz.email?.trim()) missing.push("Telefon ya da e-posta");
    if (!(b.content?.sections || []).length) missing.push("En az bir bölüm");
  }
  if (ph.length || missing.length) out.push({ code: "complete", level: "fail", message: "Eksik ya da örnek metin kalmış alanlar var.", details: { placeholders: ph, missing } });
  else out.push({ code: "complete", level: "pass", message: "Zorunlu alanlar dolu, örnek metin yok." });

  // 3) Iletisim tutarliligi
  const phones = new Set<string>(), badPhones: string[] = [];
  for (const t of texts) {
    const isPhoneField = /phone|tel|telefon/i.test(t.key);
    const found = isPhoneField ? [t.value] : (t.value.match(/\+?\d[\d\s().-]{8,}\d/g) || []);
    for (const p of found) {
      const d = p.replace(/\D/g, "");
      if (!d) continue;
      if (d.length < 7 || d.length > 15) badPhones.push(p); else phones.add(d.slice(-10));
    }
  }
  const emails = [...new Set((allText.match(/[^\s@<>"']+@[^\s@<>"']+/g) || []))];
  const badEmails = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e));
  if (badPhones.length || badEmails.length) out.push({ code: "contact", level: "fail", message: "Hatalı telefon ya da e-posta var.", details: { badPhones, badEmails } });
  else if (phones.size > 1) out.push({ code: "contact", level: "warn", message: "Sitede birden fazla farklı telefon var. Bilerek mi?", details: { phones: [...phones] } });
  else out.push({ code: "contact", level: "pass", message: "İletişim bilgileri tutarlı." });

  // 4) Linkler
  const brokenLinks: string[] = [], blocked: string[] = [];
  await Promise.all(links.slice(0, 40).map(async (l) => {
    try {
      const r = await fetchT(l.value, 8000);
      if ([401, 403, 429, 999].includes(r.status)) blocked.push(l.value);
      else if (r.status >= 400) brokenLinks.push(`${l.value} (${r.status})`);
      await r.body?.cancel();
    } catch { brokenLinks.push(`${l.value} (açılmadı)`); }
  }));
  if (brokenLinks.length) out.push({ code: "links", level: "fail", message: "Açılmayan linkler var.", details: { broken: brokenLinks, blocked } });
  else if (blocked.length) out.push({ code: "links", level: "info", message: "Bazı siteler otomatik kontrolü engelliyor, elle tıklayıp bak.", details: { blocked } });
  else out.push({ code: "links", level: "pass", message: `${links.length} link açılıyor.` });

  // 5) Link guvenligi (Google Safe Browsing, istege bagli)
  if (SAFE_KEY && urls.length) {
    try {
      const r = await fetchT(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_KEY}`, 8000, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "mrspace", clientVersion: "1.0" },
          threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"], platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"], threatEntries: urls.slice(0, 200).map((u) => ({ url: u.value })) },
        }),
      });
      const j = await r.json();
      if (j.matches?.length) out.push({ code: "safety", level: "fail", message: "Tehlikeli olarak işaretli link var.", details: { matches: j.matches.map((m: any) => m.threat?.url) } });
      else out.push({ code: "safety", level: "pass", message: "Linklerde güvenlik sorunu yok." });
    } catch { out.push({ code: "safety", level: "info", message: "Güvenlik kontrolüne ulaşılamadı, sonra tekrar dene." }); }
  } else {
    out.push({ code: "safety", level: "info", message: "Güvenlik anahtarı eklenmemiş, link güvenliği atlandı." });
  }

  // 6) Gorseller: tur, boyut, kaynak, alt metin
  const bigImgs: string[] = [], notImg: string[] = [], external: string[] = [];
  await Promise.all(images.slice(0, 40).map(async (im) => {
    if (!im.value.startsWith(MEDIA)) external.push(im.value);
    try {
      const r = await fetchT(im.value, 8000);
      const ct = r.headers.get("content-type") || "";
      let size = Number(r.headers.get("content-length") || 0);
      if (!size && r.ok) size = (await r.arrayBuffer()).byteLength; else await r.body?.cancel();
      if (!r.ok || !ct.startsWith("image/")) notImg.push(im.value);
      else if (size > 1_500_000) bigImgs.push(`${im.value} (${(size / 1e6).toFixed(1)} MB)`);
    } catch { notImg.push(im.value); }
  }));
  const gallery = (b.content?.sections || []).flatMap((x: any) => x?.type === "gallery" ? (x.images || []) : []);
  const noAlt = gallery.filter((g: any) => !g?.alt?.trim()).length;
  if (notImg.length) out.push({ code: "images", level: "fail", message: "Açılmayan ya da görsel olmayan dosya var.", details: { files: notImg } });
  else if (bigImgs.length || noAlt) out.push({ code: "images", level: "warn", message: "Büyük görsel ya da açıklaması eksik görsel var.", details: { big: bigImgs, missing_alt: noAlt } });
  else out.push({ code: "images", level: "pass", message: `${images.length} görsel uygun.` });
  if (external.length) out.push({ code: "image_source", level: "warn", message: "Dışarıdan link verilmiş görsel var. Kaynağına ve kullanım iznine bak.", details: { files: external } });

  // 7) Yazi tipi lisansi (sadece Google Fonts)
  if (b.mode === "builder") {
    const fonts = [b.theme?.fonts?.head, b.theme?.fonts?.body].filter(Boolean) as string[];
    const badFonts: string[] = [];
    for (const f of [...new Set(fonts)]) {
      try {
        const r = await fetchT(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}`, 6000);
        if (!r.ok) badFonts.push(f);
        await r.body?.cancel();
      } catch { badFonts.push(f); }
    }
    if (badFonts.length) out.push({ code: "fonts", level: "fail", message: "Lisansı doğrulanamayan yazı tipi var. Google Fonts'tan seç.", details: { fonts: badFonts } });
    else out.push({ code: "fonts", level: "pass", message: "Yazı tipleri serbest lisanslı." });

    // 8) Renk kontrasti
    const c = b.theme?.colors || {};
    const body = contrast(c.ink, c.bg), acc = contrast(c.accent, c.bg);
    if (body == null) out.push({ code: "contrast", level: "warn", message: "Tema renkleri okunamadı." });
    else if (body < 4.5) out.push({ code: "contrast", level: "fail", message: `Yazı ile arka plan arası kontrast düşük (${body.toFixed(1)}, en az 4.5).` });
    else if (acc != null && acc < 3) out.push({ code: "contrast", level: "warn", message: `Vurgu rengi arka planda zor seçiliyor (${acc.toFixed(1)}, önerilen 3+).` });
    else out.push({ code: "contrast", level: "pass", message: `Kontrast iyi (${body.toFixed(1)}).` });
  }

  // 9) Yasal metin
  const hasForm = (b.content?.sections || []).some((x: any) => ["form", "booking", "newsletter"].includes(x?.type))
    || Object.keys(b.content || {}).some((k) => /form|booking|rezervasyon/i.test(k));
  const privacy = b.content?.legal?.privacy?.trim() || b.content?.privacy?.trim();
  if (hasForm && !privacy) {
    const law = country === "TR" ? "KVKK aydınlatma metni" : country === "US" ? "gizlilik metni (California)" : "gizlilik metni";
    out.push({ code: "legal", level: "fail", message: `Sitede form var ama ${law} yok.` });
  } else out.push({ code: "legal", level: "pass", message: hasForm ? "Form ve gizlilik metni var." : "Kişisel veri toplayan form yok." });

  // 10) Kopya metin (diger yayindaki sitelerle)
  const mine = shingles(allText);
  if (mine.size > 20) {
    const { data: others } = await db.from("ms_builds").select("site, content").eq("status", "published").neq("site", b.site).limit(80);
    const hits: string[] = [];
    for (const o of others || []) {
      const arr: { path: string; key: string; value: string }[] = []; walk(o.content, "", arr);
      const theirs = shingles(arr.filter((x) => !isUrl(x.value)).map((x) => x.value).join("\n"));
      let same = 0; for (const x of mine) if (theirs.has(x)) same++;
      const ratio = same / Math.min(mine.size, theirs.size || 1);
      if (ratio > 0.3) hits.push(`${o.site} (%${Math.round(ratio * 100)})`);
    }
    if (hits.length) out.push({ code: "duplicate", level: "warn", message: "Metin başka bir müşterinin sitesiyle çok benzer.", details: { sites: hits } });
    else out.push({ code: "duplicate", level: "pass", message: "Metin diğer sitelerle örtüşmüyor." });
  }

  // Elle bakilacaklar
  out.push({ code: "trademark", level: "info", message: "İşletme adı ve logo: marka kaydı çakışmasına elle bak.",
    details: { links: ["https://tmsearch.uspto.gov/", "https://www.turkpatent.gov.tr/arastirma-yap"] } });

  // Kaydet
  await db.from("ms_build_checks").delete().eq("build_id", buildId);
  await db.from("ms_build_checks").insert(out.map((c) => ({ ...c, build_id: buildId })));
  const summary = { pass: 0, info: 0, warn: 0, fail: 0 } as Record<Level, number>;
  out.forEach((c) => summary[c.level]++);
  await db.from("ms_builds").update({ status: "review", checks_summary: summary }).eq("id", buildId).eq("status", "checking");
  await db.from("ms_activity").insert({ site: b.site, who: "auto",
    action: `Checks done (v${b.version}): ${summary.fail} red, ${summary.warn} yellow`, meta: summary });
}

// ---------- gorsel yukleme ----------
async function upload(req: Request) {
  const form = await req.formData();
  const key = String(form.get("key") || "");
  const trial = String(form.get("trial") || "");
  const file = form.get("file");
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!(file instanceof File) || (!uuid.test(key) && !uuid.test(trial))) return json({ error: "bad_request" }, 400);
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  if (!types[file.type]) return json({ error: "type" }, 400);

  let folder = "", site: string | null = null;
  if (uuid.test(key)) {
    const { data: s } = await db.from("ms_sites").select("slug").eq("site_key", key).maybeSingle();
    if (!s) return json({ error: "unknown_site" }, 403);
    if (file.size > 5 * 1024 * 1024) return json({ error: "size" }, 400);
    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from("ms_activity").select("id", { count: "exact", head: true })
      .eq("site", s.slug).eq("action", "Image uploaded").gte("at", since);
    if ((count || 0) >= 80) return json({ error: "too_many" }, 429);
    folder = s.slug; site = s.slug;
  } else {
    // Ucretsiz deneme: taslak basina en fazla 15 gorsel, her biri 3 MB
    const { data: t } = await db.from("ms_trials").select("id, status").eq("token", trial).maybeSingle();
    if (!t || t.status !== "draft") return json({ error: "unknown_trial" }, 403);
    if (file.size > 3 * 1024 * 1024) return json({ error: "size" }, 400);
    const { data: list } = await db.storage.from("ms-media").list(`trials/${t.id}`, { limit: 100 });
    if ((list?.length || 0) >= 15) return json({ error: "too_many" }, 429);
    folder = `trials/${t.id}`;
  }
  const path = `${folder}/${crypto.randomUUID()}.${types[file.type]}`;
  const { error } = await db.storage.from("ms-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return json({ error: error.message }, 500);
  if (site) await db.from("ms_activity").insert({ site, who: "client", action: "Image uploaded" });
  return json({ url: MEDIA + path });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) return upload(req);

  const body = await req.json().catch(() => ({}));
  if (body.action === "check") {
    const { data } = await db.from("ms_settings").select("value").eq("key", "cron_secret").maybeSingle();
    if (!data || req.headers.get("x-ms-secret") !== data.value) return json({ ok: false }, 401);
    const id = Number(body.build_id);
    EdgeRuntime.waitUntil(runChecks(id).catch(async (e) => {
      await db.from("ms_build_checks").insert({ build_id: id, code: "system", level: "warn", message: `Kontroller yarıda kaldı: ${String(e).slice(0, 120)}` });
      await db.from("ms_builds").update({ status: "review" }).eq("id", id).eq("status", "checking");
    }));
    return json({ ok: true, started: true });
  }
  return json({ error: "unknown_action" }, 400);
});
