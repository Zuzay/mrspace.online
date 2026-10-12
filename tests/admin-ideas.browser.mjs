// Exercise the actual source toggle handler with intercepted query results.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser = await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
try {
 const page = await browser.newPage(), errors = [];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.abort());
 const html = await readFile(new URL('../admin/ideas/index.html',import.meta.url),'utf8');
 const marker = '$("#view").addEventListener("click", async (e) => {\n  const b = e.target.closest("button[data-src]")';
 const start = html.indexOf(marker); assert.ok(start > 0);
 const handler = html.slice(start,html.indexOf('\n});',start)+4);
 await page.setContent('<main id="view"><div><button data-src="5" data-on="true">Açık</button></div></main>');
 await page.evaluate(() => {
   window.$ = selector=>document.querySelector(selector); window.tt = text=>text;
   window.mode = 'error'; window.writes = 0; window.finish = null;
   window.sb = {from(table) {
     if (table !== 'ms_scout_sources') throw Error('unexpected table');
     const query = {update(values){query.values=values;return query;},eq(key,id){if(key!=='id'||id!=='5')throw Error('missing row filter');return query;},select(columns){if(columns!=='id,active')throw Error('missing confirmation');return query;},async single(){
       window.writes++;
       if(mode==='throw') throw Error('offline');
       if(mode==='error') return {error:{message:'denied'}};
       if(mode==='empty') return {data:null};
       if(mode==='pending') await new Promise(resolve=>window.finish=resolve);
       return {data:{id:5,active:query.values.active},error:null};
     }}; return query;
   }};
 });
 await page.addScriptTag({content:handler});
 for (const mode of ['error','empty','throw']) {
   await page.evaluate(mode=>window.mode=mode,mode);
   await page.locator('[data-src]').click();
   await page.locator('[data-source-error]').waitFor();
   assert.equal(await page.locator('[data-src]').getAttribute('data-on'),'true');
   assert.equal(await page.locator('[data-src]').isEnabled(),true);
   console.log('PASS '+mode+' keeps original state and allows retry');
 }
 await page.evaluate(()=>{window.mode='pending';window.writes=0;});
 await page.locator('[data-src]').click();
 assert.equal(await page.locator('[data-src]').isDisabled(),true);
 await page.evaluate(()=>document.querySelector('[data-src]').dispatchEvent(new MouseEvent('click',{bubbles:true})));
 assert.equal(await page.evaluate(()=>writes),1);
 await page.evaluate(()=>finish());
 await page.waitForFunction(()=>document.querySelector('[data-src]').dataset.on==='false');
 assert.equal(await page.locator('[data-src]').innerText(),'Kapalı');
 assert.equal(await page.locator('[data-source-error]').count(),0);
 assert.equal(await page.locator('[data-src]').isEnabled(),true);
 console.log('PASS concurrent click is ignored and confirmed save updates state');
 assert.deepEqual(errors,[]);
} finally { await browser.close(); }
