// Actual partner session handshake lines in a same-origin browser iframe.
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
 const page=await context.newPage();
 await context.route(origin+'/bridge-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto(origin+'/404.html');
 await page.setContent('<iframe src="'+origin+'/bridge-fixture"></iframe>');
 const child=page.frames().find(frame=>frame!==page.mainFrame());await child.waitForLoadState();
 await page.evaluate(()=>{
  window.mode='success';
  addEventListener('message',event=>{
   if(event.origin!==location.origin||event.data?.type!=='ms-admin-refresh')return;
   const frame=event.source;
   if(mode==='wrong-source')frame.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:frame,data:{type:'ms-admin-refreshed'}}));
   if(mode==='wrong-origin')frame.dispatchEvent(new MessageEvent('message',{origin:'https://other.example',source:window,data:{type:'ms-admin-refreshed'}}));
   if(mode==='unrelated')frame.postMessage({type:'ms-admin-refresh-other'},location.origin);
   const type=['failure','wrong-source','wrong-origin'].includes(mode)?'ms-admin-refresh-failed':'ms-admin-refreshed';
   frame.postMessage({type},location.origin);
  });
 });
 for(const name of ['heron','laloo']){
  const html=await readFile(new URL('../admin/'+name+'.html',import.meta.url),'utf8');
  const line=html.split('\n').find(line=>line.includes('await new Promise')&&line.includes('window.parent.postMessage'));
  assert.ok(line,name+' handshake');
  await child.evaluate(code=>{window.waitForParent=new Function('return (async()=>{'+code.trim()+'})()');},line);
  for(const mode of ['success','failure','wrong-source','wrong-origin','unrelated']){
   await page.evaluate(mode=>window.mode=mode,mode);
   const result=await child.evaluate(async()=>{
    try{await Promise.race([waitForParent(),new Promise((resolve,reject)=>setTimeout(()=>reject(Error('test_timeout')),1000))]);return 'success';}
    catch(error){return error.message;}
   });
   if(['success','unrelated'].includes(mode))assert.equal(result,'success',name+' '+mode);
   else{assert.notEqual(result,'success',name+' '+mode);assert.notEqual(result,'test_timeout',name+' '+mode);}
   console.log('PASS '+name+' '+mode);
  }
 }
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
