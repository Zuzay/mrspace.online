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
 const ready=await db.rpc('ms_mail_transport_ready');
 return {vapid:result.data?.vapid,emailReady:!ready.error&&ready.data===true&&!!(Deno.env.get('RESEND_API_KEY')||result.data?.resend_key)};
}
const words:Record<string,string[]>={en:['New repair work order','New jeans design','Open the work order in your panel.'],tr:['Yeni tamir iş emri','Yeni jeans tasarımı','İş emrini panelinde aç.'],es:['Nueva orden de reparación','Nuevo diseño de jeans','Abre la orden en tu panel.'],de:['Neuer Reparaturauftrag','Neuer Jeansentwurf','Öffne den Auftrag in deinem Panel.'],fr:['Nouvelle retouche','Nouveau modèle de jeans','Ouvrez la fiche dans votre panneau.']};
export async function notifyOrder(db: any,order: any,ticket: string) {
 const config=await notificationConfig(db),site=order.site,kind=order.kind;
 const url='https://mrspace.online/panel/?site='+encodeURIComponent(site)+'&view=orders&ticket='+encodeURIComponent(ticket);
 // E-posta, iş emriyle aynı SQL işleminde kalıcı kuyruğa alınır.
 // Burada kabul/teslim bilgisi üretmeyiz; Web Push ayrı devam eder.
 const emailSent=false;
 if(config.vapid){
  const subs=await db.from('ms_push_subscriptions').select('endpoint,p256dh,auth,owner_email,lang').eq('site',site).eq('enabled',true).limit(100);
  if(subs.error)throw new Error('subscriptions_unavailable');
  await Promise.allSettled((subs.data||[]).map(async(sub:any)=>{
   if(!await memberEmail(db,sub.owner_email,site)){await db.from('ms_push_subscriptions').update({enabled:false}).eq('site',site).eq('endpoint',sub.endpoint);return;}
   const copy=site==='rufcut'?words.en:words[sub.lang]||words.en;
   const result=await sendPush(sub,{title:'Rufcut / '+copy[kind==='jeans'?1:0],body:ticket+' · '+copy[2],url,tag:ticket},config.vapid);
   if(result.expired)await db.from('ms_push_subscriptions').update({enabled:false}).eq('site',site).eq('endpoint',sub.endpoint);
  }));
 }
 return {emailSent};
}
