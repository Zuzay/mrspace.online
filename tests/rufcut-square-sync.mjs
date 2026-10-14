import assert from 'node:assert/strict';
import {catalogService} from './catalog-service-fixture.mjs';
let count=0;const test=async(name,fn)=>{await fn();console.log('PASS '+name);count++;};
const read=async f=>(await(await f.publicCatalog()).json()).items;
await test('Square-managed Rufcut publishes new items and newly added variations with no publication write',async()=>{
 const f=catalogService({squareManaged:true});let items=await read(f);assert.equal(items.length,2);assert.equal(items.find(i=>i.id==='coat').variations.length,2);
 const coat=f.state.objects.find(o=>o.id==='coat');coat.item_data.variations.push({type:'ITEM_VARIATION',id:'xl',item_variation_data:{name:'XL',price_money:{amount:54000,currency:'USD'},track_inventory:false}});
 items=await read(f);assert.equal(items.find(i=>i.id==='coat').variations.length,3);assert.equal(f.calls.writes.length,0);
});
await test('Square categories group sizes and drive category changes, names, prices, descriptions and images',async()=>{
 const f=catalogService({squareManaged:true}),coat=f.state.objects.find(o=>o.id==='coat');f.state.objects.push({type:'CATEGORY',id:'vintage',category_data:{name:'Vintage Finds'}});coat.item_data.categories=[{id:'vintage',ordinal:4}];coat.item_data.name='New Square title';coat.item_data.description_plaintext='Changed in Square';coat.item_data.variations[0].item_variation_data.price_money.amount=12345;
 let item=(await read(f)).find(i=>i.id==='coat');assert.equal(item.name,'New Square title');assert.equal(item.description,'Changed in Square');assert.equal(item.variations[0].price,12345);assert.equal(item.square_category,'square:vintage');assert.equal(item.category_label,'Vintage Finds');assert.equal(item.variations.length,2);
 f.state.objects.find(o=>o.id==='vintage').category_data.name='Accessories';item=(await read(f)).find(i=>i.id==='coat');assert.equal(item.category,'accessories');assert.equal(item.square_category,undefined);
});
await test('Square Workshop, Repairs and Website hidden categories route without name heuristics',async()=>{
 const f=catalogService({squareManaged:true}),coat=f.state.objects.find(o=>o.id==='coat');f.state.objects.push({type:'CATEGORY',id:'destination',category_data:{name:'Workshop'}});coat.item_data.categories=[{id:'destination'}];assert.equal((await read(f)).find(i=>i.id==='coat').section,'workshop');
 f.state.objects.at(-1).category_data.name='Repairs';assert.equal((await read(f)).find(i=>i.id==='coat').section,'repair');f.state.objects.at(-1).category_data.name='Website hidden';assert.ok(!(await read(f)).some(i=>i.id==='coat'));
});
await test('legacy exclusions survive; archived, deleted and sold-out choices stay off the site',async()=>{
 const f=catalogService({squareManaged:true}),coat=f.state.objects.find(o=>o.id==='coat');f.state.rules.push({site:'rufcut',item_id:'coat',section:'hidden',variations:{}});assert.ok(!(await read(f)).some(i=>i.id==='coat'));f.state.rules=[];coat.item_data.is_archived=true;assert.ok(!(await read(f)).some(i=>i.id==='coat'));coat.item_data.is_archived=false;coat.item_data.variations[0].item_variation_data.location_overrides=[{location_id:'shop',sold_out:true}];assert.deepEqual((await read(f)).find(i=>i.id==='coat').variations.map(v=>v.id),['m']);coat.item_data.variations[1].is_deleted=true;assert.ok(!(await read(f)).some(i=>i.id==='coat'));
});
await test('Rufcut sales links use the merchant Square host and new Square Online URLs; invalid hosts fail closed',async()=>{
 const f=catalogService({squareManaged:true}),coat=f.state.objects.find(o=>o.id==='coat');coat.item_data.ecom_uri='https://www.rufcut.com/product/coat/coat';assert.equal((await read(f)).find(i=>i.id==='coat').variations[0].purchase_url,'https://rufcutvenice.square.site/product/coat/coat');coat.item_data.ecom_uri='https://square.link/u/new';assert.equal((await read(f)).find(i=>i.id==='coat').variations[0].purchase_url,'https://square.link/u/new');coat.item_data.ecom_uri='https://evil.test/pay';assert.ok(!(await read(f)).find(i=>i.id==='coat').variations[0].purchase_url);
});
await test('other sites retain curated review behavior; public off remains authoritative and leaks no private metadata',async()=>{
 const f=catalogService();assert.equal((await read(f)).length,0);f.state.public=false;assert.equal((await read(f)).length,0);const direct=catalogService({squareManaged:true}),serialized=JSON.stringify(await read(direct));for(const field of ['server-secret','KEEP-','square_url','square_categories','location_overrides'])assert.ok(!serialized.includes(field));assert.ok(direct.calls.square.every(c=>c.path==='/v2/catalog/list'||c.path==='/v2/inventory/counts/batch-retrieve'));
});
await test('direct source rejects ineffective panel placement changes without database writes',async()=>{const f=catalogService({squareManaged:true}),r=await f.post({action:'save_publication',item:'coat',publication:{}});assert.equal(r.status,409);assert.equal((await r.json()).error,'catalog_managed_in_square');assert.equal(f.calls.writes.length,0);});
await test('existing Square accounting categories cannot expose legacy hidden/review records or excluded variants',async()=>{
 const f=catalogService({squareManaged:true}),coat=f.state.objects.find(o=>o.id==='coat');f.state.objects.push({type:'CATEGORY',id:'bespoke',category_data:{name:'Bespoke Jeans'}});coat.item_data.categories=[{id:'bespoke'}];
 for(const section of ['hidden','review']){f.state.rules=[{site:'rufcut',item_id:'coat',section,variations:{s:{visible:true},m:{visible:false}}}];assert.ok(!(await read(f)).some(i=>i.id==='coat'));}
 f.state.rules[0].section='shop';assert.deepEqual((await read(f)).find(i=>i.id==='coat').variations.map(v=>v.id),['s']);
 f.state.objects.push({type:'CATEGORY',id:'publish',category_data:{name:'Website publish'}});coat.item_data.categories.push({id:'publish'});f.state.rules[0].section='hidden';assert.equal((await read(f)).find(i=>i.id==='coat').variations.length,2);
});
await test('actual Rufcut Alterations / Repairs and Patches / Embroidery groups are services; Shipping stays internal',async()=>{
 for(const name of ['Alterations / Repairs','Patches / Embroidery','Shipping']){const f=catalogService({squareManaged:true}),coat=f.state.objects.find(o=>o.id==='coat');f.state.objects.push({type:'CATEGORY',id:'actual',category_data:{name}});coat.item_data.categories=[{id:'actual'}];const item=(await read(f)).find(i=>i.id==='coat');if(name==='Shipping')assert.equal(item,undefined);else assert.equal(item.section,'repair');}
});

console.log(`${count} Square sync groups passed; no production calls or writes`);
