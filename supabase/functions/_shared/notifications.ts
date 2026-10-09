import { vapidKey, sendPush } from './web-push.ts';
// Kept on the server. Browsers receive only the public signing key and their own settings.
export async function memberEmail(db: any, email: string, site: string) {
 const admin=await db.from('ms_admins').select('email').eq('email',email).maybeSingle();if(admin.error)throw new Error('access_check_failed');if(admin.data)return true;
 const viewer=await db.from('ms_viewers').select('until').eq('email',email).maybeSingle();if(viewer.error)throw new Error('access_check_failed');if(viewer.data&&(!viewer.data.until||viewer.data.until>=new Date().toISOString().slice(0,10)))return false;
 const member=await db.from('ms_site_users').select('email').eq('email',email).eq('site',site).maybeSingle();if(member.error)throw new Error('access_check_failed');return !!member.data;
}
export async function staffUser(db: any,req: Request,site: string) {
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return null;
 const user=await db.auth.getUser(token);const email=user.data?.user?.email?.toLowerCase();if(user.error||!email)return null;
 return await memberEmail(db,email,site)?email:null;
}
export async function notificationConfig(db: any,initialize=false) {
 let result=await db.rpc('ms_notification_secrets',{});if(result.error)throw new Error('notification_setup_needed');
 if(initialize&&!result.data?.vapid){result=await db.rpc('ms_notification_secrets',{p_vapid:await vapidKey()});if(result.error)throw new Error('notification_setup_needed');}
 return {vapid:result.data?.vapid,emailKey:Deno.env.get('RESEND_API_KEY')||result.data?.resend_key||'',emailFrom:Deno.env.get('RESEND_FROM_EMAIL')||result.data?.resend_from||''};
}
export async function mail(config: any,to: string,subject: string,text: string) {
 if(!config.emailKey||!config.emailFrom)return false;
 const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.emailKey,'Content-Type':'application/json'},body:JSON.stringify({from:config.emailFrom,to:[to],subject,text}),signal:AbortSignal.timeout(8000)});
 return result.ok;
}
const words:Record<string,string[]>={en:['New repair work order','New jeans design','Open the work order in your panel.'],tr:['Yeni tamir iş emri','Yeni jeans tasarımı','İş emrini panelinde aç.'],es:['Nueva orden de reparación','Nuevo diseño de jeans','Abre la orden en tu panel.'],de:['Neuer Reparaturauftrag','Neuer Jeansentwurf','Öffne den Auftrag in deinem Panel.'],fr:['Nouvelle retouche','Nouveau modèle de jeans','Ouvrez la fiche dans votre panneau.']};
export async function notifyOrder(db: any,order: any,ticket: string) {
 const config=await notificationConfig(db),site=order.site,kind=order.kind;
 const url='https://mrspace.online/panel/?site='+encodeURIComponent(site)+'&view=orders&ticket='+encodeURIComponent(ticket);
 const summary=kind==='jeans'?Object.entries(order.design).map(([k,v])=>k+': '+String(v)).join('\n'):
 order.items.map((it:any,i:number)=>`${i+1}. ${it.garment} (${it.gender}): ${it.actions.join(', ')}${it.inches?' / '+it.inches+' in':''}${it.note?'\n'+it.note:''}`).join('\n\n');
 const preferences=await db.from('ms_notification_preferences').select('owner_email,delivery_email,email_enabled,lang').eq('site',site);if(preferences.error)throw new Error('preferences_unavailable');
 const members=[];for(const pref of preferences.data||[])if(await memberEmail(db,pref.owner_email,site))members.push(pref);
 const recipients=new Set<string>();if(site==='rufcut'&&!members.some(p=>p.delivery_email==='shop@rufcut.com'&&!p.email_enabled))recipients.add('shop@rufcut.com');
 members.filter(p=>p.email_enabled).forEach(p=>recipients.add(p.delivery_email));
 const text=`Ticket: ${ticket}\nCustomer: ${order.customer_name}\nEmail: ${order.customer_email}\nPhone: ${order.customer_phone||''}\n\n${summary}\n\n${url}`;
 const emailResults=await Promise.allSettled([mail(config,order.customer_email,`Rufcut ${kind==='jeans'?'jeans':'repair'} ticket ${ticket}`,`Hi ${order.customer_name},\n\nYour request reached Rufcut.\nTicket: ${ticket}\n\n${summary}\n\nTrack it at https://mrspace.online/rufcut/?ticket=${encodeURIComponent(ticket)}#order`),...Array.from(recipients,to=>mail(config,to,`Rufcut / ${kind==='jeans'?'New jeans design':'New repair order'} / ${ticket}`,text))]);
 const emailSent=emailResults.every(r=>r.status==='fulfilled'&&r.value===true);
 if(emailSent)await db.from('ms_repair_jobs').update({email_sent:true}).eq('site',site).eq('ticket',ticket);
 if(config.vapid){
  const subs=await db.from('ms_push_subscriptions').select('endpoint,p256dh,auth,owner_email,lang').eq('site',site).eq('enabled',true).limit(100);
  if(subs.error)throw new Error('subscriptions_unavailable');
  await Promise.allSettled((subs.data||[]).map(async(sub:any)=>{
   if(!await memberEmail(db,sub.owner_email,site)){await db.from('ms_push_subscriptions').update({enabled:false}).eq('site',site).eq('endpoint',sub.endpoint);return;}
   const copy=words[sub.lang]||words.en;
   const result=await sendPush(sub,{title:'Rufcut / '+copy[kind==='jeans'?1:0],body:ticket+' · '+copy[2],url,tag:ticket},config.vapid);
   if(result.expired)await db.from('ms_push_subscriptions').update({enabled:false}).eq('site',site).eq('endpoint',sub.endpoint);
  }));
 }
 return {emailSent};
}
