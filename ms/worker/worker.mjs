// Mr. Space Uretici Hat
// Musteri taleplerini ucuz modellerle hazirlar, pull request acar.
// Onaylananlari birlestirir, reddedilenleri kapatir. Bagimlilik yok (Node 20+).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const E = process.env;
const SB = E.SUPABASE_URL?.replace(/\/$/, "");
const SBK = E.SUPABASE_SERVICE_KEY;
const HOME_REPO = E.GITHUB_REPOSITORY || "Zuzay/mrspace.online";
const MAX_CTX = 120_000; // modele gonderilecek en fazla karakter

if (!SB || !SBK) { console.log("Supabase ayarlari yok, cikiliyor."); process.exit(0); }

// ---------- Supabase ----------
async function sb(p, opt = {}) {
  const r = await fetch(`${SB}/rest/v1/${p}`, {
    ...opt,
    headers: { apikey: SBK, Authorization: `Bearer ${SBK}`, "Content-Type": "application/json",
               Prefer: "return=representation", ...(opt.headers || {}) },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const patch = (id, body) => sb(`ms_changes?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
const log = (site, action, meta) =>
  sb("ms_activity", { method: "POST", body: JSON.stringify({ site, who: "auto", action, minutes: 0, meta }) }).catch(() => {});

const CONFIG = await sb("rpc/ms_worker_runtime_config", { method: "POST", body: "{}" });
if (!CONFIG?.enabled) { console.log("İşçi panelden kapalı, çalışmıyor."); process.exit(0); }
const BUDGET = Number(CONFIG.budget_month), REQUEST_BUDGET = Number(CONFIG.budget_per_request);
if (!Number.isFinite(BUDGET) || !Number.isFinite(REQUEST_BUDGET) || BUDGET <= 0 || REQUEST_BUDGET <= 0) {
  console.log("İşçi bütçesi tanımlı değil, güvenli şekilde duruyor."); process.exit(0);
}

// ---------- Modeller ----------
// Fiyatlar: 1M token basina USD (girdi, cikti). Degisebilir, env ile guncelle.
const P = (v, d) => (v ? v.split(",").map(Number) : d);
const PROVIDERS = {
  gemini: {
    key: CONFIG.keys?.gemini, model: E.GEMINI_MODEL || "gemini-2.5-flash", price: P(E.GEMINI_PRICE, [0.3, 2.5]),
    async call(sys, user, maxOutputTokens) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }],
                               generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens } }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
      const u = j.usageMetadata || {};
      return { text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "", tin: u.promptTokenCount || 0, tout: u.candidatesTokenCount || 0 };
    },
  },
  deepseek: {
    key: CONFIG.keys?.deepseek, model: E.DEEPSEEK_MODEL || "deepseek-chat", price: P(E.DEEPSEEK_PRICE, [0.28, 0.42]),
    async call(sys, user, maxOutputTokens) {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ model: this.model, max_tokens:maxOutputTokens, temperature: 0.1, response_format: { type: "json_object" },
                               messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
      return { text: j.choices?.[0]?.message?.content || "", tin: j.usage?.prompt_tokens || 0, tout: j.usage?.completion_tokens || 0 };
    },
  },
  haiku: {
    key: CONFIG.keys?.haiku, model: E.ANTHROPIC_MODEL || "claude-haiku-4-5", price: P(E.ANTHROPIC_PRICE, [1, 5]),
    async call(sys, user, maxOutputTokens) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": this.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: this.model, max_tokens:maxOutputTokens, temperature: 0.1, system: sys,
                               messages: [{ role: "user", content: user + "\n\nSadece JSON dondur." }] }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
      return { text: j.content?.map(c => c.text || "").join("") || "", tin: j.usage?.input_tokens || 0, tout: j.usage?.output_tokens || 0 };
    },
  },
};
// Hangi is hangi sirayla denenir (anahtari olmayan atlanir)
const ROUTES = CONFIG.routes || {};

function parseJSON(t) {
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  return JSON.parse(t.slice(s, e + 1));
}

// Sirayla dener; check() hata atarsa bir sonrakine gecer
async function ask(route, sys, user, check = x => x, alreadySpent = 0, limit = REQUEST_BUDGET) {
  let cost = 0, errs = [];
  for (const name of ROUTES[route] || []) {
    const p = PROVIDERS[name]; if (!p.key) continue;
    try {
      const remaining = limit - alreadySpent - cost;
      if (remaining <= 0) throw new Error("Talep başı bütçe sınırına ulaşıldı");
      const inputEstimate = Math.ceil((sys.length + user.length) / 2);
      const maxOutputTokens = Math.floor((remaining * 1e6 - inputEstimate * p.price[0]) / p.price[1]);
      if (!Number.isFinite(maxOutputTokens) || maxOutputTokens < 64) throw new Error("Bütçe bu model için yeterli değil");
      const r = await p.call(sys, user, Math.min(8000, maxOutputTokens));
      cost += (r.tin * p.price[0] + r.tout * p.price[1]) / 1e6;
      if (alreadySpent + cost > limit) { const err = new Error("Bu model çağrısı talep başı bütçe sınırını aştı; yeni model denenmedi."); err.cost = cost; throw err; }
      const out = await check(parseJSON(r.text));
      return { out, cost, model: `${name}:${p.model}` };
    } catch (e) {
      if (e.cost) { const err = new Error(e.message); err.cost = cost; throw err; }
      errs.push(`${name}: ${String(e.message || e).slice(0, 200)}`); user += `\n\nOnceki deneme hatasi: ${e.message}`;
    }
  }
  const err = new Error(errs.join(" | ") || "Hic API anahtari yok"); err.cost = cost; throw err;
}

// ---------- Git ----------
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", env: { ...E, GH_TOKEN: CONFIG.github_token || E.GH_PAT || E.GITHUB_TOKEN } }).trim();

function repoDir(repo) {
  if (repo === HOME_REPO) return process.cwd();
  const dir = `/tmp/repos/${repo.replace("/", "__")}`;
  if (!fs.existsSync(dir)) execFileSync("git", ["clone", "--depth", "1",
    `https://x-access-token:${CONFIG.github_token || E.GH_PAT}@github.com/${repo}.git`, dir]);
  return dir;
}

const TEXT = /\.(html?|css|js|mjs|json|md|txt|svg|xml)$/i;
function listFiles(root, rel) {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
      if (f.name.startsWith(".") || f.name === "node_modules") continue;
      const r = path.posix.join(d, f.name);
      if (f.isDirectory()) walk(r);
      else if (TEXT.test(f.name)) out.push({ file: r, size: fs.statSync(path.join(root, r)).size });
    }
  })(rel.replace(/\/$/, ""));
  return out;
}

// ---------- Is 1: yeni talebi hazirla ----------
async function prepare(c, spent) {
  const site = c.ms_sites;
  if (!site?.repo_path) { await patch(c.id, { ai_status: "needs_uzay", ai_note: "Sitenin repo klasoru tanimli degil (ms_sites.repo_path)." }); return 0; }
  if (spent >= BUDGET) { await patch(c.id, { ai_status: "needs_uzay", ai_note: `Aylık işçi bütçesi doldu (${BUDGET}$).` }); return 0; }
  const requestLimit = Math.min(REQUEST_BUDGET, BUDGET - spent);
  await patch(c.id, { ai_status: "working", ai_at: new Date().toISOString(), ai_attempts: Number(c.ai_attempts || 0) + 1 });

  const dir = repoDir(site.repo);
  const base = git(dir, "rev-parse", "--abbrev-ref", "HEAD");
  const files = listFiles(dir, site.repo_path);
  const talep = `Site: ${site.name}\nHedef: ${c.target || "-"}\nTur (musteri secimi): ${c.kind}\nTalep: ${c.request}`;
  let cost = 0;

  // 1) Ayirici: tur + gereken dosyalar
  const cls = await ask("classify",
    `Bir web sitesi bakim ekibinin is ayiricisisin. Musteri talebini oku ve JSON dondur:
{"route":"content|code|big","files":["..."],"reason":"kisa"}
content: metin, fiyat, saat, adres, link, gorsel yolu gibi icerik degisikligi.
code: renk, yazi tipi, bosluk, bolum ekleme/cikarma gibi kucuk tasarim/kod isi.
big: yeni sayfa, yeni ozellik, odeme/entegrasyon, tasarim degisikligi, anlasilmayan veya riskli talep.
files: degisecek dosyalar, en fazla 4, sadece listedeki yollar.`,
    `${talep}\n\nDosyalar:\n${files.map(f => `${f.file} (${f.size}b)`).join("\n")}`,
    o => { if (!["content", "code", "big"].includes(o.route)) throw new Error("route yok"); return o; }, 0, requestLimit);
  cost += cls.cost;
  const pick = (cls.out.files || []).filter(f => files.some(x => x.file === f)).slice(0, 4);

  if (cls.out.route === "big" || !pick.length) {
    await patch(c.id, { ai_status: "needs_uzay", ai_route: cls.out.route, ai_model: cls.model, ai_cost: cost,
                        ai_note: cls.out.reason || "Dosya bulunamadi." });
    await log(site.slug, `Talep #${c.id} Uzay'a birakildi: ${cls.out.reason || ""}`, { cost });
    return cost;
  }

  // 2) Duzenleyici: bul/degistir bloklari
  let ctx = "";
  for (const f of pick) ctx += `\n===== ${f} =====\n${fs.readFileSync(path.join(dir, f), "utf8")}\n`;
  ctx = ctx.slice(0, MAX_CTX);

  let edit;
  try { edit = await ask(cls.out.route,
    `Bir web sitesinde musteri talebini uygulayan dikkatli bir gelistiricisin.
Kurallar: sadece istenen degisikligi yap; tasarimi, dili, yapiyi bozma; yeni kutuphane ekleme.
JSON dondur: {"edits":[{"file":"yol","find":"dosyada AYNEN bir kez gecen metin","replace":"yeni metin"}],"summary":"Turkce tek cumle"}
find dosyadan birebir kopyalanmali ve benzersiz olmali; kisa ama benzersiz tut.`,
    `${talep}\n\nDosyalar:${ctx}`,
    o => {
      if (!Array.isArray(o.edits) || !o.edits.length) throw new Error("edits bos");
      for (const e of o.edits) {
        if (!pick.includes(e.file)) throw new Error(`izin disi dosya ${e.file}`);
        const src = fs.readFileSync(path.join(dir, e.file), "utf8");
        const n = src.split(e.find).length - 1;
        if (n !== 1) throw new Error(`"${String(e.find).slice(0, 60)}" ${e.file} icinde ${n} kez geciyor, 1 olmali`);
      }
      return o;
    }, cls.cost, requestLimit);
  } catch (e) { e.cost = (e.cost || 0) + cost; throw e; }
  cost += edit.cost;

  // 3) Uygula, dal ac, PR
  const branch = `ms/req-${c.id}`;
  git(dir, "checkout", "-B", branch);
  for (const e of edit.out.edits) {
    const p = path.join(dir, e.file);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(e.find, () => e.replace));
  }
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=mrspace-worker", "-c", "user.email=worker@mrspace.online",
      "commit", "-m", `${site.name}: ${edit.out.summary || c.request.slice(0, 60)} (#${c.id})`);
  git(dir, "push", "-f", "origin", branch);
  const body = `**Talep #${c.id}** (${site.name})\n\n> ${c.request}\n\n${edit.out.summary || ""}\n\nYol: ${cls.out.route} · Model: ${edit.model} · Maliyet: $${cost.toFixed(4)}\n\nPanelden onaylaninca otomatik birlesir.`;
  const url = gh("pr", "create", "--repo", site.repo, "--head", branch, "--base", base,
                 "--title", `[${site.name}] ${edit.out.summary || "Talep #" + c.id}`.slice(0, 120), "--body", body);
  git(dir, "checkout", base);

  await patch(c.id, { ai_status: "ready", ai_route: cls.out.route, ai_model: edit.model, ai_cost: cost,
                      ai_note: edit.out.summary, pr_url: url });
  await log(site.slug, `Talep #${c.id} hazirlandi: ${edit.out.summary}`, { pr: url, model: edit.model, cost });
  return cost;
}

// ---------- Is 2: onay/red ----------
async function finish(c) {
  if (c.status === "approved") {
    gh("pr", "merge", c.pr_url, "--squash", "--delete-branch");
    await patch(c.id, { ai_status: "merged", status: "done", done_at: new Date().toISOString() });
    await log(c.site, `Talep #${c.id} yayina alindi`, { pr: c.pr_url });
  } else {
    gh("pr", "close", c.pr_url, "--delete-branch");
    await patch(c.id, { ai_status: "closed" });
  }
}

// ---------- Ana dongu ----------
// Zaman asimina ugrayan isleri bir kez yeniden kuyruga al; ikinci kez takilirsa insana birak.
const staleBefore = encodeURIComponent(new Date(Date.now() - 15 * 60e3).toISOString());
const stale = await sb(`ms_changes?ai_status=eq.working&ai_at=lt.${staleBefore}&select=id,site,ai_attempts&limit=20`);
for (const c of stale) {
  const attempts = Number(c.ai_attempts || 0);
  if (attempts < 2) {
    await patch(c.id, { ai_status: null, ai_at: null, ai_attempts: 1, ai_note: "Is 15 dakikadir yanit vermedi. Bir kez yeniden siraya alindi." });
    console.log(`#${c.id} takildi; bir kez yeniden siraya alindi.`);
  } else {
    await patch(c.id, { ai_status: "needs_uzay", ai_note: "Is iki kez 15 dakikadan uzun surdu. Elle kontrol gerekli." });
    await log(c.site, `Talep #${c.id} iki kez zaman asimina ugradi; elle kontrol gerekli.`, {});
    console.log(`#${c.id} tekrar takildi; elle kontrole birakildi.`);
  }
}

const spentRow = await sb("rpc/ms_ai_spend_month", { method: "POST", body: "{}" });
let spent = Number(spentRow || 0);

for (const c of await sb("ms_changes?ai_status=eq.ready&status=in.(approved,rejected)&select=*")) {
  try { await finish(c); } catch (e) { console.error(`#${c.id}`, e.message); await patch(c.id, { ai_note: `Birlestirme hatasi: ${e.message}`.slice(0, 500) }); }
}

const fresh = await sb("ms_changes?status=eq.new&ai_status=is.null&select=*,ms_sites(slug,name,repo,repo_path)&order=created_at.asc&limit=5");
for (const c of fresh) {
  try { spent += await prepare(c, spent); }
  catch (e) {
    console.error(`#${c.id}`, e.message);
    spent += e.cost || 0;
    await patch(c.id, { ai_status: "failed", ai_cost: e.cost || 0, ai_note: String(e.message).slice(0, 500) });
    try { git(repoDir(c.ms_sites.repo), "checkout", "-"); } catch {}
  }
}
console.log(`Bitti. Bu ay isci harcamasi: $${spent.toFixed(4)} / $${BUDGET}`);
