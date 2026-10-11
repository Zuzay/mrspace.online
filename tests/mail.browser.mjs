// All HTTP and API requests are intercepted. Uses actual Chrome and shipped files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const root=fileURLToPath(new URL('../',import.meta.url)),origin='https://mrspace.online',partner='https://heronca.com',key='11111111-1111-4111-8111-111111111111';
const artifacts=process.env.MS_TEST_ARTIFACTS||'/private/tmp/mrspace-mail-qa';fs.mkdirSync(artifacts,{recursive:true});
let count=0;const test=async(label,fn)=>{await fn();count++;console.log('PASS '+label);};
async function fixture(lang='tr',width=390){
 const context=await browser.newContext({viewport:{width,height:900},locale:lang,reducedMotion:'reduce'}),errors=[],calls=[];
 const state={failQueue:false,seen:new Set(),settings:{enabled:false,domain_verified_at:null,daily_limit:50},messages:[],inbox:[{id:key,recipient:'rufcut@mrspace.online',sender:'Customer <customer@example.test>',subject:'An order question',received_at:new Date().toISOString()}]};
 await context.addInitScript(({lang})=>{localStorage.setItem('ms_lang',lang);localStorage.setItem('ms_admin',JSON.stringify({access_token:'fixture-session',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600}));},{lang});
 const publicHTML=`<!doctype html><html><head><style>body{font:18px Arial;margin:20px}#grid{min-height:50px}</style><script src="${origin}/assets/ms-editor-bridge.js?v=1" defer></script></head><body><section id="hero" data-ms-section="intro"><h1 data-ms-field="hero-title">Heron CA storefront</h1><p>Original shop story</p><img src="${origin}/assets/home/heron-site.webp" width="160"></section><div id="grid"><p>A live catalog product</p></div><form><input value="private form value"></form><script>window.marker='scripts must not export';</script></body></html>`;
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  if(u.hostname.endsWith('.supabase.co')){
   if(req.method()==='OPTIONS')return route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});
   const b=JSON.parse(req.postData()||'{}');calls.push({path:u.pathname,body:b});
   if(u.pathname.endsWith('ms_mail_status'))return json({settings:state.settings,sites:[{slug:'rufcut',name:'Rufcut',contact:'customer@example.test',members:[]}],messages:state.messages,inbox:state.inbox});
   if(u.pathname.endsWith('ms_mail_inbox_read'))return json({...state.inbox[0],reply_address:'reply@example.test',body:'<img src=x onerror=window.hacked=1>\nPlease help with my order.',attachment_count:1});
   if(u.pathname.endsWith('ms_client_view'))return json(state.rufcut?{name:'Rufcut',url:origin+'/rufcut/'}:{name:'Heron CA',url:partner+'/'});
   if(u.pathname.endsWith('ms_workspace_link'))return json({slug:'rufcut',name:'Rufcut',url:origin+'/rufcut/'});
   if(u.pathname.endsWith('ms-mail')){
    if(b.action==='status')return json({keyConfigured:false,webhookConfigured:false});
    if(b.action==='preview')return json({from:'Rufcut <rufcut@mrspace.online>',recipient:'customer@example.test',subject:'Your site is ready',text:'Open your panel: https://mrspace.online/panel/?site=rufcut\nOpen the editor: https://mrspace.online/edit/?site=rufcut',digest:'fixture-digest'});
    if(b.action==='queue'||b.action==='reply'){
     if(!state.seen.has(b.token)){state.seen.add(b.token);state.messages.push({id:key,site:'rufcut',kind:b.kind||'reply',recipient:b.action==='reply'?'reply@example.test':'customer@example.test',lang,status:'queued',attempts:0,created_at:new Date().toISOString()});}
     if(state.failQueue){state.failQueue=false;return json({error:'mail_service_unavailable'},503);}return json({queued:true,id:key});
    }
   }return json({error:'unhandled_test_route'},500);
  }
  if(u.origin===partner)return route.fulfill({contentType:'text/html',body:publicHTML});
  if((u.origin===origin||u.origin==='https://attacker.example')&&u.pathname==='/bridge-host.html')return route.fulfill({contentType:'text/html',body:`<iframe src="${partner}${u.searchParams.get('private')?'/admin.html':'/'}"></iframe><script>window.replies=[];addEventListener('message',e=>{if(e.data?.type==='ms:editor:snapshot:result')replies.push(e.data)});</script>`});
  if(u.origin===origin){
   let file=path.join(root,decodeURIComponent(u.pathname));if(!path.extname(file))file=path.join(file,'index.html');
   if(!file.startsWith(root))return route.abort();
   try{const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'};return route.fulfill({body:fs.readFileSync(file),contentType:types[ext]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:'test file not found'});}
  }return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,state,calls,errors};
}
try{
 await test('email center works in five languages at 320/390/1440px and both themes without overflow or fake delivery',async()=>{
  for(const lang of ['en','tr','es','de','fr'])for(const width of [320,390,1440]){
   const f=await fixture(lang,width);await f.page.goto(origin+'/admin/mail/');await f.page.locator('#compose').waitFor();
   assert.equal(await f.page.locator('#toggle').isDisabled(),true);assert.equal(await f.page.locator('#dispatch').isDisabled(),true);
   for(const colorScheme of ['light','dark']){await f.page.emulateMedia({colorScheme});assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${lang} ${width} ${colorScheme}`);}
   if(lang==='tr'&&width!==320)await f.page.screenshot({path:artifacts+'/mail-'+width+'.png',fullPage:true});assert.deepEqual(f.errors,[]);await f.context.close();
  }
 });
 await test('human preview precedes queueing, a lost acknowledgement reuses its token, and queued never reads delivered',async()=>{
  const f=await fixture();await f.page.goto(origin+'/admin/mail/');await f.page.locator('#compose').waitFor();
  await f.page.selectOption('[name=kind]','site_ready');await f.page.locator('#compose button').click();await f.page.locator('#queue').waitFor();
  assert.match(await f.page.locator('#preview').innerText(),/rufcut@mrspace.online/);assert.equal(f.calls.some(c=>c.body.action==='queue'),false);
  f.state.failQueue=true;await f.page.locator('#queue').click();await f.page.locator('#status').filter({hasText:'İşlem doğrulanamadı'}).waitFor();await f.page.locator('#queue').click();await f.page.locator('.mail-state').waitFor();
  const sent=f.calls.filter(c=>c.body.action==='queue');assert.equal(sent.length,2);assert.equal(sent[0].body.token,sent[1].body.token);assert.equal(sent[0].body.digest,'fixture-digest');assert.equal(f.state.messages.length,1);assert.equal(await f.page.locator('.mail-state').innerText(),'Kuyrukta');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('received content stays inert and replies show the real Reply-To address',async()=>{
  const f=await fixture();await f.page.goto(origin+'/admin/mail/');await f.page.locator('[data-read]').click();await f.page.locator('textarea[name=reply]').waitFor();
  assert.match(await f.page.locator('.mail-message').innerText(),/onerror=window.hacked/);assert.equal(await f.page.evaluate(()=>window.hacked),undefined);assert.match(await f.page.locator('[data-message] label').innerText(),/reply@example.test/);
  await f.page.locator('textarea[name=reply]').fill('We will check your order.');await f.page.locator('[data-message] form button').click();await f.page.locator('.mail-state').waitFor();assert.equal(f.calls.find(c=>c.body.action==='reply').body.text,'We will check your order.');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('Rufcut ignores Turkish browser and studio preferences in public pages, repair drafts and both editors',async()=>{
  const f=await fixture('tr',390);f.state.rufcut=true;
  await f.page.goto(origin+'/rufcut/');await f.page.waitForFunction(()=>window.MSI18N?.lang==='en');assert.equal(await f.page.locator('#msLang').count(),0);assert.match(await f.page.locator('footer').innerText(),/This website is a Mr. Space product/);
  await f.page.goto(origin+'/rufcut/repair/?lang=tr');await f.page.locator('#garmentSelect').waitFor();assert.equal(await f.page.locator('html').getAttribute('lang'),'en');assert.equal(await f.page.locator('#language option').count(),1);
  await f.page.goto(origin+'/edit/?k='+key);await f.page.locator('.visual-entry').waitFor();assert.match(f.page.url(),/site=rufcut/);assert.equal(await f.page.locator('html').getAttribute('lang'),'en');
  await f.page.goto(origin+'/request/?k='+key);await f.page.locator('.area-button').first().waitFor({state:'attached'});assert.match(f.page.url(),/site=rufcut/);assert.equal(await f.page.locator('html').getAttribute('lang'),'en');assert.equal(await f.page.locator('#editorLang option').count(),1);
  await f.page.goto(origin+'/panel/?site=rufcut&demo=1');await f.page.locator('#app').waitFor();assert.equal(await f.page.locator('html').getAttribute('lang'),'en');assert.equal(await f.page.locator('#msLang').count(),0);
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('ms_lang')),'tr');await f.page.goto(origin+'/');await f.page.waitForFunction(()=>window.MSI18N?.lang==='tr');await f.context.close();
 });
 await test('partner bridge exports public DOM only to the actual Mr. Space parent and removes executable/private fields',async()=>{
  const f=await fixture();await f.page.goto(origin+'/bridge-host.html');const nonce=crypto.randomUUID();
  await f.page.evaluate(({nonce,partner})=>document.querySelector('iframe').contentWindow.postMessage({type:'ms:editor:snapshot',nonce},partner),{nonce,partner});
  await f.page.waitForFunction(()=>window.replies.length===1);const result=await f.page.evaluate(()=>window.replies[0]);assert.equal(result.nonce,nonce);assert.match(result.html,/Heron CA storefront/);assert.ok(!result.html.includes('<script'));assert.ok(!result.html.includes('private form value'));assert.match(result.html,/id="grid" data-ms-skip/);
  await f.page.goto('https://attacker.example/bridge-host.html');await f.page.evaluate(({nonce,partner})=>document.querySelector('iframe').contentWindow.postMessage({type:'ms:editor:snapshot',nonce},partner),{nonce,partner});await f.page.waitForTimeout(250);assert.equal(await f.page.evaluate(()=>window.replies.length),0);
  await f.page.goto(origin+'/bridge-host.html?private=1');await f.page.evaluate(({nonce,partner})=>document.querySelector('iframe').contentWindow.postMessage({type:'ms:editor:snapshot',nonce},partner),{nonce,partner});await f.page.waitForTimeout(250);assert.equal(await f.page.evaluate(()=>window.replies.length),0);await f.context.close();
 });
 await test('cross-domain Heron opens in the shared editor as a script-free snapshot; native catalog stays excluded',async()=>{
  const f=await fixture('en',1440);await f.page.goto(origin+'/request/?k='+key);await f.page.locator('.area-button').first().waitFor();
  assert.equal(await f.page.locator('#site').getAttribute('sandbox'),'allow-same-origin');assert.match(await f.page.locator('#contextBar').innerText(),/Page snapshot/);
  await f.page.locator('#search').fill('Heron CA storefront');await f.page.locator('.area-button').first().click();await f.page.locator('#content').fill('A revised Heron heading');await f.page.locator('#saveField').click();
  assert.equal(await f.page.frameLocator('#site').locator('h1').innerText(),'A revised Heron heading');assert.equal(await f.page.frameLocator('#site').locator('script').count(),0);assert.equal(await f.page.frameLocator('#site').locator('form').count(),0);
  await f.page.locator('#backAreas').click();await f.page.locator('#search').fill('A live catalog product');assert.equal(await f.page.locator('.area-button').count(),0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
}finally{await browser.close();}
console.log(`${count} mail and cross-domain editor Chrome groups passed; all requests intercepted`);
