/* Shared pre-launch commerce contract. Prices and ownership come from the server. */
(function(root){
'use strict';
const profiles=['light','standard','heavy'];
const permissions=['ORDERS_READ','ORDERS_WRITE','PAYMENTS_READ','PAYMENTS_WRITE'];
const blank=()=>({countries:[],pickup:false,mode:'pending',origin_country:'',origin_postal:'',dispatch_days:null,returns_url:'',tax_reviewed:false,rates:Object.fromEntries(profiles.map(p=>[p,{base:null,extra:null}])),products:{}});
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function validate(input,owned){
 const s=blank();if(!input||!Array.isArray(input.countries)||input.countries.length>60||input.countries.some(c=>typeof c!=='string'||!['US','CA','GB','AU','NZ','DE','FR','ES','IT','NL','BE','IE','PT','AT','CH','SE','NO','DK','FI','JP','KR','MX'].includes(c)))throw Error('commerce_invalid');
 s.countries=[...new Set(input.countries)];
 for(const k of ['pickup','tax_reviewed']){if(typeof input[k]!=='boolean')throw Error('commerce_invalid');s[k]=input[k];}
 if(!['pending','flat','carrier'].includes(input.mode))throw Error('commerce_invalid');s.mode=input.mode;
 for(const k of ['origin_country','origin_postal','returns_url']){if(typeof input[k]!=='string'||input[k].length>(k==='returns_url'?500:30))throw Error('commerce_invalid');s[k]=input[k].trim();}
 if(s.origin_country&&!/^[A-Z]{2}$/.test(s.origin_country))throw Error('commerce_invalid');
 if(s.returns_url){let u;try{u=new URL(s.returns_url);}catch{throw Error('commerce_invalid');}if(u.protocol!=='https:'||u.username||u.password)throw Error('commerce_invalid');}
 if(input.dispatch_days!==null&&!integer(input.dispatch_days,0,60))throw Error('commerce_invalid');s.dispatch_days=input.dispatch_days;
 for(const p of profiles){const rate=input.rates?.[p];if(!rate)throw Error('commerce_invalid');for(const k of ['base','extra'])if(rate[k]!==null&&!integer(rate[k],0,1000000))throw Error('commerce_invalid');s.rates[p]={base:rate.base,extra:rate.extra};}
 if(!input.products||typeof input.products!=='object'||Array.isArray(input.products)||Object.keys(input.products).length>1000)throw Error('commerce_invalid');
 for(const [id,p] of Object.entries(input.products)){
  if(!owned.has(id)||!p||!['inquiry','ready'].includes(p.sale)||!profiles.includes(p.profile))throw Error('commerce_invalid');
  const clean={sale:p.sale,profile:p.profile};for(const k of ['weight_g','length_cm','width_cm','height_cm']){if(p[k]!==null&&!integer(p[k],1,k==='weight_g'?100000:300))throw Error('commerce_invalid');clean[k]=p[k];}s.products[id]=clean;
 }
 return s;
}
function readiness(s,account,scopes,items){
 const blockers=[];
 if(!account)blockers.push('square_connection');else if(!Array.isArray(scopes)||permissions.some(p=>!scopes.includes(p)))blockers.push('payment_permissions');
 if(!s.pickup&&!s.countries.length)blockers.push('delivery_policy');
 if(s.countries.length){if(s.mode==='pending')blockers.push('shipping_rates');else if(s.mode==='carrier')blockers.push('carrier_connection');else if(profiles.some(p=>s.rates[p].base===null||s.rates[p].extra===null))blockers.push('shipping_rates');if(!s.origin_country||!s.origin_postal)blockers.push('shipping_origin');}
 if(s.dispatch_days===null)blockers.push('dispatch_time');if(!s.returns_url)blockers.push('returns_policy');if(!s.tax_reviewed)blockers.push('tax_review');
 if(!items.some(it=>s.products[it.id]?.sale==='ready'&&it.variations.some(v=>v.track&&v.stock>0&&Number.isSafeInteger(v.price)&&v.price>0)))blockers.push('product_review');
 return {setup_ready:blockers.length===0,checkout_live:false,blockers};
}
function quote(s,items,input,currency){
 if(!input||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>20||!['pickup','ship'].includes(input.delivery))throw Error('commerce_invalid');
 const merged=new Map();for(const l of input.lines){if(typeof l.variation!=='string'||!integer(l.quantity,1,10))throw Error('commerce_invalid');merged.set(l.variation,(merged.get(l.variation)||0)+l.quantity);}
 const lines=[];for(const [id,quantity] of merged){const item=items.find(i=>i.variations.some(v=>v.id===id)),v=item?.variations.find(v=>v.id===id),p=s.products[item?.id];
  if(!item||p?.sale!=='ready'||!v.track||!integer(quantity,1,10)||!integer(v.stock,quantity,1000000)||!integer(v.price,1,100000000)||v.currency!==currency)throw Error('commerce_unavailable');
  lines.push({variation:id,item:item.id,name:item.name,choice:v.name,quantity,unit_price:v.price,profile:p.profile});
 }
 let shipping=0;
 if(input.delivery==='pickup'){if(!s.pickup)throw Error('commerce_delivery');}
 else {
  if(!s.countries.includes(input.country))throw Error('commerce_delivery');if(s.mode!=='flat')throw Error('commerce_shipping_pending');
  // One parcel: highest first-item charge, plus additional-unit fees for the rest.
  const units=lines.flatMap(l=>Array.from({length:l.quantity},()=>s.rates[l.profile]));if(units.some(r=>r.base===null||r.extra===null))throw Error('commerce_shipping_pending');
  const first=[...units].sort((a,b)=>b.base-a.base||b.extra-a.extra)[0];shipping=first.base+units.reduce((n,r)=>n+r.extra,0)-first.extra;
 }
 const subtotal=lines.reduce((n,l)=>n+l.unit_price*l.quantity,0);return {preview_only:true,currency,lines,subtotal,shipping,total_before_tax:subtotal+shipping,tax:'pending_square',delivery:input.delivery};
}
root.MsCommerce={blank,validate,readiness,quote,profiles,permissions};
})(globalThis);
