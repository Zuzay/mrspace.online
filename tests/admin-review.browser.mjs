// Review page navigation races with intercepted query results.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const {chromium} = await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser = await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const server = createServer(async (request,response) => {
 try {
   const path = new URL(request.url,'http://localhost').pathname;
   if (path.includes('..')) throw Error('path');
   const file = new URL('..' + path + (path.endsWith('/') ? 'index.html' : ''), import.meta.url);
   const type = file.pathname.endsWith('.js') ? 'text/javascript' : file.pathname.endsWith('.json') ? 'application/json' : file.pathname.endsWith('.css') ? 'text/css' : 'text/html';
   response.setHeader('Content-Type',type); response.end(await readFile(file));
 } catch { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const context = await browser.newContext();
await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
try {
 const page = await context.newPage(), errors = [];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(() => {
   window.pendingQueries = [];
   window.supabase = {createClient() { return {from(table) {
     const query = {table,filters:[],select(){return query;},in(){return query;},order(){return query;},neq(){return query;},limit(){return query;},eq(key,value){query.filters.push([key,value]);return query;},single(){return query;},then(resolve,reject){return new Promise(done=>pendingQueries.push({table,filters:query.filters,done})).then(resolve,reject);}};
     return query;
   }};}};
 });
 await context.route('**/*',async route=>{
   const url = new URL(route.request().url());
   if(url.href.includes('@supabase/supabase-js')) return route.fulfill({contentType:'text/javascript',body:''});
   if(url.pathname.endsWith('/ms-auth.js')) return route.fulfill({contentType:'text/javascript',body:'window.msAdminGate=async()=>true;'});
   if(url.pathname.endsWith('/ms-render.js')) return route.fulfill({contentType:'text/javascript',body:'window.MsRender={render:()=>"<p>Preview</p>"};'});
   if(url.pathname.endsWith('/i18n.js')) return route.fulfill({contentType:'text/javascript',body:'window.MSI18N={t:x=>x,ready:Promise.resolve(),apply:()=>{}};'});
   return url.origin===origin ? route.continue() : route.abort();
 });
 await page.goto(origin+'/admin/review/');
 await page.waitForFunction(()=>pendingQueries.length===1);
 await page.locator('[data-tab="sites"]').click();
 await page.waitForFunction(()=>pendingQueries.length===2);
 await page.evaluate(()=>pendingQueries[1].done({data:[{slug:'latest',name:'Current site'}],error:null}));
 await page.getByText('Current site',{exact:true}).waitFor();
 await page.evaluate(()=>pendingQueries[0].done({data:null,error:{message:'old queue error'}}));
 await page.evaluate(()=>Promise.resolve());
 assert.equal(await page.getByText('Current site',{exact:true}).count(),1);
 console.log('PASS old queue error cannot replace the sites tab');
 await page.evaluate(()=>{window.pendingQueries=[];window.buildLoading=openBuild(5);});
 await page.waitForFunction(()=>pendingQueries.length===1);
 await page.evaluate(()=>pendingQueries[0].done({data:{id:5,site:'latest',status:'review'},error:null}));
 await page.waitForFunction(()=>pendingQueries.length===3);
 await page.locator('[data-tab="trials"]').click();
 await page.waitForFunction(()=>pendingQueries.length===5);
 await page.evaluate(()=>{pendingQueries[3].done({data:[],error:null});pendingQueries[4].done({count:0,error:null});});
 await page.getByText('Bekleyen deneme yok.',{exact:true}).waitFor();
 await page.evaluate(()=>{pendingQueries[1].done({data:null,error:{message:'old site error'}});pendingQueries[2].done({data:[],error:null});return window.buildLoading;});
 assert.equal(await page.getByText('Bekleyen deneme yok.',{exact:true}).count(),1);
 console.log('PASS late build detail dependencies cannot overwrite trials or crash');
 await page.evaluate(()=>{window.pendingQueries=[];window.trialLoading=openTrial(8);});
 await page.waitForFunction(()=>pendingQueries.length===1);
 await page.locator('[data-tab="queue"]').click();
 await page.waitForFunction(()=>pendingQueries.length===2);
 await page.evaluate(()=>pendingQueries[1].done({data:[],error:null}));
 await page.getByText('Bekleyen site yok.',{exact:true}).waitFor();
 await page.evaluate(()=>{pendingQueries[0].done({data:null,error:{message:'old trial error'}});return window.trialLoading;});
 assert.equal(await page.getByText('Bekleyen site yok.',{exact:true}).count(),1);
 console.log('PASS old trial error cannot replace the queue');
 assert.deepEqual(errors,[]);
} finally {await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
