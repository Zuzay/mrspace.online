// Mr. Space Uretici Hat
// Musteri taleplerini ucuz modellerle hazirlar, pull request acar.
// Onaylananlari birlestirir, reddedilenleri kapatir. Bagimlilik yok (Node 20+).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { listScopedFiles, scopedPath, compileEdits, releaseAllowed } from "./safety.mjs";

const E = process.env;
const SB = E.SUPABASE_URL?.replace(/\/$/, "");
const SBK = E.SUPABASE_SERVICE_KEY;
const HOME_REPO = E.GITHUB_REPOSITORY || "Zuzay/mrspace.online";
const MAX_CTX = 120_000; // modele gonderilecek en fazla karakter

if (!SB || !SBK) { console.log("Supabase ayarlari yok, cikiliyor."); process.exit(0); }

// ---------- Supabase ----------
async function sb(p, opt = {}) {
  const r = await fetch(`${SB}/rest/v1/${p}`, {
    signal: AbortSignal.timeout(20000), ...opt,
    headers: { apikey: SBK, Authorization: `Bearer ${SBK}`, "Content-Type": "application/json",
               Prefer: "return=representation", ...(opt.headers || {}) },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
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
const P = v => { if(!v)return null;const price=v.split(",").map(Number);if(price.length!==2||price.some(n=>!Number.isFinite(n)||n<=0))throw new Error("Invalid model price");return price; };
const PROVIDERS = {
  gemini: {
    key: CONFIG.keys?.gemini, model: E.GEMINI_MODEL || "gemini-2.5-flash", price: P(E.GEMINI_PRICE),
    async call(sys, user, maxOutputTokens) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.key}`, {
        signal: AbortSignal.timeout(45000), method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }],
                               generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens } }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(`Model API ${r.status}`);
      const u = j.usageMetadata || {};
      return { text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "", tin: u.promptTokenCount || 0, tout: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
    },
  },
  deepseek: {
    key: CONFIG.keys?.deepseek, model: E.DEEPSEEK_MODEL || "deepseek-chat", price: P(E.DEEPSEEK_PRICE),
    async call(sys, user, maxOutputTokens) {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        signal: AbortSignal.timeout(45000), method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ model: this.model, max_tokens:maxOutputTokens, temperature: 0.1, response_format: { type: "json_object" },
                               messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(`Model API ${r.status}`);
      return { text: j.choices?.[0]?.message?.content || "", tin: j.usage?.prompt_tokens || 0, tout: j.usage?.completion_tokens || 0 };
    },
  },
  haiku: {
    key: CONFIG.keys?.haiku, model: E.ANTHROPIC_MODEL || "claude-haiku-4-5", price: P(E.ANTHROPIC_PRICE),
    async call(sys, user, maxOutputTokens) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        signal: AbortSignal.timeout(45000), method: "POST", headers: { "Content-Type": "application/json", "x-api-key": this.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: this.model, max_tokens:maxOutputTokens, temperature: 0.1, system: sys,
                               messages: [{ role: "user", content: user + "\n\nSadece JSON dondur." }] }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(`Model API ${r.status}`);
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
  for (const name of (ROUTES[route] || []).slice(0,3)) {
    const p = PROVIDERS[name]; if (!p?.key) continue;
    if(!p.price){errs.push(`${name}: operator must configure current input/output prices`);continue;}
    try {
      const remaining = limit - alreadySpent - cost;
      if (remaining <= 0) throw new Error("Talep başı bütçe sınırına ulaşıldı");
      const inputEstimate = Buffer.byteLength(sys+user,"utf8")+2048; // Conservative byte bound plus provider framing.
      const maxOutputTokens = Math.floor((remaining * 1e6 - inputEstimate * p.price[0]) / p.price[1]);
      if (!Number.isFinite(maxOutputTokens) || maxOutputTokens < 64) throw new Error("Bütçe bu model için yeterli değil");
      if(sys.length+user.length>MAX_CTX+20000)throw new Error("Context limit exceeded");
      let r;
      try { r=await p.call(sys, user, Math.min(8000, maxOutputTokens)); }
      catch { cost+=remaining;const error=new Error('Provider result unavailable; reserved budget charged conservatively, no retry.');error.cost=cost;throw error; }
      if(!Number.isFinite(r.tin)||!Number.isFinite(r.tout)||r.tin<=0||r.tout<0||(r.text&&r.tout===0)){
        cost+=remaining;const error=new Error('Provider usage unavailable; no further calls.');error.cost=cost;throw error;
      }
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
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||''))throw new Error('Invalid repository');
  if (repo === HOME_REPO) return process.cwd();
  const dir = path.join(os.tmpdir(),'mrspace-repos',repo.replace('/','__'));
  if(!fs.existsSync(dir)){fs.mkdirSync(path.dirname(dir),{recursive:true});gh('repo','clone',repo,dir,'--','--depth','1');}
  return dir;
}

// ---------- Is 1: yeni talebi hazirla ----------
async function prepare(c, spent) {
  const site = c.ms_sites;
  if (!site?.repo_path) { await patch(c.id, { ai_status: "needs_uzay", ai_note: "Sitenin repo klasoru tanimli degil (ms_sites.repo_path)." }); return 0; }
  if (spent >= BUDGET) { await patch(c.id, { ai_status: "needs_uzay", ai_note: `Aylık işçi bütçesi doldu (${BUDGET}$).` }); return 0; }
  const requestLimit = Math.min(REQUEST_BUDGET, BUDGET - spent);
  if(!await sb('rpc/ms_claim_request',{method:'POST',body:JSON.stringify({p_id:c.id})}))return 0;

  const repository = repoDir(site.repo);
  const base=gh('repo','view',site.repo,'--json','defaultBranchRef','--jq','.defaultBranchRef.name');
  git(repository,'fetch','origin',base);
  const branch=`ms/req-${c.id}`;
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'mrspace-request-'));
  git(repository,'worktree','add','-b',branch,workspace,`origin/${base}`);
  const dir=workspace;
  let cost=0;
  try {
  const files = listScopedFiles(dir, site.repo_path);
  const reviews=await sb(`ms_change_reviews?change_id=eq.${c.id}&select=decision,proposed,selector,note`);
  const review=reviews?.[0];
  if(review?.decision==='revision_requested'){await patch(c.id,{ai_status:'needs_uzay',ai_note:'Revision requested; human clarification required.'});return 0;}
  const talep = `Site: ${site.name}\nHedef: ${c.target || "-"}\nTur (musteri secimi): ${c.kind}\nTalep: ${c.request}`;
  const context=review?.proposed?`\nOperator proposal (plain text): ${review.proposed}\nPreview selector: ${review.selector||'-'}\nOperator note: ${review.note||'-'}`:'';

  // 1) Ayirici: tur + gereken dosyalar
  const cls = await ask("classify",
    `Bir web sitesi bakim ekibinin is ayiricisisin. Musteri talebini oku ve JSON dondur:
{"route":"content|code|big","files":["..."],"reason":"kisa"}
content: metin, fiyat, saat, adres, link, gorsel yolu gibi icerik degisikligi.
code: renk, yazi tipi, bosluk, bolum ekleme/cikarma gibi kucuk tasarim/kod isi.
big: yeni sayfa, yeni ozellik, odeme/entegrasyon, tasarim degisikligi, anlasilmayan veya riskli talep.
files: degisecek dosyalar, en fazla 4, sadece listedeki yollar.`,
    `${talep}${context}\n\nDosyalar:\n${files.map(f => `${f.file} (${f.size}b)`).join("\n")}`,
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
  for (const f of pick) ctx += `\n===== ${f} =====\n${fs.readFileSync(scopedPath(dir,site.repo_path,f), "utf8")}\n`;
  ctx = ctx.slice(0, MAX_CTX);

  let edit;
  try { edit = await ask(cls.out.route,
    `Bir web sitesinde musteri talebini uygulayan dikkatli bir gelistiricisin.
Kurallar: sadece istenen degisikligi yap; tasarimi, dili, yapiyi bozma; yeni kutuphane ekleme.
JSON dondur: {"edits":[{"file":"yol","find":"dosyada AYNEN bir kez gecen metin","replace":"yeni metin"}],"summary":"Turkce tek cumle"}
find dosyadan birebir kopyalanmali ve benzersiz olmali; kisa ama benzersiz tut.`,
    `${talep}${context}\n\nDosyalar:${ctx}`,
    o => {
      if (!Array.isArray(o.edits) || !o.edits.length) throw new Error("edits bos");
      compileEdits(dir,site.repo_path,pick,o.edits);
      return o;
    }, cls.cost, requestLimit);
  } catch (e) { e.cost = (e.cost || 0) + cost; throw e; }
  cost += edit.cost;

  // 3) Uygula, dal ac, PR
  const outputs=compileEdits(dir,site.repo_path,pick,edit.out.edits);
  for(const [file,content] of outputs)fs.writeFileSync(scopedPath(dir,site.repo_path,file),content);
  git(dir, "add", "--", ...outputs.keys());
  git(dir, "-c", "user.name=mrspace-worker", "-c", "user.email=worker@mrspace.online",
      "commit", "-m", `${site.name}: ${edit.out.summary || c.request.slice(0, 60)} (#${c.id})`);
  git(dir, "push", "origin", branch);
  const body = `**Talep #${c.id}** (${site.name})\n\n> ${c.request}\n\n${edit.out.summary || ""}\n\nYol: ${cls.out.route} · Model: ${edit.model} · Maliyet: $${cost.toFixed(4)}\n\nPanelde hazırlanmış sürüm incelenip ayrıca yayın izni verilince birleştirilebilir. Canlı yayın durumu ayrıca doğrulanır.`;
  const url = gh("pr", "create", "--repo", site.repo, "--head", branch, "--base", base,
                 "--draft", "--title", `[${site.name}] ${edit.out.summary || "Talep #" + c.id}`.slice(0, 120), "--body", body);
  const head=git(dir,"rev-parse","HEAD");

  await patch(c.id, { ai_status: "ready", ai_route: cls.out.route, ai_model: edit.model, ai_cost: cost,
                      ai_note: edit.out.summary, pr_url: url, pr_head_sha: head });
  await sb(`ms_change_reviews?change_id=eq.${c.id}`,{method:"PATCH",body:JSON.stringify({decision:"pending",reviewed_sha:null,reviewed_at:null,released_at:null})});
  await log(site.slug, `Talep #${c.id} hazirlandi: ${edit.out.summary}`, { pr: url, model: edit.model, cost });
  return cost;
  }catch(error){error.cost=Math.max(error.cost||0,cost);throw error;}
  finally{try{git(repository,'worktree','remove','--force',workspace);}catch{console.error('Temporary worktree requires cleanup');}}
}

// ---------- Is 2: onay/red ----------
async function finish(c) {
  if (c.status === "approved") {
    const reviews=await sb(`ms_change_reviews?change_id=eq.${c.id}&select=decision,released_at,reviewed_sha`);
    const head=gh('pr','view',c.pr_url,'--json','headRefOid','--jq','.headRefOid');
    if(!releaseAllowed(c,reviews?.[0],head)){await patch(c.id,{ai_note:'Prepared code must be reviewed and separately released at its current SHA.'});return;}
    if(!await sb('rpc/ms_claim_release',{method:'POST',body:JSON.stringify({p_id:c.id,p_sha:head})}))return;
    try{
      const draft=gh('pr','view',c.pr_url,'--json','isDraft','--jq','.isDraft');
      if(draft==='true')gh('pr','ready',c.pr_url);
      gh("pr", "merge", c.pr_url, "--squash", "--match-head-commit",head);
      await patch(c.id, { ai_status: "merged", ai_note:'PR merged; deployment is not yet verified.' });
    }catch(error){await patch(c.id,{ai_status:'needs_uzay',ai_note:'Merge result requires manual verification; automatic retry disabled.'});throw error;}
    await log(c.site, `Talep #${c.id} kodu birleştirildi; yayın doğrulaması bekliyor`, { pr: c.pr_url, sha:head });
  } else {
    gh("pr", "close", c.pr_url);
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
let spent = Number(spentRow);
if(spentRow===null||!Number.isFinite(spent)||spent<0)throw new Error("Monthly spend unavailable; worker stopped");

for (const c of await sb("ms_changes?ai_status=eq.ready&status=in.(approved,rejected)&select=*")) {
  try { await finish(c); } catch (e) { console.error(`#${c.id}`, e.message); await patch(c.id, { ai_note: `Birlestirme hatasi: ${e.message}`.slice(0, 500) }); }
}

const fresh = await sb("ms_changes?status=eq.new&ai_status=is.null&select=*,ms_sites(slug,name,repo,repo_path)&order=created_at.asc&limit=2");
for (const c of fresh) {
  try { spent += await prepare(c, spent); }
  catch (e) {
    console.error(`#${c.id}`, e.message);
    spent += e.cost || 0;
    await patch(c.id, { ai_status: "failed", ai_cost: e.cost || 0, ai_note: String(e.message).slice(0, 500) });

  }
}
console.log(`Bitti. Bu ay isci harcamasi: $${spent.toFixed(4)} / $${BUDGET}`);
