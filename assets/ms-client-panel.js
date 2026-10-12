"use strict";
const SB_URL = "https://tizfdnsjhhepxnqqrzuk.supabase.co";
const SB_KEY = "sb_publishable_DcfxBTRo0n2m1go5_yYjkw_qNzD6ie6";
const FN = SB_URL + "/functions/v1/ms-square";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const T = x => window.MSI18N ? MSI18N.t(x) : x;
const money = (c, cur = "USD") => c == null ? "" : new Intl.NumberFormat("en-US", { style:"currency", currency:cur, minimumFractionDigits:c % 100 ? 2 : 0 }).format(c / 100);
function actionError(e){return T(e.message==="sku_review_changed"?"Catalog changed. Close this review and check the missing SKUs again.":/^[a-z_]+$/.test(e.message||"")||e.name==="TimeoutError"||e.name==="TypeError"?"Could not save. Your changes are still here. Check your connection and try again.":e.message||"Could not save. Your changes are still here. Check your connection and try again.");}
function toast(t){ const el = $("#toast"); el.textContent = T(t); el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2800); }

/* ---------- session (same sign-in as the Mr. Space panel) ---------- */
let SS = null, DEMO = false;
try { SS = JSON.parse(localStorage.getItem("ms_panel") || "null"); } catch (e) {}
function saveSession(d){ SS = { access_token:d.access_token, refresh_token:d.refresh_token, expires_at:d.expires_at || Math.floor(Date.now()/1000) + (d.expires_in || 3600), email:d.user ? d.user.email : (SS && SS.email) }; try { localStorage.setItem("ms_panel", JSON.stringify(SS)); } catch (e) {} }
async function auth(grant, body){
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=${grant}`, { method:"POST", headers:{ apikey:SB_KEY, "Content-Type":"application/json" }, body:JSON.stringify(body),signal:AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || "Sign in failed");
  saveSession(d);
}
async function fresh(){ if (SS && Date.now()/1000 > SS.expires_at - 60) { try { await auth("refresh_token", { refresh_token:SS.refresh_token }); } catch (e) { logout(); throw new Error("Session ended, sign in again"); } } }
function logout(){ if(MsOrders.hasDrafts()&&!confirm(T("Leave unsaved changes?")))return;++SITE_SEQ;++LOAD_SEQ;++ORDER_SEQ; if(MsCommercePanel.hasDraft()&&!confirm(MsCommercePanel.t("leave")))return;MsCommercePanel.clear();if(MsCatalogPanel.hasDraft()&&!confirm(MsCatalogPanel.t("leave")))return;MsCatalogPanel.clear();void MsPanelApp.detach();MsOrders.reset(); SS = null; SITE=null; DEMO = false; try { localStorage.removeItem("ms_panel"); } catch (e) {} $("#app").hidden = true; $("#login").hidden = false; }
async function rpc(fn, body = {}){
  await fresh();
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method:"POST", headers:{ apikey:SB_KEY, Authorization:"Bearer " + SS.access_token, "Content-Type":"application/json" }, body:JSON.stringify(body),signal:AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200));
  return r.json();
}
async function sq(action, extra = {}){
  if (DEMO) return demoSq(action, extra);
  const selectedSite=SITE.slug;await fresh();
  const r = await fetch(FN, { method:"POST", headers:{ apikey:SB_KEY, Authorization:"Bearer " + SS.access_token, "Content-Type":"application/json" }, body:JSON.stringify({ action, site:selectedSite, ...extra }),signal:AbortSignal.timeout(30000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Square request failed");
  return d;
}

/* ---------- state ---------- */
let SITES = [], SITE = null, VIEW = "home", SQ = null, ITEMS = null, REPAIRS = null, REPAIR_ERROR = false, FILTER = "all", QUERY = "";
let CATALOG_ERROR=false, SQ_ERROR=false, OVERVIEW=null, OVERVIEW_ERROR=false, STOCK_PAGE=1, ORDER_TOTAL=null, ORDER_LOADING=false, OVERVIEW_LOADING=false;
let LOAD_SEQ=0, SITE_SEQ=0, ORDER_SEQ=0;const BUSY=new Set();
let QUEUE = []; // {key,name,variant,price,currency,sku,qty}
const OPT = { size:"2.25x1.25", shop:true, price:true, variant:true };
try { Object.assign(OPT, JSON.parse(localStorage.getItem("ms_label_opts") || "{}")); } catch (e) {}
const saveQ = () => { try { localStorage.setItem("ms_label_queue:"+SITE.slug, JSON.stringify(QUEUE)); localStorage.setItem("ms_label_opts", JSON.stringify(OPT)); } catch (e) {} };
const SIZES = { "2.25x1.25":["2.25 × 1.25 in (Rollo, Zebra, Dymo 30334)", 2.25, 1.25], "2x1":["2 × 1 in", 2, 1], "1.5x1":["1.5 × 1 in", 1.5, 1], "62x29mm":["62 × 29 mm (Brother)", 62/25.4, 29/25.4], "3x2":["3 × 2 in", 3, 2] };

/* ---------- views ---------- */
function render(){
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === VIEW));
  $("#qn").textContent = QUEUE.length ? "(" + QUEUE.reduce((n, q) => n + q.qty, 0) + ")" : "";
  $("#main").innerHTML = ({ home, stock, labels, repairs, catalog, settings, commerce:()=>'<div data-commerce-root></div>', help:()=>MsCatalogPanel.help(SITE), workspace:()=>'<div id="workspaceRoot"></div>' })[VIEW]();
  $("#panelAppTools").hidden=VIEW!=="settings";
  $("#pageContext").textContent=T(({home:"Today",repairs:"Work orders",catalog:"Site catalog",stock:"Stock",labels:"Labels",settings:"Settings",help:"Help & guide",workspace:"Advanced workspace",commerce:"Sales & shipping"})[VIEW]);
  bind();
  if(VIEW==="commerce")void MsCommercePanel.mount($("#main"),{site:SITE,call:sq,demo:DEMO,notify:toast,archive:(item,archived)=>panelCall("archive_catalog",{item,archived})});
  if(VIEW==="help")MsCatalogPanel.bindHelp($("#main"),SITE,()=>{go("home");});
  if(VIEW==="catalog"&&SQ?.connected)MsCatalogPanel.bind($("#main"),{items:ITEMS||[],site:SITE,save:(item,publication)=>sq("save_publication",{item,publication}),render,refresh:loadItems,addVariant,demo:DEMO,notify:toast,archive:(item,archived)=>panelCall("archive_catalog",{item,archived})});
  if(VIEW==="repairs")MsOrders.bind($("#main"),{jobs:REPAIRS||[],render,remote:true,refresh:loadRepairs});
  if(VIEW === "workspace") MsPlatform.mount(document.getElementById("workspaceRoot"),{admin:false,demo:DEMO,site:SITE.slug,rpc});
  if (window.MSI18N) MSI18N.apply($("#main"));
}
function issue(text,retry){return `<div class="panel-error" role="alert"><p>${esc(T(text))}</p><button class="btn ghost" data-act="${retry}">${esc(T("Retry"))}</button></div>`;}
function pager(page,pages,total,attribute){return `<div class="panel-pager"><span>${esc(T("Records"))}: ${total} · ${esc(T("Page"))} ${page} / ${pages}</span><div class="row"><button class="btn ghost sm" ${page<=1?'disabled':''} ${attribute}="${page-1}">${esc(T("Previous"))}</button><button class="btn ghost sm" ${page>=pages?'disabled':''} ${attribute}="${page+1}">${esc(T("Next"))}</button></div></div>`;}
function metric(title,value,description,view,filter){return `<button class="daily-metric" data-go="${view}" ${filter?`data-focus="${filter}"`:''}><span>${esc(T(title))}</span><strong>${value==null?'—':value}</strong><small>${esc(T(description))}</small></button>`;}
function home(){
 const summary=!SQ_ERROR&&!CATALOG_ERROR&&SQ?.connected?MsPanelDaily.catalog(ITEMS,SQ.public,SITE.slug):null,orders=OVERVIEW_ERROR?null:OVERVIEW?.orders,counts=orders?.counts;
 const attention=summary?.attention||[],recent=orders?.attention||[];
 return `<section data-noi18n><div class="daily-intro"><div><h1>${esc(T("Your shop, today"))}</h1><p>${esc(T("Start with incoming work and items that need your attention."))}</p><div class="daily-meta">${esc(T("Last checked"))}: ${OVERVIEW?.checked_at?esc(new Date(OVERVIEW.checked_at).toLocaleString(document.documentElement.lang)) : esc(T("Not checked yet"))}</div></div><button class="btn ghost" data-act="daily-refresh" ${OVERVIEW_LOADING?'disabled':''}>${esc(T(OVERVIEW_LOADING?'Loading…':'Refresh'))}</button></div>
 ${DEMO?`<p class="daily-note warning">${esc(T("Sample mode. These are examples, not your shop figures."))}</p>`:''}
 ${SQ_ERROR?issue("Square status could not be checked. Connection state is unknown.","daily-refresh"):''}
 ${OVERVIEW_ERROR?issue("Work-order totals could not load. No zero totals have been assumed.","daily-refresh"):''}
 ${CATALOG_ERROR?issue("The catalog could not load. Website counts are unavailable.","reload"):''}
 <div class="daily-metrics">${SITE.slug==='rufcut'?metric("New requests",counts?.received,"Waiting for your review","repairs","received")+metric("In progress",counts?counts.in_progress+counts.finishing:null,"Work at the bench","repairs","active")+metric("Ready for pickup",counts?.ready,"Contact the customer","repairs","ready"):''}${metric("Catalog needs attention",summary?.attention.length,"Review the existing records","catalog","attention")}</div>
 <div class="daily-columns"><div><section class="daily-section"><div class="daily-heading"><h2>${esc(T("Work to follow up"))}</h2>${SITE.slug==='rufcut'?`<button class="btn ghost sm" data-go="repairs">${esc(T("All work orders"))} ↗</button>`:''}</div>
 ${SITE.slug!=='rufcut'?`<p>${esc(T("Work orders are not connected for this site."))}</p>`:OVERVIEW_ERROR?`<p>${esc(T("Unavailable until the next successful check."))}</p>`:!orders?`<p role="status">${esc(T("Loading work orders…"))}</p>`:recent.length?recent.map(j=>`<div class="daily-attention"><div><strong>${esc(j.ticket)} · ${esc(j.customer_name)}</strong><p>${esc(MsPlatform.t('order_'+j.status))} · ${esc(new Date(j.created_at).toLocaleDateString(document.documentElement.lang))}</p></div><button class="btn ghost sm" data-open-order="${esc(j.ticket)}">${esc(T("Open ticket"))}</button></div>`).join(''):`<p class="daily-empty">${esc(T("No new requests or pickup follow-ups. Completed jobs remain in Work orders."))}</p>`}</section>
 <section class="daily-section"><div class="daily-heading"><h2>${esc(T("Website checks"))}</h2><button class="btn ghost sm" data-go="catalog" data-focus="attention">${esc(T("Review catalog"))} ↗</button></div>
 ${!summary?`<p>${esc(T(SQ_ERROR||CATALOG_ERROR?"Unavailable until the next successful check.":SQ&&!SQ.connected?"Connect Square in Settings to load your catalog.":"Loading the catalog…"))}</p>`:attention.length?attention.slice(0,6).map(r=>`<div class="daily-attention"><div><strong>${esc(r.item.name)}</strong><p>${[...r.reasons,...r.warnings].map(v=>esc(T(v))).join(' · ')}</p></div><button class="btn ghost sm" data-open-catalog="${esc(r.item.id)}">${esc(T("Fix this record"))}</button></div>`).join(''):`<p class="daily-empty">${esc(T("No catalog issues found in the latest check."))}</p>`}
 ${summary&&attention.length>6?`<p class="daily-meta">${attention.length-6} ${esc(T("more records in Site catalog"))}</p>`:''}</section></div>
 <aside class="daily-side"><section class="daily-section"><h2>${esc(T("Quick actions"))}</h2><div class="daily-links">${SITE.slug==='rufcut'?`<button class="btn solid" data-go="repairs">${esc(T("Open work orders"))}</button>`:''}<button class="btn ghost" data-act="add" ${!SQ?.connected?'disabled':''}>${esc(T("Add product or service"))}</button><button class="btn ghost" data-go="catalog">${esc(T("Manage website products"))}</button><a class="btn ghost" href="../edit/?site=${encodeURIComponent(SITE.slug)}">${esc(T("Website text & photos"))} ↗</a><button class="btn ghost" data-go="labels">${esc(T("Print labels"))}</button></div></section>
 <section class="daily-section"><h2>${esc(T("Shop status"))}</h2><div class="daily-status">Square <b>${esc(T(SQ_ERROR?'Check failed':SQ===null?'Checking…':SQ.connected?'Connected':'Not connected'))}</b></div><div class="daily-status">${esc(T("Visible catalog records"))}<b>${summary?summary.visible:'—'}</b></div>${SITE.slug==='rufcut'?`<div class="daily-status">${esc(T('All work orders'))}<b>${orders?orders.total:'—'}</b></div>`:''}<div class="daily-status">${esc(T("Approval needed"))}<b>${summary?summary.review:'—'}</b></div><div class="daily-status">${esc(T("Untracked variations"))}<b>${summary?summary.untracked:'—'}</b></div><p class="daily-meta">${esc(T("Untracked stock is unknown, not zero. Square handles payment and delivery for linked products."))}</p><button class="btn ghost sm" data-go="settings">${esc(T("Connections & settings"))}</button></section></aside></div></section>`;
}
function settings(){return `<section data-noi18n><div class="head"><div><h1>${esc(T("Settings"))}</h1><p>${esc(T("Connections and occasional tools. Daily work stays on Today."))}</p></div></div>${SQ_ERROR?issue("Square status could not be checked. Connection state is unknown.","daily-refresh"):''}<div class="grid"><section class="card"><h2>${esc(T("Appearance"))}</h2><label>${esc(T("Theme"))}<select data-panel-theme>${[['system','Use device setting'],['light','Light'],['dark','Dark']].map(([value,title])=>`<option value="${value}" ${document.documentElement.dataset.panelTheme===value?'selected':''}>${esc(T(title))}</option>`).join('')}</select></label></section><section class="card"><h2>Square</h2><p>${esc(T(SQ_ERROR?'Check failed':SQ?.connected?'Connected':'Not connected'))}${SQ?.location?' · '+esc(SQ.location):''}</p>${SQ?.connected?`<label class="switch"><input type="checkbox" data-act="public" ${SQ.public?'checked':''}><span>${esc(T("Publish approved items on the website"))}</span></label><button class="btn ghost" data-act="disconnect">${esc(T("Disconnect Square"))}</button>`:`<button class="btn sun" data-act="connect" ${SQ_ERROR?'disabled':''}>${esc(T("Connect Square"))}</button>`}<a href="../square-sku-guide/">${esc(T("Square SKU setup guide"))} ↗</a></section><section class="card"><h2>${esc(T("Sales & shipping"))}</h2><p>${esc(T("Existing Square product links can take payments. The Mr. Space cart is still in preparation; shipping rates and policies must be completed first."))}</p><button class="btn ghost" data-go="commerce">${esc(T("Open sales preparation"))}</button></section><section class="card"><h2>${esc(T("Advanced tools"))}</h2><p>${esc(T("Use these only when needed. SKU changes are reviewed before anything is written."))}</p><button class="btn ghost" data-act="assign-skus" ${!SQ?.connected?'disabled':''}>${esc(T("Review missing SKUs"))}</button><button class="btn ghost" data-go="workspace">${esc(T("Advanced workspace"))}</button></section></div></section>`;}
async function panelCall(action,extra={}){
 if(DEMO){if(action==='overview')return {orders:{counts:Object.fromEntries(MsPanelDaily.statuses.map(s=>[s,0])),total:0,attention:[]},checked_at:new Date().toISOString()};if(action==='orders')return {jobs:[],total:0,page:1,size:12};throw Error('Demo actions are not saved');}
 await fresh();const site=SITE.slug,r=await fetch(SB_URL+'/functions/v1/ms-panel',{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SS.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,site,...extra}),signal:AbortSignal.timeout(20000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Panel request failed');return data;
}
async function loadOverview(){const seq=SITE_SEQ;OVERVIEW_LOADING=true;try{const d=await panelCall('overview');if(seq!==SITE_SEQ)return;OVERVIEW=d;OVERVIEW_ERROR=false;$("#repairCount").textContent=d.orders&&d.orders.total>d.orders.counts.completed?"("+(d.orders.total-d.orders.counts.completed)+")":"";}catch{if(seq!==SITE_SEQ)return;OVERVIEW_ERROR=true;$("#repairCount").textContent="";}finally{if(seq===SITE_SEQ)OVERVIEW_LOADING=false;}if(VIEW==='home')render();}
async function go(view,focus){
 if(!['home','stock','catalog','repairs','labels','settings','help','workspace','commerce'].includes(view))return;
 if(VIEW!==view&&((VIEW==='catalog'&&MsCatalogPanel.hasDraft())||(VIEW==='commerce'&&MsCommercePanel.hasDraft())||(VIEW==='repairs'&&MsOrders.hasDrafts()))&&!confirm(T('Leave unsaved changes?')))return;
 VIEW=view;if(view==='catalog'&&focus)MsCatalogPanel.focus(focus);if(view==='repairs'&&focus)MsOrders.focus(focus);
 const url=new URL(location.href);url.searchParams.set('site',SITE.slug);url.searchParams.set('view',view==='repairs'?'orders':view);history.replaceState(null,'',url);
 $('.top').classList.remove('menu-open');$('#menuToggle').setAttribute('aria-expanded','false');render();
 if(view==='repairs')await loadRepairs();
}
async function repairCall(action, extra = {}){
  if(DEMO) return { jobs:[] };
  await fresh();
  const r=await fetch(`${SB_URL}/functions/v1/ms-repair`,{method:"POST",headers:{apikey:SB_KEY,Authorization:"Bearer "+SS.access_token,"Content-Type":"application/json"},body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(20000)});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Repair request failed");return d;
}
function repairs(){
 return MsOrders.render(REPAIRS,{site:SITE,demo:DEMO,error:REPAIR_ERROR,total:ORDER_TOTAL,loading:ORDER_LOADING,remote:true});
}
async function loadRepairs(){
 const selected=SITE.slug,seq=++ORDER_SEQ,focused=document.activeElement?.id==='orderSearch';ORDER_LOADING=true;
 try{const d=await panelCall('orders',MsOrders.parameters());if(SITE?.slug!==selected||seq!==ORDER_SEQ)return;REPAIRS=d.jobs;ORDER_TOTAL=d.total;REPAIR_ERROR=false;}
 catch{if(SITE?.slug!==selected||seq!==ORDER_SEQ)return;REPAIR_ERROR=true;}
 finally{if(seq===ORDER_SEQ)ORDER_LOADING=false;}
 if(VIEW==='repairs'){render();if(focused){const input=$('#orderSearch');input?.focus();}}
}
function rows(){
  const q = QUERY.toLowerCase();
  const out = [];
  (ITEMS || []).forEach(i => i.variations.forEach(v => {
    if (q && !(i.name + " " + v.name + " " + v.sku).toLowerCase().includes(q)) return;
    if (FILTER === "in" && !(v.stock > 0)) return;
    if (FILTER === "out" && v.stock !== 0) return;
    if (FILTER === "untracked" && v.stock!==null) return;
    if (FILTER === "archived" ? !i.archived : i.archived) return;
    out.push({ i, v });
  }));
  return out;
}
function stock(){
  if (SQ_ERROR) return issue("Square status could not be checked. Connection state is unknown.","daily-refresh");
  if(!SQ)return `<p role="status">${esc(T("Checking…"))}</p>`;
  if (!SQ.connected) return `<div class="head"><div><h1>Stock</h1><p>Connect Square in Settings to load your catalog.</p></div></div><div class="list"><div class="empty"><button class="btn sun" data-go="settings">Settings</button></div></div>`;
  if(CATALOG_ERROR)return issue("The catalog could not load. Website counts are unavailable.","reload");
  const result=MsPanelDaily.page(rows(),STOCK_PAGE,20),r=result.rows;STOCK_PAGE=result.number;
  return `<div class="head"><div><h1>Stock</h1><p>Straight from your Square. Change a number and save, it updates in Square too.</p></div>
    <div class="row" style="display:flex;gap:8px"><button class="btn ghost" data-act="reload">Refresh</button><button class="btn sun" data-act="add">+ Add item</button></div></div>
   <div class="bar"><input type="search" id="q" placeholder="Search name, size or SKU" value="${esc(QUERY)}">
    <div class="seg">${[["all","All"],["in","In stock"],["out","Sold out"],["untracked","Not tracked"],["archived","Archived"]].map(([k, l]) => `<button data-filter="${k}" class="${FILTER === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
   <div class="list" id="rows">${ITEMS == null ? '<div class="empty">Loading your stock</div>' : r.length ? r.map(({ i, v }) => `<div class="it">
     <div class="ph" ${i.image ? `style="background-image:url('${esc(i.image)}')"` : ""}></div>
     <div><div class="n" data-noi18n>${esc(i.name)}</div><div class="m" data-noi18n>${v.name && v.name !== "Regular" ? `<span>${esc(v.name)}</span>` : ""}<span class="mono">${esc(v.sku || "no SKU")}</span></div></div>
     <div class="pr" data-noi18n>${money(v.price, v.currency)}</div>
     <div class="acts">
      ${v.stock == null ? '<span class="m">Not tracked</span>' : `<div class="qty"><button data-step="-1" data-v="${esc(v.id)}" aria-label="One less">−</button><input inputmode="numeric" data-count="${esc(v.id)}" data-was="${v.stock}" value="${v.stock}" class="${v.stock === 0 ? "out0" : ""}" aria-label="Stock"><button data-step="1" data-v="${esc(v.id)}" aria-label="One more">+</button></div>
      <button class="btn sm solid" data-save="${esc(v.id)}" hidden>Save</button>`}
      ${i.variations[0]?.id === v.id ? `<button class="btn sm ghost" data-go="catalog" data-focus="${esc(i.id)}">${esc(MsCatalogPanel.t("catalog"))}</button><button class="btn sm ghost" data-add-variant="${esc(i.id)}">${esc(MsCatalogPanel.t("add_variant"))}</button><label class="btn sm ghost">${esc(T("Add photos"))}<input type="file" accept="image/*" multiple data-photo="${esc(i.id)}" hidden></label>` : ""}
      <button class="btn sm ghost" data-label="${esc(v.id)}">Label</button>
     </div></div>`).join("") : '<div class="empty">Nothing matches.</div>'}</div>${ITEMS===null?'':pager(result.number,result.pages,result.total,'data-stock-page')}`;
}
function catalog(){
 if(SQ_ERROR)return issue("Square status could not be checked. Connection state is unknown.","daily-refresh");
 if(!SQ)return `<p role="status">${esc(T("Checking…"))}</p>`;
 if(!SQ.connected)return `<div class="head" data-noi18n><div><h1>${esc(MsCatalogPanel.t("catalog"))}</h1><p>${esc(MsCatalogPanel.t("not_connected"))}</p></div></div><button class="btn sun" data-go="settings">${esc(T("Settings"))}</button>`;
 return MsCatalogPanel.render(ITEMS,{site:SITE,public:SQ.public,error:CATALOG_ERROR,demo:DEMO});
}
function labelHTML(q){
  const [, w, h] = SIZES[OPT.size] || SIZES["2.25x1.25"];
  return `<div class="label" style="width:${w}in;height:${h}in">
    ${OPT.shop ? `<div class="shop">${esc(SITE.name)}</div>` : ""}
    <div class="nm">${esc(q.name)}</div>
    <div class="rw"><span class="vr">${OPT.variant && q.variant && q.variant !== "Regular" ? esc(q.variant) : ""}</span><span class="pc">${OPT.price ? money(q.price, q.currency) : ""}</span></div>
    ${q.sku ? code128svg(q.sku, Math.max(.26, h * .32)) + `<div class="sku">${esc(q.sku)}</div>` : ""}
  </div>`;
}
function labels(){
  const total = QUEUE.reduce((n, q) => n + q.qty, 0);
  return `<div class="head"><div><h1>Labels</h1><p>Pick items from Stock with the Label button, or add one by hand. The barcode is the SKU, so Square finds the item when you scan it.</p></div>
    <div class="row" style="display:flex;gap:8px"><button class="btn ghost" data-act="manual">+ Add by hand</button><button class="btn sun" data-act="print" ${total ? "" : "disabled"}>Print ${total || ""} labels</button></div></div>
   <div class="lab">
    <div class="list q">${QUEUE.length ? QUEUE.map((q, k) => `<div class="it">
      <div><div class="n" data-noi18n>${esc(q.name)}</div><div class="m" data-noi18n>${q.variant && q.variant !== "Regular" ? `<span>${esc(q.variant)}</span>` : ""}<span class="mono">${esc(q.sku || "no SKU")}</span><span>${money(q.price, q.currency)}</span></div></div>
      <div class="qty"><button data-qstep="-1" data-k="${k}" aria-label="One less">−</button><input inputmode="numeric" data-qn="${k}" value="${q.qty}" aria-label="Copies"><button data-qstep="1" data-k="${k}" aria-label="One more">+</button></div>
      <button class="btn sm ghost" data-qdel="${k}">Remove</button></div>`).join("") : '<div class="empty">No labels yet. Go to Stock and press Label on an item.</div>'}
      ${QUEUE.length ? '<div class="it" style="grid-template-columns:1fr auto"><span class="m">Labels are kept on this device until you clear them.</span><button class="btn sm ghost" data-act="clearq">Clear all</button></div>' : ""}</div>
    <div class="card opts">
     <label>Label size<select id="optSize">${Object.entries(SIZES).map(([k, [l]]) => `<option value="${k}" ${OPT.size === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
     <label class="switch"><input type="checkbox" data-opt="shop" ${OPT.shop ? "checked" : ""}><span>Shop name</span></label>
     <label class="switch"><input type="checkbox" data-opt="price" ${OPT.price ? "checked" : ""}><span>Price</span></label>
     <label class="switch"><input type="checkbox" data-opt="variant" ${OPT.variant ? "checked" : ""}><span>Size or variant</span></label>
     <div class="preview" data-noi18n>${labelHTML(QUEUE[0] || { name:"Levi's 501, 1990s", variant:"W32 L30", price:8500, currency:"USD", sku:"RC-1A2B3C" })}</div>
     <p class="m" style="font-size:12.5px;color:var(--mute)">In the print window choose your label printer, set the paper to the same size, and scale to 100%.</p>
    </div>
   </div>`;
}

/* ---------- Code 128 (B) barcode ---------- */
const C128 = "11011001100,11001101100,11001100110,10010011000,10010001100,10001001100,10011001000,10011000100,10001100100,11001001000,11001000100,11000100100,10110011100,10011011100,10011001110,10111001100,10011101100,10011100110,11001110010,11001011100,11001001110,11011100100,11001110100,11101101110,11101001100,11100101100,11100100110,11101100100,11100110100,11100110010,11011011000,11011000110,11000110110,10100011000,10001011000,10001000110,10110001000,10001101000,10001100010,11010001000,11000101000,11000100010,10110111000,10110001110,10001101110,10111011000,10111000110,10001110110,11101110110,11010001110,11000101110,11011101000,11011100010,11011101110,11101011000,11101000110,11100010110,11101101000,11101100010,11100011010,11101111010,11001000010,11110001010,10100110000,10100001100,10010110000,10010000110,10000101100,10000100110,10110010000,10110000100,10011010000,10011000010,10000110100,10000110010,11000010010,11001010000,11110111010,11000010100,10001111010,10100111100,10010111100,10010011110,10111100100,10011110100,10011110010,11110100100,11110010100,11110010010,11011011110,11011110110,11110110110,10101111000,10100011110,10001011110,10111101000,10111100010,11110101000,11110100010,10111011110,10111101110,11101011110,11110101110,11010000100,11010010000,11010011100".split(",");
function code128svg(text, hIn){
  const vals = [104], s = String(text).replace(/[^\x20-\x7e]/g, "");
  for (const ch of s) vals.push(ch.charCodeAt(0) - 32);
  let sum = 104; for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103);
  const bits = "0".repeat(10) + vals.map(v => C128[v]).join("") + "1100011101011" + "0".repeat(10);
  let x = 0, rects = "";
  while (x < bits.length) { if (bits[x] === "1") { let w = 1; while (bits[x + w] === "1") w++; rects += `<rect x="${x}" y="0" width="${w}" height="1"/>`; x += w; } else x++; }
  return `<svg viewBox="0 0 ${bits.length} 1" preserveAspectRatio="none" style="height:${hIn}in" shape-rendering="crispEdges" aria-label="Barcode ${esc(s)}">${rects}</svg>`;
}

/* ---------- actions ---------- */
function findVar(id){ for (const i of ITEMS || []) for (const v of i.variations) if (v.id === id) return { i, v }; return null; }
function addToQueue(i, v, qty){
  const key = v.id || ("m" + Date.now());
  const ex = QUEUE.find(q => q.key === key);
  if (ex) ex.qty += qty; else QUEUE.push({ key, name:i.name, variant:v.name, price:v.price, currency:v.currency || "USD", sku:v.sku, qty });
  saveQ(); $("#qn").textContent = "(" + QUEUE.reduce((n, q) => n + q.qty, 0) + ")";
}
async function loadItems(){
 if(!SQ?.connected)return;const selected=SITE.slug,seq=++LOAD_SEQ;CATALOG_ERROR=false;
 ITEMS=null;if(VIEW!=='labels')render();
 try{const d=await sq('catalog');if(SITE?.slug!==selected||seq!==LOAD_SEQ)return;ITEMS=d.items;}
 catch{if(SITE?.slug!==selected||seq!==LOAD_SEQ)return;CATALOG_ERROR=true;ITEMS=null;}
 if(SITE?.slug===selected&&seq===LOAD_SEQ)render();
}
function dialog(title, fields, onSave, label = "Save"){
  $("#dlgBody").innerHTML = `<div class="dh"><h2>${esc(T(title))}</h2><button class="btn sm ghost" type="button" data-close>Close</button></div>
   <form id="dlgForm">${fields}<div class="wide" style="display:flex;justify-content:flex-end"><button class="btn sun" type="submit">${esc(T(label))}</button></div></form>`;
  const d = $("#dlg"); if (window.MSI18N) MSI18N.apply(d); d.showModal();
  d.querySelector("[data-close]").onclick = () => d.close();
  const itemName=d.querySelector("[name=name]");if(itemName)itemName.required=true;
  const price=d.querySelector("[name=price]");if(price){price.required=true;price.step="0.01";price.max="1000000";}
  let pending=false;d.oncancel=e=>{if(pending)e.preventDefault();};
  const qty=d.querySelector("[name=qty]");if(qty){qty.required=true;qty.step="1";qty.max="1000000";}
  $("#dlgForm").onsubmit = async e => {
    e.preventDefault();if(pending||!e.target.reportValidity())return;pending=true; const btn=e.target.querySelector("[type=submit]"),close=d.querySelector("[data-close]");btn.disabled=true;close.disabled=true;
    let error=d.querySelector("[data-dialog-error]");if(!error){error=document.createElement("p");error.className="panel-inline-error wide";error.setAttribute("role","alert");error.dataset.dialogError="";e.target.append(error);}error.textContent="";
    try { await onSave(Object.fromEntries(new FormData(e.target).entries())); d.close(); } catch (err) { error.textContent=actionError(err); }
    pending=false;btn.disabled=false;close.disabled=false;
  };
}
const fld = (label, name, type = "text", extra = "", val = "") => `<label${extra}>${label}<input name="${name}" type="${type}" value="${esc(val)}" ${type === "number" ? 'step="any" min="0"' : ""}></label>`;
async function photoData(input){
  const files=[...(input?.files||[])], out=[];
  if(files.length>6)throw new Error(T("Choose up to 6 photos"));
  for(const file of files){
    if(!file.type.startsWith("image/")||file.size>20*1024*1024)throw new Error(T("Photo upload failed"));
    const src=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(new Error(T("Photo upload failed")));x.src=src});
      const scale=Math.min(1,1600/Math.max(img.width,img.height)),canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error(T("Photo upload failed"))),"image/jpeg",0.84));
      const data=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=()=>reject(new Error(T("Photo upload failed")));rd.readAsDataURL(blob)});
      out.push(data);
    }finally{URL.revokeObjectURL(src)}
  }
  return out;
}

function addVariant(item){
 const token=crypto.randomUUID(),ct=MsCatalogPanel.t;
 dialog("Size or variant",`<div class="wide cat-add-explain" data-noi18n>${esc(ct("variant_context"))}: <b>${esc(item.name)}</b><p>${esc(ct("variant_help"))}</p></div>`+fld("Size or variant","variant","text",' class="wide"')+fld("Price","price","number")+fld("How many","qty","number","","1")+fld("SKU (empty = automatic)","sku"),async v=>{
 if(DEMO)throw Error(ct("demo"));
 const d=await sq("add_variation",{item:item.id,variant:v.variant,price:Number(v.price),qty:Number(v.qty||0),sku:v.sku,track:item.variations.some(v=>v.track),submission_token:token});
 toast(ct(d.stock_error?"partial":"after_add"));VIEW="catalog";await loadItems();
 },"Add to Square");
 document.querySelector('#dlgForm [name=variant]').required=true;
}
async function act(a, el){
  if (a === "connect") { if (DEMO) return toast("Demo: this opens Square to sign in"); const d = await sq("connect"); location.href = d.url; return; }
  if (a === "disconnect") { if (!confirm(T("Disconnect Square from your panel and site?"))) return; await sq("disconnect"); SQ = { connected:false }; ITEMS = null; toast("Square disconnected"); return render(); }
  if (a === "public") { const value=el.checked;try{await sq("set_public", { value });}catch(e){el.checked=!!SQ.public;throw e;}SQ.public=value; toast(value ? "Your stock now shows on your site" : "Stock hidden from your site");render();return; }
  if (a === "assign-skus") {
    if (DEMO) return toast(T("Demo actions are not saved"));
    const d=await sq('preview_missing_skus');
    dialog('Review missing SKUs',`<p class="wide">${esc(T('Only these exact variation IDs will receive a SKU. Existing SKUs stay unchanged.'))}</p><div class="wide dialog-results">${d.matches.map(v=>`<p><b>${esc(v.name)} · ${esc(v.variant)}</b><br>${esc(v.variation)}</p>`).join('')||esc(T('No missing SKUs.'))}</div><label class="switch wide"><input type="checkbox" required><span>${esc(T('I checked the matched records.'))}</span></label>`,async()=>{const result=await sq('assign_missing_skus',{review:d.matches});toast(T('SKUs assigned')+': '+result.updated);await loadItems();},'Apply reviewed changes');return;
  }
  if(a==='daily-refresh'){await Promise.allSettled([loadOverview(),(async()=>{const seq=SITE_SEQ;try{const data=await sq('status');if(seq!==SITE_SEQ)return;SQ=data;SQ_ERROR=false;}catch{if(seq!==SITE_SEQ)return;SQ_ERROR=true;}if(SQ?.connected&&!SQ_ERROR)await loadItems();})()]);render();return;}
  if (a === "reload") return loadItems();
  if (a === "add") {
    const token=crypto.randomUUID(),ct=MsCatalogPanel.t;
    dialog("Add item",`<div class="wide cat-add-explain" data-noi18n>${esc(ct("create_help"))}<p>${esc(ct("help1"))}</p></div>`+fld("Name", "name", "text", ' class="wide"')+fld("Size or variant", "variant")+fld("Price", "price", "number")+
      fld("How many", "qty", "number", "", "1")+fld("SKU (empty = automatic)", "sku")+
      `<label class="switch wide" data-noi18n><input type="checkbox" name="track" checked><span>${esc(ct("track_inventory"))}</span></label><div class="wide" data-noi18n>${MsCatalogPanel.sectionSelect(SITE)}${MsCatalogPanel.placementFields()}<p class="cat-add-explain" data-add-placement>${esc(ct("review_help"))}</p></div><label class="wide">Description<textarea name="description" rows="2"></textarea></label><label class="wide">${esc(T("Product photos"))}<input name="photos" type="file" accept="image/*" multiple></label><label class="switch wide"><input type="checkbox" name="labels" checked><span>Add labels for these right away</span></label>`,
      async v=>{
        if(DEMO)throw new Error(ct("demo"));
        const images=await photoData(document.querySelector('#dlgForm [name="photos"]'));
        const d=await sq("add_item",{name:v.name,variant:v.variant,price:Number(v.price),qty:Number(v.qty||0),sku:v.sku,description:v.description,images,section:v.section,category:v.category,display_order:Number(v.display_order),track:!!v.track,submission_token:token});
        toast(ct(d.image_error||d.stock_error||d.publication_error?"partial":"after_add"));
        if(v.labels&&Number(v.qty)>0)addToQueue({name:v.name},{id:d.variation,name:v.variant||"",price:Math.round(Number(v.price)*100),currency:SQ.currency||"USD",sku:d.sku},Number(v.qty));
        VIEW="catalog";await loadItems();
      },"Add to Square");
    const dest=document.querySelector('#dlgForm [name=section]');dest.onchange=()=>{if(["workshop","repair"].includes(dest.value))document.querySelector('#dlgForm [name=track]').checked=false;document.querySelector('[data-add-placement]').textContent=ct(dest.value==='review'?'review_help':dest.value==='hidden'?'hidden_help':'destination')+(dest.value==='review'||dest.value==='hidden'?'':' '+MsCatalogPanel.section(dest.value));};
    return;
  }
  if (a === "manual") return dialog("Add a label by hand", fld("Name", "name", "text", ' class="wide"') + fld("Size or variant", "variant") + fld("Price", "price", "number") + fld("SKU or code", "sku") + fld("Copies", "qty", "number", "", "1"),
    async v => { if (!v.name) throw new Error(T("Enter a name")); addToQueue({ name:v.name }, { id:null, name:v.variant, price:v.price === "" ? null : Math.round(Number(v.price) * 100), currency:"USD", sku:v.sku }, Math.max(1, Number(v.qty || 1))); render(); }, "Add");
  if (a === "clearq") { QUEUE = []; saveQ(); return render(); }
  if (a === "print") {
    const [, w, h] = SIZES[OPT.size];
    $("#pageSize").textContent = `@page{size:${w}in ${h}in;margin:0}`;
    $("#print").innerHTML = QUEUE.flatMap(q => Array(q.qty).fill(labelHTML(q))).join("");
    setTimeout(() => window.print(), 50);
  }
}
function bind(){
 const theme=document.querySelector("select[data-panel-theme]");if(theme)theme.onchange=()=>{document.documentElement.dataset.panelTheme=theme.value;try{localStorage.setItem("ms_panel_theme",theme.value);}catch{}};
  document.querySelectorAll("[data-act]").forEach(el => { const h = async () => {const key=el.dataset.act;if(BUSY.has(key))return;BUSY.add(key);el.disabled=true;try{await act(key,el);}catch(e){toast(actionError(e));}finally{BUSY.delete(key);el.disabled=false;}}; if (el.type === "checkbox") el.onchange = h; else el.onclick = h; });
  document.querySelectorAll("[data-photo]").forEach(el => el.onchange = async () => {
    try { if(DEMO)return toast(T("Demo photos cannot be saved")); const images=await photoData(el); if(!images.length)return; if(BUSY.has(el.dataset.photo))return;BUSY.add(el.dataset.photo);el.disabled=true;await sq("add_photos",{item:el.dataset.photo,images}); toast(T("Photos added")); await loadItems(); }
    catch(e){toast(T("Photo upload failed")+": "+e.message)} finally {BUSY.delete(el.dataset.photo);el.disabled=false;el.value="";}
  });
  document.querySelectorAll("[data-go]").forEach(el => el.onclick=()=>go(el.dataset.go,el.dataset.focus));
  document.querySelectorAll("[data-stock-page]").forEach(el=>el.onclick=()=>{STOCK_PAGE=Number(el.dataset.stockPage);render();});
  document.querySelectorAll("[data-open-catalog]").forEach(el=>el.onclick=()=>go("catalog",el.dataset.openCatalog));
  document.querySelectorAll("[data-open-order]").forEach(el=>el.onclick=()=>go("repairs",el.dataset.openOrder));
  document.querySelectorAll("[data-repair-refresh]").forEach(el => el.onclick = async () => { el.disabled=true; await loadRepairs(); render(); });
  document.querySelectorAll("[data-repair-save]").forEach(el => el.onclick = async () => {
    const id=el.dataset.repairSave,status=document.querySelector(`[data-repair-status="${CSS.escape(id)}"]`).value;
    const staff_notes=document.querySelector(`[data-repair-notes="${CSS.escape(id)}"]`).value,measurements=document.querySelector(`[data-repair-measure="${CSS.escape(id)}"]`).value;
    if(BUSY.has(id))return;BUSY.add(id);el.disabled=true;try{await repairCall("update",{id,status,staff_notes,measurements});MsOrders.accept(id);toast("Work order saved");await Promise.all([loadRepairs(),loadOverview()]);render()}catch(e){toast(MsPlatform.t("order_save_error"));}finally{BUSY.delete(id);el.disabled=false;}
  });
  document.querySelectorAll("[data-filter]").forEach(el => el.onclick = () => { FILTER = el.dataset.filter; STOCK_PAGE=1;render(); });
  const q = $("#q"); if (q) q.oninput = () => { QUERY = q.value; STOCK_PAGE=1;const pos = q.selectionStart; render(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  const dirty = inp => { const s = document.querySelector(`[data-save="${CSS.escape(inp.dataset.count)}"]`); const d = String(inp.value) !== String(inp.dataset.was); inp.classList.toggle("dirty", d); if (s) s.hidden = !d; };
  document.querySelectorAll("[data-count]").forEach(inp => inp.oninput = () => { inp.setCustomValidity(MsPanelDaily.quantity(inp.value)?"":T("Enter a whole quantity from 0 to 1000000."));dirty(inp); });
  document.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { const inp = document.querySelector(`[data-count="${CSS.escape(b.dataset.v)}"]`); inp.value = Math.max(0, Number(inp.value || 0) + Number(b.dataset.step)); dirty(inp); });
  document.querySelectorAll("[data-save]").forEach(b => b.onclick = async () => {
    const id = b.dataset.save, inp = document.querySelector(`[data-count="${CSS.escape(id)}"]`), f = findVar(id), qty = Number(inp.value || 0);
    if(!MsPanelDaily.quantity(inp.value)){inp.setCustomValidity(T("Enter a whole quantity from 0 to 1000000."));inp.reportValidity();return;}
    if(BUSY.has(id))return;BUSY.add(id);b.disabled=true;inp.disabled=true;
    try { await sq("set_count", { variation:id, qty, label:f ? f.i.name + " " + f.v.name : id }); f.v.stock = qty; toast("Saved in Square"); render(); } catch (e) { toast(T(e.message)); }finally{BUSY.delete(id);b.disabled=false;inp.disabled=false;}
  });
  document.querySelectorAll("[data-add-variant]").forEach(b=>b.onclick=()=>addVariant(ITEMS.find(i=>i.id===b.dataset.addVariant)));
  document.querySelectorAll("[data-label]").forEach(b => b.onclick = () => { const f = findVar(b.dataset.label); if (!f) return; addToQueue(f.i, f.v, Math.max(1, f.v.stock || 1)); toast(T("Added to labels") + ": " + f.i.name); });
  document.querySelectorAll("[data-qstep]").forEach(b => b.onclick = () => { const q = QUEUE[b.dataset.k]; q.qty = Math.max(1, q.qty + Number(b.dataset.qstep)); saveQ(); render(); });
  document.querySelectorAll("[data-qn]").forEach(i => i.onchange = () => { QUEUE[i.dataset.qn].qty = Math.max(1, Number(i.value.replace(/\D/g, "") || 1)); saveQ(); render(); });
  document.querySelectorAll("[data-qdel]").forEach(b => b.onclick = () => { QUEUE.splice(Number(b.dataset.qdel), 1); saveQ(); render(); });
  const os = $("#optSize"); if (os) os.onchange = () => { OPT.size = os.value; saveQ(); render(); };
  document.querySelectorAll("[data-opt]").forEach(c => c.onchange = () => { OPT[c.dataset.opt] = c.checked; saveQ(); render(); });
}

/* ---------- demo ---------- */
function demoData(){
  const v = (id, name, sku, price, stock) => ({ id, name, sku, upc:"", price, currency:"USD", track:true, stock });
  return [
    { id:"i1", name:"Levi's 501, 1990s, medium wash", description:"", image:null, variations:[v("v1","W32 L30","RC-0A1B2C",8500,1)] },
    { id:"i2", name:"Levi's 505, 1980s, dark rinse", description:"", image:null, variations:[v("v2","W34 L32","RC-0A1B2D",9500,1)] },
    { id:"i3", name:"Levi's 517 bootcut, black", description:"", image:null, variations:[v("v3","W30 L32","RC-0A1B2E",7500,0)] },
    { id:"i4", name:"Levi's trucker jacket, type III", description:"", image:null, variations:[v("v4","M","RC-0A1B2F",14500,1), v("v5","L","RC-0A1B2G",14500,2)] },
    { id:"i5", name:"Rufcut custom jeans, deposit", description:"", image:null, variations:[{ ...v("v6","Regular","RC-CUSTOM",10000,null), track:false }] },
    { id:"i6", name:"Repair: chain stitch hem", description:"", image:null, variations:[{ ...v("v7","Regular","RC-HEM",2500,null), track:false }] },
    { id:"i7", name:"Rufcut patch, leather", description:"", image:null, variations:[v("v8","Regular","RC-PATCH",1200,14)] }
  ];
}
function demoSq(action, x){
  if (action === "status") return { connected:true, location:"Rufcut, Venice Beach", currency:"USD", public:false };
  if (action === "catalog") return { items:ITEMS && ITEMS.length ? ITEMS : demoData() };
  if (action === "add_item") { const sku = x.sku || "RC-" + Date.now().toString(36).toUpperCase().slice(-6), id = "d" + Date.now();
    ITEMS.push({ id, name:x.name, description:"", image:null, variations:[{ id:id + "v", name:x.variant || "Regular", sku, upc:"", price:Math.round(x.price * 100), currency:"USD", track:true, stock:x.qty }] });
    return { ok:true, variation:id + "v", sku }; }
  return { ok:true };
}

/* ---------- start ---------- */
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.v));
$('#menuToggle').onclick=()=>{const open=$('.top').classList.toggle('menu-open');$('#menuToggle').setAttribute('aria-expanded',String(open));};
document.addEventListener('change',e=>{if(e.target.id==='msLang'){try{localStorage.setItem('ms_panel_language',e.target.value);}catch{}const url=new URL(location.href);url.searchParams.set('lang',e.target.value);history.replaceState(null,'',url);}},true);
$("#out").onclick = logout;
$("#sitePick").onchange = async () => { if(MsOrders.hasDrafts()&&!confirm(T("Leave unsaved changes?"))){$("#sitePick").value=SITE.slug;return;}if(MsCommercePanel.hasDraft()&&!confirm(MsCommercePanel.t("leave"))){$("#sitePick").value=SITE.slug;return;}MsCommercePanel.clear();if(MsCatalogPanel.hasDraft()&&!confirm(MsCatalogPanel.t("leave"))){$("#sitePick").value=SITE.slug;return;}MsCatalogPanel.clear();SITE = SITES.find(s => s.slug === $("#sitePick").value); await enterSite(); };
$("#demoBtn").onclick = async () => { DEMO = true; SITES = [{ slug:"rufcut", name:"Rufcut", url:"https://mrspace.online/rufcut/", site_key:"demo" }]; await enter(); };
$("#loginForm").onsubmit = async e => {
  e.preventDefault();if(BUSY.has("login")||!e.target.reportValidity())return;BUSY.add("login");const button=e.target.querySelector("[type=submit]");button.disabled=true;$("#loginErr").textContent="";
  try { let u = $("#em").value.trim().toLowerCase(); if (u && u.indexOf("@") < 0) u += "@mrspace.online";
    await auth("password", { email:u, password:$("#pw").value }); await start(); }
  catch (err) { $("#loginErr").textContent=T("Sign in failed. Check your details and try again."); }finally{BUSY.delete("login");button.disabled=false;}
};
async function start(){
  try { SITES = await rpc("ms_my_sites"); if (!SITES.length) throw new Error("This account has no site yet"); await enter(); }
  catch (e) { logout(); $("#loginErr").textContent = T(e.message); }
}
async function enter(){
  const want = new URLSearchParams(location.search).get("site");
  SITE = SITES.find(s => s.slug === want) || SITES[0];
  $("#sitePick").hidden = SITES.length < 2;
  $("#sitePick").innerHTML = SITES.map(s => `<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join("");
  $("#sitePick").value = SITE.slug;
  $("#login").hidden = true; $("#app").hidden = false; $("#demoTag").hidden = !DEMO;
  const sp = new URLSearchParams(location.search).get("square");
  if (sp) { toast(sp === "ok" ? "Square connected" : T("Square did not connect") + ": " + sp); history.replaceState(null, "", location.pathname); }
  await enterSite();
}
async function enterSite(){
 const seq=++SITE_SEQ;++LOAD_SEQ;++ORDER_SEQ;MsOrders.reset();MsCatalogPanel.clear();QUEUE=[];try{QUEUE=JSON.parse(localStorage.getItem("ms_label_queue:"+SITE.slug)||"[]");}catch{}
 await Promise.all([MSI18N.ready,MsPlatform.ready,MsCatalogPanel.ready,MsCommercePanel.ready]);if(seq!==SITE_SEQ)return;
 $('#siteName').textContent=SITE.name;$('#editLink').href='../edit/?site='+encodeURIComponent(SITE.slug);$('#liveSite').href=SITE.url||'../';
 ITEMS=null;SQ=null;REPAIRS=null;OVERVIEW=null;ORDER_TOTAL=null;REPAIR_ERROR=CATALOG_ERROR=SQ_ERROR=OVERVIEW_ERROR=false;QUERY='';FILTER='all';STOCK_PAGE=1;
 $('[data-v=repairs]').hidden=SITE.slug!=='rufcut';
 const desired=new URLSearchParams(location.search).get('view');VIEW=({orders:'repairs',home:'home',stock:'stock',catalog:'catalog',labels:'labels',settings:'settings',help:'help',commerce:'commerce',workspace:'workspace'})[desired]||'home';
 if(SITE.slug!=='rufcut'&&VIEW==='repairs')VIEW='home';
 if(!DEMO&&!desired&&!MsCatalogPanel.skipHelp(SITE))VIEW='help';
 render();void MsPanelApp.mount(SITE,!DEMO&&!!SS);void loadOverview();if(VIEW==='repairs')void loadRepairs();
 try{const data=await sq('status');if(seq!==SITE_SEQ)return;SQ=data;}catch{if(seq!==SITE_SEQ)return;SQ_ERROR=true;}
 render();if(SQ?.connected)void loadItems();
}
MsPanelApp.init({getSite:()=>SITE,getSession:()=>SS,fresh});
setInterval(()=>{if(SS&&!DEMO&&SITE?.slug==='rufcut'&&document.visibilityState==='visible'&&!MsOrders.hasDrafts()&&!ORDER_LOADING){void loadOverview();if(VIEW==='repairs')void loadRepairs();}},60000);
document.addEventListener('visibilitychange',()=>{if(SS&&!DEMO&&SITE?.slug==='rufcut'&&document.visibilityState==='visible'&&!MsOrders.hasDrafts()){void loadOverview();if(VIEW==='repairs')void loadRepairs();}});
if(SS)start();
