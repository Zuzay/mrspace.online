/* Shared website catalog contract. Square remains the source of stock and prices. */
(function(root){
'use strict';
const sections=site=>site==='rufcut'?['review','shop','workshop','repair','hidden']:['review','shop','hidden'];
const categories=['jeans','outerwear','shirts','accessories','other'];
const blank=()=>({section:'review',category:'other',display_order:100,layout:'grouped',title:'',variations:{}});
function settings(item,rule){return rule?{section:rule.section,category:rule.category||'other',display_order:rule.display_order??100,layout:rule.layout,title:rule.title||'',variations:rule.variations||{}}:blank();}
function validate(item,input,site){
 if(!input||!sections(site).includes(input.section)||!['grouped','separate'].includes(input.layout)||typeof input.title!=='string'||input.title.length>255)throw Error('catalog_invalid');
 const category=input.category??'other',display_order=input.display_order??100;
 if(!categories.includes(category)||!Number.isSafeInteger(display_order)||display_order<0||display_order>9999)throw Error('catalog_invalid');
 const values=input.variations;
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>250)throw Error('catalog_invalid');
 const ids=new Set(item.variations.map(v=>v.id)),clean={};
 for(const [id,v] of Object.entries(values)){
  if(!ids.has(id)||!v||typeof v.visible!=='boolean'||typeof v.title!=='string'||v.title.length>255)throw Error('catalog_invalid');
  clean[id]={visible:v.visible,title:v.title.trim()};
 }
 if(!['review','hidden'].includes(input.section)&&!Object.values(clean).some(v=>v.visible))throw Error('catalog_no_variations');
 return {section:input.section,category,display_order,layout:input.layout,title:input.title.trim(),variations:clean};
}
function cards(item,input){
 const s=settings(item,input);if(!['shop','workshop','repair'].includes(s.section))return [];
 const variations=item.variations.filter(v=>s.variations[v.id]?.visible===true&&(v.stock==null||v.stock>0)).map(v=>({id:v.id,name:s.variations[v.id].title||v.name,price:v.price,currency:v.currency,stock:v.stock,image:v.image||item.image||null}));
 const base={id:item.id,name:s.title||item.name,description:item.description||'',image:item.image||null,section:s.section,category:s.category,display_order:s.display_order};
 if(s.layout==='separate')return variations.map(v=>({...base,id:item.id+':'+v.id,name:s.variations[v.id].title||((!v.name||v.name==='Regular')?base.name:base.name+' · '+v.name),image:v.image,variations:[v]}));
 return variations.length?[{...base,variations}]:[];
}
function pending(item,s){return !s||s.section==='review'||item.variations.some(v=>!Object.hasOwn(s.variations||{},v.id));}
function sort(cards){return cards.map((card,index)=>({card,index})).sort((a,b)=>['shop','workshop','repair'].indexOf(a.card.section)-['shop','workshop','repair'].indexOf(b.card.section)||(a.card.section==='shop'?categories.indexOf(a.card.category||'other')-categories.indexOf(b.card.category||'other'):0)||(a.card.display_order??100)-(b.card.display_order??100)||a.index-b.index).map(v=>v.card);}
root.MsSiteCatalog={sections,categories,sort,blank,settings,validate,cards,pending};
})(globalThis);
