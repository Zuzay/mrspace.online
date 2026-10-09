/* One installable Mr. Space panel and notification client for every authorized site. */
(function(){
 'use strict';
 const t=k=>MsPlatform.t(k),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 let options,registration,installPrompt,settings=null,site=null,live=false,seq=0,enabled=false,busy=false;
 const root=()=>document.getElementById('panelAppTools');
 const lang=()=>document.documentElement.lang||'en';
 function notice(message){const node=root()?.querySelector('[data-app-status]');if(node)node.textContent=message;}
 async function api(action,extra={}){
  const slug=site?.slug;await options.fresh();const token=options.getSession()?.access_token;if(!token||!slug)throw Error('session');
  const response=await fetch(MS_CONFIG.url+'/functions/v1/ms-notifications',{method:'POST',headers:{apikey:MS_CONFIG.anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,site:slug,lang:lang(),...extra}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok||data.error)throw Error('notifications');return data;
 }
 function instructions(){
  const dlg=document.createElement('dialog');dlg.className='panel-install-dialog';dlg.setAttribute('data-noi18n','');
  dlg.innerHTML=`<h2>${esc(t('app_install_title'))}</h2><p>${esc(t(ios()?'app_install_ios':'app_install_other'))}</p><p>${esc(t('app_install_note'))}</p><button class="btn sun">${esc(t('close'))}</button>`;document.body.append(dlg);dlg.querySelector('button').onclick=()=>dlg.close();dlg.onclose=()=>dlg.remove();dlg.showModal();
 }
 async function install(){if(installed())return;if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;}else instructions();}
 function render(){
  const el=root();if(!el)return;
  const alertsOpen=el.querySelector('.panel-alerts')?.open;
  el.innerHTML=`<div class="panel-install"><div><strong>${esc(t('app_title'))}</strong><p>${esc(t(installed()?'app_installed_note':'app_intro'))}</p></div><button class="btn ${installed()?'ghost':'sun'}" data-app-install ${installed()?'disabled':''}>${esc(t(installed()?'app_installed':'app_install'))}</button></div>${live?`<details class="panel-alerts" ${alertsOpen?'open':''}><summary>${esc(t('app_alerts'))}</summary><p>${esc(t('app_alerts_intro'))}</p><div class="panel-alert-grid"><section><h3>${esc(t('app_phone'))}</h3><p>${esc(t(enabled?'app_phone_on':'app_phone_note'))}</p><button class="btn" data-app-push ${!settings||busy?'disabled':''}>${esc(t(enabled?'app_phone_disable':'app_phone_enable'))}</button><p class="app-help">${esc(t('app_ios_push'))}</p></section><form data-app-email><h3>${esc(t('app_email'))}</h3><label>${esc(t('app_email_address'))}<input type="email" name="email" maxlength="160" required value="${esc(settings?.email||'')}"></label><label class="app-check"><input type="checkbox" name="enabled" ${settings?.emailEnabled?'checked':''}>${esc(t('app_email_enable'))}</label><button class="btn" ${!settings||busy?'disabled':''}>${esc(t('save'))}</button>${settings&&!settings.emailReady?`<p class="app-setup">${esc(t('app_email_setup'))}</p>`:''}</form></div><p data-app-status role="status">${settings?'':esc(t('loading'))}</p></details>`:''}`;
  el.querySelector('[data-app-install]').onclick=install;
  el.querySelector('[data-app-push]')?.addEventListener('click',togglePush);
  el.querySelector('[data-app-email]')?.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||!e.target.reportValidity())return;busy=true;const button=e.target.querySelector('button');button.disabled=true;const form=new FormData(e.target);
   try{await api('preferences',{email:form.get('email'),enabled:form.has('enabled')});settings.email=String(form.get('email'));settings.emailEnabled=form.has('enabled');notice(t(settings.emailReady?'app_saved':'app_email_setup'));}catch{notice(t('app_alert_error'));}finally{busy=false;button.disabled=false;}
  });
 }
 async function togglePush(){
  if(busy||!settings)return;
  if(ios()&&!installed()){instructions();return;}
  if(!('Notification'in window)||!('PushManager'in window)||!registration){notice(t('app_push_unsupported'));return;}
  if(Notification.permission==='denied'){notice(t('app_push_denied'));return;}
  // Ask immediately on the button gesture; do not await a network call first.
  const permission=enabled?Promise.resolve('granted'):Notification.requestPermission();busy=true;
  const currentSeq=seq;try{
   if(await permission!=='granted'){notice(t('app_push_denied'));return;}
   const reg=await registration;if(!reg?.pushManager){notice(t('app_push_unsupported'));return;}const existing=await reg.pushManager.getSubscription();
   if(enabled&&existing){try{await api('unsubscribe',{endpoint:existing.endpoint});}finally{await existing.unsubscribe();}enabled=false;render();notice(t('app_phone_off'));return;}
   const decoded=atob(settings.publicKey.replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(decoded,c=>c.charCodeAt(0));
   const subscription=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   await api('subscribe',{subscription:subscription.toJSON()});if(currentSeq!==seq)return;enabled=true;render();notice(t('app_phone_on'));
  }catch{notice(t('app_alert_error'));}finally{busy=false;const button=root()?.querySelector('[data-app-push]');if(button)button.disabled=!settings;}
 }
 async function mount(nextSite,isLive){
  const current=++seq;site=nextSite;live=isLive;settings=null;enabled=false;await MsPlatform.ready;if(current!==seq)return;render();if(!live)return;
  try{const result=await api('settings');if(current!==seq)return;settings=result;
   if(registration){const reg=await registration;if(current!==seq)return;const sub=reg?.pushManager?await reg.pushManager.getSubscription():null;if(sub&&Notification.permission==='granted'){await api('subscribe',{subscription:sub.toJSON()});enabled=true;}}
   if(current!==seq)return;render();
  }catch{if(current===seq){render();notice(t('app_alert_error'));const retry=document.createElement('button');retry.className='btn';retry.textContent=t('refresh');retry.onclick=()=>mount(site,live);root().querySelector('[data-app-status]').after(retry);}}
 }
 async function detach(){
  const token=options.getSession()?.access_token,slug=site?.slug;const reg=registration&&await registration;if(!reg)return;const sub=await reg.pushManager.getSubscription();if(!sub)return;
  try{if(token&&slug)await fetch(MS_CONFIG.url+'/functions/v1/ms-notifications',{method:'POST',headers:{apikey:MS_CONFIG.anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'unsubscribe',site:slug,endpoint:sub.endpoint}),signal:AbortSignal.timeout(8000)});}catch{}finally{await sub.unsubscribe();enabled=false;}
 }
 function init(config){
  options=config;const url=new URL(location.href);url.searchParams.set('lang',lang());history.replaceState(null,'',url);window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('appinstalled',()=>{installPrompt=null;render();});
  if('serviceWorker'in navigator&&window.isSecureContext)registration=navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(async reg=>{if(reg.active)return reg;await navigator.serviceWorker.ready;return reg;}).catch(()=>null);
 }
 window.MsPanelApp={init,mount,detach,install};
})();
