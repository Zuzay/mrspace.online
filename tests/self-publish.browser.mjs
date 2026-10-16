import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MS_PLAYWRIGHT_MODULE||'/Users/zuzay/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const origin='http://127.0.0.1:8766';
const manifest=fs.readFileSync(new URL('../supabase/functions/ms-content/manifest.ts',import.meta.url),'utf8'),allowed=JSON.parse(manifest.match(/export const fields = (.*);/)[1]);
try{for(const language of ['en','tr','es','de','fr']){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];let revision=0,fields={},pubs=0,fail=false;
 page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(({language})=>{localStorage.setItem('ms_lang',language);localStorage.setItem('ms_panel',JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,email:'test@example.test'}));},{language});
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();if(!u.hostname.endsWith('.supabase.co'))return route.abort();const body=route.request().postDataJSON()||{};let data={};
 if(u.pathname.endsWith('/ms_my_sites'))data=[{slug:'rufcut',site_key:'7b1d5c35-e743-4c7e-b8a3-78a91944e179'}];
 if(u.pathname.endsWith('/ms-content')){
  if(body.action==='get')data={enabled:true,revision,fields,allowed};
  if(body.action==='public')data={revision,fields};
  if(body.action==='publish'){if(fail)return route.fulfill({status:409,json:{error:'conflict'}});pubs++;revision++;for(const c of body.changes)fields[c.page+'|'+c.field+'|'+c.lang]={type:c.type,value:c.value};data={ok:true,revision};}
 }
 return route.fulfill({status:200,json:data});});
 await page.goto(origin+'/request/?self=rufcut');await page.locator('.area-button').first().waitFor({state:'attached'});assert.equal(await page.locator('#fatal').isVisible(),false);
 const parts=await page.evaluate(()=>MsEditorAPI.parts());assert.ok(parts.length>10);assert.ok(!parts.some(p=>p.id.includes('header.a.1')));const part=parts.find(p=>p.id.includes('opening.p.1'));assert.ok(part);
 await page.evaluate(id=>MsEditorAPI.select(id),part.id);await page.locator('#content').fill('Updated '+language);await page.locator('#saveField').click();await page.locator('#reviewBtn').click();assert.equal(await page.locator('#fOther').count(),0);
 fail=true;await page.locator('#sendReview').click();await page.locator('#confirmActions .btn').last().click();await page.waitForFunction(()=>!S.busy);assert.equal(pubs,0);assert.equal(await page.locator('#done').isVisible(),false);
 fail=false;await page.locator('#sendReview').click();await page.locator('#confirmActions .btn').last().click();await page.locator('#done').waitFor();assert.equal(pubs,1);assert.equal(errors.length,0,errors.join('\n'));
 await page.locator('#reviseBtn').click();await page.locator('.area-button').first().waitFor({state:'attached'});assert.equal(await page.frameLocator('#site').locator('[data-ms-field="opening.p.1"]').textContent(),'Updated '+language);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await context.close();console.log('PASS '+language+' mobile preview, conflict, publication, reload');
 }}finally{await browser.close();}
