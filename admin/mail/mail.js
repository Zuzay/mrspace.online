(async function(){
 'use strict';
 const root=document.getElementById('mailCenter'),api=MsApi.create();
 await MSI18N.ready;const lang=MSI18N.lang;
 const fallback={en:'Email is unavailable. Sign in as an administrator and check the server setup.',tr:'E-posta ekranı açılamadı. Yönetici olarak giriş yap ve sunucu kurulumunu kontrol et.',es:'El correo no está disponible. Accede como administrador y revisa la configuración del servidor.',de:'E-Mail ist nicht verfügbar. Melde dich als Administrator an und prüfe die Servereinrichtung.',fr:'La messagerie est indisponible. Connectez-vous en tant qu’administrateur et vérifiez la configuration du serveur.'};
 let d,data,health,preview=null,token=crypto.randomUUID(),busy=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=k=>d[k]||k,date=v=>new Date(v).toLocaleString(lang),status=v=>{const p=root.querySelector('#status');if(p)p.textContent=v;};
 async function action(button,fn){if(busy)return;busy=true;button.disabled=true;try{await fn();}catch(e){status(t(e.message==='customer_contact_missing'?'contact_missing':'error'));}finally{busy=false;if(button.isConnected)button.disabled=false;}}
 async function load(){
  [data,health]=await Promise.all([api.rpc('ms_mail_status'),api.mail({action:'status'})]);
  draw();
 }
 function draw(){
  const ready=health.keyConfigured&&data.settings.domain_verified_at,active=ready&&data.settings.enabled;
  document.title=t('title')+' | Mr. Space';
  root.innerHTML=`<div class="ms-platform-head"><div><span class="ms-eyebrow">MR. SPACE / ${esc(t('title'))}</span><h1>${esc(t('title'))}</h1><p>${esc(t('intro'))}</p></div><button class="btn" id="refresh">${esc(t('refresh'))}</button></div><p id="status" class="mail-status" role="status" aria-live="polite"></p><div class="mail-grid"><section><div class="mail-card"><h2>${esc(t('setup'))}</h2><p>${esc(t('addresses'))}</p><ul class="mail-setup">${[['key',health.keyConfigured],['domain',!!data.settings.domain_verified_at],['webhook',health.webhookConfigured],['automatic_sending',active]].map(([k,v])=>`<li>${esc(t(k))}<span>${esc(t(v?'ready':'pending'))}</span></li>`).join('')}</ul><p>${esc(t(active?'enabled_note':'paused_note'))}</p><p>${esc(t('limit'))}: ${data.settings.daily_limit}</p><div class="mail-actions"><button class="btn" id="verify" ${!health.keyConfigured?'disabled':''}>${esc(t('verify'))}</button><button class="btn" id="toggle" ${!ready?'disabled':''}>${esc(t(data.settings.enabled?'pause':'enable'))}</button><button class="btn" id="dispatch" ${!active?'disabled':''}>${esc(t('dispatch'))}</button><a class="btn" href="https://resend.com/domains" target="_blank" rel="noopener">Resend ↗</a></div><p>${esc(t('setup_help'))}</p></div><div class="mail-card"><h2>${esc(t('compose'))}</h2><form id="compose"><label>${esc(t('site'))}<select name="site">${data.sites.map(s=>`<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join('')}</select></label><label>${esc(t('kind'))}<select name="kind"><option value="welcome">${esc(t('welcome'))}</option><option value="site_ready">${esc(t('site_ready'))}</option></select></label><label>${esc(t('language'))}<select name="lang">${['en','tr','es','de','fr'].map(l=>`<option value="${l}" ${l===lang?'selected':''}>${l.toUpperCase()}</option>`).join('')}</select></label><button class="btn" ${!data.sites.length?'disabled':''}>${esc(t('preview'))}</button></form><div id="preview"></div><p>${esc(t('contact_help'))} <a href="../">${esc(t('open_admin'))} ↗</a></p></div></section><section><div class="mail-card"><h2>${esc(t('inbox'))}</h2><p>${esc(t('inbox_note'))}</p><div class="mail-list">${data.inbox.map(m=>`<article><small>${esc(m.recipient)} · ${esc(date(m.received_at))}</small><h3>${esc(m.subject||t('no_subject'))}</h3><p>${esc(m.sender)}</p><button class="btn" data-read="${esc(m.id)}">${esc(t('read'))}</button><div data-message="${esc(m.id)}"></div></article>`).join('')||`<p class="mail-empty">${esc(t('empty_inbox'))}</p>`}</div></div><div class="mail-card"><h2>${esc(t('outbox'))}</h2><p>${esc(t('delivery_note'))}</p><div class="mail-list">${data.messages.map(m=>`<article><span class="mail-state">${esc(t(m.status))}</span><h3>${esc(t(m.kind))}</h3><p>${esc(m.recipient)}</p><small>${esc(m.site||'Mr. Space')} · ${esc(date(m.created_at))} · ${esc(t('attempts'))}: ${m.attempts}${m.error_code?' · '+esc(m.error_code):''}</small>${m.status==='queued'&&m.attempts===0?`<button class="btn" data-cancel="${esc(m.id)}">${esc(t('cancel'))}</button>`:''}</article>`).join('')||`<p class="mail-empty">${esc(t('empty_outbox'))}</p>`}</div></div></section></div>`;
  root.querySelector('#refresh').onclick=e=>action(e.target,load);
  root.querySelector('#verify').onclick=e=>action(e.target,async()=>{const r=await api.mail({action:'verify_setup'});await load();status(t(r.verified?'verified':'not_verified'));});
  root.querySelector('#toggle').onclick=e=>action(e.target,async()=>{await api.rpc('ms_mail_toggle',{p_enabled:!data.settings.enabled});await load();});
  root.querySelector('#dispatch').onclick=e=>action(e.target,async()=>{await api.mail({action:'dispatch'});await load();status(t('processed'));});
  root.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>action(b,async()=>{await api.rpc('ms_mail_cancel',{p_id:b.dataset.cancel});await load();}));
  const form=root.querySelector('#compose'),applyLanguage=()=>{const english=form.elements.site.value==='rufcut';form.elements.lang.disabled=english;if(english)form.elements.lang.value='en';};applyLanguage();
  root.querySelector('#compose').onchange=()=>{applyLanguage();};
  root.querySelector('#compose').addEventListener('change',()=>{preview=null;root.querySelector('#preview').replaceChildren();token=crypto.randomUUID();});
  root.querySelector('#compose').onsubmit=e=>{e.preventDefault();action(e.target.querySelector('button'),async()=>{
   const f=new FormData(e.target),draft={site:f.get('site'),kind:f.get('kind'),lang:f.get('site')==='rufcut'?'en':f.get('lang')};
   const r=await api.mail({action:'preview',...draft});preview={...draft,...r};
   root.querySelector('#preview').innerHTML=`<p>${esc(r.from)} → ${esc(r.recipient)}</p><h3>${esc(r.subject)}</h3><div class="mail-preview">${esc(r.text)}</div><p>${esc(t('review_note'))}</p><button class="btn sun" id="queue">${esc(t('queue'))}</button>`;
   root.querySelector('#queue').onclick=e=>action(e.target,async()=>{await api.mail({action:'queue',site:preview.site,kind:preview.kind,lang:preview.lang,digest:preview.digest,token});token=crypto.randomUUID();preview=null;await load();status(t('queued_note'));});
  });};
  root.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>action(b,async()=>{
   const m=await api.rpc('ms_mail_inbox_read',{p_id:b.dataset.read});if(!m)throw new Error('missing_message');
   const host=root.querySelector(`[data-message="${b.dataset.read}"]`),replyToken=crypto.randomUUID();
   host.innerHTML=`<div class="mail-preview mail-message">${esc(m.body||t('no_text'))}</div>${m.truncated?`<p>${esc(t('truncated'))}</p>`:''}${m.attachment_count?`<p>${esc(t('attachments'))}: ${m.attachment_count}. ${esc(t('attachment_note'))}</p>`:''}<form><label>${esc(t('reply_to'))}: ${esc(m.reply_address||m.sender)}<textarea name="reply" required maxlength="10000" rows="5"></textarea></label><button class="btn">${esc(t('queue_reply'))}</button></form>`;
   host.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.target;action(form.querySelector('button'),async()=>{await api.mail({action:'reply',id:m.id,text:new FormData(form).get('reply'),token:replyToken});await load();status(t('queued_note'));});};
  }));
 }
 try{const r=await fetch('../../assets/lang/mail-'+lang+'.json');if(!r.ok)throw new Error('language_unavailable');d=await r.json();await load();}
 catch{root.textContent=fallback[lang]||fallback.en;const a=document.createElement('a');a.href='../';a.className='btn';a.textContent='Mr. Space / Admin ↗';root.append(document.createElement('br'),a);}
})();
