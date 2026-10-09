// One real editor engine, three site types. All backend traffic is mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const origin=process.env.MS_PREVIEW_ORIGIN||'http://127.0.0.1:4174',key='11111111-1111-4111-8111-111111111111';
const scope={};vm.runInNewContext(fs.readFileSync(new URL('../assets/ms-render.js',import.meta.url),'utf8'),scope);
const renderer=scope.MsRender;let passed=0;
async function test(label,fn){await fn();passed++;console.log('PASS '+label);}
function generated(lang='en',reordered=false){
 const sections=[{id:'welcome',type:'hero',title:'Neighborhood table',text:'Our kitchen',button:{label:'Menu',url:'#s1'}},{id:'food',type:'menu',title:'Menu',groups:[{name:'Lunch',items:[{name:'Soup',price:'12',desc:'Seasonal vegetables'}]}]},{id:'story',type:'about',title:'Our story',text:'First paragraph\n\nSecond paragraph'},{type:'gallery',title:'Gallery',images:[{url:origin+'/rufcut/media/rufcut-detail-800.webp',caption:'Our bench'}]},{type:'hours',title:'Hours'},{type:'contact',title:'Visit'},{type:'text',title:'Good to know',text:'Bring a friend'}];
 if(reordered)sections.unshift({type:'text',title:'Announcement',text:'Opening soon'});
 return renderer.render({lang,business:{name:'Neighborhood table',address:'Venice',email:'test@example.com',phone:'123',hours:[{open:'11:00',close:'17:00'}]},sections},{preset:'table'});
}
async function fixture(lang='tr',path='/',width=1440){
 const context=await browser.newContext({locale:lang,viewport:{width,height:1000},reducedMotion:'reduce'}),calls=[],errors=[];
 const state={sites:[{slug:'mrspace',name:'Mr. Space',site_key:key,url:origin+'/'},{slug:'rufcut',name:'Rufcut',site_key:key,url:origin+'/rufcut/'}],html:generated(lang)};
 await context.addInitScript(lang=>localStorage.setItem('ms_lang',lang),lang);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin===origin){if(u.pathname==='/shared-fixture/')return route.fulfill({contentType:'text/html',body:state.html});return route.continue();}
  if(u.hostname.endsWith('.supabase.co')){
   calls.push({path:u.pathname,method:route.request().method(),body:route.request().postDataJSON()});let data={};
   if(u.pathname.endsWith('ms_client_view'))data={name:'Test site',url:origin+path};
   else if(u.pathname.endsWith('ms_my_sites'))data=state.sites;
   else if(u.pathname.endsWith('ms_workspace_snapshot'))data={sites:state.sites};
   else if(u.pathname.endsWith('ms_submit'))data={ok:true,edit_key:key};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  }return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 return {context,page,calls,errors,state};
}
try{
 await test('Mr. Space and Rufcut declare unique stable fields and share one schema',async()=>{
  const f=await fixture();
  for(const path of ['/','/rufcut/']){
   await f.page.goto(origin+path);await f.page.addScriptTag({url:origin+'/assets/ms-editor-schema.js'});
   const data=await f.page.evaluate(()=>{const all=[...document.querySelectorAll('[data-ms-field]')];const s=MsEditorSchema;return {count:all.length,unique:new Set(all.map(el=>el.dataset.msField)).size,invalid:all.filter(el=>!s.selector(el,document)).length,version:s.config(document).version};});
   assert.ok(data.count>30);assert.equal(data.unique,data.count);assert.equal(data.invalid,0);assert.equal(data.version,1);
  }assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('the shared engine edits Mr. Space with exact before/after and stable location',async()=>{
  const f=await fixture();await f.page.goto(origin+'/request/?k='+key);await f.page.locator('.area-button').first().waitFor({state:'attached'});await f.page.locator('.area-button[data-anchor*=heroTitle]').click();
  await f.page.locator('#content').fill('A shared studio');await f.page.locator('#saveField').click();assert.equal(await f.page.frameLocator('#site').locator('#heroTitle').textContent(),'A shared studio');
  await f.page.locator('#reviewBtn').click();await f.page.locator('#fEmail').fill('test@example.com');await f.page.locator('#sendReview').click();await f.page.locator('#confirmActions .btn').click();await f.page.locator('#done[open]').waitFor();
  const item=f.calls.find(c=>c.path.endsWith('ms_submit')).body.p_items[0];assert.equal(item.anchor,'/::[data-ms-field="heroTitle"]');assert.ok(item.original.length>10);assert.equal(item.request,'A shared studio');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('generated sector sites have editable menu prices, photos and all seven section types in five languages',async()=>{
  for(const lang of ['en','tr','es','de','fr']){
   const f=await fixture(lang,'/shared-fixture/');await f.page.goto(origin+'/request/?k='+key);await f.page.locator('#search').fill('12');await f.page.locator('.area-button').first().click();
   await f.page.locator('#content').fill('15');await f.page.locator('#saveField').click();assert.equal(await f.page.frameLocator('#site').locator('[data-ms-field="food.text.2"]').innerText(),'15');
   const meta=await f.page.frameLocator('#site').locator('body').evaluate(el=>({sections:el.querySelectorAll('[data-ms-section]').length,fields:el.querySelectorAll('[data-ms-field]').length}));assert.equal(meta.sections,7);assert.ok(meta.fields>20);assert.deepEqual(f.errors,[]);await f.context.close();
  }
 });
 await test('saved generated field survives an unrelated inserted section',async()=>{
  const f=await fixture('en','/shared-fixture/');await f.page.goto(origin+'/request/?k='+key);await f.page.locator('#search').fill('Neighborhood table');await f.page.locator('.area-button').first().click();await f.page.locator('#content').fill('Our shared kitchen');await f.page.locator('#saveField').click();f.state.html=generated('en',true);await f.page.reload();await f.page.locator('.area-button').first().waitFor();assert.equal(await f.page.frameLocator('#site').locator('[data-ms-field="welcome.heading.1"]').innerText(),'Our shared kitchen');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('schema refuses ambiguous stable and legacy selectors and accepts existing IDs',async()=>{
  const f=await fixture();await f.page.goto(origin+'/');await f.page.addScriptTag({url:origin+'/assets/ms-editor-schema.js'});
  const result=await f.page.evaluate(()=>{const s=MsEditorSchema,el=document.querySelector('#heroTitle'),legacy=s.resolve(document,'#heroTitle')===el;const clone=el.cloneNode(true);document.body.append(clone);return {legacy,stable:s.selector(el,document),ambiguous:s.resolve(document,'#heroTitle'),bad:s.resolve(document,'[')};});
  assert.equal(result.legacy,true);assert.equal(result.stable,'');assert.equal(result.ambiguous,null);assert.equal(result.bad,null);await f.context.close();
 });
 await test('preview uses the real shared engine but cannot submit, upload or save a capability',async()=>{
  for(const lang of ['en','tr','es','de','fr'])for(const site of ['mrspace','rufcut']){
   const f=await fixture(lang,'/',390);await f.page.goto(origin+'/request/?preview='+site);await f.page.locator('.area-button').first().waitFor({state:'attached'});await f.page.locator('#reviewBtn').click();assert.equal(await f.page.locator('#sendReview').isDisabled(),true);
   await f.page.evaluate(async()=>{confirmSend();await send();});assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.equal(await f.page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ms-request-draft:'))),false);
   for(const colorScheme of ['dark','light']){await f.page.emulateMedia({colorScheme});assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   assert.deepEqual(f.errors,[]);await f.context.close();
  }
 });
 await test('central chooser lists only server-authorized sites without exposing keys in its HTML',async()=>{
  const f=await fixture();await f.context.addInitScript(()=>localStorage.setItem('ms_admin',JSON.stringify({access_token:'test-session',expires_at:Date.now()/1000+3600})));
  await f.page.goto(origin+'/edit/');await f.page.locator('.editor-sites article').first().waitFor();assert.equal(await f.page.locator('.editor-sites article').count(),2);assert.match(await f.page.locator('.editor-sites').innerText(),/Mr. Space/);assert.ok(!(await f.page.locator('#editor').innerHTML()).includes(key));
  f.state.sites=[];await f.page.reload();await f.page.locator('.editor-sites').waitFor();assert.equal(await f.page.locator('.editor-sites article').count(),0);assert.equal(await f.page.locator('a[href*="?site="]').count(),0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('signed-out shared entry offers sign-in and write-free examples without backend access',async()=>{
  const f=await fixture();await f.page.goto(origin+'/edit/');await f.page.locator('.editor-examples').waitFor();assert.equal(f.calls.length,0);assert.equal(await f.page.locator('a[href*="preview=mrspace"]').count(),1);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 console.log(`Shared editor browser checks: ${passed} passed`);
}finally{await browser.close();}
