(function(){
'use strict';
var $=id=>document.getElementById(id),items=[],visibleLimit=12,pageSize=12,selected={waist:'all',size:'all',model:'all',era:'all'};
var text=it=>[it.name,it.description,...it.variations.map(v=>v.name)].join(' '),waist=v=>(v.name||'').match(/W\s*(\d+)\b/i)?.[1]||'',size=v=>(v.name||'').match(/\b(XXL|XL|L|M|S)\b/i)?.[1]?.toUpperCase()||'';
function models(it){return [...new Set((text(it).match(/\b\d{3,4}[A-Z]{0,2}\b/gi)||[]).filter(v=>!/^(?:19|20)\d{2}$/.test(v)))];}
function eras(it){return [...new Set(text(it).match(/\b((?:19|20)\d{2}s?|[5-9]0s)\b/gi)||[])];}
function filters(){
 [['wf','waist',it=>it.variations.map(waist),'Waist'],['sf','size',it=>it.variations.map(size),'Clothing size'],['mf','model',models,'Model'],['ef','era',eras,'Era']].forEach(([id,key,read,label])=>{
 const values=[...new Set(items.flatMap(read).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),el=$(id);el.hidden=!values.length;if(!values.includes(selected[key]))selected[key]='all';
 el.innerHTML='<span>'+label+'</span>'+['all',...values].map(v=>'<button class="chip" data-value="'+v+'" aria-pressed="'+(v===selected[key])+'">'+(v==='all'?'All':v)+'</button>').join('');
 el.onclick=e=>{const b=e.target.closest('button');if(!b)return;selected[key]=b.dataset.value;visibleLimit=pageSize;filters();list();};
 });
}
function list(){
 const matches=items.filter(it=>(selected.model==='all'||models(it).includes(selected.model))&&(selected.era==='all'||eras(it).includes(selected.era))).map(it=>({...it,variations:it.variations.filter(v=>(selected.waist==='all'||waist(v)===selected.waist)&&(selected.size==='all'||size(v)===selected.size))})).filter(it=>it.variations.length),shown=matches.slice(0,visibleLimit);
 $('morePieces').hidden=matches.length<=visibleLimit;
 $('items').innerHTML=shown.map(MsStorefront.card).join('')||'<div class="empty"><div><strong>'+(items.length?'No pieces match these filters.':'The next good find will show up here.')+'</strong><p>'+(items.length?'Try another size or clear a filter to see the full collection.':'New finds are being added. Call the shop for available pieces and sizes.')+'</p></div><span class="empty-mark" aria-hidden="true">R</span></div>';
 MsStorefront.bind($('items'),shown);if(window.MSI18N)MSI18N.apply($('vintage'));
}
$('morePieces').onclick=()=>{visibleLimit+=pageSize;list();};filters();list();
fetch('https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-square/public?site=rufcut').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(d=>{
 items=(d.items||[]).filter(it=>it.section==='shop');filters();list();
 [['workshop','workshopOffers'],['repair','repairServices']].forEach(([section,id])=>{const el=$(id),offers=(d.items||[]).filter(it=>it.section===section);el.hidden=!offers.length;el.innerHTML=offers.map(MsStorefront.card).join('');MsStorefront.bind(el,offers);});
 if(window.MSI18N){MSI18N.apply($('workshopOffers'));MSI18N.apply($('repairServices'));}
}).catch(()=>{$('items').innerHTML='<div class="empty"><p>We could not load the collection. Please refresh or call the shop.</p><a href="tel:+13104735384">Call the shop ↗</a></div>';if(window.MSI18N)MSI18N.apply($('items'));});
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
})();
