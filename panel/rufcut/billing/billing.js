/* Rufcut billing. Commercial data is never stored in this file: it is read from
   ms-panel {action:"billing"} with the signed-in panel session (same staffUser check as work orders).
   Contract: ms/RUFCUT-BILLING-CONTRACT.md */
(function(){
'use strict';
const SITE='rufcut',LANGS=['en','es','de','fr','tr'];
const D={
 es:{"BILLING":"FACTURACIÓN","Back to panel":"Volver al panel","Billing":"Facturación","Your agreement, what is due and the work logged for your site.":"Tu acuerdo, lo que se debe y el trabajo registrado para tu sitio.","Loading…":"Cargando…","Sign in to your panel to see billing.":"Inicia sesión en tu panel para ver la facturación.","Sign in":"Iniciar sesión","Your session ended. Sign in again.":"Tu sesión terminó. Inicia sesión de nuevo.","Billing details are not ready yet. Mr. Space will share them by email.":"Los datos de facturación aún no están listos. Mr. Space los enviará por correo.","Billing could not load. Try again.":"No se pudo cargar la facturación. Inténtalo de nuevo.","Try again":"Reintentar","What you pay":"Lo que pagas","Agreed with Mr. Space":"Acordado con Mr. Space","Setup fee":"Cuota de puesta en marcha","Payment not verified yet":"Pago aún no verificado","Payment verified":"Pago verificado","Monthly":"Mensual","per month":"al mes","Required from {d}.":"Obligatorio desde el {d}.","Optional early start from {d}.":"Inicio anticipado opcional desde el {d}.","Early start chosen.":"Inicio anticipado elegido.","Due now":"A pagar ahora","Nothing is due now.":"No hay nada pendiente ahora.","There is no online payment on this page. Mr. Space sends payment details by email.":"Esta página no cobra en línea. Mr. Space envía los datos de pago por correo.","Standard value":"Valor estándar","For reference. Not charged.":"Como referencia. No se cobra.","Site care, Package 2":"Mantenimiento del sitio, Paquete 2","Jeans builder":"Creador de jeans","Repair tool":"Herramienta de arreglos","Standard total":"Total estándar","Work log":"Registro de trabajo","From the panel activity log.":"Del registro de actividad del panel.","logged entries":"entradas registradas","time recorded":"tiempo registrado","No time recorded":"Sin registro de tiempo","These are logged work entries, not a count of your revision requests.":"Son entradas de trabajo registradas, no un recuento de tus solicitudes de cambio.","No work entries yet.":"Aún no hay entradas.","Recent entries":"Entradas recientes","Options":"Opciones","Not active and not owed.":"No activas y no se deben.","Square connection":"Conexión con Square","Standard {a} per month. If you add it later: {b} per month.":"Estándar {a} al mes. Si la añades más adelante: {b} al mes.","Site handover":"Traspaso del sitio","About {a}. Proposal only. Scope and final amount to be confirmed.":"Unos {a}. Solo propuesta. El alcance y el importe final se confirmarán.","Questions? Email us":"¿Preguntas? Escríbenos","Updated":"Actualizado","{h} h {m} min":"{h} h {m} min"},
 de:{"BILLING":"ABRECHNUNG","Back to panel":"Zurück zum Panel","Billing":"Abrechnung","Your agreement, what is due and the work logged for your site.":"Deine Vereinbarung, was fällig ist und die für deine Website erfasste Arbeit.","Loading…":"Wird geladen…","Sign in to your panel to see billing.":"Melde dich im Panel an, um die Abrechnung zu sehen.","Sign in":"Anmelden","Your session ended. Sign in again.":"Deine Sitzung ist abgelaufen. Bitte erneut anmelden.","Billing details are not ready yet. Mr. Space will share them by email.":"Die Abrechnung ist noch nicht bereit. Mr. Space schickt die Angaben per E-Mail.","Billing could not load. Try again.":"Die Abrechnung konnte nicht geladen werden. Bitte erneut versuchen.","Try again":"Erneut versuchen","What you pay":"Was du zahlst","Agreed with Mr. Space":"Mit Mr. Space vereinbart","Setup fee":"Einrichtungsgebühr","Payment not verified yet":"Zahlung noch nicht bestätigt","Payment verified":"Zahlung bestätigt","Monthly":"Monatlich","per month":"pro Monat","Required from {d}.":"Fällig ab {d}.","Optional early start from {d}.":"Freiwilliger früher Start ab {d}.","Early start chosen.":"Früher Start gewählt.","Due now":"Jetzt fällig","Nothing is due now.":"Derzeit ist nichts fällig.","There is no online payment on this page. Mr. Space sends payment details by email.":"Auf dieser Seite wird nichts online bezahlt. Mr. Space schickt die Zahlungsangaben per E-Mail.","Standard value":"Standardwert","For reference. Not charged.":"Zur Orientierung. Wird nicht berechnet.","Site care, Package 2":"Website-Betreuung, Paket 2","Jeans builder":"Jeans-Konfigurator","Repair tool":"Reparatur-Tool","Standard total":"Standard gesamt","Work log":"Arbeitsprotokoll","From the panel activity log.":"Aus dem Aktivitätsprotokoll des Panels.","logged entries":"erfasste Einträge","time recorded":"erfasste Zeit","No time recorded":"Keine Zeiterfassung","These are logged work entries, not a count of your revision requests.":"Das sind erfasste Arbeitseinträge, keine Zählung deiner Änderungswünsche.","No work entries yet.":"Noch keine Einträge.","Recent entries":"Neueste Einträge","Options":"Optionen","Not active and not owed.":"Nicht aktiv und nicht geschuldet.","Square connection":"Square-Verbindung","Standard {a} per month. If you add it later: {b} per month.":"Standard {a} pro Monat. Wenn du sie später hinzufügst: {b} pro Monat.","Site handover":"Übergabe der Website","About {a}. Proposal only. Scope and final amount to be confirmed.":"Etwa {a}. Nur ein Angebot. Umfang und Endbetrag werden noch bestätigt.","Questions? Email us":"Fragen? Schreib uns","Updated":"Aktualisiert","{h} h {m} min":"{h} Std. {m} Min."},
 fr:{"BILLING":"FACTURATION","Back to panel":"Retour au panneau","Billing":"Facturation","Your agreement, what is due and the work logged for your site.":"Votre accord, ce qui est dû et le travail enregistré pour votre site.","Loading…":"Chargement…","Sign in to your panel to see billing.":"Connectez-vous à votre panneau pour voir la facturation.","Sign in":"Se connecter","Your session ended. Sign in again.":"Votre session a expiré. Reconnectez-vous.","Billing details are not ready yet. Mr. Space will share them by email.":"La facturation n'est pas encore prête. Mr. Space vous l'enverra par e-mail.","Billing could not load. Try again.":"La facturation n'a pas pu se charger. Réessayez.","Try again":"Réessayer","What you pay":"Ce que vous payez","Agreed with Mr. Space":"Convenu avec Mr. Space","Setup fee":"Frais de mise en place","Payment not verified yet":"Paiement pas encore vérifié","Payment verified":"Paiement vérifié","Monthly":"Mensuel","per month":"par mois","Required from {d}.":"Obligatoire à partir du {d}.","Optional early start from {d}.":"Démarrage anticipé facultatif dès le {d}.","Early start chosen.":"Démarrage anticipé choisi.","Due now":"À payer maintenant","Nothing is due now.":"Rien n'est dû pour le moment.","There is no online payment on this page. Mr. Space sends payment details by email.":"Aucun paiement en ligne sur cette page. Mr. Space envoie les détails de paiement par e-mail.","Standard value":"Valeur standard","For reference. Not charged.":"À titre indicatif. Non facturé.","Site care, Package 2":"Entretien du site, Forfait 2","Jeans builder":"Créateur de jeans","Repair tool":"Outil de retouches","Standard total":"Total standard","Work log":"Journal de travail","From the panel activity log.":"Issu du journal d'activité du panneau.","logged entries":"entrées enregistrées","time recorded":"temps enregistré","No time recorded":"Aucun temps enregistré","These are logged work entries, not a count of your revision requests.":"Ce sont des entrées de travail, pas un décompte de vos demandes de modification.","No work entries yet.":"Aucune entrée pour l'instant.","Recent entries":"Entrées récentes","Options":"Options","Not active and not owed.":"Non actives et non dues.","Square connection":"Connexion Square","Standard {a} per month. If you add it later: {b} per month.":"Standard {a} par mois. Si vous l'ajoutez plus tard : {b} par mois.","Site handover":"Transfert du site","About {a}. Proposal only. Scope and final amount to be confirmed.":"Environ {a}. Simple proposition. Le périmètre et le montant final restent à confirmer.","Questions? Email us":"Des questions ? Écrivez-nous","Updated":"Mis à jour","{h} h {m} min":"{h} h {m} min"},
 tr:{"BILLING":"FATURA","Back to panel":"Panele dön","Billing":"Fatura","Your agreement, what is due and the work logged for your site.":"Anlaşman, ödenecek tutar ve siten için kaydedilen işler.","Loading…":"Yükleniyor…","Sign in to your panel to see billing.":"Faturayı görmek için paneline giriş yap.","Sign in":"Giriş yap","Your session ended. Sign in again.":"Oturumun sona erdi. Tekrar giriş yap.","Billing details are not ready yet. Mr. Space will share them by email.":"Fatura bilgileri henüz hazır değil. Mr. Space e-postayla iletecek.","Billing could not load. Try again.":"Fatura yüklenemedi. Tekrar dene.","Try again":"Tekrar dene","What you pay":"Ödediğin","Agreed with Mr. Space":"Mr. Space ile anlaşılan","Setup fee":"Kurulum ücreti","Payment not verified yet":"Ödeme henüz doğrulanmadı","Payment verified":"Ödeme doğrulandı","Monthly":"Aylık","per month":"aylık","Required from {d}.":"{d} tarihinden itibaren zorunlu.","Optional early start from {d}.":"{d} tarihinden itibaren isteğe bağlı erken başlangıç.","Early start chosen.":"Erken başlangıç seçildi.","Due now":"Şimdi ödenecek","Nothing is due now.":"Şu an ödenecek bir şey yok.","There is no online payment on this page. Mr. Space sends payment details by email.":"Bu sayfada online ödeme yok. Mr. Space ödeme bilgilerini e-postayla gönderir.","Standard value":"Standart değer","For reference. Not charged.":"Bilgi amaçlı. Ücretlendirilmez.","Site care, Package 2":"Site bakımı, Paket 2","Jeans builder":"Jean tasarım aracı","Repair tool":"Tamir aracı","Standard total":"Standart toplam","Work log":"İş kaydı","From the panel activity log.":"Panel aktivite kaydından.","logged entries":"kayıtlı iş","time recorded":"kayıtlı süre","No time recorded":"Süre kaydı yok","These are logged work entries, not a count of your revision requests.":"Bunlar kayıtlı iş girdileridir, değişiklik taleplerinin sayısı değildir.","No work entries yet.":"Henüz iş kaydı yok.","Recent entries":"Son kayıtlar","Options":"Seçenekler","Not active and not owed.":"Aktif değil, borç değil.","Square connection":"Square bağlantısı","Standard {a} per month. If you add it later: {b} per month.":"Standart aylık {a}. İleride eklersen: aylık {b}.","Site handover":"Site devri","About {a}. Proposal only. Scope and final amount to be confirmed.":"Yaklaşık {a}. Sadece teklif. Kapsam ve kesin tutar sonra netleşir.","Questions? Email us":"Soru mu var? Bize yaz","Updated":"Güncellendi","{h} h {m} min":"{h} sa {m} dk"}
};
function pick(){
 try{const q=new URLSearchParams(location.search).get('lang');if(LANGS.includes(q)){localStorage.setItem('ms_lang',q);return q;}}catch{}
 try{const s=localStorage.getItem('ms_lang');if(LANGS.includes(s))return s;}catch{}
 for(const l of navigator.languages||[navigator.language||'en']){const c=String(l).slice(0,2).toLowerCase();if(LANGS.includes(c))return c;}
 return 'en';
}
const lang=pick();document.documentElement.lang=lang;
const t=(k,v={})=>String((D[lang]&&D[lang][k])||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
document.querySelectorAll('[data-t]').forEach(el=>{el.textContent=t(el.dataset.t);});
document.title='Rufcut · '+t('Billing');
const host=document.querySelector('[data-lang-host]');
if(host){const sel=document.createElement('select');sel.className='lang-pick';sel.setAttribute('aria-label','Language');
 LANGS.forEach(l=>{const o=document.createElement('option');o.value=l;o.textContent=l.toUpperCase();o.selected=l===lang;sel.append(o);});
 sel.onchange=()=>{try{localStorage.setItem('ms_lang',sel.value);}catch{}const u=new URL(location.href);u.searchParams.set('lang',sel.value);location.assign(u.href);};host.append(sel);}

const $=id=>document.getElementById(id),state=$('billState'),body=$('billBody');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
let currency='USD';
const money=v=>num(v)?new Intl.NumberFormat(lang,{style:'currency',currency,maximumFractionDigits:v%1?2:0}).format(v):'';
const date=v=>{const d=new Date(String(v||'')+(String(v||'').length===10?'T12:00:00':''));return isNaN(d)?'':new Intl.DateTimeFormat(lang,{year:'numeric',month:'long',day:'numeric'}).format(d);};
function show(message,action){
 state.hidden=false;body.hidden=true;state.replaceChildren(el('span',null,message));
 if(action){const a=action.href?el('a','btn sm',action.label):el('button','btn sm',action.label);if(action.href)a.href=action.href;else{a.type='button';a.onclick=action.run;}state.append(a);}
}

let session=null;try{session=JSON.parse(localStorage.getItem('ms_panel')||'null');}catch{}
async function fresh(){
 if(!session?.access_token)throw Error('auth');
 if(session.expires_at>Date.now()/1000+60)return;
 if(!session.refresh_token)throw Error('auth');
 const r=await fetch(MS_CONFIG.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:MS_CONFIG.anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(20000)});
 const d=await r.json().catch(()=>({}));if(!r.ok||!d.access_token)throw Error('auth');
 session={...session,access_token:d.access_token,refresh_token:d.refresh_token||session.refresh_token,expires_at:d.expires_at||Date.now()/1000+(d.expires_in||3600)};
 try{localStorage.setItem('ms_panel',JSON.stringify(session));}catch{}
}
async function load(){
 if(!window.MS_CONFIG||!session)return show(t('Sign in to your panel to see billing.'),{label:t('Sign in'),href:'../'});
 state.hidden=false;body.hidden=true;state.replaceChildren(el('span','bill-pulse'),el('span',null,t('Loading…')));
 try{
  await fresh();
  const r=await fetch(MS_CONFIG.url+'/functions/v1/ms-panel',{method:'POST',headers:{apikey:MS_CONFIG.anon,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({site:SITE,action:'billing'}),signal:AbortSignal.timeout(20000)});
  const d=await r.json().catch(()=>({}));
  if(r.status===401)throw Error('auth');
  if(r.status>=500)throw Error('server');
  if(!r.ok||d.error||!d.agreement)return show(t('Billing details are not ready yet. Mr. Space will share them by email.'));
  if(!num(d.due?.amount)||!num(d.agreement.setup?.amount)||!num(d.agreement.monthly?.agreed))throw Error('server');
  render(d);
 }catch(e){
  if(e.message==='auth')return show(t('Your session ended. Sign in again.'),{label:t('Sign in'),href:'../'});
  show(t('Billing could not load. Try again.'),{label:t('Try again'),run:load});
 }
}
function row(label,sub,value,cls){const tr=el('div','bill-row'+(cls?' '+cls:''));const l=el('div');l.append(el('span',null,label));if(sub)l.append(el('small',null,sub));tr.append(l,el('b',null,value));return tr;}
function card(label,title,note){const c=el('section','bill-card');c.append(el('p','bill-label',label));if(title)c.append(el('h2',null,title));if(note)c.append(el('p','bill-note',note));return c;}
function render(d){
 currency=/^[A-Z]{3}$/.test(d.currency)?d.currency:'USD';
 const a=d.agreement||{},setup=a.setup||{},monthly=a.monthly||{};
 const out=document.createDocumentFragment();

 // 1. Agreed charges (what is actually owed)
 const pay=card(t('Agreed with Mr. Space'),t('What you pay'));
 if(num(setup.amount)){const s=row(t('Setup fee'),null,money(setup.amount));const badge=el('span','bill-badge'+(setup.status==='verified'?' ok':''),setup.status==='verified'?t('Payment verified')+(setup.verified_at?' · '+date(setup.verified_at):''):t('Payment not verified yet'));s.firstChild.append(badge);pay.append(s);}
 if(num(monthly.agreed)){
  const notes=[];if(monthly.required_from)notes.push(t('Required from {d}.',{d:date(monthly.required_from)}));
  const early=monthly.early_start||{};if(early.chosen)notes.push(t('Early start chosen.'));else if(early.available_from)notes.push(t('Optional early start from {d}.',{d:date(early.available_from)}));
  pay.append(row(t('Monthly'),notes.join(' '),money(monthly.agreed)+' '+t('per month')));
 }
 out.append(pay);

 const due=d.due||{},dueBox=el('section','bill-due');const dl=el('div');
 dl.append(el('p',null,t('Due now')),el('b',null,num(due.amount)?money(due.amount):money(0)));
 if(!num(due.amount)||due.amount===0)dl.append(el('p',null,t('Nothing is due now.')));
 dl.append(el('p',null,t('There is no online payment on this page. Mr. Space sends payment details by email.')));
 const mail=el('a','btn sun',t('Questions? Email us'));mail.href='mailto:mrspace.online1@gmail.com?subject='+encodeURIComponent('Rufcut billing');
 dueBox.append(dl,mail);out.append(dueBox);

 // 2. Standard value (reference only, never charged)
 if(num(monthly.standard)){
  const names={site_care:t('Site care, Package 2'),jeans_builder:t('Jeans builder'),repair_tool:t('Repair tool')};
  const std=card(t('For reference. Not charged.'),t('Standard value'),[t('Site care, Package 2'),t('Jeans builder'),t('Repair tool')].join(' · '));
  (monthly.components||[]).filter(c=>names[c.key]&&num(c.amount)).forEach(c=>std.append(row(names[c.key],null,money(c.amount)+' '+t('per month'))));
  std.append(row(t('Standard total'),null,money(monthly.standard)+' '+t('per month'),'total'));
  out.append(std);
 }

 // 3. Work log (activity entries, not revisions)
 const w=d.work||{},log=card(t('From the panel activity log.'),t('Work log'),t('These are logged work entries, not a count of your revision requests.'));
 const stats=el('div','bill-stats');
 const s1=el('div');s1.append(el('b',null,num(w.entries)?String(w.entries):'0'),el('span',null,t('logged entries')));
 const s2=el('div');const m=w.minutes_recorded;s2.append(el('b',null,num(m)&&m>0?t('{h} h {m} min',{h:Math.floor(m/60),m:m%60}):t('No time recorded')),el('span',null,t('time recorded')));
 stats.append(s1,s2);log.append(stats);
 if(Array.isArray(w.recent)&&w.recent.length){log.append(el('h3',null,t('Recent entries')));const ul=el('ul','bill-log');w.recent.slice(0,10).forEach(x=>{const li=el('li');li.append(el('time',null,date(x.at)),el('span',null,String(x.action||'').slice(0,160)));ul.append(li);});log.append(ul);}
 else log.append(el('p','bill-note',t('No work entries yet.')));
 out.append(log);

 // 4. Options: never active, never owed
 const opts=(Array.isArray(d.options)?d.options:[]).filter(o=>o&&(o.key==='square_addon'||o.key==='handover'));
 if(opts.length){
  const oc=card(t('Not active and not owed.'),t('Options'));
  opts.forEach(o=>{
   if(o.key==='square_addon'&&num(o.standard_monthly)&&num(o.offer_monthly))oc.append(row(t('Square connection'),t('Standard {a} per month. If you add it later: {b} per month.',{a:money(o.standard_monthly),b:money(o.offer_monthly)}),''));
   if(o.key==='handover'&&num(o.approx_amount))oc.append(row(t('Site handover'),t('About {a}. Proposal only. Scope and final amount to be confirmed.',{a:money(o.approx_amount)}),''));
  });
  out.append(oc);
 }
 if(d.checked_at)out.append(el('p','bill-note bill-updated',t('Updated')+' '+date(d.checked_at)));
 body.replaceChildren(out);state.hidden=true;body.hidden=false;
}
load();
})();
