import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {catalogService} from './catalog-service-fixture.mjs';
const f=catalogService();
for(const action of ['status','connect','catalog','set_count','add_item','commerce_status','commerce_save','commerce_quote','set_public','disconnect']){
 const response=await f.post({action});assert.equal(response.status,409,action);assert.equal((await response.json()).error,'square_disabled');
}
assert.deepEqual((await(await f.publicCatalog()).json()).items,[]);
for(const route of ['commerce','checkout']){
 const method=route==='checkout'?'POST':'GET';const response=await f.request(new Request('https://test.supabase.co/functions/v1/ms-square/'+route+(method==='GET'?'?site=rufcut':''),{method,...(method==='POST'?{body:JSON.stringify({site:'rufcut',lines:[]})}:{})}));assert.equal(response.status,409);assert.equal((await response.json()).error,'sales_disabled');
}
const payload=Buffer.from(JSON.stringify({site:'rufcut',exp:Date.now()+10000,role:'admin'})).toString('base64url'),sig=createHmac('sha256','test-app-secret').update(payload).digest('base64url');
const callback=await f.request(new Request('https://test.supabase.co/functions/v1/ms-square/callback?code=unused&state='+payload+'.'+sig));assert.equal(callback.status,302);assert.ok(callback.headers.get('location').includes('square=disabled'));
assert.equal(f.calls.square.length,0);assert.equal(f.calls.writes.length,0);
assert.equal((await f.post({action:'status'},false)).status,403);
const other=catalogService({site:'test-shop'});assert.equal((await other.post({action:'status'})).status,200);assert.equal((await(await other.post({action:'status'})).json()).connected,true);assert.equal((await other.post({action:'connect'})).status,200);
console.log('PASS: Rufcut public/catalog/checkout/commerce/OAuth and all panel actions blocked without Square calls or writes; other site still works; unauthenticated denied.');
