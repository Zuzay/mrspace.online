/* Shared website catalog contract. Square remains the source of stock and prices. */
(function(root){
'use strict';
const sections=site=>site==='rufcut'?['review','shop','workshop','repair','hidden']:['review','shop','hidden'];
const categories=['jeans','outerwear','shirts','accessories','other'];
const blank=()=>({section:'review',category:'other',display_order:100,layout:'grouped',title:'',variations:{}});
function settings(item,rule){return rule?{section:rule.section,category:rule.category||'other',display_order:rule.display_order??100,layout:rule.layout,title:rule.title||'',variations:rule.variations||{}}:blank();}
function purchaseURL(value,site){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||value.length>1000)return '';
 try{const u=new URL(value.trim());if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
 const squareLink=u.hostname==='square.link'&&/^\/u\/[A-Za-z0-9_-]+\/?$/.test(u.pathname);
 const product=/^[a-z0-9-]+\.square\.site$/.test(u.hostname)&&u.pathname.startsWith('/product/');
 const rufcut=site==='rufcut'&&['rufcut.com','www.rufcut.com'].includes(u.hostname)&&u.pathname.startsWith('/product/');
 return squareLink||product||rufcut?u.href:'';
 }catch{return '';}
}
// Rufcut keeps Square Online for payment after its custom domain moves here.
function squarePurchaseURL(value,site){
 const safe=purchaseURL(value,site);if(!safe)return '';
 const u=new URL(safe);
 if(site==='rufcut'&&['rufcut.com','www.rufcut.com'].includes(u.hostname))u.hostname='rufcutvenice.square.site';
 return u.href;
}
// Square-managed sites read categories on every request. Legacy exclusions remain
// until the owner explicitly assigns Website publish; new records need no panel save.
function squareSettings(item,rule,site){
 const groups=item.square_categories||[],names=groups.map(c=>c.name.trim().toLowerCase());
 const forcePublish=names.includes('website publish'),hidden=names.some(n=>['website hidden','shipping','register only','internal'].includes(n));
 const repair=names.some(n=>['repair','repairs','alterations / repairs','alterations & repairs','patches / embroidery'].includes(n));
 const workshop=names.some(n=>['workshop','workshops'].includes(n));
 const protectedSection=rule&&['hidden','review'].includes(rule.section)&&!forcePublish?rule.section:null;
 const section=hidden?'hidden':protectedSection|| (repair?'repair':workshop?'workshop':forcePublish?'shop':rule?.section==='repair'||rule?.section==='workshop'?rule.section:'shop');
 const primary=groups.find(c=>!['website hidden','website publish','shipping','register only','internal','repair','repairs','alterations / repairs','alterations & repairs','patches / embroidery','workshop','workshops'].includes(c.name.trim().toLowerCase()));
 const aliases={jeans:'jeans','jeans & overalls':'jeans',outerwear:'outerwear','jackets & coats':'outerwear',shirts:'shirts','shirts & tops':'shirts',accessories:'accessories','other pieces':'other'};
 const category=primary?(aliases[primary.name.trim().toLowerCase()]||'other'):rule?.category||'other';
 const variations=Object.fromEntries(item.variations.map(v=>[v.id,{visible:forcePublish?true:rule?.variations?.[v.id]?.visible??true,title:'',purchase_url:squarePurchaseURL(item.square_url||rule?.variations?.[v.id]?.purchase_url,site)}]));
 return {section,category,display_order:primary?.order??rule?.display_order??100,layout:groups.length?'grouped':rule?.layout||'grouped',title:'',variations,
  ...(primary&&!aliases[primary.name.trim().toLowerCase()]?{square_category:'square:'+primary.id,category_label:primary.name}:{})};
}
function validate(item,input,site){
 if(!input||!sections(site).includes(input.section)||!['grouped','separate'].includes(input.layout)||typeof input.title!=='string'||input.title.length>255)throw Error('catalog_invalid');
 const category=input.category??'other',display_order=input.display_order??100;
 if(!categories.includes(category)||!Number.isSafeInteger(display_order)||display_order<0||display_order>9999)throw Error('catalog_invalid');
 const values=input.variations;
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>250)throw Error('catalog_invalid');
 const ids=new Set(item.variations.map(v=>v.id)),clean={};
 for(const [id,v] of Object.entries(values)){
  if(!ids.has(id)||!v||typeof v.visible!=='boolean'||typeof v.title!=='string'||v.title.length>255)throw Error('catalog_invalid');
  const purchase_url=purchaseURL(v.purchase_url,site);if(v.purchase_url&&!purchase_url)throw Error('catalog_invalid_link');
  if(purchase_url&&['rufcut.com','www.rufcut.com'].includes(new URL(purchase_url).hostname)&&new URL(purchase_url).pathname.split('/').filter(Boolean).at(-1)!==item.id)throw Error('catalog_invalid_link');
  clean[id]={visible:v.visible,title:v.title.trim(),...(purchase_url?{purchase_url}:{})};
 }
 if(!['review','hidden'].includes(input.section)&&!Object.values(clean).some(v=>v.visible))throw Error('catalog_no_variations');
 return {section:input.section,category,display_order,layout:input.layout,title:input.title.trim(),variations:clean};
}
function cards(item,input,site){
 const s=settings(item,input);if(!['shop','workshop','repair'].includes(s.section))return [];
 const variations=item.variations.filter(v=>s.variations[v.id]?.visible===true&&(v.stock==null||v.stock>0)).map(v=>({id:v.id,name:s.variations[v.id].title||v.name,price:v.price,currency:v.currency,stock:v.stock,image:v.image||item.image||null,...(purchaseURL(s.variations[v.id].purchase_url,site)?{purchase_url:purchaseURL(s.variations[v.id].purchase_url,site)}:{})}));
 const base={id:item.id,name:s.title||item.name,description:item.description||'',image:item.image||null,section:s.section,category:s.category,display_order:s.display_order,...(input?.square_category?{square_category:input.square_category,category_label:input.category_label}:{})};
 if(s.layout==='separate')return variations.map(v=>({...base,id:item.id+':'+v.id,name:s.variations[v.id].title||((!v.name||v.name==='Regular')?base.name:base.name+' · '+v.name),image:v.image,variations:[v]}));
 return variations.length?[{...base,variations}]:[];
}
function pending(item,s){return !s||s.section==='review'||item.variations.some(v=>!Object.hasOwn(s.variations||{},v.id));}
function sort(cards){return cards.map((card,index)=>({card,index})).sort((a,b)=>['shop','workshop','repair'].indexOf(a.card.section)-['shop','workshop','repair'].indexOf(b.card.section)||(a.card.section==='shop'?categories.indexOf(a.card.category||'other')-categories.indexOf(b.card.category||'other'):0)||(a.card.square_category||'').localeCompare(b.card.square_category||'')||(a.card.display_order??100)-(b.card.display_order??100)||a.index-b.index).map(v=>v.card);}
root.MsSiteCatalog={sections,categories,sort,purchaseURL,squarePurchaseURL,squareSettings,blank,settings,validate,cards,pending};
})(globalThis);
