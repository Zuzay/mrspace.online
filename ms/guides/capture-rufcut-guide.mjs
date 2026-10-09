// Guide screenshots: actual site UI, sample work orders, all external API calls blocked.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {service} from '../../tests/order-service-fixture.mjs';
import {catalogService} from '../../tests/catalog-service-fixture.mjs';
const {chromium}=await import(pathToFileURL(process.env.MS_PLAYWRIGHT_MODULE));
const origin=process.env.MS_PREVIEW_ORIGIN||'http://127.0.0.1:4174';
const out=process.env.MS_GUIDE_ASSETS||'/private/tmp/rufcut-guide';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.MS_CHROME_PATH,headless:true});
const square=catalogService();square.state.objects[0].image_data.url=origin+'/rufcut/media/rufcut-detail.webp';
const orders=service(),notifications=service('notifications'),key='11111111-1111-4111-8111-111111111111';
const context=await browser.newContext({locale:'en-US',viewport:{width:1280,height:900},reducedMotion:'reduce',colorScheme:'light'});
await context.addInitScript(()=>localStorage.setItem('ms_lang','en'));
await context.route('**/*',async route=>{
 const request=route.request(),u=new URL(request.url());if(u.origin===origin)return route.continue();
 if(u.hostname.endsWith('.supabase.co')){
  const body=request.postDataJSON?.();let data={};
  if(u.pathname.endsWith('ms-repair')||u.pathname.endsWith('ms-notifications')){
   const r=await (u.pathname.endsWith('ms-repair')?orders:notifications).post(body,{auth:true});return route.fulfill({status:r.status,contentType:'application/json',body:await r.text(),headers:{'Access-Control-Allow-Origin':'*'}});
  }
  if(u.pathname.endsWith('ms_my_sites'))data=[{slug:'rufcut',name:'Rufcut',url:origin+'/rufcut/',site_key:key}];
  else if(u.pathname.endsWith('ms-square')){const r=await square.post(body);return route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});}
  else if(u.pathname.endsWith('ms_workspace_snapshot'))data={sites:[]};
  else if(u.pathname.includes('/public'))data={items:[]};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
 }
 return route.abort();
});
const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+name+'.png'});console.log('Captured '+name);};
try{
 await page.goto(origin+'/panel/');await page.locator('#login').waitFor();await shot('login');
 await page.goto(origin+'/rufcut/repair/');await page.locator('#garmentSelect').selectOption('jacket');await page.locator('#jobs input[value=take_in]').check();await page.locator('#jobs input[value=patch]').check();await page.locator('.workbench').screenshot({path:out+'/repair.png'});console.log('Captured repair');
 await page.locator('#next').click();await page.locator('#customerName').fill('Sample customer');await page.locator('#customerEmail').fill('sample@example.test');await page.locator('#send').click();await page.locator('#success:not([hidden])').waitFor();
 const sample=orders.state.jobs[0];fs.writeFileSync(out+'/sample.svg',sample.items[0].preview_svg);Object.assign(sample,{ticket:'RC-SAMPLE2',created_at:'2026-10-08T17:30:00Z',measurements:'Confirm sleeve length at fitting.',staff_notes:'Check patch position with the customer.'});
 await page.goto(origin+'/rufcut/#build');await page.locator('[data-k=fit] [data-v=Relaxed]').click();await page.locator('#requestPair').click();await page.locator('#pairOrder[open]').waitFor();await shot('jeans');
 await context.addInitScript(()=>localStorage.setItem('ms_panel',JSON.stringify({access_token:'test-session',expires_at:Date.now()/1000+3600,email:'owner@example.test'})));
 orders.state.jobs.push({site:'rufcut',id:crypto.randomUUID(),ticket:'RC-DENIM23',kind:'jeans',customer_name:'Sample jeans customer',customer_email:'sample-jeans@example.test',design:{fit:'Relaxed',denim:'Raw',wash:'Dark indigo',thread:'Tonal',fly:'Zip fly',hem:'Chain stitch'},status:'received',created_at:'2026-10-08T17:40:00Z',items:[],preview_svg:'',staff_notes:'',measurements:''});
 await page.goto(origin+'/panel/?site=rufcut&view=orders');await page.locator('.order-ticket').first().waitFor();await shot('inbox');
 await page.locator('[data-ticket="RC-SAMPLE2"]').evaluate(el=>el.open=true);await page.locator('[data-ticket="RC-SAMPLE2"] img').evaluate(img=>img.decode()).catch(e=>{throw Error('Ticket drawing failed: '+e.message)});await page.locator('[data-ticket="RC-SAMPLE2"]').screenshot({path:out+'/ticket.png'});console.log('Captured ticket');
 await page.goto(origin+'/panel/?site=rufcut&view=catalog');await page.locator('[data-cat-item=coat] summary').click();await page.locator('[data-cat-item=coat] [name=section]').selectOption('shop');await page.locator('[data-cat-item=coat] [data-variant-row=s] [type=checkbox]').check();await page.locator('[data-cat-item=coat] [data-variant-row=m] [type=checkbox]').check();await shot('catalog');await page.locator('[data-cat-discard]').first().click();await page.goto(origin+'/panel/?site=rufcut&view=help');await page.locator('.cat-help').waitFor();await shot('welcome');
 await page.locator('#out').click();await page.locator('#demoBtn').click();await page.locator('[data-v=stock]').click();await page.locator('[data-label]').first().waitFor();await shot('stock');await page.locator('[data-label]').first().click();await page.locator('[data-v=labels]').click();await shot('labels');
 await page.goto(origin+'/request/?preview=rufcut');await page.locator('.area-button').first().waitFor();await page.locator('#search').fill('workshop');await page.locator('.area-button').first().click();await page.locator('#content').waitFor();await shot('editor');
 await page.setViewportSize({width:430,height:1000});await page.goto(origin+'/panel/?site=rufcut');await page.locator('.panel-alerts').waitFor();await page.locator('.panel-alerts summary').click();await page.locator('[data-app-email] input[type=email]').waitFor();await page.locator('#panelAppTools').screenshot({path:out+'/phone.png'});console.log('Captured phone');
 if(errors.length)throw Error(errors.join('\n'));console.log('Screenshots use sample data only; no live orders or notifications were sent.');
}finally{await browser.close();}
