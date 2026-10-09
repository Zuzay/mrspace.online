/* Shared work-order inbox and printable job ticket. Customer data stays in memory. */
(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=k=>MsPlatform.t(k),drafts=new Map();let filter='all',status='all',query='',opened=new URLSearchParams(location.search).get('ticket')||'';
 const statuses=['received','in_progress','finishing','ready','completed'];
 const label=v=>{const key='order_'+String(v).toLowerCase().replace(/[^a-z0-9_]+/g,'_'),value=t(key);return value===key?v:value;};
 const date=v=>new Date(v).toLocaleString(document.documentElement.lang||'en');
 const image=svg=>svg?`<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${esc(t('order_drawing'))}">`:'';
 const details=job=>job.kind==='jeans'?`<dl class="order-spec">${Object.entries(job.design||{}).filter(([,v])=>v).map(([k,v])=>`<div><dt>${esc(label(k))}</dt><dd>${esc(['note','measurements'].includes(k)?v:label(v))}</dd></div>`).join('')}</dl>`:(job.items||[]).map((it,i)=>`<section class="order-piece"><h3>${i+1}. ${esc(it.garment==='jeans'?t('order_garment_jeans'):label(it.garment))}</h3><p>${esc(label(it.gender))} · ${(it.actions||[]).map(a=>esc(label(a))).join(' · ')}</p>${it.inches?`<p>${esc(it.inches)} in</p>`:''}${it.note?`<p class="order-note">${esc(it.note)}</p>`:''}${image(it.preview_svg)}</section>`).join('');
 const drawings=job=>job.kind==='jeans'?image(job.preview_svg):'';
 function render(jobs,opts={}){
  const data=jobs||[],active=data.filter(j=>!['ready','completed'].includes(j.status)).length,ready=data.filter(j=>j.status==='ready').length;
  const q=query.toLocaleLowerCase(),visible=data.filter(j=>(filter==='all'||(j.kind||'repair')===filter)&&(status==='all'||j.status===status)&&(!q||[j.ticket,j.customer_name,j.customer_email,j.customer_phone].join(' ').toLocaleLowerCase().includes(q)));
  return `<section class="order-inbox" data-noi18n><div class="head"><div><span class="mono">${esc(opts.site?.name||'MR. SPACE')}</span><h1>${esc(t('order_title'))}</h1><p>${esc(t('order_intro'))}</p></div><button class="btn ghost" data-repair-refresh>${esc(t('refresh'))}</button></div><div class="order-counts"><span>${esc(t('order_active'))}<b>${active}</b></span><span>${esc(t('order_ready'))}<b>${ready}</b></span><span>${esc(t('order_total'))}<b>${data.length}</b></span></div>
  ${opts.demo?`<p class="order-empty">${esc(t('order_demo'))}</p>`:opts.error?`<p role="alert" class="order-error">${esc(t('order_load_error'))}</p>`:jobs===null?`<p role="status">${esc(t('loading'))}</p>`:''}
  <div class="order-controls"><div role="group" aria-label="${esc(t('order_type'))}">${['all','repair','jeans'].map(k=>`<button class="btn sm ${filter===k?'sun':'ghost'}" data-order-filter="${k}" aria-pressed="${filter===k}">${esc(label(k))}</button>`).join('')}</div><label><span>${esc(t('order_find'))}</span><input id="orderSearch" type="search" value="${esc(query)}" placeholder="${esc(t('order_search'))}"></label><label><span>${esc(t('status'))}</span><select id="orderStatus">${['all',...statuses].map(k=>`<option value="${k}" ${status===k?'selected':''}>${esc(label(k))}</option>`).join('')}</select></label></div>
  <div class="order-list">${visible.map(job=>{
   const pending=drafts.get(job.id),j={...job,...pending};
   return `<details class="order-ticket card" data-ticket="${esc(j.ticket)}" ${opened===j.ticket?'open':''}><summary><span class="order-ticket-meta"><span class="mono">${esc(j.ticket)} · ${esc(label(j.kind||'repair'))}</span><strong>${esc(j.customer_name)}</strong><small>${esc(date(j.created_at))}</small></span><span class="order-state">${esc(label(j.status))}</span><span class="order-open">${esc(t('order_open'))} ↗</span></summary><div class="order-sheet"><div class="order-contact"><a href="mailto:${esc(j.customer_email)}">${esc(j.customer_email)}</a>${j.customer_phone?`<a href="tel:${esc(j.customer_phone.replace(/[^+\d]/g,''))}">${esc(j.customer_phone)}</a>`:''}</div><div class="order-detail-grid"><div>${drawings(j)}${details(j)}</div><div class="order-staff"><label>${esc(t('status'))}<select data-repair-status="${esc(j.id)}">${statuses.map(k=>`<option value="${k}" ${j.status===k?'selected':''}>${esc(label(k))}</option>`).join('')}</select></label><label>${esc(t('order_fitting'))}<textarea data-repair-measure="${esc(j.id)}" maxlength="2000">${esc(j.measurements||'')}</textarea></label><label>${esc(t('order_staff_note'))}<textarea data-repair-notes="${esc(j.id)}" maxlength="3000">${esc(j.staff_notes||'')}</textarea></label><p class="order-draft" data-order-draft="${esc(j.id)}">${pending?esc(t('order_unsaved')):''}</p><div class="row"><button class="btn sun" data-repair-save="${esc(j.id)}">${esc(t('order_save'))}</button><button class="btn ghost" data-order-print="${esc(j.id)}">${esc(t('order_print'))}</button></div></div></div></div></details>`;
  }).join('')||(!opts.error&&jobs!==null?`<p class="order-empty">${esc(data.length?t('order_no_match'):t('order_empty'))}</p>`:'')}</div></section>`;
 }
 function print(job){
  const target=document.getElementById('print'),style=document.getElementById('pageSize'),previousHTML=target.innerHTML,previousCSS=style.textContent;
  target.innerHTML=`<article class="printed-order"><header><strong>${esc('RUFCUT')}</strong><span>${esc(t('order_ticket'))}</span></header><h1>${esc(job.ticket)}</h1><p>${esc(label(job.kind||'repair'))} · ${esc(label(job.status))} · ${esc(date(job.created_at))}</p><h2>${esc(job.customer_name)}</h2><p>${esc(job.customer_email)}${job.customer_phone?' · '+esc(job.customer_phone):''}</p>${drawings(job)}${details(job)}${job.measurements?`<h3>${esc(t('order_fitting'))}</h3><p class="order-note">${esc(job.measurements)}</p>`:''}${job.staff_notes?`<h3>${esc(t('order_staff_note'))}</h3><p class="order-note">${esc(job.staff_notes)}</p>`:''}<footer>${esc(t('order_ticket_note'))}</footer></article>`;
  style.textContent='@page{size:A4 portrait;margin:14mm}';
  window.addEventListener('afterprint',()=>{target.innerHTML=previousHTML;style.textContent=previousCSS;},{once:true});window.print();
 }
 function bind(root,opts){
  root.querySelectorAll('[data-order-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.orderFilter;opts.render();});
  const search=root.querySelector('#orderSearch');if(search)search.oninput=()=>{query=search.value;opts.render();const next=root.querySelector('#orderSearch');next.focus();next.setSelectionRange(query.length,query.length);};
  const select=root.querySelector('#orderStatus');if(select)select.onchange=()=>{status=select.value;opts.render();};
  root.querySelectorAll('[data-ticket]').forEach(el=>el.ontoggle=()=>{if(el.open)opened=el.dataset.ticket;});
  root.querySelectorAll('[data-repair-status],[data-repair-notes],[data-repair-measure]').forEach(el=>el.addEventListener('input',()=>{
   const id=el.dataset.repairStatus||el.dataset.repairNotes||el.dataset.repairMeasure,read=key=>root.querySelector(`[data-repair-${key}="${CSS.escape(id)}"]`).value;
   const values={status:read('status'),staff_notes:read('notes'),measurements:read('measure')},job=opts.jobs.find(j=>j.id===id);
   if(job&&Object.entries(values).every(([k,v])=>v===(job[k]||'')))drafts.delete(id);else drafts.set(id,values);
   root.querySelector(`[data-order-draft="${CSS.escape(id)}"]`).textContent=drafts.has(id)?t('order_unsaved'):'';
  }));
  root.querySelectorAll('[data-order-print]').forEach(b=>b.onclick=()=>{const job=opts.jobs.find(j=>j.id===b.dataset.orderPrint);if(job)print(job);});
 }
 window.addEventListener('beforeunload',e=>{if(drafts.size){e.preventDefault();e.returnValue='';}});
 window.MsOrders={render,bind,accept:id=>drafts.delete(id),reset:()=>{drafts.clear();filter=status='all';query='';},hasDrafts:()=>!!drafts.size};
})();
