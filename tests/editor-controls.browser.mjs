// Regression: the shared editor must reveal interactive panels and target actual swatches.
// All non-local requests are intercepted; no real edits, orders or uploads are sent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const origin=process.env.MS_PREVIEW_ORIGIN||'http://127.0.0.1:4174';
const key='11111111-1111-4111-8111-111111111111',edit='22222222-2222-4222-8222-222222222222';
const artifacts=process.env.MS_TEST_ARTIFACTS||'/private/tmp/editor-controls-qa';fs.mkdirSync(artifacts,{recursive:true});
let passed=0;
async function fixture(width=1440,lang='en'){
 const context=await browser.newContext({viewport:{width,height:1000},locale:lang,reducedMotion:'reduce'}),calls=[],errors=[];
 await context.addInitScript(lang=>localStorage.setItem('ms_lang',lang),lang);
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin===origin)return route.continue();
  const send=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  if(u.pathname.endsWith('ms_client_view'))return send({name:'Rufcut',url:origin+'/rufcut/'});
  if(u.pathname.endsWith('ms_submit')){calls.push(JSON.parse(route.request().postData()));return send({ok:true,edit_key:edit,version:1});}
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/request/?k='+key);await page.locator('.area-button').first().waitFor({state:'attached'});
 const site=page.frameLocator('#site');
 async function areas(){if(!await page.locator('#search').isVisible()){if(await page.locator('#backAreas').isVisible())await page.locator('#backAreas').click();else await page.locator('#areasToggle').click();}}
 async function choose(field){await areas();await page.locator('#search').fill('');const target=page.locator('.area-button[data-anchor*="'+field+'"]');await target.evaluate(el=>el.closest('details').open=true);await target.click();await page.locator('#content').waitFor();}
 return {context,page,site,calls,errors,choose};
}
async function test(name,fn){if(process.env.MS_TEST_ONLY&&!new RegExp(process.env.MS_TEST_ONLY).test(name))return;await fn();passed++;console.log('PASS '+name);}
try{
 await test('clicking maker tabs in Edit activates exactly one matching panel',async()=>{
  const f=await fixture();await f.site.locator('#maker-tab-1').click();assert.equal(await f.site.locator('#maker-panel-1').isVisible(),true);assert.equal(await f.site.locator('#maker-panel-0').isVisible(),false);assert.equal(await f.site.locator('#maker-tab-1').getAttribute('aria-selected'),'true');await f.context.close();
 });
 await test('sidebar selection reveals hidden panels without breaking ARIA or Next/Previous',async()=>{
  const f=await fixture();await f.choose('maker.button.23');assert.equal(await f.site.locator('#maker-tab-2').getAttribute('aria-selected'),'true');assert.equal(await f.site.locator('[role=tabpanel]:visible').count(),1);await f.page.locator('#backAreas').click();await f.site.locator('#makerPrevious').click();assert.equal(await f.site.locator('#maker-tab-1').getAttribute('aria-selected'),'true');await f.site.locator('#makerPrevious').click();assert.equal(await f.site.locator('#maker-tab-0').getAttribute('aria-selected'),'true');await f.site.locator('#makerNext').click();assert.equal(await f.site.locator('#maker-tab-1').getAttribute('aria-selected'),'true');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('solid swatches edit the color and drawing, with precise review, confirmation and receipt',async()=>{
  const f=await fixture();await f.choose('maker.button.13');assert.match(await f.page.locator('#sidebarTitle').innerText(),/Wash: Dark indigo/);assert.equal(await f.page.locator('#content').inputValue(),'#111b2e');await f.page.locator('#colorPicker').fill('#87ceeb');await f.page.locator('#editNote').fill('Example draft color for validation.');assert.equal(await f.site.locator('#jBody').getAttribute('fill'),'rgb(135, 206, 235)');assert.equal(await f.site.locator('[data-ms-field="maker.button.13"]').innerText(),'');await f.page.locator('#saveField').click();assert.match(await f.page.locator('#fieldStatus').innerText(),/Wash: Dark indigo/);await f.choose('maker.button.20');await f.page.locator('#colorPicker').fill('#e6c183');assert.equal(await f.site.locator('#jStitch').getAttribute('stroke'),'rgb(230, 193, 131)');await f.page.locator('#saveField').click();await f.page.locator('#reviewBtn').click();assert.match(await f.page.locator('#changesList').innerText(),/#111b2e[\s\S]*#87ceeb/);await f.page.locator('#fEmail').fill('tester@example.com');await f.page.locator('#sendReview').click();assert.match(await f.page.locator('#confirmBody').innerText(),/Wash: Dark indigo/);assert.equal(f.calls.length,0);await f.page.locator('#confirmActions .btn').click();await f.page.locator('#done[open]').waitFor();assert.match(await f.page.locator('#doneList').innerText(),/#87ceeb/);assert.equal(f.calls[0].p_items[0].anchor,'/rufcut/::[data-ms-field="maker.button.13"]');assert.equal(f.calls[0].p_items[0].kind,'big');assert.match(f.calls[0].p_items[0].request,/#87ceeb[\s\S]*Note:/);assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('color drafts restore after reload, locate the right tab, and undo exactly',async()=>{
  const f=await fixture();await f.choose('maker.button.16');await f.page.locator('#content').fill('#334455');await f.page.locator('#saveField').click();await f.page.reload();await f.page.locator('.area-button').first().waitFor({state:'attached'});await f.page.locator('#reviewBtn').click();await f.page.locator('[data-locate]').click();assert.equal(await f.page.locator('#content').inputValue(),'#334455');assert.equal(await f.site.locator('#maker-tab-1').getAttribute('aria-selected'),'true');assert.equal(await f.site.locator('#jBody').getAttribute('fill'),'rgb(51, 68, 85)');await f.page.locator('#undoField').click();assert.equal(await f.site.locator('[data-ms-field="maker.button.16"]').getAttribute('style'),'background:#232427');assert.equal(await f.site.locator('#jBody').getAttribute('fill'),'rgb(35, 36, 39)');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('unsaved color edits guard tab switches and cancel restores the original',async()=>{
  const f=await fixture();await f.choose('maker.button.13');await f.page.locator('#content').fill('#112233');await f.site.locator('#maker-tab-2').click();await f.page.locator('#confirm[open]').waitFor();assert.equal(await f.site.locator('#maker-tab-1').getAttribute('aria-selected'),'true');await f.page.locator('#confirmActions button').first().click();assert.equal(await f.page.locator('#content').inputValue(),'#112233');await f.page.locator('#cancelField').click();assert.equal(await f.site.locator('[data-ms-field="maker.button.13"]').getAttribute('style'),'background:#111B2E');await f.site.locator('#maker-tab-2').click();assert.equal(await f.site.locator('#maker-tab-2').getAttribute('aria-selected'),'true');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('invalid color cannot be committed; pattern instructions preserve the actual swatch',async()=>{
  const f=await fixture();await f.choose('maker.button.18');await f.page.locator('#content').fill('blue');await f.page.locator('#saveField').click();assert.match(await f.page.locator('#fieldStatus').innerText(),/HEX/);assert.equal(await f.page.locator('#reviewBtn').innerText(),'Review');await f.page.locator('#cancelField').click();await f.choose('maker.button.14');assert.equal(await f.page.locator('#colorPicker').count(),0);const before=await f.site.locator('[data-ms-field="maker.button.14"]').getAttribute('style');await f.page.locator('#content').fill('Use a wider dark-indigo stripe.');await f.page.locator('#saveField').click();assert.equal(await f.site.locator('[data-ms-field="maker.button.14"]').getAttribute('style'),before);assert.equal(await f.site.locator('[data-ms-field="maker.button.14"]').innerText(),'');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('runtime values cannot be destructively edited and maker still works in Browse',async()=>{
  const f=await fixture();for(let i=1;i<=6;i++)assert.equal(await f.page.locator('.area-button[data-anchor*="maker.h3.'+i+'"]').count(),0);assert.equal(await f.page.locator('.area-button[data-anchor*="summary"]').count(),0);await f.page.locator('#mBrowse').click();await f.site.locator('[data-v="Wide"]').click();assert.equal(await f.site.locator('#vFit').innerText(),'Wide');await f.site.locator('#maker-tab-1').click();await f.site.locator('[data-v="Black"]').click();assert.equal(await f.site.locator('#vWash').innerText(),'Black');await f.site.locator('#maker-tab-2').click();await f.site.locator('[data-v="Cuffed"]').click();assert.equal(await f.site.locator('#vHem').innerText(),'Cuffed');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 await test('all ten swatches are listed; colors, patterns and photos work at narrow/wide widths in both themes',async()=>{
  for(const width of [320,390,1440]){const f=await fixture(width);for(const scheme of ['dark','light']){await f.page.emulateMedia({colorScheme:scheme});for(const field of ['maker.button.13','maker.button.17','maker.button.20','maker.button.22','openingPhoto','workshopPhoto']){await f.choose(field);assert.match(await f.page.locator('#sidebarTitle').innerText(),/Wash:|Thread:|photo/i);assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(field==='maker.button.13'&&width===390)await f.page.screenshot({path:artifacts+'/color-editor-390-'+scheme+'.png'});}await f.page.screenshot({path:artifacts+'/controls-'+width+'-'+scheme+'.png'});}await f.page.locator('#backAreas').click();await f.page.locator('#search').fill('');assert.equal(await f.page.locator('.area-button').evaluateAll(xs=>xs.filter(x=>/maker\.button\.(1[3-9]|2[0-2])"/.test(x.dataset.anchor)).length),10);assert.deepEqual(f.errors,[]);await f.context.close();}
 });
 await test('keyboard tab navigation guards unsaved changes and theme switching works in Edit',async()=>{
  const f=await fixture();await f.choose('maker.button.13');await f.page.locator('#content').fill('#445566');await f.site.locator('#maker-tab-1').press('ArrowRight');await f.page.locator('#confirm[open]').waitFor();await f.page.locator('#confirmActions .btn').click();assert.equal(await f.site.locator('#maker-tab-2').getAttribute('aria-selected'),'true');assert.equal(await f.site.locator('[role=tabpanel]:visible').count(),1);await f.site.locator('#themeToggle').click();assert.equal(await f.site.locator('html').getAttribute('data-theme'),'light');await f.site.locator('#maker-tab-2').press('Home');assert.equal(await f.site.locator('#maker-tab-0').getAttribute('aria-selected'),'true');assert.deepEqual(f.errors,[]);await f.context.close();
 });
 console.log(JSON.stringify({passed,failures:0}));
}finally{await browser.close();}
