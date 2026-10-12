/* Project navigation and read-only summaries. No API calls or session storage. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src);
let dict={};
const lang=['tr','en','es','de','fr'].includes(window.MSI18N?.lang)?MSI18N.lang:'tr';
const ready=fetch(new URL('lang/admin-project-'+lang+'.json',base)).then(r=>{if(!r.ok)throw Error('project_dictionary');return r.json();}).then(d=>{dict=d;});
ready.catch(()=>{});
const t=k=>dict[k]||k;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const projectViews=['overview','changes','versions','log','usage','billing','sites','control','orders','catalog','commerce'];
const studioViews=['workspaces','worker','access'];
function scope(data,slug){
 const out={...data};
 const site=data.sites.find(s=>s.slug===slug);
 out.sites=site?[site]:[];
 for(const key of ['checks','changes','activity','usage','payments','subs'])out[key]=(data[key]||[]).filter(row=>site&&row.site===slug);
 const ids=new Set(out.subs.map(row=>row.id));
 out.vers=(data.vers||[]).filter(row=>ids.has(row.submission_id));
 out.quota=site?{[slug]:data.quota?.[slug]||{}}:{};
 return out;
}
function route(hash,data,viewer=false){
 const params=new URLSearchParams(hash.replace(/^#/,'')),slug=params.get('project')||'',view=params.get('view')||'overview';
 if(studioViews.includes(view)&&!viewer)return {project:'',view};
 if(!slug||!data.sites.some(s=>s.slug===slug))return {project:'',view:'overview'};
 if(view==='orders'&&slug!=='rufcut')return {project:slug,view:'overview'};
 if(!projectViews.includes(view)||viewer&&['versions','billing','sites','control','orders','catalog','commerce'].includes(view))return {project:slug,view:'overview'};
 return {project:slug,view};
}
const link=(slug,view='overview')=>'#'+new URLSearchParams({project:slug,view});
function directory(data,{viewer=false}={}){
 return `<section class="project-directory" data-noi18n><header class="project-page-head"><div><p class="project-kicker">MR. SPACE / ${esc(t('studio'))}</p><h1 tabindex="-1">${esc(t('projects'))}</h1><p>${esc(t('intro'))}</p></div><span class="project-total">${data.sites.length} ${esc(t('projects'))}</span>${!viewer?`<button class="btn sun" data-act="newsite">+ ${esc(t('new_project'))}</button>`:''}</header>
 <label class="project-search">${esc(t('search'))}<input type="search" data-project-search placeholder="${esc(t('search_help'))}" autocomplete="off"></label>
 <div class="project-list">${data.sites.map(s=>{
  const count=(data.changes||[]).filter(c=>c.site===s.slug&&['new','approved'].includes(c.status)).length;
  const checks=(data.checks||[]).filter(c=>c.site===s.slug).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));const last=checks[0];
  return `<a class="project-list-row" href="${esc(link(s.slug))}" data-project-row data-search="${esc((s.name+' '+s.slug+' '+s.url).toLocaleLowerCase())}"><span class="project-monogram" aria-hidden="true">${esc(s.name.slice(0,1))}</span><span class="project-list-name"><strong>${esc(s.name)}</strong><small>${esc(s.url?new URL(safeURL(s.url)||location.href).hostname:s.slug)}</small></span><span class="project-health ${last?(last.ok?'is-ok':'is-bad'):''}"><i aria-hidden="true"></i>${esc(t(last?(last.ok?'healthy':'unhealthy'):'unchecked'))}</span><span class="project-open-count">${count} ${esc(t('open_requests'))}</span><span class="project-enter">${esc(t('open'))} <span aria-hidden="true">→</span></span></a>`;
 }).join('')}</div><p class="project-empty" data-project-empty ${data.sites.length?'hidden':''}>${esc(t(data.sites.length?'no_match':'empty'))}</p></section>`;
}
function home(data,slug,{viewer=false,demo=false}={}){
 const scoped=scope(data,slug),site=scoped.sites[0];if(!site)return `<p>${esc(t('unavailable'))}</p>`;
 const open=scoped.changes.filter(c=>['new','approved'].includes(c.status));
 const last=[...scoped.checks].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 const activity=[...scoped.activity].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 const action=(view,title,help)=>`<a class="project-shortcut" href="${esc(link(slug,view))}"><strong>${esc(t(title))}<span aria-hidden="true">↗</span></strong><p>${esc(t(help))}</p></a>`;
 return `<section data-noi18n><header class="project-page-head"><div><h1 tabindex="-1">${esc(t('overview'))}</h1><p>${esc(t('scoped'))}</p></div>${safeURL(site.url)?`<a class="btn ghost" href="${esc(safeURL(site.url))}" target="_blank" rel="noopener">${esc(t('website'))} ↗</a>`:''}</header>
 <div class="project-stats"><article><small>${esc(t('open_requests'))}</small><b>${open.length}</b></article><article><small>${esc(t('status'))}</small><strong class="${last?(last.ok?'is-ok':'is-bad'):''}">${esc(t(last?(last.ok?'healthy':'unhealthy'):'unchecked'))}</strong></article><article><small>${esc(t('latest'))}</small><strong>${activity?esc(new Date(activity.at).toLocaleDateString(lang)):esc(t('no_activity'))}</strong></article></div>
 <div class="project-shortcuts">${!viewer&&slug==='rufcut'?action('orders','orders','order_help')+`<a class="project-shortcut" href="../rufcut/repair/" target="_blank" rel="noopener"><strong>${esc(t('intake'))} ↗</strong><p>${esc(t('intake_help'))}</p></a>`:''}${action('changes','changes','requests_help')}${!viewer&&site.kind==='client'?action('catalog','catalog','catalog_help')+action('commerce','commerce','commerce_help'):''}${!viewer?`<a class="project-shortcut" href="../edit/?site=${encodeURIComponent(slug)}${demo?'&preview=1':''}"><strong>${esc(t('editor'))}<span aria-hidden="true">↗</span></strong><p>${esc(t('editor_help'))}</p></a>`:''}${!viewer&&['laloo','heron'].includes(slug)?action('control','control','operations_help'):''}</div>
 <section class="project-inbox"><header><h2>${esc(t('open_requests'))}</h2><a href="${esc(link(slug,'changes'))}">${esc(t('all_requests'))} →</a></header>${open.slice(0,5).map(c=>`<a class="project-request" href="${esc(link(slug,'changes'))}"><span>${esc(c.request)}</span><small>#${esc(c.id)}</small></a>`).join('')||`<p class="project-empty">${esc(t('no_requests'))}</p>`}</section></section>`;
}
function context(data,slug,view){
 const site=data.sites.find(s=>s.slug===slug);
 return `<div class="project-context" data-noi18n><a href="#">${esc(t('projects'))}</a><span aria-hidden="true">/</span><strong>${esc(site?.name||t('studio'))}</strong><span class="project-context-view">${esc(t(view))}</span></div>`;
}
function navigation(data,slug,view,{viewer=false}={}){
 const selected=data.sites.find(s=>s.slug===slug);
 const item=(key,label=key)=>`<a href="${esc(link(slug,key))}" class="${view===key?'on':''}" ${view===key?'aria-current="page"':''}>${esc(t(label))}</a>`;
 return `<div data-noi18n><label class="project-switch-label" for="projectSwitch">${esc(t('workspace'))}</label><select id="projectSwitch"><option value="">${esc(t('all'))}</option>${data.sites.map(s=>`<option value="${esc(s.slug)}" ${s.slug===slug?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><nav id="projectNav" aria-label="${esc(t('workspace'))}" data-noi18n><a href="#" class="${!slug&&view==='overview'?'on':''}" ${!slug&&view==='overview'?'aria-current="page"':''}>${esc(t('projects'))}</a>${selected?`<p>${esc(selected.name)}</p>${item('overview')}${!viewer&&slug==='rufcut'?item('orders'):''}${!viewer&&selected.kind==='client'?item('catalog')+item('commerce'):''}${item('changes')}${!viewer&&['laloo','heron'].includes(slug)?item('control'):''}<details class="project-studio-tools" ${['versions','log','usage','billing','sites'].includes(view)?'open':''}><summary>${esc(t('management'))}</summary>${!viewer?item('versions'):''}${item('log')}${item('usage')}${!viewer?`${selected.kind==='client'?item('billing'):''}${item('sites')}`:''}</details>`:''}${!viewer?`<details class="project-studio-tools" ${studioViews.includes(view)?'open':''}><summary>${esc(t('system'))}</summary>${['workspaces','worker','access'].map(k=>`<a href="${esc(link('',k))}" class="${view===k?'on':''}" ${view===k?'aria-current="page"':''}>${esc(t(k))}</a>`).join('')}<a href="review/">${esc(t('review'))} ↗</a><a href="ideas/">${esc(t('ideas'))} ↗</a></details>`:''}</nav>`;
}
function bind(root){
 const input=root.querySelector('[data-project-search]');if(!input)return;
 input.oninput=()=>{let count=0;const query=input.value.trim().toLocaleLowerCase();root.querySelectorAll('[data-project-row]').forEach(row=>{row.hidden=!row.dataset.search.includes(query);if(!row.hidden)count++;});root.querySelector('[data-project-empty]').hidden=count>0;};
}
window.MsAdminProjects={ready,t,translate:k=>dict[k],esc,scope,route,link,directory,home,context,navigation,bind};
})();
