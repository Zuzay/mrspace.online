// Commerce save races; all live services blocked.
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
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/admin/?preview=1');
 await page.addScriptTag({url:origin+'/assets/ms-commerce.js'});
 await page.addScriptTag({url:origin+'/assets/ms-commerce-panel.js'});
 await page.evaluate(()=>MsCommercePanel.ready);
 const result=await page.evaluate(async()=>{
  document.body.innerHTML='<main id="commerce"></main>';
  const root=document.getElementById('commerce'),states=new Map(),pending=[],notifications=[];
  function record(slug){if(!states.has(slug)){const setup=MsCommerce.blank();setup.countries=['US'];setup.pickup=true;states.set(slug,{setup,items:[],readiness:{blockers:[]},currency:'USD'});}return states.get(slug);}
  const options=slug=>({site:{slug,name:slug},demo:false,notify:message=>notifications.push(message),call:async(action,body)=>{
   if(action==='commerce_status')return structuredClone(record(slug));
   if(action==='commerce_save'){await new Promise(resolve=>pending.push(resolve));record(slug).setup=structuredClone(body.setup);return {};}
   throw Error('Unexpected action '+action);
  }});
  const edit=value=>{const input=root.querySelector('[name=dispatch_days]');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
  await MsCommercePanel.mount(root,options('rufcut'));
  edit('3');const original=root.querySelector('[data-commerce-form]');
  const saving=original.onsubmit({preventDefault(){}});
  await original.onsubmit({preventDefault(){}});
  root.querySelector('[data-commerce-refresh]').click();
  const saveLocked=pending.length===1&&root.querySelector('[data-commerce-form]')===original;
  edit('7');pending.shift()();await saving;
  const newerEditKept=root.querySelector('[name=dispatch_days]').value==='7'&&MsCommercePanel.hasDraft()&&record('rufcut').setup.dispatch_days===3;
  const next=root.querySelector('[data-commerce-form]').onsubmit({preventDefault(){}});
  await MsCommercePanel.mount(root,options('heron'));
  pending.shift()();await next;
  const siteUnchanged=root.querySelector('[data-commerce-root]').dataset.commerceRoot==='heron'&&notifications.length===1;
  await MsCommercePanel.mount(root,options('rufcut'));
  const savedDraftCleared=root.querySelector('[name=dispatch_days]').value==='7'&&!MsCommercePanel.hasDraft();
  edit('3');const reverting=root.querySelector('[data-commerce-form]').onsubmit({preventDefault(){}});
  edit('7');pending.shift()();await reverting;
  const revertedEditKept=root.querySelector('[name=dispatch_days]').value==='7'&&MsCommercePanel.hasDraft()&&record('rufcut').setup.dispatch_days===3;
  return {saveLocked,newerEditKept,siteUnchanged,savedDraftCleared,revertedEditKept};
 });
 for(const [name,value]of Object.entries(result)){assert.equal(value,true,name);console.log('PASS '+name);}
 assert.deepEqual(errors,[]);
} finally {await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
