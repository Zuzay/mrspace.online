/* Shared publication workspace for every Square-connected Mr. Space site. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src),lang=['en','tr','es','de','fr'].includes(window.MSI18N?.lang)?MSI18N.lang:'en',C=MsSiteCatalog;
let dict={},drafts=new Map();
const ready=fetch(new URL('lang/catalog-'+lang+'.json?v=20261010',base)).then(r=>{if(!r.ok)throw Error('catalog_dictionary');return r.json();}).then(d=>dict=d);
const t=k=>dict[k]||k,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const section=k=>t('section_'+k),key=(site,item)=>site.slug+':'+item.id;
function sectionSelect(site,value='review'){return `<label>${esc(t('destination'))}<select name="section">${C.sections(site.slug).map(s=>`<option value="${s}" ${s===value?'selected':''}>${esc(section(s))}</option>`).join('')}</select></label>`;}
function read(form){const values=new FormData(form),variations={};form.querySelectorAll('[data-variant-row]').forEach(row=>variations[row.dataset.variantRow]={visible:row.querySelector('[type=checkbox]').checked,title:row.querySelector('[type=text]').value});return {section:values.get('section'),layout:values.get('layout'),title:values.get('title')||'',variations};}
const money=v=>v.price==null?t('ask_price'):new Intl.NumberFormat(lang,{style:'currency',currency:v.currency||'USD'}).format(v.price/100);
function preview(item,s){
 const cards=C.cards(item,s);
 if(['review','hidden'].includes(s.section))return `<p>${esc(t(s.section==='review'?'review_help':'hidden_help'))}</p>`;
 if(!cards.length)return `<p>${esc(t('no_live_variations'))}</p>`;
 return `<p><b>${esc(section(s.section))}</b> · ${cards.length} ${esc(t('cards'))}</p>`+cards.map(c=>`<article class="cat-preview-card">${c.image?`<img src="${esc(c.image)}" alt="" loading="lazy">`:''}<div><b data-noi18n>${esc(c.name)}</b><p data-noi18n>${c.variations.map(v=>esc(v.name)+' · '+esc(money(v))).join('<br>')}</p></div></article>`).join('');
}
function render(items,options){
 const {site,public:enabled,error,demo}=options;
 return `<div class="head" data-noi18n><div><h1>${esc(t('catalog'))}</h1><p>${esc(t('intro'))}</p></div><div class="row"><button class="btn ghost" data-cat-refresh>${esc(t('refresh'))}</button><button class="btn sun" data-act="add">${esc(t('add_item'))}</button></div></div>
 <div class="cat-guide" data-noi18n><b>${esc(t('workflow'))}</b><p>${esc(t('new_help'))}</p><details><summary>${esc(t('help'))}</summary><ol><li>${esc(t('help1'))}</li><li>${esc(t('help2'))}</li><li>${esc(t('help3'))}</li></ol><p>${esc(t('square_help'))}</p></details></div>
 ${!enabled?`<p class="cat-warning" data-noi18n>${esc(t('global_off'))}</p>`:''}${demo?`<p data-noi18n>${esc(t('demo'))}</p>`:''}
 <div class="bar" data-noi18n><input type="search" data-cat-search aria-label="${esc(t('search'))}" placeholder="${esc(t('search'))}"><select data-cat-filter aria-label="${esc(t('filter'))}"><option value="all">${esc(t('all'))}</option>${C.sections(site.slug).map(s=>`<option value="${s}">${esc(section(s))}</option>`).join('')}</select></div>
 ${error?`<p role="alert" data-noi18n>${esc(t('load_error'))}</p>`:items===null?`<p data-noi18n>${esc(t('loading'))}</p>`:`<div class="cat-list">${items.map(item=>{
 const saved=item.publication||C.blank(),draft=drafts.get(key(site,item)),s=draft||saved,pending=C.pending(item,saved),differ=!!draft;
 return `<details class="cat-item" data-cat-item="${esc(item.id)}" data-section="${esc(pending?'review':saved.section)}" data-search="${esc((item.name+' '+item.variations.map(v=>v.name+' '+v.sku).join(' ')).toLowerCase())}" ${differ?'open':''}>
 <summary>${item.image?`<img src="${esc(item.image)}" alt="" loading="lazy">`:'<span class="cat-no-photo">◇</span>'}<span><b data-noi18n>${esc(item.name)}</b><small data-noi18n>${esc(section(saved.section))} · ${item.variations.length} ${esc(t('variations'))}${pending?' · '+esc(t('pending')):''}${differ?' · '+esc(t('unsaved')):''}</small></span><span aria-hidden="true">＋</span></summary>
 <form data-cat-form="${esc(item.id)}" data-noi18n><div class="cat-editor"><div class="cat-fields">
 <p class="cat-current">${esc(t('current'))}: <b>${esc(section(saved.section))}</b> · ${esc(t(saved.layout==='separate'?'separate':'grouped'))}</p>
 ${sectionSelect(site,s.section)}<label>${esc(t('site_title'))}<input name="title" maxlength="255" value="${esc(s.title)}" placeholder="${esc(item.name)}"></label>
 <label>${esc(t('layout'))}<select name="layout"><option value="grouped" ${s.layout==='grouped'?'selected':''}>${esc(t('grouped'))}</option><option value="separate" ${s.layout==='separate'?'selected':''}>${esc(t('separate'))}</option></select></label><p>${esc(t('layout_help'))}</p>
 <fieldset><legend>${esc(t('included'))}</legend>${item.variations.map(v=>`<div class="cat-variant" data-variant-row="${esc(v.id)}"><label class="cat-check"><input type="checkbox" ${s.variations[v.id]?.visible?'checked':''}><span data-noi18n>${esc(v.name||item.name)}<small>${esc(v.sku||t('no_sku'))} · ${esc(money(v))}${v.stock===0?' · '+esc(t('sold_out')):v.stock==null?' · '+esc(t('untracked')):''}</small></span></label><label>${esc(t('variant_title'))}<input type="text" maxlength="255" value="${esc(s.variations[v.id]?.title||'')}"></label></div>`).join('')}</fieldset>
 <button type="button" class="btn ghost sm" data-cat-add-variant="${esc(item.id)}">${esc(t('add_variant'))}</button><p>${esc(t('variant_help'))}</p>
 </div><aside class="cat-preview"><h3>${esc(t('preview'))}</h3><div data-cat-preview>${preview(item,s)}</div><p>${esc(t('preview_help'))}</p></aside></div>
 <div class="cat-save"><p data-cat-change>${esc(t('current'))}: ${esc(section(saved.section))} → ${esc(section(s.section))} · ${esc(t(s.layout==='separate'?'separate':'grouped'))}</p><label class="cat-check"><input name="confirm" type="checkbox" required><span>${esc(t('confirm'))}</span></label><div class="row"><button type="submit" class="btn sun">${esc(t('save'))}</button><button type="button" class="btn ghost" data-cat-discard>${esc(t('discard'))}</button></div><p data-cat-error role="alert"></p></div></form></details>`;
 }).join('')}</div><p data-cat-empty hidden data-noi18n>${esc(t('no_match'))}</p>`}`;
}
function bind(root,{items,site,save,render:rerender,refresh,addVariant,demo,notify}){
 const filter=()=>{let count=0;root.querySelectorAll('[data-cat-item]').forEach(el=>{el.hidden=!(el.dataset.search.includes(root.querySelector('[data-cat-search]').value.toLowerCase())&&(root.querySelector('[data-cat-filter]').value==='all'||el.dataset.section===root.querySelector('[data-cat-filter]').value));if(!el.hidden)count++;});const empty=root.querySelector('[data-cat-empty]');if(empty)empty.hidden=count>0;};
 root.querySelector('[data-cat-search]').oninput=filter;root.querySelector('[data-cat-filter]').onchange=filter;root.querySelector('[data-cat-refresh]').onclick=refresh;
 root.querySelectorAll('[data-cat-form]').forEach(form=>{
 const item=items.find(i=>i.id===form.dataset.catForm),saved=item.publication||C.blank(),draftKey=key(site,item);
 const change=()=>{const s=read(form);if(JSON.stringify(s)===JSON.stringify(saved))drafts.delete(draftKey);else drafts.set(draftKey,s);form.querySelector('[name=confirm]').checked=false;form.querySelector('[data-cat-preview]').innerHTML=preview(item,s);form.querySelector('[data-cat-change]').textContent=t('current')+': '+section(saved.section)+' → '+section(s.section)+' · '+t(s.layout==='separate'?'separate':'grouped')+' · '+Object.values(s.variations).filter(v=>v.visible).length+' '+t('included');};
 form.oninput=e=>{if(e.target.name!=='confirm')change();};form.onchange=e=>{if(e.target.name!=='confirm')change();};
 form.querySelector('[data-cat-discard]').onclick=()=>{drafts.delete(draftKey);rerender();};
 form.querySelector('[data-cat-add-variant]').onclick=()=>addVariant(item);
 form.onsubmit=async e=>{e.preventDefault();const error=form.querySelector('[data-cat-error]'),button=form.querySelector('[type=submit]');error.textContent='';if(demo){error.textContent=t('demo');return;}
 try{const s=C.validate(item,read(form),site.slug);button.disabled=true;await save(item.id,s);drafts.delete(draftKey);notify(t('saved')+' · '+item.name+' → '+section(s.section));await refresh();}
 catch(e){error.textContent=t(e.message==='catalog_no_variations'?'select_variation':'save_error');}finally{button.disabled=false;}};
 });
}
function skipKey(site){return 'ms_help_skip_v1:'+site.slug;}
function skipHelp(site){try{return localStorage.getItem(skipKey(site))==='yes';}catch{return false;}}
function help(site){
 const rufcut=site.slug==='rufcut',links=[...(rufcut?[['repairs','help_orders','help_orders_text']]:[]),['catalog','catalog','help_catalog_text'],['stock','help_stock','help_stock_text']];
 return `<div class="cat-help" data-noi18n><header><p>${esc(site.name)}</p><h1>${esc(t('help_title'))}</h1><p>${esc(t('help_intro'))}</p>${rufcut?`<a class="btn sun" href="../rufcut/docs/rufcut-system-guide.pdf?v=20261010" target="_blank" rel="noopener">${esc(t('help_pdf'))}</a>`:''}</header><div class="cat-help-links">${links.map(([view,title,desc])=>`<article><h2>${esc(t(title))}</h2><p>${esc(t(desc))}</p><button class="btn solid" data-go="${view}">${esc(t(title))} ↗</button></article>`).join('')}<article><h2>${esc(t('help_editor'))}</h2><p>${esc(t('help_editor_text'))}</p><a class="btn solid" href="../edit/?site=${encodeURIComponent(site.slug)}">${esc(t('help_editor'))} ↗</a></article></div>${rufcut?`<section><h2>${esc(t('help_phone'))}</h2><p>${esc(t('help_phone_text'))}</p></section>`:''}<section class="cat-help-faq"><h2>${esc(t('help_faq'))}</h2>${[1,2,3].map(n=>`<details><summary>${esc(t('help_faq'+n))}</summary><p>${esc(t('help_faq'+n+'_text'))}</p></details>`).join('')}</section><footer><label class="cat-check"><input type="checkbox" data-help-skip ${skipHelp(site)?'checked':''}><span>${esc(t('help_skip'))}</span></label><button class="btn sun" data-help-continue>${esc(t('help_continue'))}</button><p>${esc(t('help_return'))}</p></footer></div>`;
}
function bindHelp(root,site,done){root.querySelector('[data-help-continue]').onclick=()=>{try{localStorage.setItem(skipKey(site),root.querySelector('[data-help-skip]').checked?'yes':'no');}catch{}done();};}
window.addEventListener('beforeunload',e=>{if(drafts.size){e.preventDefault();e.returnValue='';}});
window.MsCatalogPanel={help,bindHelp,skipHelp,ready,t,section,sectionSelect,render,bind,clear:()=>drafts.clear(),hasDraft:()=>drafts.size>0};
})();
