// Project-first admin navigation with local demo data; all external requests blocked.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
async function source(path,fallback){if(process.env.MS_ADMIN_BASE){const candidate=process.env.MS_ADMIN_BASE+path;try{await access(candidate);return candidate;}catch{}}return fallback;}
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.includes('..'))throw Error('path');
 const file=path==='/admin/'&&process.env.MS_ADMIN_PREVIEW?process.env.MS_ADMIN_PREVIEW:new URL('..'+path+(path.endsWith('/')?'index.html':''),import.meta.url);
 const suffix=String(file);res.setHeader('Content-Type',suffix.endsWith('.js')?'text/javascript':suffix.endsWith('.json')?'application/json':suffix.endsWith('.css')?'text/css':'text/html');res.end(await readFile(await source(path,file)));
}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/admin/projects.html?preview=1');
 await page.locator('[data-project-row]').first().waitFor();
 assert.equal(await page.locator('[data-project-row]').count(),4);
 assert.equal(await page.locator('#main .site').count(),0);
 console.log('PASS directory shows compact project entry points');
 const search=page.locator('[data-project-search]');await search.fill('heron');
 assert.equal(await page.locator('[data-project-row]:visible').count(),1);
 await search.fill('not-a-project');assert.equal(await page.locator('[data-project-empty]:visible').count(),1);await search.fill('');
 console.log('PASS directory search and empty state');
 await page.locator('[data-project-row][href*="rufcut"]').click();
 await page.waitForFunction(()=>PROJECT==='rufcut');
 assert.equal(await page.locator('#main .project-request').count(),await page.evaluate(()=>Math.min(5,D.changes.filter(c=>c.site==='rufcut'&&['new','approved'].includes(c.status)).length)));
 assert.ok(!(await page.locator('#main').innerText()).includes('Heron CA'));
 await page.locator('#projectSwitch').selectOption('heron');await page.waitForFunction(()=>PROJECT==='heron');
 assert.equal(await page.locator('#main .project-request').count(),0);
 assert.ok(!(await page.locator('#main').innerText()).includes('Saturday hours'));
 console.log('PASS switching projects isolates requests and summaries');
 await page.evaluate(()=>{
  D.activity=[{site:'rufcut',action:'Rufcut private work',at:new Date().toISOString()},{site:'heron',action:'Heron private work',at:new Date().toISOString()}];
  D.usage=[{site:'rufcut',service:'Rufcut service',used:1,lim:10},{site:'heron',service:'Heron service',used:2,lim:10}];
  D.subs=[{id:1,site:'rufcut'},{id:2,site:'heron'}];D.vers=[{submission_id:1},{submission_id:2}];
  location.hash=MsAdminProjects.link('heron','log');
 });
 await page.getByText('Heron private work',{exact:false}).waitFor();assert.ok(!(await page.locator('#main').innerText()).includes('Rufcut private work'));
 await page.locator('#projectNav a[href*="view=usage"]').click();await page.getByText('Heron service',{exact:false}).waitFor();
 assert.equal(await page.locator('[data-act="editusage"]').getAttribute('data-i'),'1');
 assert.ok(!(await page.locator('#main').innerText()).includes('Rufcut service'));
 const scoped=await page.evaluate(()=>MsAdminProjects.scope(D,'heron'));assert.equal(scoped.vers.length,1);assert.equal(scoped.vers[0].submission_id,2);
 console.log('PASS scoped history, usage indices and submission versions');
 await page.reload();await page.waitForFunction(()=>PROJECT==='heron'&&VIEW==='usage');
 console.log('PASS route survives reload');
 await page.evaluate(()=>{VIEWER=true;document.body.classList.add('viewer');location.hash=MsAdminProjects.link('heron','billing');});
 await page.waitForFunction(()=>VIEW==='overview');assert.equal(await page.locator('#projectNav a[href*="view=billing"]').count(),0);assert.equal(await page.locator('#projectNav a[href*="view=access"]').count(),0);
 assert.equal(await page.locator('#main a[href*="/edit/"]').count(),0);
 console.log('PASS viewer cannot navigate to restricted tools');
 await page.evaluate(()=>{VIEWER=false;document.body.classList.remove('viewer');location.hash='#project=missing&view=changes';});
 await page.locator('[data-project-row]').first().waitFor();assert.equal(await page.evaluate(()=>PROJECT),'');
 console.log('PASS unknown project returns to directory');
 await page.locator('#main h1').evaluate(el=>el.blur());
 if(process.env.MS_ADMIN_SCREENSHOT)await page.screenshot({path:process.env.MS_ADMIN_SCREENSHOT,fullPage:true});
 for(const width of [390,768]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 console.log('PASS mobile and tablet do not overflow');
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{location.hash=MsAdminProjects.link('rufcut');});await page.waitForFunction(()=>PROJECT==='rufcut');
 await page.locator('#main h1').evaluate(el=>el.blur());
 if(process.env.MS_ADMIN_SCREENSHOT)await page.screenshot({path:process.env.MS_ADMIN_SCREENSHOT.replace('.png','-project.png'),fullPage:true});
 for(const [language,title]of [['tr','Projeler'],['en','Projects'],['es','Proyectos'],['de','Projekte'],['fr','Projets']]){
  await page.evaluate(language=>{localStorage.setItem('ms_lang',language);location.hash='';},language);await page.reload();
  await page.locator('[data-project-row]').first().waitFor();assert.equal(await page.locator('#main h1').innerText(),title);
  await page.setViewportSize({width:390,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'language overflow '+language);
  await page.setViewportSize({width:1440,height:1000});
 }
 console.log('PASS five languages and mobile dark theme');

 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
