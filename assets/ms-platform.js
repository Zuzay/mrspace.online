/* Ortak çalışma alanı. Veri yalnızca yetkili RPC'den gelir. */
(function () {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const langs = ['en','tr','es','de','fr'];
  const lang = langs.includes(window.MSI18N?.lang) ? MSI18N.lang : (() => { try { if(langs.includes(localStorage.ms_lang))return localStorage.ms_lang;const chosen=(navigator.languages||[navigator.language]).map(l=>String(l).slice(0,2).toLowerCase()).find(l=>langs.includes(l));return chosen||'en'; } catch { return 'en'; } })();
  if(!window.MSI18N)document.documentElement.lang=lang;
  let dict = {}, generation = 0;
  const ready = fetch(new URL(`lang/platform-${lang}.json?v=20261009-orders`, base),{signal:AbortSignal.timeout(10000)}).then(r => { if (!r.ok) throw new Error('dictionary'); return r.json(); }).then(d => dict = d);
  ready.catch(()=>{});
  function fail(target){
    const node=typeof target==='string'?document.getElementById(target):target;if(!node)return;
    const words={en:['Text could not load. Your work stays on this device.','Retry'],tr:['Metinler yüklenemedi. Taslağın bu cihazda kalır.','Tekrar dene'],es:['No se pudieron cargar los textos. El borrador sigue en este dispositivo.','Reintentar'],de:['Texte konnten nicht geladen werden. Dein Entwurf bleibt auf diesem Gerät.','Erneut versuchen'],fr:['Impossible de charger les textes. Le brouillon reste sur cet appareil.','Réessayer']}[lang];
    node.innerHTML=`<div class="ms-notice"><p>${esc(words[0])}</p><button class="btn">${esc(words[1])}</button></div>`;node.querySelector('button').onclick=()=>location.reload();
  }
  const t = key => dict[key] || key;
  const packageName = key => t(key);
  const date = value => value ? new Date(value).toLocaleString(lang) : t('never_checked');
  function connectionState(c, now = Date.now()) {
    if (!c || c.state === 'setup' || !c.checked_at) return 'setup';
    if (now - Date.parse(c.checked_at) > 24 * 3600e3 || Date.parse(c.checked_at)>now+300000 || !Number.isFinite(Date.parse(c.checked_at))) return 'stale';
    return c.state === 'connected' ? 'connected' : 'error';
  }
  function expected(site) {
    return ['requests', ...(site.slug === 'heron' ? ['heron'] : site.slug === 'laloo' ? ['laloo'] : site.slug === 'rufcut' ? ['square','repair'] : ['builder'])];
  }
  function sample() {
    return { admin:true, jobs:[], sites:[
      {slug:'heron',name:'Heron CA',service_package:'package_3',sector:'retail',relationship:'portfolio',showcase:true,status:'live',connections:[],requests:[]},
      {slug:'laloo',name:'Laloo',service_package:'package_3',sector:'community',relationship:'product',showcase:true,status:'live',connections:[],requests:[]}
    ] };
  }
  function connectionHTML(s) {
    return `<div class="ms-connections">${expected(s).map(service => {
      const c = s.connections?.find(c => c.service === service), state = connectionState(c);
      return `<div><span>${esc(t(service))}</span><span class="ms-state ${state}">${esc(t(state))}</span><small>${esc(date(c?.checked_at))}</small></div>`;
    }).join('')}</div>`;
  }
  function quotaHTML(site){
    const q=site.quota;if(!q)return '';
    const rows=[['small','small_changes','monthly'],['big','big_changes','yearly']].filter(([k])=>Number.isFinite(q[k+'_used'])&&Number.isFinite(q[k+'_quota']));
    return `<div class="ms-usage"><span class="ms-eyebrow">${esc(t('request_usage'))}</span>${rows.map(([k,label,period])=>`<div><span>${esc(t(label))}<small>${esc(t(period))}</small></span><b>${esc(q[k+'_used'])} / ${esc(q[k+'_quota'])}</b></div>`).join('')}</div>`;
  }
  function requestHTML(s, admin) {
    return `<section class="ms-requests"><h3>${esc(t('requests'))}</h3>${(s.requests || []).length ? s.requests.map(r => `<article><div><span class="ms-eyebrow">#${esc(r.id)} · ${esc(t(r.target) || r.target)}</span><p>${esc(r.request)}</p>${r.revision_note?`<p class="ms-muted">${esc(r.revision_note)}</p>`:''}${admin?`<a class="btn sm" href="${esc(new URL(`../admin/changes/?id=${r.id}`,base).href)}">${esc(t('red_preview'))}</a>`:''}</div><span class="ms-state">${esc(t(r.review_status||r.status))}</span></article>`).join('') : `<p class="ms-muted">${esc(t('no_requests'))}</p>`}</section>`;
  }
  const sectorOptions = value => ['general','retail','fashion','food','services','community'].map(k => `<option value="${k}" ${k === value ? 'selected' : ''}>${esc(t(k))}</option>`).join('');
  function catalogHTML(sector, limit = 3) {
    const entries = window.MsCatalog?.recommend(sector).slice(0,limit) || [];
    return `<div class="ms-catalog">${entries.map(x => `<a href="${esc(new URL(x.path,base).href)}"><span class="ms-eyebrow">${esc(t(x.kind))} · ${esc(t(x.stage))}</span><h3>${esc(t(x.title))}</h3><p>${esc(t(x.description))}</p><span>${esc(t('open'))} ↗</span></a>`).join('')}</div>`;
  }
  async function mount(el, options) {
    const seq = ++generation;
    el.setAttribute('data-noi18n','');
    try {
      await ready;
      if (!el.isConnected || seq !== generation) return;
      el.innerHTML = `<div class="ms-platform"><p role="status">${esc(t('loading'))}</p></div>`;
      const snapshot = options.demo ? sample() : await options.rpc('ms_workspace_snapshot', {p_site:options.site || null});
      if (!el.isConnected || seq !== generation) return;
      const admin = options.admin && snapshot.admin;
      const intakes=admin&&!options.demo?await options.rpc('ms_intake_list',{}):[];
      if(!el.isConnected||seq!==generation)return;
      el.innerHTML = `<div class="ms-platform">
        <header class="ms-platform-head"><div><span class="ms-eyebrow">MR. SPACE / ${esc(t('service_platform'))}</span><h1>${esc(t('workspaces'))}</h1><p>${esc(t(admin ? 'workspace_intro' : 'client_intro'))}</p></div><a class="btn sm" href="${esc(new URL('../edit/',base).href)}">${esc(t('shared_editor_title'))}</a><button class="btn sm" data-platform-refresh>${esc(t('refresh'))}</button></header>
        ${options.demo ? `<div class="ms-notice">${esc(t('preview_notice'))}</div>` : ''}
        <div class="ms-workspaces">${snapshot.sites.map(s => `<article class="ms-workspace"><div class="ms-workspace-top"><div><span class="ms-eyebrow">${esc(packageName(s.service_package))} · ${esc(t(s.relationship))}</span><h2>${esc(s.name)}</h2><p>${esc(t(s.sector))}</p></div><span class="ms-state">${esc(t(s.status))}</span></div>
          ${connectionHTML(s)}${quotaHTML(s)}<div class="ms-workspace-actions">${admin ? `<button class="btn sm" data-profile="${esc(s.slug)}">${esc(t('service_profile'))}</button><button class="btn sm" data-probe="${esc(s.slug)}" ${options.demo ? 'disabled' : ''}>${esc(t('check_connections'))}</button>` : ''}
          ${options.demo ? '' : `<a class="btn sm solid" href="${esc(new URL(`../edit/?site=${encodeURIComponent(s.slug)}`,base).href)}">${esc(t('easy_edit'))}</a>`}
          ${safeURL(s.url) ? `<a class="btn sm" href="${esc(safeURL(s.url))}" target="_blank" rel="noopener">${esc(t('open_site'))} ↗</a>` : ''}</div>
          <details><summary>${esc(t('request_history'))} (${s.requests?.length || 0})</summary>${requestHTML(s,admin)}</details>
          <div class="ms-recommendations"><span class="ms-eyebrow">${esc(t('for_your_sector'))}</span>${catalogHTML(s.sector,2)}</div>
        </article>`).join('') || `<div class="ms-notice">${esc(t('no_workspaces'))}</div>`}</div>
        ${admin?`<section class="ms-library"><div class="ms-platform-head"><div><span class="ms-eyebrow">MR. SPACE / ${esc(t('applications'))}</span><h2>${esc(t('applications'))}</h2><p>${esc(t('application_intro'))}</p></div></div><div class="ms-jobs">${intakes.map(i=>`<article><div><span class="ms-eyebrow">#${esc(i.id)} · ${esc(t(i.sector))}</span><h3>${esc(i.business)}</h3><p>${esc(i.name)} · ${esc(i.email||i.phone)}</p><details><summary>${esc(t('application_details'))}</summary>${Object.entries(i.answers||{}).map(([k,v])=>`<p><b>${esc(k)}</b><br>${esc(v)}</p>`).join('')}</details></div><form data-intake="${i.id}"><label>${esc(t('status'))}<select name="status">${['new','reviewing','accepted','closed'].map(k=>`<option value="${k}" ${i.status===k?'selected':''}>${esc(t(k))}</option>`).join('')}</select></label><label>${esc(t('operator_note'))}<textarea name="note" maxlength="2000" rows="3">${esc(i.operator_note||'')}</textarea></label><button class="btn sm">${esc(t('save'))}</button><p role="status"></p></form></article>`).join('')||`<p class="ms-muted">${esc(t('no_applications'))}</p>`}</div></section>`:''}
        ${admin ? `<section class="ms-library"><div class="ms-platform-head"><div><span class="ms-eyebrow">MR. SPACE / LAB</span><h2>${esc(t('draft_library'))}</h2><p>${esc(t('draft_intro'))}</p></div></div>${catalogHTML('general',8)}
          <form class="ms-draft-form"><label>${esc(t('sector'))}<select name="sector">${sectorOptions('general')}</select></label><label>${esc(t('kind'))}<select name="kind"><option value="design">${esc(t('design'))}</option><option value="tool">${esc(t('tool'))}</option></select></label><label class="ms-wide">${esc(t('brief'))}<textarea name="brief" required minlength="10" maxlength="2000" rows="3"></textarea></label><button class="btn sun" ${options.demo ? 'disabled' : ''}>${esc(t('queue_draft'))}</button><p class="ms-form-status" role="status"></p></form>
          ${snapshot.jobs.some(j=>j.status==='queued')?`<button class="btn sun" data-prepare-queue ${options.demo?'disabled':''}>${esc(t('prepare_queue'))}</button>`:''}<div class="ms-jobs">${snapshot.jobs.map(j => `<article><div><span class="ms-eyebrow">#${esc(j.id)} · ${esc(t(j.kind))} / ${esc(t(j.sector))}</span><p>${esc(j.brief)}</p><small>${esc(t(j.status))}${j.error_code ? ' · ' + esc(t(j.error_code)) : ''}</small></div><div>${safeURL(j.pr_url) ? `<a class="btn sm" href="${esc(safeURL(j.pr_url))}" target="_blank" rel="noopener">${esc(t('review_source'))} ↗</a>` : ''}${['review','ready'].includes(j.status)&&!options.demo?`<button class="btn sm" data-draft-preview="${j.id}">${esc(t('red_preview'))}</button>`:''}${j.status === 'review' && !options.demo ? `<button class="btn sm" data-review="${j.id}" data-status="ready">${esc(t('approve_library'))}</button><button class="btn sm" data-review="${j.id}" data-status="rejected">${esc(t('reject'))}</button>` : ''}</div></article>`).join('') || `<p class="ms-muted">${esc(t('no_jobs'))}</p>`}</div>
        </section>` : ''}<p class="ms-platform-status" role="status"></p>
      </div>`;
      el.querySelector('[data-platform-refresh]').onclick = () => mount(el,options);
      const status = text => { const p=el.querySelector('.ms-platform-status'); if(p) p.textContent=text; };
      el.querySelectorAll('[data-probe]').forEach(b => b.onclick = async () => { b.disabled=true; try { await options.probe(b.dataset.probe); await mount(el,options); } catch { status(t('probe_error')); b.disabled=false; } });
      el.querySelectorAll('[data-profile]').forEach(b => b.onclick = () => {
        const s=snapshot.sites.find(s=>s.slug===b.dataset.profile);
        const dlg=document.createElement('dialog'); dlg.className='ms-platform ms-profile-dialog';
        dlg.innerHTML=`<form><h2>${esc(s.name)}</h2><label>${esc(t('service_package'))}<select name="package">${['platform','package_1','package_2','package_3'].map(k=>`<option value="${k}" ${k===s.service_package?'selected':''}>${esc(t(k))}</option>`).join('')}</select></label><label>${esc(t('sector'))}<select name="sector">${sectorOptions(s.sector)}</select></label><label>${esc(t('relationship'))}<select name="relationship">${['platform','portfolio','product','client'].map(k=>`<option value="${k}" ${k===s.relationship?'selected':''}>${esc(t(k))}</option>`).join('')}</select></label><label class="ms-check"><input type="checkbox" name="showcase" ${s.showcase?'checked':''}>${esc(t('showcase'))}</label><p>${esc(t('profile_note'))}</p><div><button class="btn sun" ${options.demo?'disabled':''}>${esc(t('save'))}</button><button type="button" class="btn" data-close>${esc(t('close'))}</button></div><p role="status"></p></form>`;
        document.body.append(dlg);dlg.showModal();dlg.onclose=()=>dlg.remove();dlg.querySelector('[data-close]').onclick=()=>dlg.close();
        dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),save=dlg.querySelector('button');save.disabled=true;try{await options.rpc('ms_set_site_profile',{p_site:s.slug,p_package:f.get('package'),p_sector:f.get('sector'),p_relationship:f.get('relationship'),p_showcase:f.has('showcase')});dlg.close();await mount(el,options);}catch{dlg.querySelector('[role=status]').textContent=t('profile_error');save.disabled=false;}};
      });
      el.querySelectorAll('[data-intake]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const data=new FormData(form),button=form.querySelector('button');button.disabled=true;try{await options.rpc('ms_handle_intake',{p_id:Number(form.dataset.intake),p_status:data.get('status'),p_note:data.get('note')});await mount(el,options);}catch{form.querySelector('[role=status]').textContent=t('review_error');button.disabled=false;}});
      const form=el.querySelector('.ms-draft-form');
      if(form) { let token=crypto.randomUUID();form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),b=form.querySelector('button'),p=form.querySelector('[role=status]');b.disabled=true;try{await options.rpc('ms_queue_draft',{p_sector:f.get('sector'),p_kind:f.get('kind'),p_brief:f.get('brief'),p_token:token});token=crypto.randomUUID();let preparationFailed=false;try{await options.prepare();}catch{preparationFailed=true;}await mount(el,options);if(preparationFailed)status(t('draft_processing_error'));}catch{p.textContent=t('queue_error');b.disabled=false;}}; }
      const prepare=el.querySelector('[data-prepare-queue]');if(prepare)prepare.onclick=async()=>{prepare.disabled=true;try{await options.prepare();await mount(el,options);}catch{status(t('draft_processing_error'));prepare.disabled=false;}};
      el.querySelectorAll('[data-draft-preview]').forEach(b=>b.onclick=async()=>{
        b.disabled=true;
        try{
          const html=await options.rpc('ms_draft_preview',{p_id:Number(b.dataset.draftPreview)});
          const parsed=new DOMParser().parseFromString(html,'text/html');
          parsed.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv]').forEach(n=>n.remove());
          parsed.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(a.name.startsWith('on'))n.removeAttribute(a.name);});
          const dlg=document.createElement('dialog');dlg.className='ms-platform ms-draft-dialog';
          dlg.innerHTML=`<div class="ms-platform-head"><h2>${esc(t('draft_library'))} #${esc(b.dataset.draftPreview)}</h2><button class="btn" data-close>${esc(t('close'))}</button></div><iframe title="${esc(t('draft_library'))}" sandbox="allow-same-origin"></iframe><p>${esc(t('not_published'))}</p>`;
          document.body.append(dlg);dlg.querySelector('iframe').srcdoc='<!doctype html>'+parsed.documentElement.outerHTML;
          dlg.showModal();dlg.onclose=()=>dlg.remove();dlg.querySelector('[data-close]').onclick=()=>dlg.close();
        }catch{status(t('review_error'));}finally{b.disabled=false;}
      });
      el.querySelectorAll('[data-review]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await options.rpc('ms_review_draft',{p_id:Number(b.dataset.review),p_status:b.dataset.status});await mount(el,options);}catch{status(t('review_error'));b.disabled=false;}});
    } catch {
      if(!Object.keys(dict).length){fail(el);return;}
      if (el.isConnected && seq===generation) el.innerHTML=`<div class="ms-platform"><h1>${esc(t('workspaces'))}</h1><div class="ms-notice"><h2>${esc(t('setup_title'))}</h2><p>${esc(t('setup_intro'))}</p><button class="btn" data-retry>${esc(t('retry'))}</button></div></div>`;
      el.querySelector('[data-retry]')?.addEventListener('click',()=>mount(el,options));
    }
  }
  window.MsPlatform = {mount,ready,t,esc,connectionState,sample,fail};
})();
