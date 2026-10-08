(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
  var items=[],visibleLimit=12,pageSize=12;
  var selected={waist:'all',size:'all',model:'all',era:'all'};
function modelOf(it){var title=String(it[0]||''),m=title.match(/\b(\d{3,4})(?:[A-Z]{0,2})?\b/i);if(!m||/^(?:19|20)\d{2}$/.test(m[1]))return '';return m[1];}
  function eraOf(it){var text=it[0]+' '+it[1]+' '+(it[4]||''),m=text.match(/\b((?:19|20)\d{2}s?|[5-9]0s)\b/i);if(!m)return '';var y=m[1];return /^[5-9]0s$/i.test(y)?'19'+y[0]+'0s':y.replace(/s?$/,'s');}
  function sizeOf(it){var m=(it[0]+' '+it[1]+' '+(it[4]||'')).match(/\b(XXL|XL|L|M|S)\b/i);return m?m[1].toUpperCase():'';}
  function typeOf(it){var text=(it[0]+' '+it[1]+' '+(it[4]||'')).toLowerCase();if(/\b(jacket|trucker|coat|outerwear)\b/.test(text))return 'Jacket';if(/\b(jeans?|denim|trousers?|pants?|501|505|517|550)\b/.test(text))return 'Jeans';return 'Vintage';}
  function tagOf(it){return it[2]?'W'+it[2]+' L'+it[3]:(sizeOf(it)||typeOf(it));}
  function waistFilters(){var el=$('wf'),values=[];el.hidden=!items.length;items.forEach(function(it){if(it[2]&&values.indexOf(+it[2])<0)values.push(+it[2])});values.sort(function(a,b){return a-b});if(selected.waist!=='all'&&values.indexOf(+selected.waist)<0)selected.waist='all';el.innerHTML='<span>Waist</span><button class="chip" data-w="all" aria-pressed="'+(selected.waist==='all')+'">All</button>'+values.map(function(v){return '<button class="chip" data-w="'+v+'" aria-pressed="'+(selected.waist===String(v))+'">'+v+'</button>'}).join('')+'<span>Waist sizes 26-50, depending on stock</span>';}
  function filters(){
    [['mf','model',modelOf],['ef','era',eraOf]].forEach(function(cfg){var el=$(cfg[0]),values=[];el.hidden=!items.length;items.forEach(function(it){var v=cfg[2](it);if(v&&values.indexOf(v)<0)values.push(v)});values.sort();
      el.hidden=!items.length||(cfg[1]==='model'&&!values.length);
      if(values.indexOf(selected[cfg[1]])<0)selected[cfg[1]]='all';
      el.innerHTML='<span>'+ (cfg[1]==='model'?'Model':'Era') +'</span><button class="chip" data-'+cfg[1]+'="all" aria-pressed="'+(selected[cfg[1]]==='all')+'">All</button>'+values.map(function(v){return '<button class="chip" data-'+cfg[1]+'="'+v+'" aria-pressed="'+(selected[cfg[1]]===v)+'">'+v+'</button>'}).join('');
    });
  }
  function list(){
    var h='',matches=0;items.forEach(function(it,i){if(selected.waist!=='all'&&it[2]!==+selected.waist)return;if(selected.size!=='all'&&sizeOf(it)!==selected.size)return;if(selected.model!=='all'&&modelOf(it)!==selected.model)return;if(selected.era!=='all'&&eraOf(it)!==selected.era)return;
      matches++;if(matches>visibleLimit)return;var photo=photoURL(it[5]),art=photo?'<img src="'+esc(photo)+'" alt="'+esc(it[0])+'" loading="lazy">':'<span class="photo-missing"><b>Photo coming soon</b></span>';
      h+='<div class="item"><div class="ph"><span class="tag">'+esc(tagOf(it))+'</span>'+art+'</div><div class="in"><h3 data-noi18n>'+esc(it[0])+'</h3><p data-noi18n>'+esc(it[1])+'</p></div></div>'});
    $('sf').hidden=!items.length;$('morePieces').hidden=matches<=visibleLimit;
    $('items').innerHTML=h||'<div class="empty">'+(items.length?'<div><strong>No pieces match these filters.</strong><p>Try another size or clear a filter to see the full collection.</p></div><span class="empty-mark" aria-hidden="true">R</span>':'<div><strong>The next good find will show up here.</strong><p>New finds are being added. Call the shop for available pieces and sizes.</p><a class="text-link" href="tel:+13104735384">Call the shop ↗</a></div><span class="empty-mark" aria-hidden="true">R</span>')+'</div>';
    if(window.MSI18N)MSI18N.apply($('vintage'));
  }
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
  function photoURL(v){try{var u=new URL(v);return u.protocol==='https:'||u.protocol==='http:'?u.href:''}catch(e){return ''}}
  $('wf').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    visibleLimit=pageSize;selected.waist=b.dataset.w;this.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});list()});
  $('sf').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;visibleLimit=pageSize;selected.size=b.dataset.size;this.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});list()});
  [['mf','model'],['ef','era']].forEach(function(cfg){$(cfg[0]).addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;visibleLimit=pageSize;selected[cfg[1]]=b.dataset[cfg[1]];this.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});list()})});
  $('morePieces').onclick=function(){visibleLimit+=pageSize;list()};filters();waistFilters();list();if(window.MSI18N)MSI18N.apply($('vintage'));
  fetch('https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-square/public?site=rufcut').then(function(r){return r.json()}).then(function(d){
    if(!d||!d.items||!d.items.length)return;var n=[];
    d.items.forEach(function(it){it.variations.forEach(function(v){var m=(v.name||'').match(/W\s*(\d+)\D+L\s*(\d+)/i);
      n.push([it.name,(v.price!=null?'$'+Math.round(v.price/100)+' ':'')+(v.name&&v.name!=='Regular'?v.name:''),m?+m[1]:0,m?+m[2]:0,it.description||'',it.image||''])})});
    items=n;filters();waistFilters();list();
  }).catch(function(){});

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
