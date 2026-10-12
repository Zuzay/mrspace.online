// Local browser regression checks; all external requests are blocked.
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
 page.on('pageerror', e => errors.push(e.message));
 await page.goto(origin + '/admin/?preview=1');
 await page.waitForFunction(() => window.MsPlatform);
 await page.evaluate(() => MsPlatform.ready);
 const result = await page.evaluate(async () => {
   document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
   const a = document.getElementById('a'), b = document.getElementById('b');
   const snapshot = {admin:true,jobs:[],sites:[{slug:'heron',name:'Heron CA',sector:'retail',connections:[],requests:[]}]};
   let failed = true;
   const options = {admin:true,rpc:async name => {
     if (name === 'ms_workspace_snapshot') return snapshot;
     if (name === 'ms_intake_list') { if (failed) throw Error('offline'); return []; }
     throw Error('Unexpected write: ' + name);
   }};
   await MsPlatform.mount(a, options);
   const isolated = a.querySelectorAll('.ms-workspace').length === 1 && !!a.querySelector('[data-intake-retry]') && !a.querySelector('[data-retry]');
   failed = false;
   a.querySelector('[data-intake-retry]').click();
   await new Promise(resolve => setTimeout(resolve, 50));
   const retried = !a.querySelector('[data-intake-retry]') && a.querySelectorAll('.ms-workspace').length === 1;
   let finishA;
   const delayed = {admin:false,rpc:() => new Promise(resolve => {finishA = resolve;})};
   const pending = MsPlatform.mount(a, delayed);
   await Promise.resolve();
   await MsPlatform.mount(b, {demo:true});
   finishA(snapshot); await pending;
   const independent = a.querySelectorAll('.ms-workspace').length === 1 && b.querySelectorAll('.ms-workspace').length === 2;
   let rejectOld;
   const old = MsPlatform.mount(a, {rpc:() => new Promise((resolve,reject) => {rejectOld = reject;})});
   await Promise.resolve();
   await MsPlatform.mount(a, {demo:true});
   rejectOld(Error('old failure')); await old;
   const staleIgnored = a.querySelectorAll('.ms-workspace').length === 2 && !a.querySelector('[data-retry]');
   return {isolated,retried,independent,staleIgnored};
 });
 for (const [name, passed] of Object.entries(result)) { assert.equal(passed,true,name); console.log('PASS ' + name); }
 assert.deepEqual(errors,[]);
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
