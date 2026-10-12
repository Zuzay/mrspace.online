/* Shared daily-work model. Unknown and failed data never become zero. */
(function(root){
 'use strict';
 const statuses=['received','in_progress','finishing','ready','completed'];
 function inspect(item,enabled,site){
  const s=item.publication||MsSiteCatalog.blank(),reasons=[],warnings=[];
  if(item.archived)reasons.push('Archived from the website');
  if(!enabled)reasons.push('Website publishing is off');
  if(s.section==='review')reasons.push('Placement needs approval');
  if(s.section==='hidden')reasons.push('Kept in Square only');
  const selected=item.variations.filter(v=>s.variations[v.id]?.visible);
  if(!['review','hidden'].includes(s.section)&&!selected.length)reasons.push('No variations selected');
  if(selected.length&&selected.every(v=>v.stock===0))reasons.push('All selected variations are sold out');
  const cards=item.archived||!enabled?[]:MsSiteCatalog.cards(item,s,site);
  if(MsSiteCatalog.pending(item,s)&&s.section!=='review')warnings.push('New variations need approval');
  if(!item.image&&item.variations.every(v=>!v.image)&&s.section==='shop')warnings.push('Product photo missing');
  if(s.section==='shop'&&selected.some(v=>v.stock!==0&&!MsSiteCatalog.purchaseURL(s.variations[v.id]?.purchase_url,site)))warnings.push('Online sales link missing');
  if(s.section==='shop'&&selected.some(v=>v.stock==null))warnings.push('Inventory is not tracked');
  if(selected.some(v=>v.price==null)&&s.section==='shop')warnings.push('Product price missing');
  return {visible:cards.length>0,cards:cards.length,reasons,warnings,attention:!item.archived&&s.section!=='hidden'&&(reasons.length>0||warnings.length>0)};
 }
 function catalog(items,enabled,site){
  if(!Array.isArray(items))return null;
  const rows=items.map(item=>({item,...inspect(item,enabled,site)}));
  return {rows,total:rows.filter(r=>!r.item.archived).length,visible:rows.filter(r=>r.visible).length,cards:rows.reduce((n,r)=>n+r.cards,0),review:rows.filter(r=>!r.item.archived&&MsSiteCatalog.pending(r.item,r.item.publication)).length,attention:rows.filter(r=>r.attention),archived:rows.filter(r=>r.item.archived).length,untracked:items.filter(i=>!i.archived).flatMap(i=>i.variations).filter(v=>v.stock==null).length};
 }
 function page(rows,value,size=12){const pages=Math.max(1,Math.ceil(rows.length/size)),number=Math.min(pages,Math.max(1,Number(value)||1));return {rows:rows.slice((number-1)*size,number*size),number,pages,total:rows.length};}
 function quantity(value){return String(value).trim()!==''&&Number.isSafeInteger(Number(value))&&Number(value)>=0&&Number(value)<=1000000;}
 root.MsPanelDaily={inspect,catalog,page,quantity,statuses};
})(globalThis);
