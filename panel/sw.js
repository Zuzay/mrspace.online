/* Panel notifications only. No account data, API responses or work orders are cached. */
'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 let url;try{url=new URL(String(data.url||'/panel/'),self.location.origin);}catch{url=new URL('/panel/',self.location.origin);}
 const target=url.origin===self.location.origin&&url.pathname==='/panel/'?url.href:self.location.origin+'/panel/';
 event.waitUntil(self.registration.showNotification(String(data.title||'Mr. Space').slice(0,120),{body:String(data.body||'').slice(0,240),icon:'/panel/icons/icon-192.png',badge:'/panel/icons/icon-192.png',tag:String(data.tag||'mrspace-panel').slice(0,60),data:{url:target}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'/panel/',self.location.origin);
 const target=url.origin===self.location.origin&&url.pathname==='/panel/'?url.href:self.location.origin+'/panel/';
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const found=windows.find(c=>new URL(c.url).pathname==='/panel/');if(found){await found.navigate(target);return found.focus();}return self.clients.openWindow(target);})());
});
// A generic offline screen carries no cached customer information.
const offline={en:['You’re offline','Reconnect to see the latest work orders.','Retry'],tr:['Bağlantı yok','Güncel iş emirlerini görmek için yeniden bağlan.','Tekrar dene'],es:['Sin conexión','Conéctate para ver las órdenes actuales.','Reintentar'],de:['Offline','Verbinde dich, um aktuelle Aufträge zu sehen.','Erneut versuchen'],fr:['Hors ligne','Reconnectez-vous pour voir les bons actuels.','Réessayer']};
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.mode!=='navigate'||url.pathname!=='/panel/')return;
 const chosen=url.searchParams.get('lang')||navigator.language.slice(0,2),lang=offline[chosen]?chosen:'en',copy=offline[lang];
 event.respondWith(fetch(event.request).catch(()=>new Response(`<!doctype html><html lang="${lang}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mr. Space</title><style>body{margin:0;background:#101318;color:#f5f2e9;font:17px/1.6 system-ui;padding:12vh 24px;max-width:520px}a{color:#f6b93b;display:inline-block;padding:14px 0}h1{font-size:38px}</style><p>MR. SPACE</p><h1>${copy[0]}</h1><p>${copy[1]}</p><a href="/panel/?lang=${lang}">${copy[2]} ↗</a></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
