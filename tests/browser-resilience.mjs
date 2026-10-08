// Isolated HTTP fixture + real Chrome. All external APIs are intercepted; no live writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const sdk=fs.readFileSync(process.env.MS_SUPABASE_UMD,'utf8');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{const body=fs.readFileSync(file),type=({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(body);}catch(_){res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const key='11111111-1111-4111-8111-111111111111',selector='[data-p="content.business.name"]';
let passed=0;
const artifacts=process.env.MS_TEST_ARTIFACTS||'/private/tmp/mrspace-validation';fs.mkdirSync(artifacts,{recursive:true});
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function document(name='Server shop'){return {lang:'tr',business:{name,hours:[],socials:{}},sections:[{type:'hero',title:name}]};}
async function fixture({lang='tr',trial=false,admin=false,storageFail=false}={}){
 const context=await browser.newContext({viewport:{width:390,height:844},locale:lang}),calls=[],errors=[];
 let status='draft',id=7,content=document(),failSave=true,delay=null,lostAck=false;
 const canonical=value=>JSON.parse(JSON.stringify(value,(_,row)=>row && typeof row==='object' && !Array.isArray(row)?Object.keys(row).sort().reduce((result,key)=>{result[key]=row[key];return result;},Object.create(null)):row));
 await context.addInitScript(({lang,storageFail})=>{localStorage.setItem('ms_lang',lang);if(storageFail)Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};},{lang,storageFail});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===origin)return route.continue();
  if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:sdk});
  if(url.hostname.endsWith('.supabase.co')){
   const body=req.postDataJSON?.();calls.push({path:url.pathname,body});let data=null,code=200;
   if(/ms_builder_get$/.test(url.pathname))data={site:{slug:'test',name:content.business.name,mode:'builder'},build:{id,status,content,theme:{preset:'commerce'}}};
   else if(/ms_trial_get$/.test(url.pathname))data={content,theme:{preset:'commerce'},status,sector:'cafe'};
   else if(/ms_builder_save$|ms_trial_save$/.test(url.pathname)){if(delay)await delay;if(lostAck)content=canonical(body.p_content);if(failSave){code=503;data={message:'not_saved'};}else{content=body.p_content;data={ok:true};}}
   else if(/ms_builder_submit$|ms_trial_submit$/.test(url.pathname)){status=trial?'submitted':'checking';data={ok:true};}
   else{code=401;data={message:'unauthorized'};}
   return route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  }return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.type()==='beforeunload'?d.accept():d.dismiss());
 const url=origin+'/build/?'+(admin?'b=7':trial?'t='+key:'k='+key);
 return {context,page,calls,errors,url,setSave:(fail)=>{failSave=fail;},setServer:(name,newStatus='draft',newId=7)=>{content=document(name);status=newStatus;id=newId;},setDelay:p=>{delay=p;},setLostAck:()=>{lostAck=true;}};
}
const drafts=page=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ms-device-draft:')).map(k=>({key:k,row:JSON.parse(localStorage.getItem(k))})));
try{
 await test('client and trial drafts survive failed saves and require explicit recovery after reload',async()=>{
  for(const trial of [false,true]){
   const f=await fixture({trial});await f.page.goto(f.url);await f.page.locator(selector).fill('Device edit');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Bu cihazda saklandı');
   let rows=await drafts(f.page);assert.equal(rows.length,1);assert.equal(rows[0].row.value.content.business.name,'Device edit');assert.ok(!JSON.stringify(rows).includes(key));
   f.setServer('Changed on server');await f.page.reload();await f.page.getByRole('button',{name:'Taslağımı geri yükle',exact:true}).waitFor();assert.equal(await f.page.locator(selector).inputValue(),'Changed on server');assert.equal(await f.page.locator(selector).isDisabled(),true);assert.equal(await f.page.locator('[data-act="view"]').first().isEnabled(),true);
   const count=f.calls.filter(c=>/ms_builder_save$|ms_trial_save$/.test(c.path)).length;await f.page.waitForTimeout(1050);assert.equal(f.calls.filter(c=>/ms_builder_save$|ms_trial_save$/.test(c.path)).length,count);
   f.setSave(false);await f.page.getByRole('button',{name:'Taslağımı geri yükle',exact:true}).click();await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Kaydedildi');assert.equal(await f.page.locator(selector).inputValue(),'Device edit');assert.equal((await drafts(f.page)).length,0);assert.deepEqual(f.errors,[]);await f.context.close();
  }
 });
 await test('lost acknowledgement reconciles with the server regardless of JSON key order',async()=>{
  const f=await fixture();f.setLostAck();await f.page.goto(f.url);await f.page.locator(selector).fill('Saved despite lost response');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Bu cihazda saklandı');assert.equal((await drafts(f.page)).length,1);await f.page.reload();await f.page.locator(selector).waitFor();assert.equal(await f.page.locator(selector).inputValue(),'Saved despite lost response');assert.equal((await drafts(f.page)).length,0);assert.equal(await f.page.getByRole('button',{name:'Taslağımı geri yükle',exact:true}).count(),0);assert.equal(f.calls.filter(c=>/ms_builder_save$/.test(c.path)).length,1);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('disconnect protects edits; reconnect requires server recheck and mobile recovery has no overflow',async()=>{
  const f=await fixture();await f.page.goto(f.url);await f.page.locator(selector).waitFor();await f.context.setOffline(true);await f.page.locator(selector).fill('Offline edit');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Bu cihazda saklandı');assert.equal(f.calls.some(c=>/ms_builder_save$/.test(c.path)),false);
  await f.context.setOffline(false);await f.page.getByText('Bağlantı geri geldi.',{exact:false}).waitFor();await f.page.waitForTimeout(1000);assert.equal(f.calls.some(c=>/ms_builder_save$/.test(c.path)),false);
  await f.page.getByRole('button',{name:'Bağlanıp yeniden yükle',exact:true}).click();await f.page.getByRole('button',{name:'Taslağımı geri yükle',exact:true}).waitFor();assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await f.page.screenshot({path:artifacts+'/builder-device-recovery-mobile.png',fullPage:true});assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('choosing server version clears only the pending draft and issues no write',async()=>{
  const f=await fixture();await f.page.goto(f.url);await f.page.locator(selector).fill('Not to restore');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Bu cihazda saklandı');await f.page.reload();await f.page.getByRole('button',{name:'Sunucudaki sürümü kullan',exact:true}).waitFor();const count=f.calls.filter(c=>/ms_builder_save$/.test(c.path)).length;await f.page.getByRole('button',{name:'Sunucudaki sürümü kullan',exact:true}).click();assert.equal((await drafts(f.page)).length,0);assert.equal(f.calls.filter(c=>/ms_builder_save$/.test(c.path)).length,count);assert.equal(await f.page.locator(selector).inputValue(),'Server shop');await f.context.close();
 });
 await test('storage failure is visible and never claims that a draft is saved on device',async()=>{
  const f=await fixture({storageFail:true});await f.page.goto(f.url);await f.page.locator(selector).fill('Not persisted');await f.page.getByText('Cihaz depolaması kullanılamıyor',{exact:false}).waitFor();await f.page.waitForTimeout(1100);assert.notEqual(await f.page.locator('#saved').innerText(),'Bu cihazda saklandı');assert.equal((await drafts(f.page)).length,0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('old server acknowledgement cannot remove edits made while the request was in flight',async()=>{
  const f=await fixture();f.setSave(false);let release;f.setDelay(new Promise(resolve=>{release=resolve;}));await f.page.goto(f.url);await f.page.locator(selector).fill('First edit');await f.page.waitForTimeout(1100);await f.page.locator(selector).fill('Newer edit');release();await f.page.waitForTimeout(200);const rows=await drafts(f.page);assert.equal(rows[0].row.value.content.business.name,'Newer edit');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Kaydedildi');assert.equal((await drafts(f.page)).length,0);await f.context.close();
 });
 await test('submitted or replaced server version keeps a downloadable draft and prohibits restoration',async()=>{
  for(const [status,id] of [['checking',7],['draft',8]]){
   const f=await fixture();await f.page.goto(f.url);await f.page.locator(selector).fill('Preserved');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Bu cihazda saklandı');f.setServer('Server shop',status,id);await f.page.reload();await f.page.getByRole('button',{name:'Cihaz taslağını indir',exact:true}).waitFor();assert.equal(await f.page.getByRole('button',{name:'Taslağımı geri yükle',exact:true}).count(),0);assert.equal((await drafts(f.page)).length,1);await f.context.close();
  }
 });
 await test('draft store handles expiry, oversize, malformed records and concurrent acknowledgement safely',async()=>{
  const f=await fixture();await f.page.goto(f.url);await f.page.locator(selector).waitFor();await f.page.evaluate(async()=>{
   const check=(value,label)=>{if(!value)throw new Error(label);},store=await MsDrafts.open('test-workspace','test-identity'),first=store.write({text:'first'}),second=store.write({text:'second'});
   check(!store.clear(first.revision),'stale acknowledgement');check(store.read().value.text==='second','latest edit');check(store.clear(second.revision),'latest acknowledgement');
   check(!store.write({text:'x'.repeat(600000)}).ok,'byte limit');store.write({text:'expired'});
   const key=Object.keys(localStorage).find(k=>k.startsWith('ms-device-draft:')),row=JSON.parse(localStorage.getItem(key));row.at=Date.now()-MsDrafts.ttl-1;localStorage.setItem(key,JSON.stringify(row));check(store.read().value===null,'expiry');
   localStorage.setItem(key,'{');check(!store.read().ok,'malformed JSON');check(localStorage.getItem(key)==='{','corrupt record preserved');
  });await f.context.close();
 });
 await test('all five languages translate recovery notices, with light and dark mobile layouts',async()=>{
  const labels=['Restore my draft','Taslağımı geri yükle','Restaurar mi borrador','Meinen Entwurf wiederherstellen','Restaurer mon brouillon'];
  for(const [i,lang] of ['en','tr','es','de','fr'].entries()){
   const f=await fixture({lang});await f.page.emulateMedia({colorScheme:i%2?'dark':'light'});await f.page.goto(f.url);await f.page.locator(selector).fill('Draft');await f.page.waitForTimeout(1100);await f.page.reload();await f.page.getByRole('button',{name:labels[i],exact:true}).waitFor();assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(f.errors,[]);await f.context.close();
  }
 });
 await test('local preview keeps saving on the device while offline without a server request',async()=>{
  const f=await fixture();await f.page.goto(origin+'/build/?preview=1');await f.page.locator(selector).waitFor();await f.context.setOffline(true);await f.page.locator(selector).fill('Local offline preview');await f.page.waitForFunction(()=>document.getElementById('saved')?.textContent==='Kaydedildi');assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem('ms-builder-local-preview')).content.business.name),'Local offline preview');assert.equal(f.calls.length,0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('unauthorized admin load stores no private draft or credentials',async()=>{
  const f=await fixture({admin:true});await f.page.goto(f.url);await f.page.waitForTimeout(500);assert.equal((await drafts(f.page)).length,0);assert.equal(f.calls.some(c=>/ms_builder_save$/.test(c.path)),false);await f.context.close();
 });
 console.log(`${passed} browser resilience groups passed; no live writes.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
