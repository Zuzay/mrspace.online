// Every external/API request is intercepted. No customer request or photo is sent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const origin=process.env.MS_PREVIEW_ORIGIN||'http://127.0.0.1:4174';
const key='11111111-1111-4111-8111-111111111111',edit='22222222-2222-4222-8222-222222222222';
const sb='https://tizfdnsjhhepxnqqrzuk.supabase.co';
const photo=fs.readFileSync(new URL('../rufcut/media/rufcut-detail-800.webp',import.meta.url));
const artifacts=process.env.MS_TEST_ARTIFACTS||'/private/tmp/request-editor-qa';fs.mkdirSync(artifacts,{recursive:true});
let passed=0;
async function test(label,fn){await fn();passed++;console.log('PASS '+label);}
async function fixture(lang='tr',width=1440,mode='key'){
 const context=await browser.newContext({viewport:{width,height:1000},locale:lang,reducedMotion:'reduce'}),calls=[],errors=[];
 await context.addInitScript(lang=>localStorage.setItem('ms_lang',lang),lang);
 const state={uploadFails:false,sendFails:false,submission:{site:'Rufcut',version:1,name:'Tester',email:'test@example.com',url:origin+'/rufcut/',items:[]}};
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===origin)return route.continue();
  if(u.hostname.endsWith('.supabase.co')){
   calls.push({path:u.pathname,body:req.postData()});const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
   if(u.pathname.endsWith('ms_client_view'))return send({name:'Rufcut',url:origin+'/rufcut/'});
   if(u.pathname.endsWith('ms_get_submission'))return send(state.submission);
   if(u.pathname.endsWith('ms_submit')||u.pathname.endsWith('ms_revise'))return state.sendFails?send({error:'offline'},503):send({ok:true,edit_key:edit,changed:true,version:2});
   if(u.pathname.includes('/storage/v1/'))return route.fulfill({contentType:'image/webp',body:photo});
   if(u.pathname.endsWith('ms-builder'))return state.uploadFails?send({error:'upload'},500):send({url:sb+'/storage/v1/object/public/ms-media/rufcut/test.webp'});
  }return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/request/?'+(mode==='edit'?'e='+edit:'k='+key));await page.locator('.area-button').first().waitFor({state:'attached'});
 async function choose(query){if(width<=640&&!await page.locator('#search').isVisible())await page.locator('#areasToggle').click();await page.locator('#search').fill(query);await page.locator('.area-button').first().click();await page.locator('#content').waitFor();}
 return{context,page,calls,errors,state,choose};
}
try{
 await test('five browser languages keep Rufcut editor English with named photos and no overflow',async()=>{
  const labels=Object.fromEntries(['en','tr','es','de','fr'].map(lang=>[lang,['Opening photo','Workshop photo']]));
  for(const lang of Object.keys(labels))for(const width of [320,390,1440]){
   const f=await fixture(lang,width);assert.equal(await f.page.locator('html').getAttribute('lang'),'en');await f.page.emulateMedia({colorScheme:'dark'});
   for(const label of labels[lang]){await f.choose(label);assert.equal(await f.page.locator('#sidebarTitle').innerText(),label);assert.match(await f.page.locator('#contextBar').innerText(),new RegExp(label));assert.equal(await f.page.locator('#photoFile').count(),1);await f.page.locator('#backAreas').click();}
   for(const colorScheme of ['light','dark']){await f.page.emulateMedia({colorScheme});assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,lang+' '+width+' '+colorScheme);}
   assert.deepEqual(f.errors,[]);if(lang==='tr')await f.page.screenshot({path:artifacts+'/areas-'+width+'.png'});await f.context.close();
  }
 });
 await test('photo filter exposes both named photos and direct selection highlights the canvas',async()=>{
  const f=await fixture();await f.page.locator('[data-filter=photos]').click();assert.equal(await f.page.locator('.area-button').count(),2);assert.equal(await f.page.locator('.area-button img').count(),2);await f.page.locator('.area-button').first().click();assert.equal(await f.page.frameLocator('#site').locator('.hero-art.ms-editor-selected').count(),1);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('text draft shows location on site, feedback, review, confirmation and receipt',async()=>{
  const f=await fixture();await f.choose('Cut & Denim');const before=await f.page.locator('#content').inputValue();await f.page.locator('#content').fill('Choose your denim');await f.page.locator('#saveField').click();
  assert.match(await f.page.locator('#fieldStatus').innerText(),/Jean Maker[\s\S]*Cut & Denim/);assert.match(await f.page.locator('#notice').innerText(),/Jean Maker[\s\S]*Cut & Denim/);
  assert.equal(await f.page.frameLocator('#site').locator('#maker-tab-0').innerText(),'Choose your denim');assert.match(await f.page.frameLocator('#site').locator('#maker-tab-0').getAttribute('data-ms-change-location'),/Jean Maker/);
  await f.page.locator('#reviewBtn').click();assert.match(await f.page.locator('#changesList').innerText(),new RegExp(before));assert.match(await f.page.locator('#changesList').innerText(),/Choose your denim/);
  await f.page.locator('#fEmail').fill('test@example.com');await f.page.locator('#sendReview').click();assert.match(await f.page.locator('#confirmBody').innerText(),/Jean Maker[\s\S]*Cut & Denim/);
  assert.equal(f.calls.filter(c=>c.path.endsWith('ms_submit')).length,0);await f.page.locator('#confirmActions .btn').click();await f.page.locator('#done[open]').waitFor();assert.match(await f.page.locator('#doneList').innerText(),/Choose your denim/);
  const sent=JSON.parse(f.calls.find(c=>c.path.endsWith('ms_submit')).body);assert.match(sent.p_items[0].anchor,/data-ms-field="maker-tab-0"/);assert.match(sent.p_items[0].target,/Jean Maker/);assert.equal(sent.p_items[0].request,'Choose your denim');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('both photos upload, preview replaces responsive srcset, and undo restores it',async()=>{
  const f=await fixture();
  for(const label of ['Opening photo','Workshop photo']){
   await f.choose(label);await f.page.locator('#photoFile').setInputFiles({name:'workshop.webp',mimeType:'image/webp',buffer:photo});await f.page.waitForFunction(()=>document.querySelector('#content').value.includes('/ms-media/'));await f.page.locator('#saveField').click();await f.page.locator('#backAreas').click();
  }
  const src=await f.page.frameLocator('#site').locator('#openingPhoto').getAttribute('src');assert.match(src,/ms-media/);assert.equal(await f.page.frameLocator('#site').locator('#openingPhoto').getAttribute('srcset'),null);
  await f.page.locator('#reviewBtn').click();assert.equal(await f.page.locator('#changesList .change-card').count(),2);assert.equal(await f.page.locator('#changesList img').count(),4);
  await f.page.locator('[data-locate]').first().click();await f.page.locator('#undoField').click();assert.match(await f.page.frameLocator('#site').locator('#openingPhoto').getAttribute('srcset'),/576w/);assert.match(await f.page.frameLocator('#site').locator('#openingPhoto').getAttribute('src'),/rufcut-store.webp/);
  assert.equal(f.calls.filter(c=>c.path.endsWith('ms-builder')).length,2);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('invalid and failed uploads retain existing changes and allow retry',async()=>{
  const f=await fixture();await f.choose('Opening photo');await f.page.locator('#photoFile').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});assert.equal(f.calls.filter(c=>c.path.endsWith('ms-builder')).length,0);assert.match(await f.page.locator('#uploadStatus').innerText(),/5 MB/);
  f.state.uploadFails=true;await f.page.locator('#photoFile').setInputFiles({name:'photo.webp',mimeType:'image/webp',buffer:photo});await f.page.getByText('Photo could not upload.',{exact:false}).waitFor();assert.equal(await f.page.locator('#content').inputValue(),'');
  f.state.uploadFails=false;await f.page.locator('#photoFile').setInputFiles({name:'photo.webp',mimeType:'image/webp',buffer:photo});await f.page.waitForFunction(()=>document.querySelector('#content').value.includes('ms-media'));assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('unsaved selection changes ask with exact location and can keep, discard or save',async()=>{
  const f=await fixture();await f.choose('Cut & Denim');await f.page.locator('#content').fill('Test change');await f.page.locator('#backAreas').click();assert.match(await f.page.locator('#confirmBody').innerText(),/Jean Maker[\s\S]*Cut & Denim/);await f.page.locator('#confirmActions button').first().click();assert.equal(await f.page.locator('#content').inputValue(),'Test change');
  await f.page.locator('#backAreas').click();await f.page.locator('#confirmActions .btn').click();await f.page.locator('#search').waitFor();await f.choose('Cut & Denim');assert.equal(await f.page.locator('#content').inputValue(),'Test change');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('saved and unsaved edits survive refresh without silently sending',async()=>{
  const f=await fixture();await f.choose('Cut & Denim');await f.page.locator('#content').fill('Saved text');await f.page.locator('#saveField').click();await f.page.reload();await f.page.locator('.area-button').first().waitFor();await f.choose('Cut & Denim');assert.equal(await f.page.locator('#content').inputValue(),'Saved text');
  await f.page.locator('#content').fill('Pending text');await f.page.reload();await f.page.locator('#content').waitFor();assert.equal(await f.page.locator('#content').inputValue(),'Pending text');assert.equal(f.calls.filter(c=>c.path.endsWith('ms_submit')).length,0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('failed send retains exact before/after and location for retry',async()=>{
  const f=await fixture();await f.choose('Cut & Denim');await f.page.locator('#content').fill('Changed denim');await f.page.locator('#saveField').click();await f.page.locator('#reviewBtn').click();await f.page.locator('#fEmail').fill('test@example.com');f.state.sendFails=true;await f.page.locator('#sendReview').click();await f.page.locator('#confirmActions .btn').click();await f.page.getByText('Could not send.',{exact:false}).waitFor();assert.match(await f.page.locator('#changesList').innerText(),/Changed denim/);
  f.state.sendFails=false;await f.page.locator('#sendReview').click();await f.page.locator('#confirmActions .btn').click();await f.page.locator('#done[open]').waitFor();assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('revision links upload with edit capability and existing locked requests cannot change',async()=>{
  const f=await fixture('tr',1440,'edit');await f.choose('Workshop photo');await f.page.locator('#photoFile').setInputFiles({name:'photo.webp',mimeType:'image/webp',buffer:photo});await f.page.waitForFunction(()=>document.querySelector('#content').value.includes('ms-media'));const body=f.calls.find(c=>c.path.endsWith('ms-builder')).body;assert.match(body,/name="edit"/);assert.ok(body.includes(edit));assert.ok(!body.includes(key));await f.context.close();
 });
 await test('locked requests remain visible but have no editable input',async()=>{
  const f=await fixture('tr',1440,'edit');f.state.submission.items=[{id:12,anchor:'/rufcut/::#maker-tab-0',kind:'small',target:'Jean Maker / first button',original:'Cut & Denim',request:'Previous proposal',status:'working'}];await f.page.reload();await f.page.locator('#search').waitFor();await f.page.locator('#search').fill('Cut & Denim');await f.page.locator('.area-button').click();assert.equal(await f.page.locator('#content').count(),0);assert.match(await f.page.locator('#sideBody').innerText(),/already started/);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('a newer server revision asks before restoring an older device draft',async()=>{
  const f=await fixture('tr',1440,'edit');await f.choose('Cut & Denim');await f.page.locator('#content').fill('Device draft');await f.page.locator('#saveField').click();f.state.submission.version=2;await f.page.reload();await f.page.locator('#confirm[open]').waitFor();assert.match(await f.page.locator('#confirmBody').innerText(),/newer/);await f.page.locator('#confirmActions button').first().click();await f.page.locator('#search').waitFor();await f.choose('Cut & Denim');assert.notEqual(await f.page.locator('#content').inputValue(),'Device draft');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 console.log(JSON.stringify({passed,failures:0}));
}finally{await browser.close();}
