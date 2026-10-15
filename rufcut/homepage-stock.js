/* Work-order tracking only. Rufcut sales and Square are disconnected. */
(function(){'use strict';var $=id=>document.getElementById(id);
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

var ticket=new URLSearchParams(location.search).get('ticket');if(ticket&&/^RC-[A-Z0-9-]{3,28}$/i.test(ticket))$('on').value=ticket.toUpperCase();
})();
