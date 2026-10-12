"use strict";
const SB_URL = "https://tizfdnsjhhepxnqqrzuk.supabase.co";
const SB_KEY = "sb_publishable_DcfxBTRo0n2m1go5_yYjkw_qNzD6ie6";
const SITE = "https://mrspace.online";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const money = c => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const T = x => window.MSI18N ? MSI18N.t(x) : x;
const LOC = ({ en:"en-US", es:"es-ES", de:"de-DE", fr:"fr-FR", tr:"tr-TR" })[(window.MSI18N && MSI18N.lang) || "tr"] || "tr-TR";
const dt = d => d ? new Date(d).toLocaleString(LOC, { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
const day = d => d ? new Date(d + (String(d).length === 10 ? "T12:00:00" : "")).toLocaleDateString(LOC, { day:"2-digit", month:"short", year:"numeric" }) : T("yok");
const ago = d => { if (!d) return T("hiç"); const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? T("şimdi") : m < 60 ? m + " " + T("dk önce") : m < 1440 ? Math.round(m / 60) + " " + T("sa önce") : Math.round(m / 1440) + " " + T("gün önce"); };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date((d || today()) + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
function toast(t){ const el = $("#toast"); el.textContent = window.MSI18N ? MSI18N.t(t) : t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2800); }
const PLAN = { own:"Kendi işimiz", rent:"Rent", custom:"Custom", handover:"Handover", first:"İlk müşteri" };
const STATUS = { live:"Yayında", building:"Yapılıyor", paused:"Durduruldu", suspended:"Askıda" };
const WHO = { auto:"Otomatik", uzay:"Uzay", client:"Müşteri", claude:"Claude" };

/* ---------------- session ---------------- */
let S = null, DEMO = false, VIEWER = false;
try { S = JSON.parse(localStorage.getItem("ms_admin") || "null"); } catch (e) {}
function saveSession(d){ S = { access_token:d.access_token, refresh_token:d.refresh_token, expires_at:d.expires_at || Math.floor(Date.now()/1000) + (d.expires_in || 3600), email:d.user ? d.user.email : (S && S.email) }; try { localStorage.setItem("ms_admin", JSON.stringify(S)); } catch (e) {} }
async function auth(grant, body){
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=${grant}`, { method:"POST", headers:{ apikey:SB_KEY, "Content-Type":"application/json" }, body:JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || "Giriş başarısız");
  saveSession(d);
}
let refreshing = null;
async function fresh(){
  if (S && Date.now()/1000 > S.expires_at - 60) {
    refreshing = refreshing || auth("refresh_token", { refresh_token:S.refresh_token }).finally(() => refreshing = null);
    try { await refreshing; } catch (e) { logout(); throw new Error("Oturum bitti, tekrar giriş yap"); }
  }
}
function logout(){ MsAdminOperations.clear(); D={sites:[],checks:[],changes:[],activity:[],usage:[],payments:[],quota:{},subs:[],vers:[],worker:null}; $("#main").replaceChildren(); S = null; DEMO = false; VIEWER = false; document.body.classList.remove("viewer"); try { localStorage.removeItem("ms_admin"); } catch (e) {} $("#app").hidden = true; $("#login").hidden = false; }
async function api(path, opt = {}){
  await fresh();
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method:opt.method || "GET",
    headers:{ apikey:SB_KEY, Authorization:"Bearer " + S.access_token, "Content-Type":"application/json", Prefer:opt.prefer || "return=representation" },
    body:opt.body ? JSON.stringify(opt.body) : undefined });
  if (!r.ok) { const t = await r.text(); throw new Error(t.includes("not_admin") ? "Bu hesap Mr. Space yöneticisi değil" : t.slice(0, 200)); }
  return r.status === 204 ? null : r.json();
}
const rpc = (fn, body) => api("rpc/" + fn, { method:"POST", body });
async function controlApi(action, body){
  await fresh();
  const r = await fetch(`${SB_URL}/functions/v1/ms-site-control`, { method:"POST", headers:{ apikey:SB_KEY, Authorization:"Bearer "+S.access_token, "Content-Type":"application/json" }, body:JSON.stringify({ action, ...body }) });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error === "heron_bridge_not_configured" ? "Heron bağlantısı için HERON_ADMIN_PASSWORD sunucu sırrı eklenmeli." : (data.error || `Heron bağlantı hatası (${r.status})`));
  return data;
}
async function logSiteControl(site, action){
  try { await api("ms_activity", { method:"POST", prefer:"return=minimal", body:{ site, who:"uzay", action:"Site control: " + action } }); } catch (e) {}
}

/* ---------------- data ---------------- */
let D = { sites:[], checks:[], changes:[], activity:[], usage:[], payments:[], quota:{}, subs:[], vers:[], worker:null };
async function load(){
  if (DEMO) return;
  if (VIEWER) { const v = await rpc("ms_viewer_snapshot", {}); D = { ...v, payments:[], viewers:[], subs:[], vers:[] }; return; }
  const errors={};
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const [sites, checks, changes, activity, usage, payments, viewers, subs, vers, worker] = await Promise.all([
    api("ms_sites?select=*&order=created_at"),
    api(`ms_checks?select=site,at,ok,ms,status&at=gte.${since}&order=at.asc&limit=3000`),
    api("ms_changes?select=*&order=created_at.desc&limit=300"),
    api("ms_activity?select=*&order=at.desc&limit=300"),
    api("ms_usage?select=*&order=site"),
    api("ms_payments?select=*&order=paid_at.desc&limit=200"),
    api("ms_viewers?select=*&order=created_at"),
    api("ms_submissions?select=*&order=updated_at.desc&limit=60").catch(() => {errors.versions=true;return [];}),
    api("ms_submission_versions?select=*&order=submission_id.desc,version.asc&limit=800").catch(() => {errors.versions=true;return [];}),
    rpc("ms_worker_admin_snapshot", {}).catch(() => {errors.worker=true;return null;})
  ]);
  const quota = {};
  await Promise.all(sites.map(async s => { const q = await rpc("ms_quota", { p_site:s.slug }); quota[s.slug] = q[0] || {}; }));
  D = { sites, checks, changes, activity, usage, payments, viewers, quota, subs, vers, worker, errors };
}
function demoData(){
  const now = Date.now(), iso = m => new Date(now - m * 60000).toISOString();
  const sites = [
    { slug:"mrspace", name:"Mr. Space", url:"https://mrspace.online/", admin_url:"https://mrspace.online/admin/", kind:"own", plan:"own", status:"live", monthly_cents:0 },
    { slug:"heron", name:"Heron CA", url:"https://heronca.com/", admin_url:"https://heronca.com/admin.html", kind:"own", plan:"own", status:"live", monthly_cents:0 },
    { slug:"laloo", name:"laloo", url:"https://www.laloo.org/", admin_url:"https://www.laloo.org/admin.html", kind:"own", plan:"own", status:"live", monthly_cents:0 },
    { slug:"rufcut", name:"Rufcut", url:"https://mrspace.online/rufcut/", admin_url:null, kind:"client", plan:"first", status:"building", small_quota:8, big_quota:4, monthly_cents:5000, paid_until:addDays(today(), 21), grace_days:7, contact:"hello@rufcut.com", site_key:"00000000-0000-0000-0000-000000000000" }
  ];
  const checks = [];
  sites.forEach(s => { for (let i = 95; i >= 0; i--) checks.push({ site:s.slug, at:iso(i * 15), ok:!(s.slug === "laloo" && (i === 40 || i === 41)), ms:180 + Math.round(Math.random() * 220) }); });
  const changes = [
    { id:3, site:"rufcut", kind:"small", target:"hours", request:"Saturday hours 10:00 to 7:00", requested_by:"Rufcut", status:"new", created_at:iso(35) },
    { id:2, site:"rufcut", kind:"big", target:"homepage", request:"Bigger photo of the workbench on the homepage", requested_by:"Rufcut", status:"new", created_at:iso(220) },
    { id:1, site:"heron", kind:"small", target:"banner", request:"Free shipping banner: change $80 to $75", requested_by:"Uzay", status:"done", counts:true, minutes:6, created_at:iso(2000), decided_at:iso(1990), done_at:iso(1980) }
  ];
  const activity = [
    { site:"rufcut", who:"client", action:"New change request: Saturday hours 10:00 to 7:00", minutes:0, at:iso(35) },
    { site:"laloo", who:"auto", action:"Site is back up", minutes:0, at:iso(590) },
    { site:"laloo", who:"auto", action:"Site did not answer", minutes:0, at:iso(615) },
    { site:"heron", who:"uzay", action:"Price labels template", minutes:12, at:iso(800) },
    { site:"heron", who:"auto", action:"Nightly check", minutes:0, at:iso(900) },
    { site:"laloo", who:"uzay", action:"New city added: Lisbon", minutes:18, at:iso(1500) },
    { site:"heron", who:"uzay", action:"Done: Free shipping banner", minutes:6, at:iso(1980) }
  ];
  const usage = [
    { site:"heron", service:"Google aerial video", used:4120, lim:4900, unit:"calls / month", enabled:true },
    { site:"heron", service:"AI writing", used:3.4, lim:10, unit:"USD / month", enabled:true },
    { site:"laloo", service:"Map tiles", used:21000, lim:50000, unit:"loads / month", enabled:true }
  ];
  const payments = [{ site:"rufcut", amount_cents:30000, paid_at:addDays(today(), -9), period_to:addDays(today(), 21), note:"Setup (first client)" }];
  const quota = { rufcut:{ small_used:3, small_quota:8, big_used:1, big_quota:4 } };
  const subs = [{ id:7, site:"rufcut", edit_key:"demo", name:"Rufcut", email:"hello@rufcut.com", version:2, approved:["a","b","c","d","e","f","g","h","i"], created_at:iso(300), updated_at:iso(40) }];
  const v1 = [
    { id:11, kind:"small", target:"Heading: Custom jeans, cut in Venice", original:"Custom jeans, cut in Venice", request:"Custom jeans cut by hand in Venice", status:"new" },
    { id:12, kind:"small", target:"Text: Open daily 11 to 7", original:"Open daily 11 to 7", request:"Open daily 10 to 7", status:"new" },
    { id:13, kind:"small", target:"Image: hero", original:"/rufcut/hero.jpg", request:"Use the workbench photo", status:"new" }];
  const v2 = [
    { ...v1[0], request:"Custom jeans, cut by hand on the Venice boardwalk" }, v1[1],
    { id:14, kind:"small", target:"Button: Book a fitting", original:"Book a fitting", request:"Book a fitting today", status:"new" }];
  const vers = [{ submission_id:7, version:1, at:iso(300), items:v1 }, { submission_id:7, version:2, at:iso(40), items:v2 }];
  v2.forEach(x => changes.unshift({ ...x, site:"rufcut", requested_by:"Rufcut", submission_id:7, created_at:iso(300) }));
  changes.push({ ...v1[2], site:"rufcut", requested_by:"Rufcut", submission_id:7, status:"withdrawn", created_at:iso(300) });
  D = { sites, checks, changes, activity, usage, payments, quota, subs, vers, worker:{ enabled:false, budget_month:10, budget_per_request:1, spend_month:0, routes:{ classify:["gemini","deepseek","haiku"], content:["gemini","deepseek","haiku"], code:["deepseek","haiku","gemini"] }, keys:[] } };
}

/* ---------------- views ---------------- */
let VIEW = "overview", FILTER = "open", PROJECT = "", ACTIVE_HASH = location.hash, ACTION_PENDING = false;
const dirty=()=>MsAdminOperations.hasDraft()||[...document.querySelectorAll('#main input:not([type=search]):not([type=file]),#main textarea')].some(x=>x.type==='checkbox'?x.checked!==x.defaultChecked:x.value!==x.defaultValue)||[...document.querySelectorAll('#main select[name]')].some(x=>x.value!==(Array.from(x.options).find(o=>o.defaultSelected)||x.options[0])?.value);
let CT_SITE = "laloo", CT_MODE = "native", CT_TAB = "places", CT_Q = "", CT_ERROR = "", CT_DATA = { places:[], businesses:[], suggestions:[], cities:[], heron:[], queue:[], offers:[] }, CT_READY = { laloo:false, heron:false };
function uptime(slug){
  const c = D.checks.filter(x => x.site === slug);
  if (!c.length) return { pct:null, last:null, avg:null, bars:[] };
  const ok = c.filter(x => x.ok).length, last = c[c.length - 1];
  const ms = c.filter(x => x.ok && x.ms != null).map(x => x.ms);
  return { pct:Math.round(1000 * ok / c.length) / 10, last, avg:ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null, bars:c.slice(-48) };
}
function overdue(s){ return s.kind === "client" && s.plan !== "handover" && s.paid_until && addDays(s.paid_until, s.grace_days || 7) < today(); }
const META = { uptime_24h:"uptime %", reviews:"yorum", members:"üye", stories:"hikaye", flags:"şikayet" };
function metaTxt(m){ if (!m) return ""; return Object.keys(m).filter(k => m[k] != null).map(k => k === "uptime_24h" ? ` · uptime ${m[k]}%` : ` · ${m[k]} ${T(META[k] || k)}`).join(""); }
function siteName(slug){ const s = D.sites.find(x => x.slug === slug); return s ? s.name : (slug || "Genel"); }
function qbar(label, used, quota){
  if (quota == null) return "";
  const p = Math.min(100, Math.round(100 * (used || 0) / Math.max(1, quota)));
  return `<div><span>${label}</span><span class="bar"><i class="${(used || 0) >= quota ? "full" : ""}" style="width:${p}%"></i></span><span>${used || 0} / ${quota}</span></div>`;
}
function projectData(){ return MsAdminProjects.scope(D,PROJECT); }
function render(){
  if(window.MSI18N&&!MSI18N.projectTranslations){const original=MSI18N.t;MSI18N.t=value=>MsAdminProjects.translate(value)??original(value);MSI18N.projectTranslations=true;}
  const route=MsAdminProjects.route(location.hash,D,VIEWER);PROJECT=route.project;VIEW=route.view;
  const m=$("#main"), ui=MsAdminProjects;
  $("#projectRail").innerHTML=ui.navigation(D,PROJECT,VIEW,{viewer:VIEWER});
  $("#projectSwitch").onchange=e=>{location.hash=ui.link(e.target.value);};
  let content;
  if(VIEW==='overview')content=PROJECT?ui.home(D,PROJECT,{viewer:VIEWER,demo:DEMO}):ui.directory(D,{viewer:VIEWER});
  else if(['orders','catalog','commerce'].includes(VIEW))content='<div id=projectOperations></div>';
  else if(VIEW==='control'){
    CT_SITE=PROJECT;
    content=['laloo','heron'].includes(PROJECT)?siteControl():ui.home(D,PROJECT,{viewer:VIEWER,demo:DEMO});
  }else content=({changes,versions,log,billing,usage,sites:siteSettings,worker,workspaces:()=>'<div id="workspaceRoot"></div>',access})[VIEW]();
  if(D.errors?.[VIEW])content=`<section class="project-service-error" data-noi18n role="alert"><h1>${esc(ui.t('error_title'))}</h1><p>${esc(ui.t('load_error'))}</p><button class="btn sun" data-act="retry-load">${esc(ui.t('retry'))}</button></section>`;
  m.innerHTML=(PROJECT||VIEW!=='overview'?ui.context(D,PROJECT,VIEW):'')+content;
  if(DEMO)m.insertAdjacentHTML('afterbegin',`<p class="project-mode" data-noi18n>${esc(ui.t('demo_mode'))} <a href="projects.html">${esc(ui.t('real_mode'))}</a></p>`);
  bind();ui.bind(m);ACTIVE_HASH=location.hash;
  const serviceRoot=document.getElementById('projectService');if(serviceRoot)loadProjectService(serviceRoot,PROJECT);
  const operationRoot=document.getElementById('projectOperations');
  if(operationRoot){const site=D.sites.find(s=>s.slug===PROJECT),view=VIEW;MsAdminOperations.mount(operationRoot,{site,view,demo:DEMO,notify:toast,dialog:openDlg,imageDataURL:imageDataUrl,call:(action,body)=>serviceApi(site.slug,view,action,body)});}

  if(VIEW==='workspaces')MsPlatform.mount(document.getElementById('workspaceRoot'),{admin:true,demo:DEMO,rpc,prepare:()=>controlApi('prepare_drafts',{}),probe:site=>controlApi('check_connections',{site})}).then(()=>{const root=document.getElementById('workspaceRoot'),head=root?.querySelector('.ms-platform-head');if(head){head.querySelector('h1').textContent=ui.t('workspaces');head.querySelector('p').textContent=ui.t('workspaces_help');}});
  if(window.MSI18N)MSI18N.apply(document.body);
}
async function projectNavigate(){
  if($("#app").hidden)return;
  if(ACTION_PENDING||MsAdminOperations.pending()){history.replaceState(null,'',ACTIVE_HASH||location.pathname+location.search);toast(MsAdminProjects.t('pending'));return;}
  if(dirty()&&!confirm(MsAdminProjects.t('leave'))){history.replaceState(null,'',ACTIVE_HASH||location.pathname+location.search);$('#projectSwitch').value=PROJECT;return;}
  MsAdminOperations.clear();FILTER='open';CT_Q='';CT_ERROR='';render();
  if(VIEW==='control'&&CT_MODE==='quick'&&!DEMO){const selected=PROJECT;try{await loadSiteControl();}catch(e){if(PROJECT===selected){CT_ERROR=e.message;toast(e.message);}}if(PROJECT===selected&&VIEW==='control')render();}
  $("#main h1")?.focus({preventScroll:true});
}
window.addEventListener('hashchange',projectNavigate);
function overview(){
  const open = D.changes.filter(c => c.status === "new");
  const down = D.sites.filter(s => { const u = uptime(s.slug); return u.last && !u.last.ok; });
  const late = D.sites.filter(overdue);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const mins = D.activity.filter(a => new Date(a.at) >= monthStart).reduce((t, a) => t + (a.minutes || 0), 0);
  return `<div class="head"><div><h1>Genel bakış</h1><p>${D.sites.length} ${T("site")} · ${T("son kontrol")} ${ago(D.checks.length ? D.checks[D.checks.length - 1].at : null)} · ${T("izleme 15 dakikada bir")}</p></div>
   <button class="btn sun" data-act="newlog">+ İş kaydet</button></div>
  <div class="kpis">
   <div class="kpi ${down.length ? "attn" : ""}"><small>Ayakta</small><b class="num">${D.sites.length - down.length} / ${D.sites.length}</b><span>${down.length ? esc(down.map(s => s.name).join(", ")) + " " + T("cevap vermiyor") : "Hepsi cevap veriyor"}</span></div>
   <div class="kpi ${open.length ? "attn" : ""}"><small>Bekleyen talep</small><b class="num">${open.length}</b><span>${open.length ? "Onayını bekliyor" : "Hepsi tamam"}</span></div>
   <div class="kpi ${late.length ? "attn" : ""}"><small>Geciken ödeme</small><b class="num">${late.length}</b><span>${late.length ? esc(late.map(s => s.name).join(", ")) : "Gecikme yok"}</span></div>
   <div class="kpi"><small>Bu ay harcanan süre</small><b class="num">${Math.floor(mins / 60)} ${T("sa")} ${mins % 60} ${T("dk")}</b><span>Kayıttaki işlerden</span></div>
  </div>
  <div class="sites">${D.sites.map(siteCard).join("")}</div>`;
}
function siteCard(s){
  const u = uptime(s.slug), q = D.quota[s.slug] || {};
  const st = s.status === "live" && u.last && !u.last.ok ? "down" : s.status;
  const stl = st === "down" ? "Cevap yok" : STATUS[s.status] || s.status;
  const bars = u.bars.length ? u.bars.map(c => `<i class="${c.ok ? "" : "no"}" style="height:${c.ok ? Math.max(25, Math.min(100, 100 - (c.ms || 0) / 12)) : 100}%" title="${esc(dt(c.at))}${c.ms ? " · " + c.ms + " ms" : ""}"></i>`).join("") : '<i class="gap" style="height:100%"></i>';
  const late = overdue(s);
  return `<article class="site">
   <div class="site-h"><div><h3>${esc(s.name)}</h3><small>${esc((s.url || "").replace(/^https?:\/\//, ""))} · ${esc(T(PLAN[s.plan] || s.plan))}</small></div><span class="st ${st}">${esc(stl)}</span></div>
   <div class="spark" aria-label="Son 12 saatlik kontroller">${bars}</div>
   <div class="facts">
    <div><small>Uptime 24 s</small><b class="num">${u.pct == null ? T("bekliyor") : u.pct + "%"}</b></div>
    <div><small>Ortalama</small><b class="num">${u.avg == null ? T("bekliyor") : u.avg + " ms"}</b></div>
    <div><small>${s.kind === "client" && !VIEWER ? "Ödendi" : "Son kontrol"}</small><b class="num ${late ? "bad" : ""}">${s.kind === "client" && !VIEWER ? day(s.paid_until) : ago(u.last && u.last.at)}</b></div>
   </div>
   ${q.small_quota != null || q.big_quota != null ? `<div class="q">${qbar("Küçük · ay", q.small_used, q.small_quota)}${qbar("Büyük · yıl", q.big_used, q.big_quota)}</div>` : ""}
   <div class="acts">
    ${s.url ? `<a class="btn sm" href="${esc(s.url)}" target="_blank" rel="noopener">Siteyi aç ↗</a>` : ""}
    ${s.admin_url ? `<a class="btn sm" href="${esc(s.admin_url)}" target="_blank" rel="noopener">Kendi paneli ↗</a>` : ""}
    <button class="btn sm ghost" data-act="newlog" data-site="${esc(s.slug)}">İş kaydet</button>
    ${s.kind === "client" ? `<button class="btn sm ghost" data-act="link" data-site="${esc(s.slug)}">Talep linki</button>` : ""}
    ${s.kind === "client" ? `<button class="btn sm ghost adm-only real-only" data-act="member" data-site="${esc(s.slug)}">Panel erişimi</button>` : ""}
   </div>
  </article>`;
}
function controlTabs(items, value, attr){ return `<div class="control-tabs">${items.map(([k,l])=>`<button class="${value===k?"on":""}" ${attr}="${k}">${l}</button>`).join("")}</div>`; }
function controlRow(title, detail, actions="") { return `<article class="control-row"><div><h3>${esc(title)}</h3><p>${detail||""}</p></div><div class="acts">${actions}</div></article>`; }
function siteControl(){
  if(DEMO) return `<div class="head"><div><h1>Site yönetimi</h1><p>Önizlemede canlı yönetim kontrolleri açılmaz. Gerçek veriler için giriş yap.</p></div></div>`;
  const header = `<div class="head"><div><h1>Site yönetimi</h1><p>Heron ve Laloo kontrolleri, kendi veritabanı ve izinleri üzerinden çalışır.</p></div><div class="control-tools"><strong data-noi18n>${esc(D.sites.find(s=>s.slug===PROJECT)?.name||PROJECT)}</strong><a class="btn sm" href="${CT_SITE==="heron"?"https://heronca.com/admin.html":"https://www.laloo.org/admin.html"}" target="_blank" rel="noopener">Tam panel ↗</a><button class="btn sm" data-act="control-refresh">Yenile</button></div></div>`;
  const modes = controlTabs([["quick","Hızlı kontroller"],["native","Tam yönetim"]], CT_MODE, "data-ctmode");
  if (CT_MODE === "native") return `${header}${modes}<iframe class="control-frame" title="${CT_SITE==="heron"?"Heron":"Laloo"} tam yönetim" src="/admin/${CT_SITE}.html"></iframe>`;
  if (CT_SITE === "laloo") {
    const tabs = modes + controlTabs([["places","Harita yerleri"],["businesses","İşletmeler"],["suggestions","Öneriler"],["cities","Şehirler"]], CT_TAB, "data-ctab");
    if (!CT_READY.laloo) return `${header}${tabs}<div class="control-notice">${esc(CT_ERROR||"Laloo yönetim verileri yükleniyor…")}</div>`;
    const list = CT_DATA[CT_TAB] || [];
    const q = CT_Q.trim().toLowerCase();
    const filtered = !q ? list : list.filter(x => [x.name,x.info,x.city,x.address,x.category,x.note,x.id].some(v=>String(v||"").toLowerCase().includes(q)));
    const tools = `<div class="control-tools" style="margin-bottom:12px"><input id="controlSearch" placeholder="${CT_TAB==="places"?"Yer, şehir veya adres ara":"İsim veya şehir ara"}" value="${esc(CT_Q)}"><span class="pill">${filtered.length}${CT_TAB==="places"?" / ilk 100":" kayıt"}</span></div>`;
    const rows = filtered.map(x=>{
      if (CT_TAB === "places") return controlRow(`${x.name||"Adsız yer"} · ${x.kind||""}`, `${esc([x.city,x.area,x.address,x.fee].filter(Boolean).join(" · "))} ${x.verified?"· doğrulandı":""}`, `<button class="btn sm ghost" data-act="place-edit" data-id="${x.id}">Düzenle</button><button class="btn sm ${x.active?"":"ghost"}" data-act="place-toggle" data-id="${x.id}" data-on="${x.active}">${x.active?"Yayında":"Gizli"}</button>`);
      if (CT_TAB === "businesses") return controlRow(x.name, `${esc([x.category,x.city,x.address,x.plan].filter(Boolean).join(" · "))}`, `<button class="btn sm ghost" data-act="business-edit" data-id="${esc(x.id)}">Düzenle</button><button class="btn sm ${x.active?"":"ghost"}" data-act="business-toggle" data-id="${esc(x.id)}" data-on="${x.active}">${x.active?"Yayında":"Gizli"}</button>`);
      if (CT_TAB === "suggestions") return controlRow(x.name, `${esc([x.city,x.address,x.source,x.note].filter(Boolean).join(" · "))}${x.url?` · <a href="${esc(x.url)}" target="_blank" rel="noopener">Bağlantı ↗</a>`:""}`, `<button class="btn sm ok" data-act="suggestion-set" data-id="${x.id}" data-status="approved">Onayla</button><button class="btn sm bad" data-act="suggestion-set" data-id="${x.id}" data-status="rejected">Reddet</button>`);
      return controlRow(`${x.name} · ${x.country}`, `${esc(x.id)} · ${x.active?"aktif":"kapalı"}`, `<button class="btn sm ${x.active?"ghost":""}" data-act="city-toggle" data-id="${esc(x.id)}" data-on="${x.active}">${x.active?"Kapat":"Aç"}</button>`);
    }).join("");
    return `${header}<div class="control-notice">Laloo’nun canlı yönetim verileri. Harita yerlerinde ilk 100 kayıt gelir; filtreyi sonuç daraltmak için kullan. Değişiklikler Laloo sitesine anında yansır.</div>${tabs}${tools}<div class="control-list">${rows||'<div class="empty">Kayıt bulunamadı.</div>'}</div>`;
  }
  const tabs = modes + controlTabs([["heron","Ürünler"],["queue","Yayın sırası"],["offers","Teklifler"]], CT_TAB, "data-ctab");
  if (!CT_READY.heron) return `${header}${tabs}<div class="control-notice">${esc(CT_ERROR||"Heron yönetim köprüsü bağlanıyor…")} <a href="https://heronca.com/admin.html" target="_blank" rel="noopener">Tam Heron yönetimini aç ↗</a></div>`;
  const q = CT_Q.trim().toLowerCase();
  if (CT_TAB === "heron") {
    const rows = CT_DATA.heron.filter(x=>!q||`${x.title} ${x.sku} ${x.category}`.toLowerCase().includes(q)).slice(0,150).map(x=>controlRow(`${x.title} · ${x.size||"Tek beden"}`, `${esc([x.sku,x.category,"$"+(Number(x.price||0)/100).toFixed(2),x.qty+" adet"].join(" · "))}${x.images?.length?` · ${x.images.length} fotoğraf`:" · fotoğraf yok"}`, `<button class="btn sm ghost" data-photo-open="photo-${esc(x.id)}">Fotoğraf</button><input id="photo-${esc(x.id)}" data-photo-item="${esc(x.item_id)}" data-photo-sku="${esc(x.sku)}" type="file" accept="image/*" hidden><button class="btn sm ghost" data-act="heron-price" data-id="${esc(x.id)}" data-price="${Number(x.price||0)/100}">Fiyat</button><button class="btn sm ${x.qty>0?"bad":"ghost"}" data-act="heron-sold" data-id="${esc(x.id)}" data-sku="${esc(x.sku)}">${x.qty>0?"Satıldı":"Stokta yok"}</button>`)).join("");
    return `${header}${tabs}<div class="control-tools" style="margin-bottom:12px"><input id="controlSearch" placeholder="Ürün veya SKU ara" value="${esc(CT_Q)}"><span class="pill">${CT_DATA.heron.length} ürün</span></div><div class="control-list">${rows||'<div class="empty">Ürün bulunamadı.</div>'}</div>`;
  }
  if (CT_TAB === "queue") {
    const rows = CT_DATA.queue.map(x=>controlRow(x.item?.title||x.item_id, `${esc(x.status)}${x.publish_at?" · "+esc(dt(x.publish_at)):""}`)).join("");
    return `${header}${tabs}<div class="control-notice">Yayın kuyruğunu buradan görüntüleyebilirsin. Ürünü kuyruğa alma ve zamanlama için <a href="https://heronca.com/admin.html" target="_blank" rel="noopener">Heron’un tam yönetim ekranını aç ↗</a>.</div><div class="control-list">${rows||'<div class="empty">Yayın sırası boş.</div>'}</div>`;
  }
  const rows = CT_DATA.offers.map(x=>controlRow(`${x.email} · ${x.status}`, `${esc(x.items?.map(i=>i.title).join(", ")||"")} · ${x.amount_cents?money(x.amount_cents):"teklif bekliyor"}`, x.status==="new"?`<button class="btn sm ok" data-act="heron-offer" data-id="${x.id}" data-accept="1" data-amount="${x.amount_cents||""}">Kabul et</button><button class="btn sm bad" data-act="heron-offer" data-id="${x.id}" data-accept="0">Reddet</button>`:"" )).join("");
  return `${header}${tabs}<div class="control-list">${rows||'<div class="empty">Yeni teklif yok.</div>'}</div>`;
}
function changes(){
  const list = projectData().changes.filter(c => FILTER === "all" ? true : FILTER === "open" ? c.status === "new" || c.status === "approved" : c.status === FILTER);
  return `<div class="head"><div><h1>Talepler</h1><p>Müşteri talebi buraya düşer. Sen onaylarsın, iş bitince "Bitti" dersin. Aynı şey 12 saat içinde tekrar değişirse kotadan düşmez.</p></div>
   <button class="btn sun" data-act="newchange">+ Talep ekle</button></div>
  <div class="panel"><div class="panel-h"><h2>${list.length} ${T("talep")}</h2>
   <div class="filters">${[["open","Açık"],["new","Yeni"],["done","Biten"],["rejected","Reddedilen"],["withdrawn","Geri çekilen"],["all","Hepsi"]].map(([k, l]) => `<button data-filter="${k}" class="${FILTER === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
   ${list.length ? list.map(c => `<div class="row"><div>
      <div class="t">${esc(c.request)}</div>
      <div class="m"><b>${esc(siteName(c.site))}</b><span>${c.kind === "big" ? T("Büyük") : T("Küçük")}${c.target ? " · " + esc(c.target) : ""}</span><span>${esc(c.requested_by || "")}</span><span>${dt(c.created_at)}</span>${c.counts === false && c.status !== "rejected" ? "<span>" + T("kotadan düşmedi") + "</span>" : ""}${c.minutes ? `<span>${c.minutes} ${T("dk")}</span>` : ""}</div></div>
     <div class="r">${!VIEWER ? `<a class="btn sm" href="changes/?${DEMO?'preview=1':'id='+c.id}">Kırmızı önizleme</a>` : ""}${subTag(c)}<span class="pill ${c.status}">${({ new:"Yeni", approved:"Onaylı", done:"Bitti", rejected:"Ret", withdrawn:"Geri çekildi" })[c.status] || esc(c.status)}</span>
      ${c.status === "new" ? `<button class="btn sm bad" data-act="decide" data-id="${c.id}" data-s="rejected">Reddet</button>` : ""}
      ${c.status === "new" || c.status === "approved" ? `<button class="btn sm" data-act="done" data-id="${c.id}">Bitti</button>` : ""}
     </div></div>`).join("") : '<div class="empty">Bu filtrede talep yok.</div>'}
  </div>`;
}
/* ---------------- versions ---------------- */
let VFOCUS = null; const VSEL = {};
function subTag(c){
  if (!c.submission_id) return "";
  const s = (D.subs || []).find(x => x.id === c.submission_id);
  if (!s || s.version < 2) return "";
  return `<button class="vtag" data-act="vers" data-id="${s.id}" title="Sürümler">v${s.version}</button>`;
}
function wdiff(a, b){
  const A = String(a || "").split(/(\s+)/), B = String(b || "").split(/(\s+)/);
  if (A.length * B.length > 250000) return [esc(a), esc(b)];
  const n = A.length, m = B.length, L = Array.from({ length:n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, x = "", y = "";
  while (i < n && j < m) {
    if (A[i] === B[j]) { x += esc(A[i]); y += esc(B[j]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { x += /^\s+$/.test(A[i]) ? A[i] : `<del>${esc(A[i])}</del>`; i++; }
    else { y += /^\s+$/.test(B[j]) ? B[j] : `<ins>${esc(B[j])}</ins>`; j++; }
  }
  while (i < n) { x += /^\s+$/.test(A[i]) ? A[i] : `<del>${esc(A[i])}</del>`; i++; }
  while (j < m) { y += /^\s+$/.test(B[j]) ? B[j] : `<ins>${esc(B[j])}</ins>`; j++; }
  return [x, y];
}
function versions(){
  const subs = (projectData().subs || []).filter(s => (projectData().vers || []).some(v => v.submission_id === s.id));
  const head = `<div class="head"><div><h1>Sürümler</h1><p>Müşteri talebini her düzelttiğinde yeni sürüm kaydedilir. İlk hali ile son halini yan yana gör, yanlış yöne gittiyse eski sürüme dön.</p></div></div>`;
  if (!subs.length) return head + '<div class="panel"><div class="empty">Henüz gönderilmiş talep yok.</div></div>';
  return head + subs.map(s => {
    const vs = projectData().vers.filter(v => v.submission_id === s.id).sort((a, b) => a.version - b.version);
    const sel = VSEL[s.id] || { a:vs[0].version, b:vs[vs.length - 1].version };
    const va = vs.find(v => v.version === sel.a) || vs[0], vb = vs.find(v => v.version === sel.b) || vs[vs.length - 1];
    const ids = [...new Set([...va.items, ...vb.items].map(x => x.id))];
    const cnt = { edited:0, added:0, removed:0, same:0 };
    const rows = ids.map(id => {
      const a = va.items.find(x => x.id === id), b = vb.items.find(x => x.id === id), it = b || a;
      const st = !b ? "removed" : !a ? "added" : (a.request === b.request && a.kind === b.kind) ? "same" : "edited"; cnt[st]++;
      const [x, y] = st === "edited" ? wdiff(a.request, b.request) : [a ? esc(a.request) : "", b ? esc(b.request) : ""];
      const lbl = { edited:"Değişti", added:"Eklendi", removed:"Kaldırıldı", same:"Aynı" }[st];
      return `<div class="vr ${st}"><div class="vt"><b data-noi18n>${esc(it.target || T("Genel not"))}</b>${it.original ? `<small><span>Sitede:</span> <span data-noi18n>${esc(String(it.original).slice(0, 140))}</span></small>` : ""}<span class="pill ${st}">${lbl}</span>${it.kind === "big" ? ' <span class="pill big">Büyük</span>' : ""}</div>
        <div class="vc ${a ? "" : "none"}" data-v="v${va.version}" data-noi18n>${a ? x : "–"}</div><div class="vc ${b ? "" : "none"}" data-v="v${vb.version}" data-noi18n>${b ? y : "–"}</div></div>`;
    }).join("");
    const opt = (side, cur) => `<select data-vsel="${s.id}" data-side="${side}">${vs.map(v => `<option value="${v.version}" ${v.version === cur ? "selected" : ""}>v${v.version} · ${esc(dt(v.at))}</option>`).join("")}</select>`;
    return `<div class="panel" id="sub-${s.id}"><div class="panel-h"><div><h2>${esc(siteName(s.site))}</h2>
       <div class="row" style="padding:0;border:0;display:block"><div class="m"><b data-noi18n>${esc(s.name || "")}</b><span data-noi18n>${esc(s.email || "")}</span><span>v${s.version}</span><span>${T("güncellendi")} ${ago(s.updated_at)}</span>${(s.approved || []).length ? `<span>${(s.approved || []).length} <span>parça onaylandı</span></span>` : ""}</div></div></div>
      <div class="vsel"><label>A ${opt("a", va.version)}</label><label>B ${opt("b", vb.version)}</label>
       <button class="btn sm ghost" data-act="vlink" data-id="${s.id}">Linki kopyala</button>
       <a class="btn sm ghost" href="${SITE}/request/?e=${esc(s.edit_key)}" target="_blank" rel="noopener">Müşteri sayfası ↗</a>
       ${va.version !== s.version ? `<button class="btn sm sun" data-act="restore" data-id="${s.id}" data-v="${va.version}"><span>A sürümüne dön</span> (v${va.version})</button>` : ""}</div></div>
     <div class="vsum"><span><b>${cnt.edited}</b> değişti</span><span><b>${cnt.added}</b> eklendi</span><span><b>${cnt.removed}</b> kaldırıldı</span><span><b>${cnt.same}</b> aynı</span></div>
     <div class="vgrid"><div class="vr h"><span>Parça</span><span>A: v${va.version}</span><span>B: v${vb.version}</span></div>${rows}</div></div>`;
  }).join("");
}
function log(){
  return `<div class="head"><div><h1>Kayıt</h1><p>Elle ve otomatik yapılan her iş, harcanan süreyle. Bir şey bozulursa son yedek + bu kayıt ile geri dönülür.</p></div>
   <button class="btn sun" data-act="newlog">+ İş kaydet</button></div>
  <div class="panel"><div class="log">${projectData().activity.length ? projectData().activity.map(a => `<div class="e"><time>${dt(a.at)}</time><span class="w ${esc(a.who)}">${esc(WHO[a.who] || a.who)}</span><span><span class="s">${esc(siteName(a.site))}</span>${esc(a.action)}${metaTxt(a.meta)}</span><span class="min">${a.minutes ? a.minutes + " " + T("dk") : ""}</span></div>`).join("") : '<div class="empty">Henüz kayıt yok.</div>'}</div></div>`;
}
function billing(){
  const clients = projectData().sites.filter(s => s.kind === "client");
  return `<div class="head"><div><h1>Ödemeler</h1><p>Ödeme gecikince ${clients.length ? "site " + (clients[0].grace_days || 7) + " gün sonra" : "site bekleme süresinden sonra"} kendiliğinden askıya alınır ve nazik bir mesaj gösterir. Ödeme kaydedilince geri açılır.</p></div></div>
  <div class="panel"><div class="tw"><table class="t"><thead><tr><th>Müşteri</th><th>Paket</th><th>Aylık</th><th>Ödendi</th><th>Durum</th><th></th></tr></thead><tbody>
   ${clients.length ? clients.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(PLAN[s.plan] || s.plan)}</td><td class="num">${money(s.monthly_cents)}</td><td class="num" style="color:${overdue(s) ? "var(--bad)" : "inherit"}">${day(s.paid_until)}</td><td><span class="st ${overdue(s) ? "suspended" : s.status}">${overdue(s) ? "Gecikti" : esc(STATUS[s.status] || s.status)}</span></td>
     <td style="text-align:right"><button class="btn sm" data-act="pay" data-site="${esc(s.slug)}">Ödeme kaydet</button> <button class="btn sm ${s.status === "suspended" ? "ok" : "bad"}" data-act="suspend" data-site="${esc(s.slug)}">${s.status === "suspended" ? "Aç" : "Askıya al"}</button></td></tr>`).join("") : '<tr><td colspan="6" class="empty">Henüz müşteri yok.</td></tr>'}
  </tbody></table></div></div>
  <div class="panel"><div class="panel-h"><h2>Son ödemeler</h2></div><div class="tw"><table class="t"><thead><tr><th>Tarih</th><th>Müşteri</th><th>Tutar</th><th>Şu tarihe kadar</th><th>Not</th></tr></thead><tbody>
   ${projectData().payments.length ? projectData().payments.map(p => `<tr><td>${day(p.paid_at)}</td><td>${esc(siteName(p.site))}</td><td class="num">${money(p.amount_cents)}</td><td>${day(p.period_to)}</td><td>${esc(p.note || "")}</td></tr>`).join("") : '<tr><td colspan="5" class="empty">Kayıt yok.</td></tr>'}
  </tbody></table></div></div>`;
}
function usage(){
  return `<div class="head"><div><h1>Kullanım</h1><p>Ücretli servisler her zaman müşterinin kendi hesabından çalışır. Limite yaklaşınca uyar, istersen kapat.</p></div><button class="btn sun" data-act="newusage">+ Servis ekle</button></div>
  <div class="panel">${projectData().usage.length ? projectData().usage.map((u, i) => { const p = u.lim ? Math.round(100 * u.used / u.lim) : null;
    return `<div class="meter"><div class="top"><span><b>${esc(siteName(u.site))}</b> · ${esc(u.service)} ${u.enabled ? "" : '<span class="pill">kapalı</span>'}</span><span class="mono num">${Number(u.used).toLocaleString("en-US")}${u.lim ? " / " + Number(u.lim).toLocaleString("en-US") : ""} ${esc(u.unit || "")}${p != null ? " · " + p + "%" : ""}</span></div>
     ${p != null ? `<div class="bar"><i class="${p >= 95 ? "x" : p >= 80 ? "w" : ""}" style="width:${Math.min(100, p)}%"></i></div>` : ""}
     <div><button class="btn sm ghost" data-act="editusage" data-i="${D.usage.indexOf(u)}">Güncelle</button> <button class="btn sm ghost" data-act="toggleusage" data-i="${D.usage.indexOf(u)}">${u.enabled ? "Kapat" : "Aç"}</button></div></div>`; }).join("") : '<div class="empty">Takip edilen servis yok.</div>'}</div>`;
}
function siteSettings(){
 const s=projectData().sites[0],ui=MsAdminProjects;
 return `<section data-noi18n><header class="project-page-head"><div><h1>${esc(ui.t('sites'))}</h1><p>${esc(ui.t('settings_help'))}</p></div></header><section class="project-settings"><h2>${esc(s.name)}</h2><p>${esc(s.url||s.slug)}</p><button class="btn sun" data-act="editsite" data-s="${esc(s.slug)}">${esc(ui.t('edit_project'))}</button><button class="btn ghost" data-act="link" data-s="${esc(s.slug)}">${esc(ui.t('request_link'))}</button></section><section class="project-settings"><h2>${esc(ui.t('customer_access'))}</h2><p>${esc(ui.t('access_help'))}</p><button class="btn sun" data-act="member" data-s="${esc(s.slug)}">${esc(ui.t('add_member'))}</button></section><div id="projectService"></div></section>`;
}

function worker(){
  const w = D.worker;
  if (!w) return `<div class="head"><div><h1>İşçi</h1><p>Önce işçi paneli SQL dosyasını Supabase projesine kur. Bu panel otomasyonu varsayılan olarak kapalı tutar.</p></div></div><div class="panel"><div class="empty">Veritabanı kurulumu bulunamadı. İşçi ayarları yüklenmedi ve otomasyon çalıştırılamaz.</div></div>`;
  const routes = w.routes || {}, keys = w.keys || [];
  const providerName = { gemini:"Gemini", deepseek:"DeepSeek", haiku:"Claude Haiku API", github:"GitHub token" };
  const routeKeys = ["classify","content","code"], routeLabel = { classify:"Ayırma", content:"İçerik", code:"Kod" };
  const opts = selected => ["gemini","deepseek","haiku"].map(p => `<option value="${p}" ${p === selected ? "selected" : ""}>${providerName[p]}</option>`).join("");
  const routeRows = routeKeys.map(route => `<div class="worker-route"><label>${routeLabel[route]}</label>${[0,1,2].map(i => `<select data-route="${route}" data-pos="${i}" aria-label="${routeLabel[route]} ${i+1}. model">${opts((routes[route] || [])[i])}</select>`).join("")}</div>`).join("");
  const keyRows = keys.map(k => `<div class="worker-key"><div><b>${providerName[k.provider]}</b><small>${k.configured ? `${T("Anahtar kayıtlı")} · ${T("sonu")} ${esc(k.last4 || "••••")}` : T("Anahtar eklenmedi")}</small></div><label>Yeni API anahtarı<input type="password" autocomplete="new-password" data-key="${k.provider}" placeholder="Yalnızca yeni anahtar yaz"></label><button class="btn sm" data-act="worker-key" data-provider="${k.provider}">Kaydet</button></div>`).join("");
  const siteRows = D.sites.map(s => `<div class="worker-key"><div><b>${esc(s.name)}</b><small>${esc(s.slug)}</small></div><label>GitHub repo<input type="text" data-repo="${esc(s.slug)}" value="${esc(s.repo || "Zuzay/mrspace.online")}" placeholder="owner/repo"></label><label>Repo klasörü<input type="text" data-path="${esc(s.slug)}" value="${esc(s.repo_path || "")}" placeholder="rufcut/"></label><button class="btn sm" data-act="worker-site" data-site="${esc(s.slug)}">Kaydet</button></div>`).join("");
  const spent = Number(w.spend_month || 0), limit = Number(w.budget_month || 0), pct = limit > 0 ? Math.min(100, Math.round(spent / limit * 100)) : 0;
  return `<div class="head"><div><h1>İşçi</h1><p>API anahtarlarını, bütçeyi, model sırasını ve sitelerin repo klasörünü yönet.</p></div><button class="btn sun" data-act="worker-run">Şimdi çalıştır</button></div>
   <div class="kpis"><div class="kpi"><small>Durum</small><b>${w.enabled ? "Açık" : "Kapalı"}</b><span>${w.updated_at ? "Güncellendi " + ago(w.updated_at) : "Kurulum bekliyor"}</span></div><div class="kpi"><small>Bu ay</small><b>$${spent.toFixed(2)}</b><span>/ $${limit.toFixed(2)} aylık tavan</span></div><div class="kpi"><small>Talep başı tavan</small><b>$${Number(w.budget_per_request || 0).toFixed(2)}</b><span>API çağrılarının toplam sınırı</span></div><div class="kpi"><small>Harcanan bütçe</small><b>${pct}%</b><span class="meter"><span class="bar"><i style="width:${pct}%"></i></span></span></div></div>
   <div class="worker-grid">
    <section class="worker-card"><div class="panel-h"><h2>Genel ayarlar</h2><button class="btn sm sun" data-act="worker-save">Ayarları kaydet</button></div><div class="form"><label class="wide" style="display:flex;align-items:center;gap:10px;text-transform:none;letter-spacing:0"><input type="checkbox" id="workerEnabled" ${w.enabled ? "checked" : ""} style="width:auto"> Otomatik işçi açık</label><label>Aylık bütçe · USD<input type="number" id="workerBudgetMonth" min="0.01" max="10000" step="0.01" value="${esc(w.budget_month ?? 10)}"></label><label>Talep başı bütçe · USD<input type="number" id="workerBudgetRequest" min="0.01" step="0.01" value="${esc(w.budget_per_request ?? "")}"></label></div><div class="control-notice" style="margin:0 16px 16px">Açma işlemi yeni ve onaylanmış talepleri otomatik çalıştırır. Önce en az bir AI anahtarı ve GitHub token ile iki bütçe sınırını gir.</div></section>
    <section class="worker-card"><div class="panel-h"><h2>API anahtarları</h2></div>${keyRows}<div class="control-notice" style="margin:0 16px 16px">GitHub token için bu repo ile sınırlı fine-grained token kullan; Contents ve Pull requests için yazma izni gerekir.</div></section>
    <section class="worker-card"><div class="panel-h"><h2>İş türüne göre model sırası</h2><span class="mono">Öncelik 1 → 2 → 3</span></div>${routeRows}<div class="acts"><button class="btn sm sun" data-act="worker-save">Ayarları kaydet</button></div></section>
    <section class="worker-card"><div class="panel-h"><h2>GitHub site klasörleri</h2></div>${siteRows || '<div class="empty">Site bulunamadı.</div>'}<div class="control-notice" style="margin:0 16px 16px">Klasör yolunu repo köküne göre yaz, ör. <code>rufcut/</code>. Boş yol bırakırsan işçi o siteye dokunmaz.</div></section>
   </div>`;
}
function access(){
  const v = D.viewers || [];
  return `<div class="head"><div><h1>Erişim</h1><p>Sistemi göstermek istediğin kişiler buraya. Her şeyi görürler ama hiçbir şeyi değiştiremezler. Ödemeler, müşteri iletişimi ve gizli anahtarlar onlara gösterilmez.</p></div><button class="btn sun" data-act="newviewer">+ İzleyici ekle</button></div>
  <div class="panel">${v.length ? v.map(x => `<div class="row"><div><div class="t">${esc(x.name || x.email)}</div><div class="m"><span>${T("Kullanıcı adı")}: <b>${esc(x.email.replace("@mrspace.online", ""))}</b></span><span>${x.until ? T("Şu tarihe kadar") + ": " + day(x.until) : T("Süresiz")}</span></div></div><div class="r"><button class="btn sm bad" data-act="delviewer" data-email="${esc(x.email)}">Kaldır</button></div></div>`).join("") : '<div class="empty">Henüz izleyici yok.</div>'}</div>
  <div class="panel"><div class="panel-h"><h2>Nasıl eklenir</h2></div><div style="padding:14px 16px;display:grid;gap:8px;font-size:14px">
   <p>1. Burada "İzleyici ekle" de, kullanıcı adını yaz (ör. <b>edwin</b>).</p>
   <p>2. Supabase'de laloo projesi > Authentication > Users > Add user: e-posta <b>edwin@mrspace.online</b>, bir şifre belirle, "Auto confirm" işaretli olsun.</p>
   <p>3. Kişiye mrspace.online/admin adresini, kullanıcı adını ve şifreyi ver. Süre koyarsan o tarihten sonra giremez.</p>
  </div></div>`;
}

/* ---------------- dialogs ---------------- */
function openDlg(title, fields, onSave, saveLabel = "Kaydet"){
  $("#dlgBody").innerHTML = `<div class="panel-h"><h2>${esc(title)}</h2><button class="btn sm ghost" type="button" data-close>Kapat</button></div>
   <form class="form" id="dlgForm">${fields}<div class="wide" style="display:flex;justify-content:flex-end"><button class="btn sun" type="submit">${esc(saveLabel)}</button></div></form>`;
  const d = $("#dlg"); if (window.MSI18N) MSI18N.apply(d); d.showModal();
  d.querySelector("[data-close]").onclick = () => {if(!ACTION_PENDING)d.close();};
  d.oncancel=e=>{if(ACTION_PENDING)e.preventDefault();};
  $("#dlgForm").onsubmit = async e => {
    e.preventDefault();if(ACTION_PENDING)return;
    const v = Object.fromEntries(new FormData(e.target).entries());
    const button=e.target.querySelector('[type=submit]');ACTION_PENDING=true;button.disabled=true;
    e.target.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=true);
    try { await onSave(v); d.close(); await refresh(); } catch (err) { toast(err.message); }
    finally{ACTION_PENDING=false;button.disabled=false;e.target.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=false);}

  };
}
const siteOpts = (sel, withNone) => (withNone && !PROJECT ? '<option value="">Genel</option>' : "") + (PROJECT?D.sites.filter(s=>s.slug===PROJECT):D.sites).map(s => `<option value="${esc(s.slug)}" ${s.slug === sel ? "selected" : ""}>${esc(s.name)}</option>`).join("");
const f = (label, name, val = "", type = "text", extra = "") => `<label${extra}>${label}<input name="${name}" type="${type}" value="${esc(val)}"></label>`;

async function act(kind, el){
  if(kind==='retry-load')return refresh();
  if(VIEWER)throw Error(MsAdminProjects.t('readonly'));
  const slug = el.dataset.site, id = Number(el.dataset.id);
  if (kind === "worker-key") {
    const provider = el.dataset.provider, input = [...document.querySelectorAll("[data-key]")].find(x => x.dataset.key === provider), key = (input?.value || "").trim();
    if (!key) throw new Error("Yeni API anahtarını yaz");
    if (DEMO) { input.value = ""; return toast("Demo: anahtar kaydedilmedi"); }
    await rpc("ms_set_ai_key", { p_provider:provider, p_key:key }); input.value = ""; toast("Anahtar güvenli kasaya kaydedildi"); return refresh();
  }
  if (kind === "worker-site") {
    const repo = [...document.querySelectorAll("[data-repo]")].find(x => x.dataset.repo === slug)?.value.trim() || "";
    const repoPath = [...document.querySelectorAll("[data-path]")].find(x => x.dataset.path === slug)?.value.trim() || "";
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Repo biçimi owner/name olmalı");
    if (repoPath && (repoPath.startsWith("/") || repoPath.split("/").includes("..") || !/^[A-Za-z0-9_.\/-]+$/.test(repoPath))) throw new Error("Klasör yolu göreli olmalı ve .. içermemeli");
    if (DEMO) { const s = D.sites.find(x => x.slug === slug); s.repo = repo; s.repo_path = repoPath; return toast("Demo: kaydedildi"); }
    await api(`ms_sites?slug=eq.${encodeURIComponent(slug)}`, { method:"PATCH", body:{ repo, repo_path:repoPath || null } }); toast("Repo ayarı kaydedildi"); return refresh();
  }
  if (kind === "worker-save") {
    const budgetMonth = Number($("#workerBudgetMonth").value), budgetRequest = Number($("#workerBudgetRequest").value), routes = {};
    for (const route of ["classify","content","code"]) routes[route] = [0,1,2].map(i => [...document.querySelectorAll("[data-route]")].find(x => x.dataset.route === route && Number(x.dataset.pos) === i)?.value).filter(Boolean);
    const enabled = $("#workerEnabled").checked, keys = D.worker?.keys || [];
    if (!Number.isFinite(budgetMonth) || budgetMonth <= 0 || !Number.isFinite(budgetRequest) || budgetRequest <= 0 || budgetRequest > budgetMonth) throw new Error("Bütçe sınırlarını kontrol et");
    if (enabled && (!keys.some(x => x.provider !== "github" && x.configured) || !keys.some(x => x.provider === "github" && x.configured))) throw new Error("İşçiyi açmadan önce AI ve GitHub anahtarlarını kaydet");
    if (DEMO) { D.worker.enabled = enabled; D.worker.budget_month = budgetMonth; D.worker.budget_per_request = budgetRequest; D.worker.routes = routes; return toast("Demo: kaydedildi"); }
    await rpc("ms_set_worker_settings", { p_enabled:enabled, p_routes:routes, p_budget_month:budgetMonth, p_budget_per_request:budgetRequest }); toast("İşçi ayarları kaydedildi"); return refresh();
  }
  if (kind === "worker-run") {
    if (!D.worker?.enabled && !DEMO) throw new Error("Önce işçiyi aç ve ayarları kaydet");
    if (DEMO) return toast("Demo: çalıştırma gönderilmedi");
    await rpc("ms_worker_run_now", {}); toast("İşçi çalıştırma isteği gönderildi"); return refresh();
  }
  if (kind === "control-refresh") { if(CT_MODE==="native"){document.querySelector(".control-frame")?.contentWindow?.location.reload();return;} await loadSiteControl(); return render(); }
  if (kind === "place-toggle") {
    const row = CT_DATA.places.find(x=>String(x.id)===el.dataset.id); if (!row) return;
    await api(`places?id=eq.${encodeURIComponent(row.id)}`, { method:"PATCH", body:{ active:!row.active } }); await logSiteControl("laloo", "place visibility updated"); toast(row.active?"Harita yerinden kaldırıldı":"Harita yerinde yayınlandı"); await loadSiteControl(); return render();
  }
  if (kind === "place-edit") {
    const x = CT_DATA.places.find(x=>String(x.id)===el.dataset.id); if (!x) return;
    return openDlg("Harita yerini düzenle", f("Ad","name",x.name)+f("Adres","address",x.address||"")+f("Bölge","area",x.area||"")+f("Ücret","fee",x.fee||"")+f("Saatler","hours",x.hours||"")+`<label class="wide">Bilgi<textarea name="info" rows="3">${esc(x.info||"")}</textarea></label><label><span>Aktif</span><input name="active" type="checkbox" ${x.active?"checked":""}></label><label><span>Doğrulanmış</span><input name="verified" type="checkbox" ${x.verified?"checked":""}></label>`, async v=>{
      const active = $("#dlgForm [name=active]").checked, verified = $("#dlgForm [name=verified]").checked;
      await api(`places?id=eq.${encodeURIComponent(x.id)}`, { method:"PATCH", body:{ name:v.name, address:v.address||null, area:v.area||null, fee:v.fee||null, hours:v.hours||null, info:v.info||null, active, verified } });
      await logSiteControl("laloo", "place updated"); toast("Laloo harita kaydı güncellendi"); await loadSiteControl();
    });
  }
  if (kind === "business-toggle") {
    const x = CT_DATA.businesses.find(x=>x.id===el.dataset.id); if (!x) return;
    await api(`businesses?id=eq.${encodeURIComponent(x.id)}`, { method:"PATCH", body:{ active:!x.active } }); await logSiteControl("laloo", "business visibility updated"); toast("İşletme durumu güncellendi"); await loadSiteControl(); return render();
  }
  if (kind === "business-edit") {
    const x = CT_DATA.businesses.find(x=>x.id===el.dataset.id); if (!x) return;
    return openDlg("Laloo işletmesini düzenle", f("İşletme adı","name",x.name)+f("Kategori","category",x.category)+f("Şehir","city",x.city||"")+f("Adres","address",x.address||"")+f("Web sitesi","website",x.website||"","url")+f("Ücretli plan","plan",x.plan)+f("Plan fiyatı ($)","plan_price_usd",x.plan_price_usd,"number")+f("Üyelik bitişi","paid_until",x.paid_until||"","date")+`<label class="wide">Kısa açıklama<textarea name="blurb" rows="3">${esc(x.blurb||"")}</textarea></label>`, async v=>{
      await api(`businesses?id=eq.${encodeURIComponent(x.id)}`, { method:"PATCH", body:{ name:v.name, category:v.category, city:v.city||null, address:v.address||null, website:v.website||null, plan:v.plan, plan_price_usd:Number(v.plan_price_usd||0), paid_until:v.paid_until||null, blurb:v.blurb||null } }); await logSiteControl("laloo", "business updated"); toast("Laloo işletmesi güncellendi"); await loadSiteControl();
    });
  }
  if (kind === "suggestion-set") {
    await api(`suggestions?id=eq.${encodeURIComponent(el.dataset.id)}`, { method:"PATCH", body:{ status:el.dataset.status } }); await logSiteControl("laloo", "suggestion moderated"); toast(el.dataset.status==="approved"?"Öneri onaylandı":"Öneri reddedildi"); await loadSiteControl(); return render();
  }
  if (kind === "city-toggle") {
    const x = CT_DATA.cities.find(x=>x.id===el.dataset.id); if (!x) return;
    await api(`cities?id=eq.${encodeURIComponent(x.id)}`, { method:"PATCH", body:{ active:!x.active } }); await logSiteControl("laloo", "city visibility updated"); toast("Şehir görünürlüğü güncellendi"); await loadSiteControl(); return render();
  }
  if (kind === "heron-price") {
    const price = prompt("Yeni fiyat (USD)", el.dataset.price); if (price===null || !Number.isFinite(Number(price)) || Number(price)<0) return;
    await controlApi("admin_reprice", { changes:[{ id:el.dataset.id, price:Number(price) }] }); toast("Heron fiyatı güncellendi"); await loadSiteControl(); return render();
  }
  if (kind === "heron-sold") {
    if (!confirm(`“${el.dataset.sku||"Ürün"}” ürününü Square'de satıldı olarak işaretleyeyim mi?`)) return;
    await controlApi("admin_mark_sold", { ids:[el.dataset.id] }); toast("Heron stoğu sıfırlandı"); await loadSiteControl(); return render();
  }
  if (kind === "heron-offer") {
    const accept = el.dataset.accept === "1"; let amount;
    if (accept) { amount = prompt("Teklif tutarı (USD)", el.dataset.amount?String(Number(el.dataset.amount)/100):""); if (amount===null) return; if (!Number.isFinite(Number(amount)) || Number(amount)<=0) throw new Error("Geçerli bir teklif tutarı yaz"); }
    const out = await controlApi("admin_offer_answer", { id:Number(el.dataset.id), accept, ...(accept?{amount:Number(amount)}:{}) });
    if (accept && out.link) { try { await navigator.clipboard.writeText(out.link); toast("Teklif kabul edildi, ödeme bağlantısı kopyalandı"); } catch { prompt("Ödeme bağlantısı",out.link); } } else toast(accept?"Teklif kabul edildi":"Teklif reddedildi");
    await loadSiteControl(); return render();
  }
  if (kind === "newlog") return openDlg("İş kaydet", `<label>Site<select name="site">${siteOpts(slug, true)}</select></label>${f("Süre (dk)", "minutes", "", "number")}<label class="wide">Ne yapıldı<textarea name="action" rows="2" required></textarea></label>`,
    async v => { if (DEMO) { D.activity.unshift({ site:v.site || null, who:"uzay", action:v.action, minutes:Number(v.minutes || 0), at:new Date().toISOString() }); return toast("Demo: kaydedildi"); }
      await api("ms_activity", { method:"POST", body:{ site:v.site || null, who:"uzay", action:v.action, minutes:Number(v.minutes || 0) } }); toast("Kaydedildi"); });
  if (kind === "newchange") return openDlg("Talep ekle", `<label>Site<select name="site">${siteOpts()}</select></label><label>Tür<select name="kind"><option value="small">Küçük</option><option value="big">Büyük</option></select></label>${f("Ne (logo, saatler...)", "target")}<label class="wide">Talep<textarea name="request" rows="3" required></textarea></label>`,
    async v => { if (DEMO) { D.changes.unshift({ id:Date.now(), ...v, status:"new", requested_by:"Uzay", created_at:new Date().toISOString() }); return toast("Demo: eklendi"); }
      await api("ms_changes", { method:"POST", body:{ site:v.site, kind:v.kind, target:v.target || "", request:v.request, requested_by:"Uzay" } }); toast("Talep eklendi"); });
  if (kind === "decide") {
    if (DEMO) { const c = D.changes.find(x => x.id === id); c.status = el.dataset.s; c.counts = el.dataset.s === "approved"; c.decided_at = new Date().toISOString(); toast("Demo: güncellendi"); return render(); }
    await rpc("ms_decide_change", { p_id:id, p_status:el.dataset.s }); toast(el.dataset.s === "approved" ? "Onaylandı" : "Reddedildi"); return refresh();
  }
  if (kind === "done") return openDlg("İş bitti", f("Harcanan süre (dk)", "minutes", "", "number"), async v => {
    if (DEMO) { const c = D.changes.find(x => x.id === id); c.status = "done"; c.minutes = Number(v.minutes || 0); return toast("Demo: bitti"); }
    await rpc("ms_decide_change", { p_id:id, p_status:"done", p_minutes:Number(v.minutes || 0) }); toast("Bitti olarak kaydedildi"); }, "Bitti");
  if (kind === "pay") { const s = D.sites.find(x => x.slug === slug); return openDlg("Ödeme kaydet · " + s.name, f("Tutar ($)", "amount", (s.monthly_cents || 0) / 100, "number", "") + f("Şu tarihe kadar", "to", addDays(s.paid_until && s.paid_until > today() ? s.paid_until : today(), 30), "date") + f("Not", "note", "", "text", ' class="wide"'),
    async v => { const cents = Math.round(Number(v.amount || 0) * 100);
      if (DEMO) { s.paid_until = v.to; if (s.status === "suspended") s.status = "live"; D.payments.unshift({ site:slug, amount_cents:cents, paid_at:today(), period_to:v.to, note:v.note }); return toast("Demo: ödeme kaydedildi"); }
      await rpc("ms_record_payment", { p_site:slug, p_cents:cents, p_period_to:v.to, p_note:v.note || null }); toast("Ödeme kaydedildi"); }); }
  if (kind === "suspend") { const s = D.sites.find(x => x.slug === slug); const to = s.status === "suspended" ? "live" : "suspended";
    if (DEMO) { s.status = to; toast("Demo: " + STATUS[to]); return render(); }
    await api(`ms_sites?slug=eq.${encodeURIComponent(slug)}`, { method:"PATCH", body:{ status:to } });
    await api("ms_activity", { method:"POST", body:{ site:slug, who:"uzay", action:to === "suspended" ? "Site suspended" : "Site reopened" } });
    toast(STATUS[to]); return refresh(); }
  if (kind === "vers") { VFOCUS = id; location.hash=MsAdminProjects.link(PROJECT,"versions"); return; }
  if (kind === "vlink") { const s = D.subs.find(x => x.id === id); const url = `${SITE}/request/?e=${s.edit_key}`;
    try { await navigator.clipboard.writeText(url); toast("Müşterinin düzeltme linki kopyalandı"); } catch (e) { prompt("Link", url); } return; }
  if (kind === "restore") { const v = Number(el.dataset.v);
    if (!confirm(T("Talep bu sürüme dönecek. Bu da yeni bir sürüm olarak kaydedilir. Devam?"))) return;
    if (DEMO) { const s = D.subs.find(x => x.id === id), src = D.vers.find(x => x.submission_id === id && x.version === v);
      s.version++; s.updated_at = new Date().toISOString(); D.vers.push({ submission_id:id, version:s.version, at:s.updated_at, items:JSON.parse(JSON.stringify(src.items)) });
      delete VSEL[id]; toast("Demo: sürüme dönüldü"); return render(); }
    await rpc("ms_restore_version", { p_sub:id, p_version:v }); delete VSEL[id]; toast("Sürüme dönüldü"); return refresh(); }
  if (kind === "member") return openDlg("Panel erişimi · " + siteName(slug), f("Kullanıcı adı veya e-posta", "user"),
    async v => { let e = (v.user || "").trim().toLowerCase(); if (!e) throw new Error("Kullanıcı adı yaz"); if (e.indexOf("@") < 0) e += "@mrspace.online";
      if(DEMO)return toast(MsAdminProjects.t('demo_mode'));
      await api("ms_site_users", { method:"POST", prefer:"resolution=merge-duplicates,return=minimal", body:{ email:e, site:slug } });
      await api("ms_activity", { method:"POST", body:{ site:slug, who:"uzay", action:"Client panel access: " + e } });
      toast("Eklendi. Supabase'de aynı e-postayla kullanıcı aç, giriş: mrspace.online/panel"); });
  if (kind === "link") { const s = D.sites.find(x => x.slug === slug); if(!s?.site_key)throw Error(MsAdminProjects.t('connect_needed')); const url = `${SITE}/request/?k=${s.site_key}`;
    try { await navigator.clipboard.writeText(url); toast("Talep linki kopyalandı"); } catch (e) { prompt("Talep linki", url); } return; }
  if (kind === "newviewer") return openDlg("İzleyici ekle", f("Kullanıcı adı", "user") + f("Ad", "name") + f("Şu tarihe kadar (boş = süresiz)", "until", "", "date"),
    async v => { let e = (v.user || "").trim().toLowerCase(); if (!e) throw new Error("Kullanıcı adı yaz"); if (e.indexOf("@") < 0) e += "@mrspace.online";
      if (DEMO) { (D.viewers = D.viewers || []).push({ email:e, name:v.name, until:v.until || null }); return toast("Demo: eklendi"); }
      await api("ms_viewers", { method:"POST", body:{ email:e, name:v.name || null, until:v.until || null } });
      await api("ms_activity", { method:"POST", body:{ site:null, who:"uzay", action:"Viewer access added: " + (v.name || e) } }); toast("Eklendi. Supabase'de hesabını açmayı unutma."); });
  if (kind === "delviewer") { const e = el.dataset.email;
    if (DEMO) { D.viewers = (D.viewers || []).filter(x => x.email !== e); return render(); }
    await api(`ms_viewers?email=eq.${encodeURIComponent(e)}`, { method:"DELETE", prefer:"return=minimal" }); toast("Kaldırıldı"); return refresh(); }
  if (kind === "key") { const s = D.sites.find(x => x.slug === slug);
    const code = `<script src="https://mrspace.online/ms/guard.js" data-site="${s.slug}" data-key="${s.log_key}" defer></` + `script>`;
    try { await navigator.clipboard.writeText(code); toast("Bağlantı kodu kopyalandı. Sitenin admin sayfasına yapıştır."); } catch (e) { prompt("Bağlantı kodu", code); } return; }
  if (kind === "editsite" || kind === "newsite") {
    const s = kind === "editsite" ? D.sites.find(x => x.slug === slug) : { kind:"client", plan:"rent", status:"building", small_quota:2, big_quota:2, monthly_cents:3000, grace_days:7 };
    const sel = (name, map, val) => `<label>${name === "plan" ? "Paket" : name === "status" ? "Durum" : "Tür"}<select name="${name}">${Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === val ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    return openDlg(kind === "editsite" ? "Düzenle · " + s.name : "Yeni site",
      (kind === "newsite" ? f("Kısa ad (slug)", "slug", "", "text") : "") + f("Ad", "name", s.name || "") + f("Adres", "url", s.url || "", "url") + f("Kendi paneli", "admin_url", s.admin_url || "", "url") +
      sel("kind", { own:"Kendi", client:"Müşteri" }, s.kind) + sel("plan", PLAN, s.plan) + sel("status", STATUS, s.status) +
      f("Küçük kota / ay", "small_quota", s.small_quota ?? "", "number") + f("Büyük kota / yıl", "big_quota", s.big_quota ?? "", "number") + f("Aylık ($)", "monthly", (s.monthly_cents || 0) / 100, "number") +
      f("Ödendi (tarih)", "paid_until", s.paid_until || "", "date") + f("Bekleme (gün)", "grace_days", s.grace_days ?? 7, "number") + f("Müşteri e-posta", "contact", s.contact || "", "email") +
      `<label class="wide">Askı mesajı<input name="suspend_message" value="${esc(s.suspend_message || "")}" placeholder="This site is taking a short break. It will be back soon."></label>`,
      async v => {
        if(!v.name.trim())throw Error(T("Ad"));
        const body = { name:v.name.trim(), url:v.url || null, admin_url:v.admin_url || null, kind:v.kind, plan:v.plan, status:v.status,
          small_quota:v.small_quota === "" ? null : Number(v.small_quota), big_quota:v.big_quota === "" ? null : Number(v.big_quota),
          monthly_cents:Math.round(Number(v.monthly || 0) * 100), paid_until:v.paid_until || null, grace_days:Number(v.grace_days || 7), contact:v.contact || null, suspend_message:v.suspend_message || null };
        if (DEMO) { if (kind === "newsite") D.sites.push({ slug:v.slug, ...body }); else Object.assign(s, body); return toast("Demo: kaydedildi"); }
        if (kind === "newsite") { if (!/^[a-z0-9-]{2,30}$/.test(v.slug || "")) throw new Error("Kısa ad sadece küçük harf, rakam ve - olabilir"); await api("ms_sites", { method:"POST", body:{ slug:v.slug, ...body } }); }
        else await api(`ms_sites?slug=eq.${encodeURIComponent(slug)}`, { method:"PATCH", body });
        toast("Kaydedildi");
      });
  }
  if (kind === "newusage" || kind === "editusage") {
    const u = kind === "editusage" ? D.usage[Number(el.dataset.i)] : { site:PROJECT || (D.sites[0] && D.sites[0].slug), service:"", used:0, lim:"", unit:"" };
    return openDlg(kind === "editusage" ? "Kullanım · " + u.service : "Servis ekle",
      `<label>Site<select name="site" ${kind === "editusage" ? "disabled" : ""}>${siteOpts(u.site)}</select></label>` + f("Servis", "service", u.service, "text", kind === "editusage" ? ' style="opacity:.6"' : "") + f("Kullanılan", "used", u.used, "number") + f("Limit", "lim", u.lim ?? "", "number") + f("Birim", "unit", u.unit || ""),
      async v => { const body = { site:kind === "editusage" ? u.site : v.site, service:kind === "editusage" ? u.service : v.service, used:Number(v.used || 0), lim:v.lim === "" ? null : Number(v.lim), unit:v.unit || null, updated_at:new Date().toISOString() };
        if (DEMO) { if (kind === "editusage") Object.assign(u, body); else D.usage.push({ ...body, enabled:true }); return toast("Demo: kaydedildi"); }
        await api("ms_usage?on_conflict=site,service", { method:"POST", prefer:"resolution=merge-duplicates,return=representation", body }); toast("Kaydedildi"); });
  }
  if (kind === "toggleusage") { const u = D.usage[Number(el.dataset.i)];
    if (DEMO) { u.enabled = !u.enabled; return render(); }
    await api(`ms_usage?site=eq.${encodeURIComponent(u.site)}&service=eq.${encodeURIComponent(u.service)}`, { method:"PATCH", body:{ enabled:!u.enabled } });
    await api("ms_activity", { method:"POST", body:{ site:u.site, who:"uzay", action:(u.enabled ? "Turned off: " : "Turned on: ") + u.service } });
    return refresh(); }
}
function bind(){
  document.querySelectorAll("[data-act]").forEach(el => el.onclick = async () => {if(el.disabled)return;el.disabled=true;try{await act(el.dataset.act,el);}catch(e){toast(e.message);}finally{el.disabled=false;}});
  document.querySelectorAll("[data-ctab]").forEach(el=>el.onclick=()=>{CT_TAB=el.dataset.ctab;CT_Q="";render();});
  document.querySelectorAll("[data-ctmode]").forEach(el=>el.onclick=async()=>{CT_MODE=el.dataset.ctmode;render();if(CT_MODE==="quick"){try{await loadSiteControl();}catch(e){CT_ERROR=e.message;toast(e.message);}render();}});
  const siteSelect=$("#controlSite"); if(siteSelect) siteSelect.onchange=async()=>{CT_SITE=siteSelect.value;CT_Q="";CT_ERROR="";if(CT_MODE==="native")return render();try{await loadSiteControl();}catch(e){CT_ERROR=e.message;toast(e.message);}render();};
  const search=$("#controlSearch"); if(search) search.oninput=()=>{CT_Q=search.value;const pos=search.selectionStart;if(CT_SITE==="laloo"&&CT_TAB==="places"){render();const next=$("#controlSearch");next.focus();next.setSelectionRange(pos,pos);clearTimeout(window.__msControlSearch);window.__msControlSearch=setTimeout(async()=>{try{await loadSiteControl();}catch(e){CT_ERROR=e.message;toast(e.message);}render();},450);}else{render();const next=$("#controlSearch");next.focus();next.setSelectionRange(pos,pos);}};
  document.querySelectorAll("[data-photo-open]").forEach(el=>el.onclick=()=>document.getElementById(el.dataset.photoOpen)?.click());
  document.querySelectorAll("[data-photo-item]").forEach(el=>el.onchange=async()=>{
    const file=el.files?.[0]; if(!file)return;
    try { const data=await imageDataUrl(file); await controlApi("admin_add_photos",{item_id:el.dataset.photoItem,sku:el.dataset.photoSku,images:[data]}); toast("Heron ürün fotoğrafı eklendi"); await loadSiteControl(); render(); }
    catch(e){toast(e.message);} finally{el.value="";}
  });
  document.querySelectorAll("[data-filter]").forEach(el => el.onclick = () => { FILTER = el.dataset.filter; render(); });
  document.querySelectorAll("[data-vsel]").forEach(el => el.onchange = () => { const id = Number(el.dataset.vsel), vs = D.vers.filter(v => v.submission_id === id).map(v => v.version);
    const cur = VSEL[id] || { a:Math.min(...vs), b:Math.max(...vs) }; cur[el.dataset.side] = Number(el.value); VSEL[id] = cur; render(); document.getElementById("sub-" + id).scrollIntoView({ block:"start" }); });
}
async function refresh(){ if(dirty())return;const active=PROJECT,view=VIEW;try { if(VIEW==="control"){await fresh();return;} await load(); } catch (e) { toast(e.message); } if(PROJECT===active&&VIEW===view)render(); }
async function loadSiteControl(){
  if (DEMO) throw new Error("Site yönetimi örnek modda kullanılamaz");
  CT_ERROR="";
  if (CT_SITE==="laloo") {
    CT_READY.laloo=false;
    const term=CT_TAB==="places"?CT_Q.trim().replace(/[^\p{L}\p{N}\s.'-]/gu," ").trim():"";
    const placeFilter=term?`&or=${encodeURIComponent(`(name.ilike.*${term}*,city.ilike.*${term}*,address.ilike.*${term}*)`)}`:"";
    const [places,businesses,suggestions,cities]=await Promise.all([
      api(`places?select=id,kind,name,info,city,area,fee,hours,address,active,verified${placeFilter}&order=id.desc&limit=100`),
      api("businesses?select=id,name,category,city,address,hours,blurb,website,plan,plan_price_usd,paid_until,active&order=created_at.desc&limit=200"),
      api("suggestions?select=id,city,name,address,note,source,url,status,created_at&status=eq.pending&order=created_at.desc&limit=200"),
      api("cities?select=id,name,country,active&order=country,name&limit=300")
    ]);
    CT_DATA={...CT_DATA,places,businesses,suggestions,cities}; CT_READY.laloo=true;
  } else {
    CT_READY.heron=false;
    const [products,queue,offers]=await Promise.all([
      controlApi("admin_list",{}), controlApi("admin_queue",{}), controlApi("admin_offers",{})
    ]);
    CT_DATA={...CT_DATA,heron:products.items||[],queue:queue.rows||[],offers:offers.rows||[]}; CT_READY.heron=true;
  }
}
function imageDataUrl(file){
  if(!file.type.startsWith("image/")) return Promise.reject(new Error("Fotoğraf dosyası seç"));
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Fotoğraf okunamadı"));reader.onload=()=>{const im=new Image();im.onerror=()=>reject(new Error("Fotoğraf açılamadı"));im.onload=()=>{const scale=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext("2d").drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.86));};im.src=reader.result;};reader.readAsDataURL(file);});
}

/* ---------------- start ---------------- */

window.addEventListener("message", async ev=>{if(ev.origin!==location.origin)return;if(ev.data?.type==="ms-admin-logout"){logout();return;}if(ev.data?.type==="ms-admin-refresh"){try{await fresh();ev.source?.postMessage({type:"ms-admin-refreshed"},ev.origin);}catch(e){ev.source?.postMessage({type:"ms-admin-refresh-failed"},ev.origin);}}});
$("#out").onclick = ()=>{if(ACTION_PENDING||MsAdminOperations.pending())return toast(MsAdminProjects.t("pending"));if(!dirty()||confirm(MsAdminProjects.t("leave")))logout();};
$("#demoBtn").onclick = async () => { try{await MsAdminProjects.ready; DEMO = true; demoData(); enter("Demo");}catch{MsPlatform.fail($('#loginForm'));} };
$("#loginForm").onsubmit = async e => {
  e.preventDefault(); $("#loginErr").textContent = "";
  try { let u = $("#em").value.trim().toLowerCase(); if (u && u.indexOf("@") < 0) u += "@mrspace.online";
    await auth("password", { email:u, password:$("#pw").value }); await start(); }
  catch (err) { $("#loginErr").textContent = T(err.message); }
};
function enter(who){ $("#login").hidden = true; $("#app").hidden = false; $("#who").textContent = who; $("#demoTag").hidden = !DEMO; document.body.classList.toggle("demo", DEMO); render(); }
async function start(){
  try { const role = await rpc("ms_role", {}); if (!role) throw new Error("Bu hesabın panele erişimi yok");
    VIEWER = role === "viewer"; document.body.classList.toggle("viewer", VIEWER); $("#viewTag").hidden = !VIEWER;
    await Promise.all([load(),MsAdminProjects.ready]); enter(S.email || ""); }
  catch (e) { logout(); $("#loginErr").textContent = T(e.message); }
}
MsAdminProjects.ready.then(()=>{$('#login form>p').textContent=MsAdminProjects.t('intro');}).catch(()=>MsPlatform.fail($('#loginForm')));
if(new URLSearchParams(location.search).get('preview')==='1')$('#demoBtn').click();else if(S)start();
window.addEventListener('beforeunload',e=>{if(dirty()||ACTION_PENDING||MsAdminOperations.pending()) {e.preventDefault();e.returnValue='';}});
setInterval(() => { if (!DEMO && S && !document.hidden&&!ACTION_PENDING&&!MsAdminOperations.pending()&&!dirty()) refresh(); }, 120000);


async function serviceApi(site,view,action,body={}){
 if(VIEWER||DEMO)throw Error(MsAdminProjects.t(VIEWER?'readonly':'demo_mode'));
 await fresh();if(!S)throw Error('Session expired');
 const endpoint=view==='orders'?'ms-repair':'ms-square';
 const response=await fetch(`${SB_URL}/functions/v1/${endpoint}`,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+S.access_token,'Content-Type':'application/json'},body:JSON.stringify({...body,action,site}),signal:AbortSignal.timeout(25000)});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(MsAdminProjects.t('load_error'));return result;
}

async function loadProjectService(root,slug){
 await MsPlatform.ready;const t=MsPlatform.t;
 root.innerHTML=`<p role="status" data-noi18n>${esc(MsAdminProjects.t('loading'))}</p>`;
 try{
  if(DEMO){root.textContent=MsAdminProjects.t('demo_mode');return;}
  const snapshot=await rpc('ms_workspace_snapshot',{p_site:slug}),s=snapshot.sites?.find(s=>s.slug===slug);if(!root.isConnected)return;if(!s)throw Error('site');
  const expected=['requests',...(slug==='rufcut'?['square','repair']:slug==='heron'?['heron']:slug==='laloo'?['laloo']:['builder'])];
  root.innerHTML=`<section class="project-settings" data-noi18n><h2>${esc(t('service_profile'))}</h2><p>${esc(t(s.service_package))} · ${esc(t(s.sector))} · ${esc(t(s.relationship))}</p><div class="project-connections">${expected.map(key=>{const connection=s.connections?.find(c=>c.service===key);return `<p><strong>${esc(t(key))}</strong> <span>${esc(t(MsPlatform.connectionState(connection)))}</span></p>`;}).join('')}</div><button class="btn sun" data-profile-edit>${esc(t('service_profile'))}</button><button class="btn ghost" data-profile-probe>${esc(t('check_connections'))}</button><p role="status" data-profile-error></p></section>`;
  root.querySelector('[data-profile-edit]').onclick=()=>{
   const select=(name,keys,value)=>`<label data-noi18n>${esc(t(name==='package'?'service_package':name))}<select name="${name}">${keys.map(k=>`<option value="${k}" ${k===value?'selected':''}>${esc(t(k))}</option>`).join('')}</select></label>`;
   openDlg(t('service_profile'),select('package',['platform','package_1','package_2','package_3'],s.service_package)+select('sector',['general','retail','fashion','food','services','community'],s.sector)+select('relationship',['platform','portfolio','product','client'],s.relationship)+`<label data-noi18n><input type="checkbox" name="showcase" ${s.showcase?'checked':''}>${esc(t('showcase'))}</label>`,v=>rpc('ms_set_site_profile',{p_site:slug,p_package:v.package,p_sector:v.sector,p_relationship:v.relationship,p_showcase:!!v.showcase}));
  };
  root.querySelector('[data-profile-probe]').onclick=async e=>{if(ACTION_PENDING)return;ACTION_PENDING=true;e.target.disabled=true;try{await controlApi('check_connections',{site:slug});if(root.isConnected)await loadProjectService(root,slug);}catch{if(root.isConnected)root.querySelector('[data-profile-error]').textContent=MsAdminProjects.t('load_error');}finally{ACTION_PENDING=false;e.target.disabled=false;}};
 }catch{if(root.isConnected){root.innerHTML=`<p role="alert" data-noi18n>${esc(MsAdminProjects.t('load_error'))}</p><button class="btn" data-profile-retry>${esc(MsAdminProjects.t('retry'))}</button>`;root.querySelector('button').onclick=()=>loadProjectService(root,slug);}}
}
