/* Prepare an SMS locally. No personal information is stored or sent by the website. */
(async function(){
 'use strict';
 const script=document.currentScript,base=new URL('.',script.src),lang=window.MSI18N?.lang||document.documentElement.lang||'en';
 let words={};try{const r=await fetch(new URL('assets/lang/contact-'+(['en','tr','es','de','fr'].includes(lang)?lang:'en')+'.json?v=20261015',base));if(!r.ok)return;words=await r.json();}catch{return;}
 const t=k=>words[k]||k,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let opener=null,intent='',dialog=null;
 const message=()=>{
  const name=dialog.querySelector('[name=contact_name]').value.trim().replace(/\s+/g,' '),email=dialog.querySelector('[name=contact_email]').value.trim();
  if(!intent||!name)return '';
  return t('message_'+intent).replace('{name}',name)+(email?'\n'+t('email_line').replace('{email}',email):'');
 };
 const update=()=>{dialog.querySelector('[data-message-preview]').textContent=message()||t('preview_empty');dialog.querySelector('[data-copy-result]').textContent='';};
 function choose(value){intent=value;dialog.querySelector('[data-intents]').hidden=true;dialog.querySelector('[data-contact-form]').hidden=false;dialog.querySelector('[data-chosen-intent]').textContent=t(value);update();dialog.querySelector('[name=contact_name]').focus();}
 function create(){
  dialog=document.createElement('dialog');dialog.className='contact-dialog';dialog.setAttribute('aria-labelledby','contactTitle');dialog.setAttribute('data-noi18n','');dialog.setAttribute('data-ms-skip','');
  dialog.innerHTML=`<button type="button" class="contact-close" data-contact-close aria-label="${esc(t('close'))}">×</button><h2 id="contactTitle">${esc(t('title'))}</h2><div data-intents><p>${esc(t('choose'))}</p><div class="contact-intents">${['repair','fitting','information'].map(k=>`<button type="button" data-intent="${k}"><strong>${esc(t(k))}</strong><span>${esc(t(k+'_help'))}</span><span aria-hidden="true">↗</span></button>`).join('')}</div></div><form data-contact-form hidden><div class="contact-chosen"><span data-chosen-intent></span><button type="button" data-contact-back>${esc(t('change'))}</button></div><label>${esc(t('name'))}<input name="contact_name" autocomplete="name" maxlength="80" required></label><label>${esc(t('email_optional'))}<input name="contact_email" type="email" autocomplete="email" maxlength="160"></label><p class="contact-help">${esc(t('email_help'))}</p><label id="contactPreviewLabel">${esc(t('preview'))}</label><output data-message-preview aria-labelledby="contactPreviewLabel"></output><p class="contact-help">${esc(t('send_note'))}</p><div class="contact-actions"><button class="btn primary" type="submit">${esc(t('open_messages'))} ↗</button><button class="btn secondary" type="button" data-contact-copy>${esc(t('copy'))}</button></div><p data-copy-result role="status"></p></form>`;
  document.body.append(dialog);dialog.querySelector('[data-contact-close]').onclick=()=>dialog.close();dialog.onclose=()=>opener?.focus();
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();});
  dialog.querySelectorAll('[data-intent]').forEach(b=>b.onclick=()=>choose(b.dataset.intent));
  const form=dialog.querySelector('form');form.oninput=update;
  dialog.querySelector('[data-contact-back]').onclick=()=>{intent='';form.hidden=true;dialog.querySelector('[data-intents]').hidden=false;dialog.querySelector('[data-intent]').focus();};
  form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;const body=message();if(!body){form.elements.contact_name.focus();return;}const separator=/iPhone|iPad|iPod/.test(navigator.userAgent)?'?&':'?';const link=document.createElement('a');link.href='sms:+13104735384'+separator+'body='+encodeURIComponent(body);link.hidden=true;dialog.append(link);link.click();link.remove();};
  dialog.querySelector('[data-contact-copy]').onclick=async()=>{if(!form.reportValidity())return;const body=message();if(!body)return;const result=dialog.querySelector('[data-copy-result]');try{await navigator.clipboard.writeText(body);result.textContent=t('copied');}catch{result.textContent=t('copy_help');}};
 }
 document.querySelectorAll('#visit a[href^="sms:"]').forEach(link=>{
  if(link.classList.contains('btn'))link.innerHTML=esc(t('button'))+' <span aria-hidden="true">↗</span>';else link.textContent=t('text_us');
  link.setAttribute('aria-haspopup','dialog');link.addEventListener('click',e=>{e.preventDefault();opener=link;if(!dialog)create();intent='';dialog.querySelector('[data-intents]').hidden=false;dialog.querySelector('form').hidden=true;dialog.showModal();dialog.querySelector('[data-intent]').focus();});
 });
})();
