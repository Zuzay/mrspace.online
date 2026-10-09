// Real customer/panel JS submits to the actual Edge handlers with isolated DB doubles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {service} from './order-service-fixture.mjs';
import {base64url} from '../supabase/functions/_shared/web-push.ts';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const origin=process.env.MS_PREVIEW_ORIGIN||'http://127.0.0.1:4174',key='11111111-1111-4111-8111-111111111111';
const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),subscription={endpoint:'https://web.push.apple.com/test-device',keys:{p256dh:base64url(new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey))),auth:base64url(crypto.getRandomValues(new Uint8Array(16)))}};
const artifacts=process.env.MS_TEST_ARTIFACTS||'/private/tmp/work-order-qa';fs.mkdirSync(artifacts,{recursive:true});
let count=0;async function test(label,fn){await fn();count++;console.log('PASS '+label);}
async function fixture(lang='en',width=1440,mockPush=false){
 const context=await browser.newContext({locale:lang,viewport:{width,height:1000},reducedMotion:'reduce'}),orders=service(),notifications=service('notifications'),calls=[],errors=[];
 await context.addInitScript(lang=>localStorage.setItem('ms_lang',lang),lang);
 if(mockPush)await context.addInitScript(sub=>{
  let current=null;window.__push={requests:0,subscribes:0,unsubscribes:0};
  class Notice{}Notice.permission='default';Notice.requestPermission=async()=>{window.__push.requests++;Notice.permission='granted';return 'granted';};Object.defineProperty(window,'Notification',{value:Notice});
  const registration={active:{},pushManager:{getSubscription:async()=>current,subscribe:async()=>{window.__push.subscribes++;current={...sub,toJSON:()=>sub,unsubscribe:async()=>{window.__push.unsubscribes++;current=null;return true;}};return current;}}};
  Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration)}});
 },subscription);
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());if(u.origin===origin)return route.continue();
  if(u.hostname.endsWith('.supabase.co')){
   const body=request.postDataJSON?.();calls.push({path:u.pathname,body,method:request.method()});
   if(u.pathname.endsWith('ms-repair')||u.pathname.endsWith('ms-notifications')){
    const source=u.pathname.endsWith('ms-repair')?orders:notifications;
    const r=await source.post(body,{auth:request.headers().authorization?.includes('test-session')});return route.fulfill({status:r.status,contentType:'application/json',body:await r.text(),headers:{'Access-Control-Allow-Origin':'*'}});
   }
   let data={};if(u.pathname.endsWith('ms_my_sites'))data=[{slug:'rufcut',name:'Rufcut',url:origin+'/rufcut/',site_key:key}];
   else if(u.pathname.endsWith('ms-square'))data={connected:false};
   else if(u.pathname.endsWith('ms_workspace_snapshot'))data={sites:[]};
   else if(u.pathname.includes('/public'))data={items:[]};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  }return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 async function signIn(){await context.addInitScript(()=>localStorage.setItem('ms_panel',JSON.stringify({access_token:'test-session',expires_at:Date.now()/1000+3600,email:'owner@example.test'})));}
 return {context,page,orders,notifications,calls,errors,signIn};
}
try{
 await test('jacket Take in + Patch submits its real numbered drawing and receives a panel ticket',async()=>{
  const f=await fixture();await f.page.goto(origin+'/rufcut/repair/');await f.page.locator('#garmentSelect').selectOption('jacket');await f.page.locator('#jobs input[value=take_in]').check();await f.page.locator('#jobs input[value=patch]').check();await f.page.locator('#next').click();await f.page.locator('#customerName').fill('Jacket customer');await f.page.locator('#customerEmail').fill('jacket@example.test');await f.page.locator('#send').click();await f.page.locator('#success:not([hidden])').waitFor();assert.equal(f.orders.state.jobs.length,1);assert.match(f.orders.state.jobs[0].preview_svg,/<text/);await f.page.evaluate(async svg=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(svg);await img.decode();if(!img.naturalWidth)throw Error('Invalid stored drawing');},f.orders.state.jobs[0].preview_svg);assert.match(await f.page.locator('#ticketCode').innerText(),/^RC-/);fs.writeFileSync(artifacts+'/repair-validation.json',JSON.stringify({...f.calls.find(c=>c.body?.action==='submit').body,action:'validate'}));assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('jeans submits chosen denim to the panel, never opens a mailto URL, and failure retains the draft',async()=>{
  const f=await fixture();await f.page.goto(origin+'/rufcut/');assert.equal(await f.page.locator('#requestPair').getAttribute('href'),null);await f.page.locator('[data-k=fit] [data-v=Relaxed]').click();await f.page.locator('#requestPair').click();await f.page.locator('#pairOrder[open]').waitFor();await f.page.locator('#pairForm [name=name]').fill('Jeans customer');await f.page.locator('#pairForm [name=email]').fill('jeans@example.test');await f.page.locator('#pairForm [name=measurements]').fill('W32, fit in store');
  f.orders.state.saveFail=true;await f.page.locator('#pairForm [type=submit]').click();await f.page.locator('#pairStatus').filter({hasText:'couldn’t send'}).waitFor();assert.equal(f.orders.state.jobs.length,0);assert.equal(await f.page.locator('#pairForm [name=name]').inputValue(),'Jeans customer');
  const token=f.calls.find(c=>c.body?.action==='submit_pair').body.token;f.orders.state.saveFail=false;await f.page.locator('#pairForm [type=submit]').click();await f.page.locator('#pairReceipt:not([hidden])').waitFor();const submissions=f.calls.filter(c=>c.body?.action==='submit_pair');assert.equal(submissions[1].body.token,token);assert.equal(f.orders.state.jobs[0].kind,'jeans');assert.equal(f.orders.state.jobs[0].design.fit,'Relaxed');assert.equal(f.orders.state.jobs[0].design.measurements,'W32, fit in store');assert.equal(f.orders.state.jobs.length,1);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('five languages show the same usable customer form on mobile with both themes',async()=>{
  const headings={en:'Send your design',tr:'Tasarımını gönder',es:'Envía tu diseño',de:'Deinen Entwurf senden',fr:'Envoyer votre modèle'};
  for(const lang of Object.keys(headings)){
   const f=await fixture(lang,390);await f.page.goto(origin+'/rufcut/');await f.page.locator('#requestPair').click();await f.page.locator('#pairOrder[open]').waitFor();assert.equal(await f.page.locator('.pair-head h2').innerText(),headings[lang]);
   for(const theme of ['light','dark']){await f.page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await f.page.locator('#pairOrder').evaluate(el=>el.scrollWidth>el.clientWidth),false);}
   if(lang==='tr')await f.page.screenshot({path:artifacts+'/jeans-mobile.png'});assert.deepEqual(f.errors,[]);await f.context.close();
  }
 });
 await test('one inbox contains repairs and jeans, searches tickets, preserves notes and prints a job sheet',async()=>{
  const f=await fixture('tr',390,true);f.orders.state.jobs=[{site:'rufcut',id:crypto.randomUUID(),ticket:'RC-JACKET2',kind:'repair',customer_name:'Jacket customer',customer_email:'jacket@example.test',items:[{garment:'jacket',gender:'unisex',actions:['take_in','patch'],note:'Sleeve',preview_svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'}],status:'received',measurements:'',staff_notes:'',created_at:new Date().toISOString()},{site:'rufcut',id:crypto.randomUUID(),ticket:'RC-JEANS23',kind:'jeans',customer_name:'Jeans customer',customer_email:'jeans@example.test',design:{fit:'Relaxed',denim:'Raw'},preview_svg:'',items:[],status:'in_progress',measurements:'W32',staff_notes:'',created_at:new Date().toISOString()}];await f.signIn();await f.page.goto(origin+'/panel/?site=rufcut&view=orders');await f.page.locator('.order-ticket').first().waitFor();assert.equal(await f.page.locator('.order-ticket').count(),2);
  await f.page.locator('[data-ticket="RC-JACKET2"] summary').click();await f.page.locator('[data-repair-notes]').first().fill('Check sleeve at fitting');await f.page.locator('[data-order-filter=jeans]').click();assert.equal(await f.page.locator('.order-ticket').count(),1);await f.page.locator('[data-order-filter=all]').click();assert.equal(await f.page.locator('[data-repair-notes]').first().inputValue(),'Check sleeve at fitting');await f.page.locator('[data-ticket="RC-JACKET2"]').evaluate(el=>el.open=true);await f.page.locator('[data-repair-save]').first().click();await f.page.waitForFunction(()=>document.querySelector('[data-repair-save]')&&!document.querySelector('[data-repair-save]').disabled);assert.equal(f.orders.state.jobs[0].staff_notes,'Check sleeve at fitting');
  await f.page.locator('#orderSearch').fill('RC-JEANS23');assert.equal(await f.page.locator('.order-ticket').count(),1);await f.page.locator('[data-ticket="RC-JEANS23"] summary').click();await f.page.evaluate(()=>window.print=()=>{window.__printed=document.getElementById('print').innerText;});await f.page.locator('[data-order-print]').click();assert.match(await f.page.evaluate(()=>window.__printed),/RC-JEANS23[\s\S]*W32/);assert.match(await f.page.locator('#pageSize').textContent(),/A4/);await f.page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await f.page.locator('#print').innerHTML(),'');
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await f.page.screenshot({path:artifacts+'/inbox-mobile.png',fullPage:true});assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('install help and explicit phone permission register one device, then disable it safely',async()=>{
  const f=await fixture('tr',390,true);await f.signIn();await f.page.goto(origin+'/panel/');await f.page.locator('[data-app-install]').click();await f.page.locator('.panel-install-dialog[open]').waitFor();assert.match(await f.page.locator('.panel-install-dialog').innerText(),/Ana ekrana ekle/);await f.page.locator('.panel-install-dialog button').click();await f.page.locator('.panel-alerts summary').click();await f.page.locator('[data-app-push]:not(:disabled)').waitFor();assert.equal(await f.page.evaluate(()=>window.__push.requests),0);await f.page.locator('[data-app-push]').click();await f.page.locator('[data-app-status]').filter({hasText:'bildirimler açık'}).waitFor();assert.equal(await f.page.evaluate(()=>window.__push.requests),1);assert.equal(f.notifications.state.subscriptions.length,1);assert.equal(f.notifications.state.subscriptions[0].enabled,true);await f.page.locator('[data-app-push]').click();await f.page.locator('[data-app-status]').filter({hasText:'bildirimler kapalı'}).waitFor();assert.equal(f.notifications.state.subscriptions[0].enabled,false);assert.equal(await f.page.evaluate(()=>window.__push.unsubscribes),1);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('real manifest and service worker use panel scope without caching customer/API responses',async()=>{
  const f=await fixture();await f.signIn();await f.page.goto(origin+'/panel/');await f.page.waitForFunction(()=>navigator.serviceWorker.controller);const data=await f.page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();const m=await(await fetch('manifest.webmanifest')).json();return {scope:r.scope,manifest:m,caches:await caches.keys()};});assert.equal(data.scope,origin+'/panel/');assert.equal(data.manifest.display,'standalone');assert.equal(data.manifest.scope,'/panel/');assert.deepEqual(data.caches,[]);for(const icon of data.manifest.icons){const response=await f.context.request.get(origin+'/panel/'+icon.src);assert.equal(response.status(),200);}assert.deepEqual(f.errors,[]);await f.context.close();
 });
 console.log(`${count} work-order browser groups passed; live APIs were blocked`);
}finally{await browser.close();}
