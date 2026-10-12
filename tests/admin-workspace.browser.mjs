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
   let rejectReview, writes = 0;
   const reviewSnapshot = {...snapshot,jobs:[{id:7,status:'review',kind:'design',sector:'retail',brief:'A test draft'}]};
   await MsPlatform.mount(a, {admin:true,rpc:async name => {
     if (name === 'ms_workspace_snapshot') return reviewSnapshot;
     if (name === 'ms_intake_list') return [];
     if (name === 'ms_review_draft') { writes++; return new Promise((resolve,reject) => {rejectReview = reject;}); }
     throw Error('Unexpected RPC');
   }});
   const approve = a.querySelector('[data-review][data-status="ready"]');
   const reject = a.querySelector('[data-review][data-status="rejected"]');
   const saving = approve.onclick();
   await reject.onclick();
   const reviewLocked = writes === 1 && approve.disabled && reject.disabled;
   rejectReview(Error('offline')); await saving;
   const reviewRetry = !approve.disabled && !reject.disabled && !!a.querySelector('.ms-platform-status').textContent;
   let queueFail = true, failSnapshot = false, finishQueue;
   const tokens = [];
   const drafting = {admin:true,prepare:async()=>{},rpc:async (name,body) => {
     if (name === 'ms_workspace_snapshot') { if (failSnapshot) throw Error('offline'); return snapshot; }
     if (name === 'ms_intake_list') return [];
     if (name === 'ms_queue_draft') {
       tokens.push(body.p_token);
       if (queueFail) throw Error('lost response');
       return new Promise(resolve => {finishQueue = resolve;});
     }
     throw Error('Unexpected RPC');
   }};
   await MsPlatform.mount(a,drafting);
   let form = a.querySelector('.ms-draft-form');
   form.elements.brief.value = 'Keep my unfinished draft';
   form.elements.sector.value = 'fashion';
   form.dispatchEvent(new Event('input',{bubbles:true}));
   await form.onsubmit({preventDefault(){}});
   failSnapshot = true; await MsPlatform.mount(a,drafting);
   failSnapshot = false; await MsPlatform.mount(a,drafting);
   form = a.querySelector('.ms-draft-form');
   const draftRetained = form.elements.brief.value === 'Keep my unfinished draft' && form.elements.sector.value === 'fashion';
   queueFail = false;
   const queued = form.onsubmit({preventDefault(){}});
   await MsPlatform.mount(a,drafting);
   const pendingProtected = a.querySelector('.ms-draft-form') === form && form.querySelector('button').disabled;
   finishQueue({id:9}); await queued;
   const draftCleared = a.querySelector('.ms-draft-form').elements.brief.value === '' && tokens.length === 2 && tokens[0] === tokens[1];
   let intakeFailed = false, saveFailed = true, finishIntake, intakeWrites = 0;
   const intake = {id:12,business:'Test business',status:'new',operator_note:'Server note',answers:{}};
   const applications = {admin:true,rpc:async (name,body) => {
     if (name === 'ms_workspace_snapshot') return snapshot;
     if (name === 'ms_intake_list') { if (intakeFailed) throw Error('offline'); return [intake]; }
     if (name === 'ms_handle_intake') {
       intakeWrites++;
       if (saveFailed) throw Error('save failed');
       await new Promise(resolve => {finishIntake = resolve;});
       intake.status = body.p_status; intake.operator_note = body.p_note;
       return {};
     }
     throw Error('Unexpected RPC');
   }};
   await MsPlatform.mount(a,applications);
   let application = a.querySelector('[data-intake]');
   application.elements.note.value = 'Unfinished operator note';
   application.elements.status.value = 'reviewing';
   application.dispatchEvent(new Event('input',{bubbles:true}));
   await application.onsubmit({preventDefault(){}});
   intakeFailed = true; await MsPlatform.mount(a,applications);
   intakeFailed = false; await MsPlatform.mount(a,applications);
   application = a.querySelector('[data-intake]');
   const intakeRetained = application.elements.note.value === 'Unfinished operator note' && application.elements.status.value === 'reviewing';
   saveFailed = false;
   const savingIntake = application.onsubmit({preventDefault(){}});
   await application.onsubmit({preventDefault(){}});
   await MsPlatform.mount(a,applications);
   const intakeLocked = intakeWrites === 2 && a.querySelector('[data-intake]') === application && application.querySelector('button').disabled;
   finishIntake(); await savingIntake;
   intake.operator_note = 'Updated from another session';
   await MsPlatform.mount(a,applications);
   const intakeClean = a.querySelector('[data-intake]').elements.note.value === intake.operator_note;
   const host=document.createElement('main');host.id='main';document.body.append(host);
   const refreshHost=async options=>{host.innerHTML='<div id="workspaceRoot"></div>';await MsPlatform.mount(host.firstElementChild,options);return host.firstElementChild;};
   let workspace=await refreshHost(drafting);
   form=workspace.querySelector('.ms-draft-form');form.elements.brief.value='Survives shell refresh';form.dispatchEvent(new Event('input',{bubbles:true}));
   workspace=await refreshHost(drafting);
   const rootDraft=workspace.querySelector('.ms-draft-form').elements.brief.value==='Survives shell refresh';
   form=workspace.querySelector('.ms-draft-form');const pendingDraft=form.onsubmit({preventDefault(){}});
   workspace=await refreshHost(drafting);
   const rootPendingDraft=workspace.querySelector('.ms-draft-form')===form&&form.querySelector('button').disabled;
   finishQueue({id:10});await pendingDraft;
   workspace=await refreshHost(applications);application=workspace.querySelector('[data-intake]');
   application.elements.note.value='Survives application refresh';application.dispatchEvent(new Event('input',{bubbles:true}));
   workspace=await refreshHost(applications);
   const rootIntake=workspace.querySelector('[data-intake]').elements.note.value==='Survives application refresh';
   application=workspace.querySelector('[data-intake]');const pendingApplication=application.onsubmit({preventDefault(){}});
   workspace=await refreshHost(applications);
   const rootPendingIntake=workspace.querySelector('[data-intake]')===application&&application.querySelector('button').disabled;
   finishIntake();await pendingApplication;
   return {isolated,retried,independent,staleIgnored,reviewLocked,reviewRetry,draftRetained,pendingProtected,draftCleared,intakeRetained,intakeLocked,intakeClean,rootDraft,rootPendingDraft,rootIntake,rootPendingIntake};
 });
 for (const [name, passed] of Object.entries(result)) { assert.equal(passed,true,name); console.log('PASS ' + name); }
 assert.deepEqual(errors,[]);
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
