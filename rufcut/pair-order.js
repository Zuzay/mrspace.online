/* Submit the actual Jean Maker design to the same Rufcut work-order inbox. */
(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=s=>window.MSI18N?MSI18N.t(s):s,key='rufcut-pair-order-v1';
 let draft={token:crypto.randomUUID(),name:'',email:'',phone:'',note:'',measurements:'',design:{}},pending=false;
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&/^[a-f0-9-]{36}$/i.test(saved.token)){for(const k of ['name','email','phone','note','measurements'])if(typeof saved[k]==='string')draft[k]=saved[k].slice(0,600);draft.token=saved.token;draft.design=saved.design||{};}}catch{}
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(draft));}catch{}};
 function snapshot(source){
  const svg=source.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  [svg,...svg.querySelectorAll('*')].forEach(el=>{if(el.hasAttribute('hidden')||el.style?.display==='none')el.setAttribute('display','none');for(const a of [...el.attributes])if(/^data-|^on|^(style|class|hidden|pointer-events|tabindex)$/.test(a.name))el.removeAttribute(a.name);});
  return new XMLSerializer().serializeToString(svg);
 }
 window.MsPairOrder={async open(design,source){
  await window.MSI18N?.ready;if(pending)return;
  if(JSON.stringify(design)!==JSON.stringify(draft.design)){draft.token=crypto.randomUUID();draft.design={...design};persist();}
  let dlg=document.getElementById('pairOrder');if(!dlg){dlg=document.createElement('dialog');dlg.id='pairOrder';dlg.className='pair-order';dlg.setAttribute('data-ms-skip','');dlg.setAttribute('data-noi18n','');document.body.append(dlg);}
  const svg=snapshot(source),names={fit:'Fit',denim:'Denim',wash:'Wash',thread:'Thread',fly:'Fly',hem:'Hem'};
  dlg.innerHTML=`<div class="pair-head"><div><p class="section-kicker">RUFCUT / JEAN MAKER</p><h2>${esc(t('Send your design'))}</h2></div><button type="button" class="pair-close" aria-label="${esc(t('Close'))}">×</button></div><form id="pairForm"><div class="pair-design"><img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${esc(t('Your jeans design'))}"><dl>${Object.entries(design).map(([k,v])=>`<div><dt>${esc(t(names[k]||k))}</dt><dd>${esc(t(v))}</dd></div>`).join('')}</dl></div><p>${esc(t('Your design goes straight to Rufcut’s panel. The shop confirms the fitting, price and timing.'))}</p><div class="pair-fields">${[['name','Your name','text',100,'name'],['email','Email','email',160,'email'],['phone','Phone (optional)','tel',40,'tel']].map(([k,label,type,max,auto])=>`<label>${esc(t(label))}<input name="${k}" type="${type}" maxlength="${max}" autocomplete="${auto}" ${k!=='phone'?'required':''} value="${esc(draft[k])}"></label>`).join('')}<label>${esc(t('Measurements (optional)'))}<textarea name="measurements" maxlength="600">${esc(draft.measurements)}</textarea></label><label>${esc(t('Note for the shop'))}<textarea name="note" maxlength="600">${esc(draft.note)}</textarea></label></div><label class="pair-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><p id="pairStatus" role="status"></p><div class="pair-actions"><button class="btn secondary" type="button" data-close>${esc(t('Back to my design'))}</button><button class="btn primary" type="submit">${esc(t('Send to Rufcut'))} ↗</button></div></form><section id="pairReceipt" hidden></section>`;
  const form=dlg.querySelector('form'),status=dlg.querySelector('#pairStatus');
  const close=()=>{if(!pending)dlg.close();};dlg.querySelector('.pair-close').onclick=close;dlg.querySelector('[data-close]').onclick=close;dlg.oncancel=e=>{if(pending)e.preventDefault();};
  form.oninput=e=>{if(e.target.name in draft){draft[e.target.name]=e.target.value;draft.token=crypto.randomUUID();persist();}};
  form.onsubmit=async e=>{
   e.preventDefault();if(pending||!form.reportValidity())return;pending=true;const button=form.querySelector('[type=submit]');const controls=[...form.elements];controls.forEach(el=>el.disabled=true);status.textContent=t('Sending your design…');
   try{
    const response=await fetch(MS_CONFIG.url+'/functions/v1/ms-repair',{method:'POST',headers:{apikey:MS_CONFIG.anon,'Content-Type':'application/json'},body:JSON.stringify({action:'submit_pair',token:draft.token,name:draft.name.trim(),email:draft.email.trim(),phone:draft.phone.trim(),design,measurements:draft.measurements,note:draft.note,preview_svg:svg,website:form.elements.website.value}),signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok||!/^RC-[A-Z2-9]{7}$/.test(data.ticket||'')){if(data.error==='token_conflict'){draft.token=crypto.randomUUID();persist();}throw new Error(data.error||'send_failed');}
    try{localStorage.removeItem(key);}catch{}draft.token=crypto.randomUUID();form.hidden=true;const receipt=dlg.querySelector('#pairReceipt');receipt.hidden=false;
    receipt.innerHTML=`<p class="section-kicker">${esc(t('Work order saved'))}</p><h3>${esc(data.ticket)}</h3><p>${esc(t('Rufcut can now see your design and contact details in the shop panel. Keep this ticket number.'))}</p><a class="btn primary" href="?ticket=${encodeURIComponent(data.ticket)}#order">${esc(t('Track my work order'))} ↗</a>`;
   }catch(error){status.textContent=t(error.message==='rate_limited'?'Too many requests. Please try again later.':'We couldn’t send your design. Your draft is still here. Please try again.');}
   finally{pending=false;controls.forEach(el=>el.disabled=false);}
  };
  dlg.showModal();
 }};
})();
