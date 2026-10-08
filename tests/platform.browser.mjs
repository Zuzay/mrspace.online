// Run against the local static server. Every live API call is intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const origin=process.env.MS_PREVIEW_ORIGIN||'http://127.0.0.1:8765';
const key='11111111-1111-4111-8111-111111111111';
const sdk=fs.readFileSync(process.env.MS_SUPABASE_UMD,'utf8');
const artifacts=process.env.MS_TEST_ARTIFACTS||'/private/tmp/mrspace-validation';fs.mkdirSync(artifacts,{recursive:true});
let passed=0;
async function test(label,fn){await fn();passed++;console.log('PASS '+label);}
async function fixture(lang='tr',viewport={width:1440,height:1000},mock=null){
 const context=await browser.newContext({viewport,locale:lang,reducedMotion:'reduce'}),calls=[],errors=[];
 await context.addInitScript(lang=>{localStorage.setItem('ms_lang',lang);},lang);
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin)return route.continue();
  if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:sdk});
  if(url.hostname.endsWith('.supabase.co')){
   const body=request.postDataJSON?.();calls.push({path:url.pathname,body});
   const result=mock&&await mock(url,body,calls);if(result)return route.fulfill({status:result.status||200,contentType:'application/json',body:JSON.stringify(result.data),headers:{'Access-Control-Allow-Origin':'*'}});
  }
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page,calls,errors};
}
try{
 await test('all five languages render the workspace and every catalog link opens',async()=>{
  for(const lang of ['en','tr','es','de','fr']){
   const f=await fixture(lang);await f.page.goto(origin+'/admin/?preview=1');await f.page.locator('.ms-workspace').first().waitFor();
   assert.equal(await f.page.locator('.ms-workspace').count(),2);assert.equal(await f.page.locator('.ms-state.connected').count(),0);
   assert.equal(f.calls.length,0);assert.deepEqual(f.errors,[]);
   const links=await f.page.locator('.ms-catalog a').evaluateAll(nodes=>nodes.map(n=>n.href));
   for(const href of new Set(links)){const response=await f.context.request.get(href);assert.equal(response.status(),200,href);}
   await f.context.close();
  }
 });
 await test('mobile previews have no page overflow or script errors',async()=>{
  for(const path of ['studio/','admin/?preview=1','build/?preview=1','admin/changes/?preview=1','edit/?preview=1','library/','tools/denim/']){
   const f=await fixture('tr',{width:390,height:844});await f.page.goto(origin+'/'+path);await f.page.waitForTimeout(450);
   assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path);assert.deepEqual(f.errors,[],path);assert.equal(f.calls.length,0,path);
   await f.page.screenshot({path:artifacts+'/mobile-'+path.split('/')[0]+'.png',fullPage:true});await f.context.close();
  }
 });
 await test('red preview shows before/after, original toggle and no live write',async()=>{
  const f=await fixture();await f.page.goto(origin+'/admin/changes/?preview=1');const frame=f.page.frameLocator('#livePreview');
  await frame.locator('h1 ins').waitFor();assert.match(await frame.locator('h1 ins').innerText(),/Bağımsız/);
  await f.page.locator('#proposed').fill('Yeni öneri');assert.equal(await frame.locator('h1 ins').innerText(),'Yeni öneri');
  await f.page.locator('#toggleRed').click();assert.equal(await frame.locator('h1 ins').count(),0);
  await f.page.locator('#toggleRed').click();await f.page.locator('#approve').click();assert.equal(f.calls.length,0);
  await f.page.screenshot({path:artifacts+'/red-review.png',fullPage:true});assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('dictionary failure stays readable and does not issue a live API request',async()=>{
  const f=await fixture();await f.context.route('**/assets/lang/platform-*.json',route=>route.fulfill({status:503,body:''}));await f.page.goto(origin+'/edit/?preview=1');await f.page.getByText('Metinler yüklenemedi.',{exact:false}).waitFor();assert.equal(f.calls.length,0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('easy editor retains a failed request and retry uses the same receipt token',async()=>{
  let submissions=0;
  const f=await fixture('tr',undefined,(url,body)=>{
   if(url.pathname.endsWith('ms_workspace_link'))return {data:{slug:'heron',name:'Heron CA'}};
   if(url.pathname.endsWith('ms_workspace_request'))return ++submissions===1?{status:503,data:{error:'offline'}}:{data:{ok:true,id:42,duplicate:true}};
  });
  await f.page.goto(origin+'/edit/?k='+key);await f.page.locator('[data-next]').click();await f.page.locator('#requestText').fill('Saat 10:00 olarak değişsin.');
  await f.page.locator('[data-next]').click();await f.page.locator('[data-next]').click();await f.page.locator('[data-next]:not(:disabled)').waitFor();
  const tokens=f.calls.filter(c=>c.path.endsWith('ms_workspace_request')).map(c=>c.body.p_token);assert.equal(tokens.length,1);
  assert.ok(await f.page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ms-easy-draft'))));
  await f.page.locator('[data-next]').click();await f.page.locator('.edit-success').waitFor();assert.match(await f.page.locator('.edit-success').innerText(),/#42/);
  const retry=f.calls.filter(c=>c.path.endsWith('ms_workspace_request'));assert.equal(retry[0].body.p_token,retry[1].body.p_token);
  assert.equal(await f.page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ms-easy-draft'))),false);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('malformed editor capability does not make an API request',async()=>{
  const f=await fixture();await f.page.goto(origin+'/edit/?k=bad&site=heron');await f.page.locator('.edit-card').waitFor();assert.equal(f.calls.length,0);assert.equal(await f.page.locator('[data-next]').count(),0);await f.context.close();
 });
 await test('builder does not submit when autosave fails',async()=>{
  const content={lang:'tr',business:{name:'Test shop',hours:[],socials:{}},sections:[{type:'hero',title:'Test shop'}]};
  const f=await fixture('tr',undefined,(url)=>{
   if(url.pathname.endsWith('ms_builder_get'))return {data:{site:{slug:'test',name:'Test shop',mode:'builder'},build:{id:1,status:'draft',content,theme:{preset:'commerce'}}}};
   if(url.pathname.endsWith('ms_builder_save'))return {status:503,data:{message:'not_saved'}};
  });
  f.page.on('dialog',dialog=>dialog.dismiss());await f.page.goto(origin+'/build/?k='+key);await f.page.locator('#sendBtn').click();await f.page.locator('#sendGo').click();await f.page.locator('#sendGo:not(:disabled)').waitFor();
  assert.equal(f.calls.some(c=>c.path.endsWith('ms_builder_submit')),false);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('denim calculator handles valid reduction and rejects impossible lengths',async()=>{
  const f=await fixture();await f.page.goto(origin+'/tools/denim/');await f.page.locator('#current').fill('82');await f.page.locator('#desired').fill('78');assert.match(await f.page.locator('#result').innerText(),/4 cm/);
  await f.page.locator('#desired').fill('90');assert.equal(await f.page.locator('#copy').isDisabled(),true);assert.equal((await f.page.locator('#result').innerText()).trim(),'');assert.equal(f.calls.length,0);await f.context.close();
 });
 await test('project submission shows success only after a receipt and preserves failed drafts',async()=>{
  let submissions=0;const f=await fixture('tr',undefined,url=>url.pathname.endsWith('ms-intake')?(++submissions===1?{status:503,data:{error:'not_saved'}}:{data:{ok:true,id:73}}):null);
  await f.page.goto(origin+'/start/');await f.page.locator('#biz').fill('A new brand');await f.page.locator('#stepnav li').nth(6).click();await f.page.locator('#nm').fill('New owner');await f.page.locator('#em').fill('owner@example.test');await f.page.locator('#stepnav li').last().click();
  await f.page.locator('#submitProject').click();await f.page.locator('#submitProject:not(:disabled)').waitFor();assert.ok(await f.page.evaluate(()=>localStorage.getItem('mrspace-start-v1')));
  await f.page.locator('#submitProject').click();await f.page.waitForFunction(()=>document.getElementById('projectStatus').textContent.includes('#73'));
  const requests=f.calls.filter(c=>c.path.endsWith('ms-intake'));assert.equal(requests[0].body.token,requests[1].body.token);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('draft preparation failure preserves the queued job and retry reaches human review',async()=>{
  const f=await fixture();await f.page.goto(origin+'/library/');await f.page.waitForFunction(()=>window.MsPlatform);
  await f.page.evaluate(async()=>{
   await MsPlatform.ready;const root=document.createElement('div');root.id='draftTest';document.body.append(root);
   window.draftTestState={jobs:[],queueCalls:[],prepareCalls:0};const state=window.draftTestState;
   const options={admin:true,rpc:async(name,body)=>{
    if(name==='ms_workspace_snapshot')return {admin:true,sites:[],jobs:state.jobs};
    if(name==='ms_intake_list')return [];
    if(name==='ms_queue_draft'){state.queueCalls.push(body);state.jobs=[{id:81,status:'queued',sector:body.p_sector,kind:body.p_kind,brief:body.p_brief}];return 81;}
    if(name==='ms_review_draft'){state.jobs[0].status=body.p_status;return null;}
    throw new Error('unexpected RPC');
   },prepare:async()=>{if(++state.prepareCalls===1)throw new Error('offline');state.jobs[0].status='review';return {ok:true};}};
   await MsPlatform.mount(root,options);
  });
  const root=f.page.locator('#draftTest');await root.locator('textarea[name=brief]').fill('A neighborhood retail design');await root.locator('.ms-draft-form button').click();
  await root.locator('[data-prepare-queue]').waitFor();assert.match(await root.locator('.ms-platform-status').innerText(),/Talep kaydedildi/);
  assert.equal(await f.page.evaluate(()=>draftTestState.queueCalls.length),1);
  await root.locator('[data-prepare-queue]').click();await root.locator('[data-review][data-status=ready]').waitFor();
  assert.equal(await f.page.evaluate(()=>draftTestState.prepareCalls),2);assert.equal(await f.page.evaluate(()=>draftTestState.jobs[0].status),'review');
  await root.locator('[data-review][data-status=ready]').click();await root.locator('[data-review]').waitFor({state:'detached'});
  assert.equal(await f.page.evaluate(()=>draftTestState.jobs[0].status),'ready');assert.equal(f.calls.length,0);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 console.log(`${passed} browser checks passed; live APIs were blocked`);
}finally{await browser.close();}
