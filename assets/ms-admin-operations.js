/* Existing service APIs, scoped to the project captured when a workspace opens. */
(function(){
'use strict';
let pending=0,generation=0;const stockDrafts=new Map();
const ui=()=>MsAdminProjects,t=k=>ui().t(k),esc=v=>ui().esc(v);
const hasDraft=()=>stockDrafts.size>0||MsOrders.hasDrafts()||MsCatalogPanel.hasDraft()||MsCommercePanel.hasDraft();
function clear(){stockDrafts.clear();generation++;MsOrders.reset();MsCatalogPanel.clear();MsCommercePanel.clear();}
async function mount(root,{site,view,call,demo,notify,dialog,imageDataURL}){
 const token=++generation,active=()=>root.isConnected&&generation===token;
 const write=async(action,body)=>{if(demo)throw Error(t('demo_mode'));pending++;const controls=[...root.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);root.setAttribute('aria-busy','true');try{return await call(action,body);}finally{pending--;controls.forEach(([el,disabled])=>el.disabled=disabled);if(active())root.removeAttribute('aria-busy');}};
 const error=()=>{if(!active())return;root.innerHTML=`<section class="project-service-error" data-noi18n role="alert"><h1>${esc(t('error_title'))}</h1><p>${esc(t('load_error'))}</p><button class="btn sun" data-service-retry>${esc(t('retry'))}</button></section>`;root.querySelector('button').onclick=load;};
 async function connect(commerce=false,redirect=true){const data=await write('connect',{commerce}),url=new URL(data.url);if(url.protocol!=='https:'||!['connect.squareup.com','connect.squareupsandbox.com'].includes(url.hostname))throw Error(t('load_error'));if(redirect)location.assign(url.href);return data;}
 let jobs=null,items=[],enabled=false;
 function orders(){
  if(!active())return;root.innerHTML=MsOrders.render(jobs,{site,demo});
  MsOrders.bind(root,{jobs:jobs||[],render:orders});
  root.querySelector('[data-repair-refresh]').onclick=()=>{if(hasDraft()&&!confirm(t('leave')))return;MsOrders.reset();load();};
  root.querySelectorAll('[data-repair-save]').forEach(b=>b.onclick=async()=>{
   if(b.disabled||!active())return;if(demo)return notify(t('demo_mode'));
   const id=b.dataset.repairSave,read=k=>root.querySelector(`[data-repair-${k}="${CSS.escape(id)}"]`).value;
   const payload={id,status:read('status'),staff_notes:read('notes'),measurements:read('measure')};
   if(!confirm(t('update_order')))return;
   b.disabled=true;const sheet=b.closest('.order-staff');sheet.querySelectorAll('input,textarea,select').forEach(x=>x.disabled=true);
   try{await write('update',payload);MsOrders.accept(id);Object.assign(jobs.find(j=>j.id===id),payload);notify(t('saved'));orders();}
   catch{if(active())sheet.querySelector('[data-order-draft]').textContent=t('save_error');}
   finally{b.disabled=false;sheet.querySelectorAll('input,textarea,select').forEach(x=>x.disabled=false);}
  });
 }
 function productForm(item){
  if(pending)return notify(t('pending'));if(hasDraft()&&!confirm(t('leave')))return;
  const ct=MsCatalogPanel.t,idempotency=crypto.randomUUID();
  const field=(key,name,type='text',extra='')=>`<label data-noi18n>${esc(t(key))}<input name="${name}" type="${type}" ${extra}></label>`;
  dialog(item?t('new_variant'):ct('add_item'),`${item?`<p class="wide" data-noi18n>${esc(item.name)}</p>`:field('product_name','name','text','required maxlength="255"')}${field('new_variant','variant','text','required maxlength="255"')}${field('price','price','number','required min="0" step="0.01"')}${field('quantity','qty','number','required min="0" max="1000000" step="1" value="0"')}<p class="wide" data-noi18n>${esc(ct('new_help'))}</p>`,async v=>{
   const d=await write(item?'add_variation':'add_item',{...(item?{item:item.id}:{name:v.name,section:'review'}),variant:v.variant,price:Number(v.price),qty:Number(v.qty),track:true,submission_token:idempotency});
   notify(ct(d.stock_error||d.publication_error?'partial':'after_add'));
   await load();
  });
 }
 function catalog(){
  if(!active())return;root.innerHTML=`<p class="project-service-note" data-noi18n>${esc(t('catalog_help'))}</p>`+MsCatalogPanel.render(items,{site,public:enabled,demo});
  MsCatalogPanel.bind(root,{items,site,demo,notify,render:catalog,refresh:load,save:(item,publication)=>write('save_publication',{item,publication}),addVariant:productForm});
  // The current API does not support archiving: do not offer an unusable action.
  root.querySelectorAll('.cat-archive').forEach(el=>el.hidden=true);
  root.querySelector('[data-act="add"]').onclick=()=>productForm();
  const publishing=document.createElement('label');publishing.className='project-publishing';publishing.dataset.noi18n='';publishing.innerHTML=`<input type="checkbox" ${enabled?'checked':''}> ${esc(t('publish_catalog'))}<span role="status"></span>`;
  root.prepend(publishing);publishing.querySelector('input').onchange=async e=>{const checked=e.target.checked;if(pending){e.target.checked=enabled;return;}e.target.disabled=true;try{await write('set_public',{value:checked});enabled=checked;e.target.defaultChecked=checked;notify(t('saved'));}catch{e.target.checked=enabled;publishing.querySelector('span').textContent=t('save_error');}finally{e.target.disabled=false;}};
  root.querySelectorAll('[data-cat-form]').forEach(form=>{
   const id=form.dataset.catForm,photo=document.createElement('form');photo.className='project-photo';photo.dataset.noi18n='';photo.innerHTML=`<label>${esc(t('add_photo'))}<input type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn sm" type="submit">${esc(t('upload_photo'))}</button><p role="status"></p>`;
   form.insertAdjacentElement('afterend',photo);photo.onsubmit=async e=>{e.preventDefault();if(pending)return;const input=photo.querySelector('input'),button=photo.querySelector('button');if(!input.files[0])return;button.disabled=true;input.disabled=true;try{pending++;const data=await imageDataURL(input.files[0]);if(!active())return;await write('add_photos',{item:id,images:[data]});input.value='';notify(t('saved'));await load();}catch{photo.querySelector('p').textContent=t('save_error');}finally{pending--;button.disabled=false;input.disabled=false;}};
  });
  const stock=document.createElement('section');stock.className='project-stock';stock.dataset.noi18n='';
  stock.innerHTML=`<h2>${esc(t('stock'))}</h2><p>${esc(t('stock_help'))}</p><div class="project-stock-list">${items.filter(i=>!i.archived).flatMap(i=>i.variations.filter(v=>v.track).map(v=>`<form data-stock="${esc(v.id)}"><label><strong>${esc(i.name)}</strong><span>${esc(v.name)} · ${esc(v.sku)}</span><input type="number" name="qty" aria-label="${esc(t('quantity'))}" min="0" max="1000000" step="1" value="${esc(stockDrafts.get(site.slug+':'+v.id)??v.stock??'')}" required></label><button class="btn sm" type="submit">${esc(t('save_stock'))}</button><p role="status"></p></form>`)).join('')||`<p>${esc(t('no_stock'))}</p>`}</div>`;
  root.append(stock);
  stock.querySelectorAll('form').forEach(form=>{const key=site.slug+':'+form.dataset.stock,field=form.elements.qty;field.oninput=()=>{const original=items.flatMap(i=>i.variations).find(v=>v.id===form.dataset.stock).stock;if(field.value===String(original??''))stockDrafts.delete(key);else stockDrafts.set(key,field.value);};form.onsubmit=async e=>{e.preventDefault();if(pending)return;const button=form.querySelector('button'),input=form.elements.qty,variation=form.dataset.stock;button.disabled=true;input.disabled=true;
   try{const qty=Number(input.value);await write('set_count',{variation,qty,label:items.find(i=>i.variations.some(v=>v.id===variation)).name});items.flatMap(i=>i.variations).find(v=>v.id===variation).stock=qty;input.defaultValue=String(qty);stockDrafts.delete(key);form.querySelector('p').textContent=t('saved');notify(t('saved'));}
   catch{form.querySelector('p').textContent=t('save_error');}finally{button.disabled=false;input.disabled=false;}
  };});
 }
 async function load(){
  if(!active())return;
  root.innerHTML=`<p role="status" data-noi18n>${esc(t('loading'))}</p>`;
  try{
   await Promise.all([MsPlatform.ready,MsCatalogPanel.ready,MsCommercePanel.ready]);if(!active())return;
   if(view==='orders'){jobs=demo?[]:(await call('list',{})).jobs;if(!Array.isArray(jobs))throw Error('jobs');orders();return;}
   if(view==='commerce'){await MsCommercePanel.mount(root,{site,demo,notify,call:(action,body)=>action==='connect'?connect(true,false):action==='commerce_save'?write(action,body):call(action,body)});return;}
   const status=demo?{connected:false}:await call('status',{});if(!active())return;
   if(!status.connected){root.innerHTML=`<section class="project-service-error" data-noi18n><h1>${esc(t('catalog'))}</h1><p>${esc(t('connect_needed'))}</p><button class="btn sun">${esc(t('connect'))}</button><p role="alert"></p></section>`;root.querySelector('button').onclick=async e=>{if(e.target.disabled)return;e.target.disabled=true;try{await connect();}catch{if(active())root.querySelector('[role=alert]').textContent=t('load_error');}finally{e.target.disabled=false;}};return;}
   const data=await call('catalog',{});if(!active())return;items=data.items;enabled=data.public;catalog();
  }catch{error();}
 }
 await load();
}
window.MsAdminOperations={mount,hasDraft,pending:()=>pending>0,clear};
})();
