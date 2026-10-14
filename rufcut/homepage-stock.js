(function(){
'use strict';
const loadScript=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});
const modules=[window.MsSiteCatalog?.purchaseURL?Promise.resolve():loadScript('../assets/ms-site-catalog.js?v=20261014-handover'),window.MsStorefront?.t?Promise.resolve():loadScript('../assets/ms-storefront.js?v=20261014-handover')];
Promise.all(modules).then(()=>MsStorefront.ready).then(function(){
var $=id=>document.getElementById(id),items=[],loading=true,visibleLimit=12,pageSize=12,selected={category:'all',waist:'all',size:'all',model:'all',era:'all',sale:'all'},tr=MsStorefront.t;
var esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var text=it=>[it.name,it.description,...it.variations.map(v=>v.name)].join(' '),waist=v=>(v.name||'').match(/W\s*(\d+)\b/i)?.[1]||'',size=v=>(v.name||'').match(/\b(XXL|XL|XS|L|M|S)\b/i)?.[1]?.toUpperCase()||'';
function models(it){return [...new Set(([it.name,...it.variations.map(v=>v.name)].join(' ').match(/\b\d{3,4}[A-Z]{0,2}\b/gi)||[]).filter(v=>!/^(?:19|20)\d{2}$/.test(v)))];}
function eras(it){return [...new Set(text(it).match(/\b((?:19|20)\d{2}s?|[5-9]0s)\b/gi)||[])];}
const saleFilter=document.createElement('div');saleFilter.id='saleFilter';saleFilter.className='filters';saleFilter.setAttribute('aria-label',tr('Buying options'));$('cf').after(saleFilter);
const group=it=>it.square_category||it.category||'other';
var categoryLabels={jeans:'Jeans & overalls',outerwear:'Jackets & coats',shirts:'Shirts & tops',accessories:'Accessories',other:'Other pieces'};
function filters(){
 const saleItems=items.map(it=>({...it,variations:it.variations.filter(v=>selected.sale==='all'||(selected.sale==='online'?!!v.purchase_url:!v.purchase_url))})).filter(it=>it.variations.length);
 items.forEach(i=>{if(i.square_category)categoryLabels[i.square_category]=i.category_label;});
 const groups=[...MsSiteCatalog.categories,...new Set(items.map(group).filter(c=>c.startsWith('square:')))].filter(c=>saleItems.some(i=>group(i)===c));if(!groups.includes(selected.category))selected.category='all';
 $('cf').hidden=!groups.length;$('cf').innerHTML=['all',...groups].map(c=>'<button type="button" class="chip" data-category="'+esc(c)+'" aria-pressed="'+(c===selected.category)+'">'+esc(tr(c==='all'?'All pieces':categoryLabels[c]))+'<span class="category-count" aria-hidden="true">'+(c==='all'?saleItems.length:saleItems.filter(i=>group(i)===c).length)+'</span></button>').join('');
 $('cf').onclick=e=>{const b=e.target.closest('button');if(!b)return;selected.category=b.dataset.category;selected.waist=selected.size=selected.model=selected.era='all';visibleLimit=pageSize;filters();list();};
 saleFilter.hidden=!items.length;saleFilter.innerHTML='<span>'+esc(tr('Buying options'))+'</span>'+[['all','All'],['online','Available online'],['shop','Ask at the shop']].map(([value,label])=>'<button class="chip" type="button" data-sale="'+value+'" aria-pressed="'+(selected.sale===value)+'">'+esc(tr(label))+'</button>').join('');saleFilter.onclick=e=>{const b=e.target.closest('button');if(!b)return;selected.sale=b.dataset.sale;visibleLimit=pageSize;filters();list();};
 const filterItems=saleItems.filter(i=>selected.category==='all'||group(i)===selected.category);
 [['wf','waist',it=>it.variations.map(waist),'Waist'],['sf','size',it=>it.variations.map(size),'Clothing size'],['mf','model',models,'Model'],['ef','era',eras,'Era']].forEach(([id,key,read,label])=>{
 const values=[...new Set(filterItems.flatMap(read).filter(Boolean))].sort((a,b)=>key==='size'?['XS','S','M','L','XL','XXL'].indexOf(a)-['XS','S','M','L','XL','XXL'].indexOf(b):a.localeCompare(b,undefined,{numeric:true})),el=$(id);el.hidden=!values.length;if(!values.includes(selected[key]))selected[key]='all';
 el.innerHTML='<span>'+esc(tr(label))+'</span>'+['all',...values].map(v=>'<button class="chip" data-value="'+esc(v)+'" aria-pressed="'+(v===selected[key])+'">'+esc(v==='all'?tr('All'):v)+'</button>').join('');
 el.onclick=e=>{const b=e.target.closest('button');if(!b)return;selected[key]=b.dataset.value;visibleLimit=pageSize;filters();list();};
 });
}
function list(){
 const matches=items.filter(it=>selected.category==='all'||group(it)===selected.category).map(it=>({...it,variations:it.variations.filter(v=>(selected.sale==='all'||(selected.sale==='online'?!!v.purchase_url:!v.purchase_url))&&(selected.waist==='all'||waist(v)===selected.waist)&&(selected.size==='all'||size(v)===selected.size)&&(selected.model==='all'||models({...it,variations:[v]}).includes(selected.model))&&(selected.era==='all'||eras({...it,variations:[v]}).includes(selected.era)))})).filter(it=>it.variations.length),shown=matches.slice(0,visibleLimit);
 $('morePieces').hidden=matches.length<=visibleLimit;
 $('items').innerHTML=shown.map((it,index)=>{const key=group(it),start=index===0||group(shown[index-1])!==key;return (start?'<h3 class="shop-group-title">'+esc(tr(categoryLabels[key]))+'</h3>':'')+MsStorefront.card(it,index,'rufcut');}).join('')||(loading?'<p role="status">'+esc(tr('Loading the collection…'))+'</p>':'<div class="empty"><div><strong>'+esc(tr(items.length?'No pieces match these filters.':'The next good find will show up here.'))+'</strong><p>'+esc(tr(items.length?'Try another size or clear a filter to see the full collection.':'New finds are being added. Call the shop for available pieces and sizes.'))+'</p></div><span class="empty-mark" aria-hidden="true">R</span></div>');
 MsStorefront.bind($('items'),shown);if(window.MSI18N)MSI18N.apply($('vintage'));
}
$('morePieces').onclick=()=>{visibleLimit+=pageSize;list();};filters();list();
fetch('https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-square/public?site=rufcut').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(d=>{
 loading=false;items=MsSiteCatalog.sort((d.items||[]).filter(it=>it.section==='shop'));filters();list();
 [['workshop','workshopOffers'],['repair','repairServices']].forEach(([section,id])=>{const el=$(id),offers=(d.items||[]).filter(it=>it.section===section);el.hidden=!offers.length;el.innerHTML=offers.map((it,index)=>MsStorefront.card(it,index,'rufcut')).join('');MsStorefront.bind(el,offers);});
 if(window.MSI18N){MSI18N.apply($('workshopOffers'));MSI18N.apply($('repairServices'));}
}).catch(()=>{loading=false;$('items').innerHTML='<div class="empty"><p>'+esc(tr('We could not load the collection. Please refresh or call the shop.'))+'</p><a href="tel:+13104735384">'+esc(tr('Call the shop'))+' ↗</a></div>';if(window.MSI18N)MSI18N.apply($('items'));});
  $('tf').addEventListener('submit',async function(e){e.preventDefault();
    var v=$('on').value.trim().toUpperCase(),li=$('stages').children;Array.from(li).forEach(function(x){x.className='';x.removeAttribute('aria-current')});$('msg').textContent='';
    var tr=function(s){return window.MSI18N?MSI18N.t(s):s};
    if(!v){$('msg').textContent=tr('Enter the ticket number from your work order.');return}
    var button=this.querySelector('button');button.disabled=true;
    $('msg').textContent=tr('Checking your repair…');
    try{var cfg=window.MS_CONFIG,r=await fetch(cfg.url+'/functions/v1/ms-repair',{method:'POST',headers:{apikey:cfg.anon,Authorization:'Bearer '+cfg.anon,'Content-Type':'application/json'},body:JSON.stringify({action:'track',ticket:v})}),d=await r.json();
      if(!r.ok||!d.status)throw new Error('not_found');var n={received:0,in_progress:1,finishing:2,ready:3,completed:4}[d.status];
      for(var i=0;i<li.length;i++){if(i<n)li[i].className='done';else if(i===n&&n<4)li[i].className='now';else if(n===4)li[i].className='done';if(i===n)li[i].setAttribute('aria-current','step');else li[i].removeAttribute('aria-current')}
      $('msg').textContent=tr({received:'Your work order has reached the shop.',in_progress:'Your garment is being worked on.',finishing:'Your repair is in its finishing stage. It should be ready tomorrow.',ready:'Your repair is ready for pickup.',completed:'This work order is complete.'}[d.status])+' · '+d.ticket;
    }catch(err){$('msg').textContent=tr('No repair found with that ticket number. Check the code and try again.')}
    finally{button.disabled=false}
  });

if(window.MSI18N)MSI18N.ready.then(function(){MSI18N.apply($('vintage'));});
var ticket=new URLSearchParams(location.search).get('ticket');if(ticket&&/^RC-[A-Z0-9-]{3,28}$/i.test(ticket))$('on').value=ticket.toUpperCase();
});
})();
