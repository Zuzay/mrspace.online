// Kuyruk mesajı ilk denemede dondurulur. Tekrar deneme aynı içerik ve UUID'yi kullanır.
const copy:Record<string,string[]>={
 en:['Welcome to Mr. Space','Your site is ready to review','New sign-in to your Mr. Space account','Your workspace is ready. Sign in with the account details shared with you.','Your site is ready for your review. Open the editor to request changes. Your changes are reviewed before publishing.','A new session signed in to your account. If this was not you, change your password and contact us.','Open your panel','Open the editor','Read the Rufcut PDF guide','This website is a Mr. Space product'],
 tr:['Mr. Space’e hoş geldin','Siten inceleme için hazır','Mr. Space hesabında yeni giriş','Çalışma alanın hazır. Seninle paylaşılan hesap bilgileriyle giriş yapabilirsin.','Siten incelemen için hazır. Değişiklik istemek için editörü aç. Değişikliklerin yayınlanmadan önce incelenir.','Hesabında yeni bir oturum açıldı. Giriş sana ait değilse şifreni değiştir ve bize ulaş.','Panelini aç','Editörü aç','Rufcut PDF kılavuzunu oku','Bu site bir Mr. Space ürünüdür'],
 es:['Bienvenido a Mr. Space','Tu sitio está listo para revisar','Nuevo acceso a tu cuenta de Mr. Space','Tu espacio de trabajo está listo. Accede con los datos de cuenta que te hemos facilitado.','Tu sitio está listo para que lo revises. Abre el editor para solicitar cambios. Los cambios se revisan antes de publicarse.','Se ha iniciado una nueva sesión en tu cuenta. Si no has sido tú, cambia tu contraseña y contacta con nosotros.','Abrir tu panel','Abrir el editor','Leer la guía PDF de Rufcut','Este sitio web es un producto de Mr. Space'],
 de:['Willkommen bei Mr. Space','Deine Website ist bereit zur Prüfung','Neue Anmeldung bei deinem Mr. Space-Konto','Dein Arbeitsbereich ist bereit. Melde dich mit den Zugangsdaten an, die du erhalten hast.','Deine Website ist bereit zur Prüfung. Öffne den Editor, um Änderungen anzufragen. Änderungen werden vor der Veröffentlichung geprüft.','Eine neue Sitzung wurde in deinem Konto angemeldet. Falls du das nicht warst, ändere dein Passwort und kontaktiere uns.','Dein Panel öffnen','Editor öffnen','Rufcut PDF-Anleitung lesen','Diese Website ist ein Produkt von Mr. Space'],
 fr:['Bienvenue chez Mr. Space','Votre site est prêt à être relu','Nouvelle connexion à votre compte Mr. Space','Votre espace de travail est prêt. Connectez-vous avec les identifiants qui vous ont été transmis.','Votre site est prêt à être relu. Ouvrez l’éditeur pour demander des modifications. Elles sont examinées avant publication.','Une nouvelle session a été ouverte sur votre compte. Si ce n’était pas vous, changez votre mot de passe et contactez-nous.','Ouvrir votre panneau','Ouvrir l’éditeur','Lire le guide PDF Rufcut','Ce site est un produit Mr. Space']
};
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const orderCopy:Record<string,string[]>={
 en:['Rufcut work order','Your request reached Rufcut.','New work order','Track your request','Open the work order','Request received.','Work has started.','Your order is in its finishing stage. Check with the shop before pickup.','Your order is ready for pickup at Rufcut.','Your work order is complete.'],
 tr:['Rufcut iş emri','Talebin Rufcut’a ulaştı.','Yeni iş emri','Talebini takip et','İş emrini aç','Talep alındı.','Çalışma başladı.','İşin son aşamada. Teslim almadan önce dükkânla görüş.','İşin Rufcut’tan teslim alınmaya hazır.','İş emrin tamamlandı.'],
 es:['Orden de trabajo Rufcut','Tu solicitud ha llegado a Rufcut.','Nueva orden de trabajo','Seguir tu solicitud','Abrir la orden','Solicitud recibida.','El trabajo ha comenzado.','Tu orden está en la fase final. Consulta con la tienda antes de recogerla.','Tu orden está lista para recoger en Rufcut.','Tu orden está completada.'],
 de:['Rufcut-Auftrag','Deine Anfrage ist bei Rufcut eingegangen.','Neuer Auftrag','Anfrage verfolgen','Auftrag öffnen','Anfrage erhalten.','Die Arbeit hat begonnen.','Dein Auftrag ist in der Endbearbeitung. Vor der Abholung beim Laden nachfragen.','Dein Auftrag ist bei Rufcut abholbereit.','Dein Auftrag ist abgeschlossen.'],
 fr:['Commande Rufcut','Votre demande est parvenue à Rufcut.','Nouvelle commande','Suivre votre demande','Ouvrir la commande','Demande reçue.','Le travail a commencé.','Votre commande est en finition. Contactez la boutique avant le retrait.','Votre commande est prête à être retirée chez Rufcut.','Votre commande est terminée.']
};
const requestCopy:Record<string,string[]>={
 en:['Your changes reached Mr. Space','Your changes were updated','Open your changes','We will review your changes before publishing. Keep this private link to return to your request.'],
 tr:['Değişikliklerin Mr. Space’e ulaştı','Değişikliklerin güncellendi','Değişikliklerini aç','Değişikliklerin yayınlanmadan önce incelenecek. Talebine dönmek için bu özel bağlantıyı sakla.'],
 es:['Tus cambios han llegado a Mr. Space','Tus cambios se han actualizado','Abrir tus cambios','Revisaremos los cambios antes de publicarlos. Guarda este enlace privado para volver a tu solicitud.'],
 de:['Deine Änderungen sind bei Mr. Space eingegangen','Deine Änderungen wurden aktualisiert','Deine Änderungen öffnen','Wir prüfen die Änderungen vor der Veröffentlichung. Bewahre diesen privaten Link für deine Anfrage auf.'],
 fr:['Vos modifications sont parvenues à Mr. Space','Vos modifications ont été mises à jour','Ouvrir vos modifications','Nous examinerons les modifications avant publication. Conservez ce lien privé pour retrouver votre demande.']
};
export function address(value:unknown):string|null {
 const s=String(value||'').trim();if(/[\r\n]/.test(s))return null;
 const a=s.match(/<([^<>]+)>$/)?.[1]||s;
 return a.length<=160&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a)?a.toLowerCase():null;
}
export function plainText(mail:any){
 if(typeof mail.text==='string'&&mail.text.trim())return mail.text;
 return String(mail.html||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?\s*>|<\/(p|div|h[1-6]|li|tr)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[x]!)).trim();
}
export function renderMail(job:any) {
 const site=String(job.site||''),lang=site==='rufcut'?'en':job.lang||'en',w=copy[lang]||copy.en,p=job.payload||{};
 const from=site==='rufcut'?'Rufcut <rufcut@mrspace.online>':'Mr. Space <hello@mrspace.online>';
 let subject='',text='',links:[string,string][]=[];
 if(job.kind==='reply') {subject=String(p.subject||'').replace(/[\r\n]/g,' ').slice(0,200);text=String(p.text||'').slice(0,20000);}
 else if(job.kind==='request_link'){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.edit_key||''))throw new Error('invalid_message');
  const rw=requestCopy[lang]||requestCopy.en;subject=rw[p.revised?1:0]+' / '+String(p.name||'').slice(0,80);text=rw[3]+'\n\nv'+Number(p.version||1)+' / '+Number(p.count||0);
  links=[[rw[2],'https://mrspace.online/request/?e='+encodeURIComponent(p.edit_key)]];
 }
 else if(job.kind==='order'){
  const ow=orderCopy[lang]||orderCopy.en,staff=p.event==='staff';
  subject=(staff?ow[2]:ow[0])+' / '+String(p.ticket||'').slice(0,30);
  text=(p.event==='created'?ow[1]:staff?ow[2]:ow[5+Math.max(0,['received','in_progress','finishing','ready','completed'].indexOf(p.status))])+'\n\n'+String(p.customer_name||'')+'\n'+String(p.summary||'');
  if(staff)text+='\n'+String(p.customer_email||'')+'\n'+String(p.customer_phone||'');
  links=[[ow[staff?4:3],staff?'https://mrspace.online/panel/?site=rufcut&view=orders&ticket='+encodeURIComponent(p.ticket):'https://mrspace.online/rufcut/?ticket='+encodeURIComponent(p.ticket)+'#order']];
 }
 else {
  const index=job.kind==='welcome'?0:job.kind==='site_ready'?1:2;
  subject=w[index]+(p.name?' / '+String(p.name).replace(/[\r\n]/g,' ').slice(0,80):'');text=w[index+3];
  if(job.kind==='signin')text+='\n\n'+String(p.at||job.created_at);
  links=[[w[6],'https://mrspace.online/panel/'+(site?'?site='+encodeURIComponent(site):'')]];
  if(site&&job.kind!=='signin')links.push([w[7],'https://mrspace.online/edit/?site='+encodeURIComponent(site)]);
  if(site==='rufcut'&&job.kind!=='signin')links.push([w[8],'https://mrspace.online/rufcut/docs/rufcut-system-guide.pdf']);
 }
 if(!address(job.recipient)||!subject||!text)throw new Error('invalid_message');
 const plain=text+'\n\n'+links.map(([label,url])=>label+': '+url).join('\n');
 const html=`<!doctype html><html lang="${escape(lang)}"><body style="margin:0;background:#f4f3ed;color:#151619;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:white"><p style="font-size:12px;letter-spacing:2px">${site==='rufcut'?'RUFCUT':'MR. SPACE'}</p><h1 style="font-size:28px;line-height:1.2">${escape(subject)}</h1><p style="line-height:1.7;white-space:pre-wrap">${escape(text)}</p>${links.map(([label,url])=>`<p><a style="color:#151619" href="${escape(url)}">${escape(label)} ↗</a></p>`).join('')}<hr style="border:0;border-top:1px solid #ddd;margin-top:32px"><p style="font-size:12px;color:#555">${escape(w[9])}</p></main></body></html>`;
 const thread=job.kind==='reply'&&/^<[^<>\r\n]{1,900}>$/.test(p.in_reply_to||'')?{'In-Reply-To':p.in_reply_to,References:p.in_reply_to}:null;
 return {from,to:[address(job.recipient)!],reply_to:site==='rufcut'?'rufcut@mrspace.online':'hello@mrspace.online',subject,text:plain,html,...(thread?{headers:thread}:{})};
}
export async function verifyWebhook(req:Request,raw:string,secret:string,now=Date.now()) {
 const id=req.headers.get('svix-id')||'',stamp=req.headers.get('svix-timestamp')||'',sig=req.headers.get('svix-signature')||'';
 if(!id||id.length>200||!/^\d{10}$/.test(stamp)||Math.abs(now/1000-Number(stamp))>300||sig.length>2000||!secret.startsWith('whsec_'))return false;
 try {
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signed=new TextEncoder().encode(`${id}.${stamp}.${raw}`);
  for(const s of sig.split(' ')){if(!s.startsWith('v1,'))continue;try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(s.slice(3)),c=>c.charCodeAt(0)),signed))return true;}catch{}}
 }catch{}
 return false;
}
export async function sendQueued(db:any,config:any,transport=fetch) {
 if(!config.key)return {processed:0,setup:true};
 let processed=0;
 for(let n=0;n<3;n++){
  const claim=await db.rpc('ms_mail_claim');if(claim.error)throw new Error('claim_failed');const job=claim.data?.[0];if(!job)break;
  let provider=null,error=null,retry=false;
  try {
   if(job.payload?.event==='staff'){
    const allowed=await db.rpc('ms_mail_staff_allowed',{p_owner:job.payload.owner_email,p_site:job.site,p_to:job.recipient});
    if(allowed.error)throw new Error('access_check_failed');if(!allowed.data)throw new Error('recipient_access_revoked');
   }
   const body=job.provider_body||renderMail(job);
   const frozen=await db.rpc('ms_mail_prepare',{p_id:job.id,p_lease:job.lease,p_body:body});if(frozen.error)throw new Error('freeze_failed');
   const res=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':'ms-mail/'+job.id},body:JSON.stringify(frozen.data),signal:AbortSignal.timeout(8000)});
   if(res.ok){const data=await res.json();if(typeof data.id==='string'&&/^[0-9a-f-]{36}$/i.test(data.id))provider=data.id;else{error='provider_ack_missing';retry=true;}}
   else{error='provider_http_'+res.status;retry=res.status===429||res.status===408||res.status===409||res.status>=500;}
  }catch(e){error=['invalid_message','recipient_access_revoked'].includes((e as Error).message)?(e as Error).message:'send_uncertain';retry=!['invalid_message','recipient_access_revoked'].includes(error);}
  const done=await db.rpc('ms_mail_finish',{p_id:job.id,p_lease:job.lease,p_provider:provider,p_error:error,p_retry:retry});if(done.error||!done.data)throw new Error('receipt_not_saved');processed++;
 }
 return {processed};
}
