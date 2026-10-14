// Catalog save races with all external services blocked.
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
try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/admin/?preview=1');
 await page.addScriptTag({url:origin+'/assets/ms-site-catalog.js'});
 await page.addScriptTag({content:await readFile(process.env.MS_PANEL_DAILY_PATH || new URL('../assets/ms-panel-daily.js',import.meta.url),'utf8')});
 await page.addScriptTag({url:origin+'/assets/ms-catalog-panel.js'});
 await page.evaluate(()=>MsCatalogPanel.ready);
 const result=await page.evaluate(async()=>{
  document.body.innerHTML='<main id="catalog"></main>';
  const root=document.getElementById('catalog'),sites=new Map(),pending=[],notices=[];
  let slug='rufcut',fail=false,refreshes=0;
  function items(site){if(!sites.has(site))sites.set(site,[{id:'coat',name:'Coat',variations:[{id:'v',name:'Small',price:1000,currency:'USD'}],publication:MsSiteCatalog.blank()}]);return sites.get(site);}
  async function render(site){slug=site;const list=structuredClone(items(site)),options={site:{slug:site,name:site},public:true,demo:false};root.innerHTML=MsCatalogPanel.render(list,options);
   MsCatalogPanel.bind(root,{...options,items:list,notify:message=>notices.push(message),render:()=>render(site),refresh:async()=>{refreshes++;await render(site);},addVariant:()=>{throw Error('should stay locked');},save:async(id,publication)=>{if(fail)throw Error('offline');await new Promise(resolve=>pending.push(resolve));items(site)[0].publication=structuredClone(publication);}});
  }
  const edit=value=>{const field=root.querySelector('[name=title]');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));};
  const submit=()=>{root.querySelector('[name=confirm]').checked=true;return root.querySelector('[data-cat-form]').onsubmit({preventDefault(){}});};
  await render('rufcut');edit('First title');const save=submit();await submit();
  const locked=pending.length===1&&root.querySelector('[data-cat-refresh]').disabled&&root.querySelector('[data-cat-discard]').disabled&&root.querySelector('[data-cat-add-variant]').disabled;
  edit('Newer title');pending.shift()();await save;
  const newerKept=root.querySelector('[name=title]').value==='Newer title'&&MsCatalogPanel.hasDraft()&&items('rufcut')[0].publication.title==='First title';
  fail=true;await submit();const failedRetained=root.querySelector('[name=title]').value==='Newer title'&&!!root.querySelector('[data-cat-error]').textContent&&!root.querySelector('[data-cat-refresh]').disabled;
  fail=false;const second=submit();await render('heron');pending.shift()();await second;
  const siteUnchanged=slug==='heron'&&notices.length===1&&refreshes===1;
  await render('rufcut');const savedClean=root.querySelector('[name=title]').value==='Newer title'&&!MsCatalogPanel.hasDraft();
  return {locked,newerKept,failedRetained,siteUnchanged,savedClean};
 });
 for(const [name,value]of Object.entries(result)){assert.equal(value,true,name);console.log('PASS '+name);}
 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
