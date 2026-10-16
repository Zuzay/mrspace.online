/* Shared editor publication adapter; the server authorizes membership for every write. */
'use strict';
const SELF_COPY={
 en:['Publish changes','Your text, photos and existing colours go live without review. The first publish each change day saves the previous live version. We retain 5 change days. Restoration is a paid service, completed within 24 hours after payment confirmation. Days use Los Angeles time.','Published. Your website is updated.','The site changed in another tab. Reload and review your draft before publishing.','Publication failed. Your draft is kept; retry safely.','Continue editing','Copy website link','Upload the photo with the file chooser before publishing.'],
 tr:['Değişiklikleri yayınla','Metin, fotoğraf ve mevcut renkler inceleme beklemeden yayınlanır. Her değişiklik gününün ilk yayınından önce önceki canlı sürüm saklanır. Son 5 değişiklik günü tutulur. Eski sürüme dönüş ücretlidir; ödeme doğrulandıktan sonra 24 saat içinde tamamlanır. Günler Los Angeles saatine göredir.','Yayınlandı. Siten güncellendi.','Site başka bir sekmede değişti. Yenileyip taslağını kontrol ettikten sonra yayınla.','Yayınlanamadı. Taslağın korunuyor; güvenle tekrar dene.','Düzenlemeye devam et','Site linkini kopyala','Yayınlamadan önce fotoğrafı dosya seçiciden yükle.'],
 es:['Publicar cambios','Los textos, fotos y colores existentes se publican sin revisión. Antes de la primera publicación de cada día de cambios guardamos la versión anterior. Conservamos 5 días de cambios. La restauración tiene un coste y se completa en 24 horas tras confirmar el pago. Hora de Los Ángeles.','Publicado. Tu sitio está actualizado.','El sitio cambió en otra pestaña. Recarga y revisa el borrador.','No se pudo publicar. El borrador se conserva; vuelve a intentarlo.','Seguir editando','Copiar enlace del sitio','Sube la foto con el selector de archivos antes de publicar.'],
 de:['Änderungen veröffentlichen','Texte, Fotos und vorhandene Farben werden ohne Prüfung veröffentlicht. Vor der ersten Veröffentlichung eines Änderungstages sichern wir die vorherige Version. Wir behalten 5 Änderungstage. Eine Wiederherstellung ist kostenpflichtig und erfolgt innerhalb von 24 Stunden nach Zahlungsbestätigung. Zeitzone Los Angeles.','Veröffentlicht. Deine Website ist aktualisiert.','Die Website wurde in einem anderen Tab geändert. Neu laden und den Entwurf prüfen.','Veröffentlichung fehlgeschlagen. Dein Entwurf bleibt erhalten; erneut versuchen.','Weiter bearbeiten','Website-Link kopieren','Lade das Foto vor der Veröffentlichung über die Dateiauswahl hoch.'],
 fr:['Publier les modifications','Les textes, photos et couleurs existantes sont publiés sans validation. Avant la première publication de chaque jour de modification, nous sauvegardons la version précédente. Nous conservons 5 jours de modification. La restauration est payante et effectuée sous 24 heures après confirmation du paiement. Heure de Los Angeles.','Publié. Votre site est à jour.','Le site a changé dans un autre onglet. Rechargez et vérifiez le brouillon.','Publication impossible. Votre brouillon est conservé ; réessayez.','Continuer à modifier','Copier le lien du site','Importez la photo avec le sélecteur de fichiers avant de publier.']};
function selfCopy(){return SELF_COPY[lang]||SELF_COPY.en;}
async function selfCall(action,extra={}){
 let session;try{session=JSON.parse(localStorage.getItem('ms_panel')||'null');}catch{}if(!session?.access_token)throw Error('session');
 if(Number(session.expires_at)<Date.now()/1000+60){const r=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.access_token)throw Error('session');session={...session,...d,expires_at:d.expires_at||Date.now()/1000+d.expires_in};localStorage.setItem('ms_panel',JSON.stringify(session));}
 const r=await fetch(cfg.url+'/functions/v1/ms-content',{method:'POST',headers:{apikey:cfg.anon,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({site:'rufcut',action,...extra}),signal:AbortSignal.timeout(120000)});const d=await r.json();if(!r.ok)throw Error(d.error||'publish_failed');return d;
}
async function initSelf(){
 const d=await selfCall('get');if(!d.enabled)throw Error('disabled');S.self=d;S.siteName='Rufcut';
 // Existing media uploader remains scoped by the site's capability key, not a repository token.
 const session=JSON.parse(localStorage.getItem('ms_panel'));const r=await fetch(cfg.url+'/rest/v1/rpc/ms_my_sites',{method:'POST',headers:{apikey:cfg.anon,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});const sites=await r.json();KEY=sites.find(s=>s.slug==='rufcut')?.site_key;if(!uuid(KEY))throw Error('session');
 Object.assign(t,{send:selfCopy()[0],sendCheck:selfCopy()[0],submitNote:selfCopy()[1],designReview:'',quota:()=>''});
 return {name:'Rufcut',url:'/rufcut/'};
}
function selfReview(){
 S.view='review';outline(S.selected||{})?.classList.remove('ms-editor-selected');S.selected=null;header();sidebarTitle(t.sheet,selfCopy()[1]);
 $('#sideBody').innerHTML=`<button class="ghost" id="backAreas">← ${esc(t.backAreas)}</button>${[...S.items.values()].map(it=>changeCard(it)).join('')||`<p>${esc(t.empty)}</p>`}<p id="sendStatus" role="status"></p><button class="btn" id="sendReview">${esc(selfCopy()[0])}</button>`;
 $('#backAreas').onclick=clearSelection;$('#sideBody').querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>locate(S.items.get(b.dataset.locate)));$('#sendReview').onclick=()=>{if(!S.items.size)return;showDialog(selfCopy()[0],`<p>${esc(selfCopy()[1])}</p>${[...S.items.values()].map(it=>changeCard(it,false)).join('')}`,[{label:t.keep,run:()=>{}},{label:selfCopy()[0],primary:true,run:publishSelf}]);};document.body.classList.add('sidebar-open');
}
async function publishSelf(){
 if(S.busy)return;S.busy=true;$('#sendReview').disabled=true;$('#sendStatus').textContent=t.sending;
 try{
  const changes=[...S.items.values()].map(it=>{const [page,selector]=it.anchor.split('::'),field=selector.match(/^\[data-ms-field="([a-zA-Z0-9_.:-]+)"\]$/)?.[1];return {page,field,type:it.type,value:it.text||'',lang};});
  if(changes.some(c=>c.type==='image'&&!c.value.startsWith(cfg.url+'/storage/v1/object/public/ms-media/rufcut/')))throw Error('upload_photo_first');
  S.publishToken||=crypto.randomUUID();const r=await selfCall('publish',{revision:S.self.revision,request:S.publishToken,changes});if(!r.ok)throw Error('unconfirmed');
  // Verify the public serving endpoint before announcing success.
  const live=await selfCall('public');if(live.revision<r.revision)throw Error('unconfirmed');
  try{localStorage.removeItem(S.storage);}catch{}S.self.revision=r.revision;S.items.clear();S.pending=null;S.publishToken=null;S.submitted=true;
  $('#doneTitle').textContent=selfCopy()[2];$('#doneText').textContent=selfCopy()[1];$('#doneList').replaceChildren();$('#reviseBtn').textContent=selfCopy()[5];$('#reviseBtn').onclick=()=>location.reload();$('#copyBtn').textContent=selfCopy()[6];$('#copyBtn').onclick=()=>navigator.clipboard.writeText(location.origin+'/rufcut/');$('#done').showModal();
 }catch(e){$('#sendStatus').textContent=e.message==='conflict'?selfCopy()[3]:e.message==='upload_photo_first'?selfCopy()[7]:selfCopy()[4];}
 finally{S.busy=false;$('#sendReview').disabled=false;}
}
