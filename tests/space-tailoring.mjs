import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {service} from './tailoring-service-fixture.mjs';
import {secureHTML,isPublicFile} from '../tools/build-public-site.mjs';
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><path d="M50 80H300V300H50Z" fill="#263e60"/></svg>';
const payload=(product='bag')=>({action:'submit_piece',name:'Fixture customer',email:'fixture@example.test',token:crypto.randomUUID(),preview_svg:svg,design:{product,shape:product==='bag'?'Tote':'Work jacket',fabric:'Raw denim',color:'Indigo',finish:'Contrast stitch'}});
test('bag and jacket designs create isolated ST receipts; retries are idempotent',async()=>{
 const f=service();for(const product of ['bag','jacket']){const body=payload(product),one=await(await f.post(body)).json(),two=await(await f.post(body)).json();assert.match(one.ticket,/^ST-[A-Z2-9]{7}$/);assert.equal(two.ticket,one.ticket);assert.equal(two.duplicate,true);assert.equal(f.state.jobs.at(-1).site,'space-tailoring');assert.equal(f.state.jobs.at(-1).design.product,product);assert.equal((await f.post({...body,name:'Changed'})).status,409);}
 assert.equal(f.state.jobs.length,2);assert.ok(f.calls.rpc.some(c=>c.name==='ms_create_tailoring_order'));assert.equal(f.calls.fetches.length,0);
});
test('invalid design, wrong site, SVG injection and anonymous staff actions are rejected',async()=>{
 const f=service();assert.equal((await f.post({...payload(),design:{...payload().design,shape:'invalid'}})).status,400);assert.equal((await f.post({...payload(),site:'rufcut'})).status,404);assert.equal((await f.post({...payload(),preview_svg:svg.replace('<path','<path onclick="alert(1)"')})).status,400);assert.equal((await f.post({action:'orders'})).status,401);assert.equal(f.state.jobs.length,0);
});
test('staff and public tracking queries never read another site; viewer and unrelated member denied',async()=>{
 const f=service();await f.post(payload());const job=f.state.jobs[0];f.state.jobs.push({...job,site:'rufcut',ticket:'RC-OTHERXX'});const list=await(await f.post({action:'list'},{auth:true})).json();assert.equal(list.jobs.length,1);assert.equal((await f.post({action:'track',ticket:'RC-OTHERXX'})).status,404);const track=await(await f.post({action:'track',ticket:job.ticket})).json();assert.equal(track.ticket,job.ticket);assert.equal(track.customer_email,undefined);
 f.state.admin=false;f.state.viewer=true;assert.equal((await f.post({action:'list'},{auth:true})).status,401);f.state.viewer=false;f.state.member=true;assert.equal((await f.post({action:'list'},{auth:true})).status,200);
});
test('read-only validation and failed storage never send messages or invent receipts',async()=>{
 const f=service();assert.equal((await f.post({...payload(),action:'validate_piece'})).status,200);assert.equal(f.state.jobs.length,0);f.state.saveFail=true;assert.equal((await f.post(payload())).status,500);assert.equal(f.state.jobs.length,0);assert.equal(f.calls.fetches.length,0);
});
test('homepage has no old brand or assets; original direct route stays and is noindex in public artifact',async()=>{
 const home=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(home,/rufcut/i);assert.match(home,/href="space-tailoring\/"/);assert.match(await readFile(new URL('../rufcut/index.html',import.meta.url),'utf8'),/RUFCUT/);assert.match(secureHTML('<head></head>','rufcut/repair/index.html'),/noindex,nofollow,noarchive/);assert.equal(isPublicFile('space-tailoring/index.html'),true);
 const scan=async dir=>{for(const item of await readdir(dir,{withFileTypes:true})){const f=new URL(item.name+(item.isDirectory()?'/':''),dir);if(item.isDirectory())await scan(f);else if(/\.(html|js|css|json)$/.test(item.name))assert.doesNotMatch(await readFile(f,'utf8'),/rufcut|517 Ocean|13104735384|Venice Beach/i,f.pathname);}};await scan(new URL('../space-tailoring/',import.meta.url));await scan(new URL('../panel/space-tailoring/',import.meta.url));
});
