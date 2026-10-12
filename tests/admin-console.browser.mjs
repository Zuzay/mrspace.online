// Real-session adapter tests. Every external request is intercepted; no live writes.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
async function source(path,fallback){if(process.env.MS_ADMIN_BASE){const candidate=process.env.MS_ADMIN_BASE+path;try{await access(candidate);return candidate;}catch{}}return fallback;}
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path.includes('..'))throw Error();res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.json')?'application/json':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile(await source(path,new URL('..'+path+(path.endsWith('/')?'index.html':''),import.meta.url))));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}});
let role='admin',failSave=true,delaySave=false,saveRelease=null,failJobs=false,jobRelease=null,delayJobs=false;
const writes=[],errors=[],sites=[{slug:'rufcut',name:'Rufcut',kind:'client',status:'live',site_key:'test-key',url:'https://example.com/rufcut'},{slug:'other',name:'Other customer',kind:'client',status:'building',url:'https://example.com/other'}];
const job={id:'00000000-0000-4000-8000-000000000001',ticket:'RC-101',kind:'repair',customer_name:'Example Customer',customer_email:'test@example.com',status:'received',staff_notes:'',measurements:'',created_at:new Date().toISOString(),items:[]};
let item={id:'ITEM1',name:'Rufcut Jeans',variations:[{id:'VAR1',name:'Regular',sku:'RC-1',price:1500,currency:'USD',track:true,stock:3}]};
await context.addInitScript(()=>{localStorage.setItem('ms_admin',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:4102444800,email:'test@example.com'}));localStorage.setItem('ms_lang','tr');});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());if(url.origin===origin)return route.continue();
 if(!url.hostname.endsWith('.supabase.co'))return route.abort();
 const body=request.postDataJSON()||{};let result=[],status=200;
 if(url.pathname.endsWith('/rpc/ms_role'))result=role;
 else if(url.pathname.endsWith('/rpc/ms_workspace_snapshot'))result={sites:[{slug:body.p_site,name:'Rufcut',service_package:'package_1',sector:'fashion',relationship:'client',connections:[]}],jobs:[]};
 else if(url.pathname.endsWith('/rpc/ms_set_site_profile')){writes.push({endpoint:'profile',...body});result={ok:true};}
 else if(url.pathname.endsWith('/rpc/ms_quota'))result=[{}];
 else if(url.pathname.endsWith('/rpc/ms_worker_admin_snapshot'))result={enabled:false,keys:[]};
 else if(url.pathname.endsWith('/rpc/ms_viewer_snapshot'))result={sites,checks:[],changes:[],activity:[],usage:[],quota:{}};
 else if(url.pathname.endsWith('/ms_sites')){if(request.method()==='POST'){writes.push({endpoint:'sites',...body});sites.push(body);}result=sites;}
 else if(url.pathname.includes('/functions/')){
  if(['update','set_count','save_publication','add_item','add_variation','commerce_save','connect','set_public','add_photos'].includes(body.action))writes.push({...body,auth:request.headers().authorization});
  if(body.action==='list'){if(delayJobs)await new Promise(r=>jobRelease=r);if(failJobs){status=500;result={error:'offline'};}else result={jobs:[job]};}
  else if(body.action==='update'){if(delaySave)await new Promise(r=>saveRelease=r);if(failSave){status=500;result={error:'offline'};}else{Object.assign(job,body);result={ok:true};}}
  else if(body.action==='status')result={connected:true,public:true,currency:'USD'};
  else if(body.action==='catalog')result={items:[{...item,publication:await page.evaluate(()=>MsSiteCatalog.settings({id:'ITEM1',variations:[{id:'VAR1'}]},null))}],public:true};
  else if(body.action==='set_count'){item.variations[0].stock=body.qty;result={ok:true};}
  else if(body.action==='save_publication'){status=500;result={error:'offline'};}
  else if(body.action==='commerce_status')result=await page.evaluate(()=>({setup:MsCommerce.blank(),items:[],readiness:{blockers:['square_required']},currency:'USD'}));
  else if(body.action==='commerce_save'){status=500;result={error:'offline'};}
  else result={ok:true};
 }
 await route.fulfill({status,json:result});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let accept=true;page.on('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
try{
 await page.goto(origin+'/admin/projects.html#project=rufcut&view=orders');await page.locator('[data-ticket]').waitFor();
 assert.equal(await page.locator('#demoTag').isVisible(),false);assert.equal(await page.locator('#projectNav [href*=orders]').count(),1);
 await page.locator('[data-ticket] summary').click();const notes=page.locator('[data-repair-notes]');await notes.fill('Keep this fitting note');
 await page.locator('[data-repair-save]').click();await page.getByText('Kaydedilemedi. Değişikliklerin korunuyor.').waitFor();assert.equal(await notes.inputValue(),'Keep this fitting note');
 accept=false;await page.locator('#projectSwitch').selectOption('other');await page.waitForFunction(()=>PROJECT==='rufcut');assert.equal(await notes.inputValue(),'Keep this fitting note');assert.ok((await page.evaluate(()=>location.hash)).includes('rufcut'));accept=true;
 console.log('PASS authenticated orders, failure retention and cancelled navigation');
 failSave=false;delaySave=true;await page.locator('[data-repair-save]').click();await page.waitForFunction(()=>MsAdminOperations.pending());await page.locator('#projectSwitch').selectOption('other');assert.equal(await page.evaluate(()=>PROJECT),'rufcut');
 await page.locator('[data-repair-save]').evaluate(b=>b.click());assert.equal(writes.filter(w=>w.action==='update').length,2);saveRelease();
 await page.waitForFunction(()=>!MsAdminOperations.pending());await page.waitForFunction(()=>!MsOrders.hasDrafts());assert.equal(job.staff_notes,'Keep this fitting note');
 assert.equal(writes.find(w=>w.action==='update').site,'rufcut');assert.equal(writes.find(w=>w.action==='update').auth,'Bearer test-token');
 console.log('PASS pending navigation guard, duplicate prevention and exact job API payload');
 await page.locator('#projectNav [href*=catalog]').click();await page.locator('[data-stock]').waitFor();await page.locator('[data-stock] input').fill('7');await page.locator('[data-stock] button').click();await page.waitForFunction(()=>document.querySelector('[data-stock] input').defaultValue==='7');
 assert.equal(writes.find(w=>w.action==='set_count').variation,'VAR1');assert.equal(writes.find(w=>w.action==='set_count').qty,7);assert.equal(writes.find(w=>w.action==='set_count').site,'rufcut');
 const form=page.locator('[data-cat-form]');await page.locator('[data-cat-form]').evaluate(el=>el.closest('details').open=true);await form.locator('[name=title]').fill('Saved only after confirmation');await form.locator('[name=confirm]').check();await form.locator('[type=submit]').click();await form.locator('[data-cat-error]').filter({hasText:'Kaydedilemedi'}).waitFor();assert.equal(await form.locator('[name=title]').inputValue(),'Saved only after confirmation');
 console.log('PASS scoped stock update and publication failure preserves form');
 await page.locator('.project-publishing input').uncheck();await page.waitForFunction(()=>!MsAdminOperations.pending());assert.equal(writes.find(w=>w.action==='set_public').value,false);
 await page.locator('.project-photo input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
 await page.locator('.project-photo button').click();await page.waitForFunction(()=>!MsAdminOperations.pending());assert.equal(writes.find(w=>w.action==='add_photos').item,'ITEM1');assert.equal(writes.find(w=>w.action==='add_photos').site,'rufcut');
 console.log('PASS website publishing and product photo use scoped Square actions');
 await page.locator('[data-stock]').waitFor();for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'catalog overflow '+width);}
 if(process.env.MS_ADMIN_SCREENSHOT)await page.screenshot({path:process.env.MS_ADMIN_SCREENSHOT.replace('orders.png','catalog.png'),fullPage:true});

 await page.locator('#projectNav [href*=commerce]').click();await page.locator('[data-commerce-form]').waitFor();const countries=page.locator('[name=countries]');await countries.fill('US, CA');await page.locator('[name=confirm]').check();await page.locator('[data-commerce-form] [type=submit]').click();await page.locator('[data-commerce-error]').filter({hasText:/\S/}).waitFor();assert.equal(await countries.inputValue(),'US, CA');
 console.log('PASS shipping settings failure retains entered data and shows blockers');
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'commerce overflow '+width);}
 await page.locator('#projectNav>a[href="#"]').click();await page.locator('[data-act=newsite]').click();await page.locator('#dlgForm [name=slug]').fill('new-client');await page.locator('#dlgForm [name=name]').fill('New Client');await page.locator('#dlgForm [type=submit]').click();await page.locator('[data-project-row][href*=new-client]').waitFor();assert.equal(writes.find(w=>w.endpoint==='sites').name,'New Client');
 console.log('PASS new customer project persists through existing API');
 await page.evaluate(()=>location.hash=MsAdminProjects.link('rufcut','sites'));await page.locator('[data-profile-edit]').waitFor();await page.locator('[data-profile-edit]').click();await page.locator('#dlgForm [name=package]').selectOption('package_2');await page.locator('#dlgForm [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#dlg').open);assert.equal(writes.find(w=>w.endpoint==='profile').p_site,'rufcut');assert.equal(writes.find(w=>w.endpoint==='profile').p_sector,'fashion');assert.equal(writes.find(w=>w.endpoint==='profile').p_package,'package_2');
 console.log('PASS service package and connection states stay inside the selected customer project');
 role='viewer';await page.goto(origin+'/admin/projects.html#project=rufcut&view=orders');await page.reload();await page.waitForFunction(()=>VIEWER&&VIEW==='overview');assert.equal(await page.locator('#projectNav [href*=orders]').count(),0);assert.equal(await page.locator('#projectNav [href*=catalog]').count(),0);const before=writes.length;await page.evaluate(()=>act('newsite',document.createElement('button')).catch(()=>{}));assert.equal(writes.length,before);
 console.log('PASS real viewer snapshot cannot access operations or write');
 role='admin';delaySave=false;delayJobs=true;await page.goto(origin+'/admin/projects.html#project=rufcut&view=orders');await page.reload();await page.waitForFunction(()=>document.querySelector('#projectOperations'));while(!jobRelease)await new Promise(r=>setTimeout(r,10));await page.locator('#projectSwitch').selectOption('other');await page.waitForFunction(()=>PROJECT==='other');jobRelease();await page.waitForTimeout(50);assert.equal(await page.locator('[data-ticket]').count(),0);assert.ok((await page.locator('#main').innerText()).includes('Other customer')||await page.evaluate(()=>PROJECT==='other'));
 console.log('PASS delayed Rufcut response cannot repaint another project');
 delayJobs=false;failJobs=true;await page.goto(origin+'/admin/projects.html#project=rufcut&view=orders');await page.locator('[data-service-retry]').waitFor();assert.equal(await page.locator('[data-ticket]').count(),0);failJobs=false;await page.locator('[data-service-retry]').click();await page.locator('[data-ticket]').waitFor();
 for(const width of [390,768]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'orders overflow '+width);}
 if(process.env.MS_ADMIN_SCREENSHOT)await page.screenshot({path:process.env.MS_ADMIN_SCREENSHOT,fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS explicit service error/retry and mobile work orders');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
