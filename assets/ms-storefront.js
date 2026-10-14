/* Shared product cards and merchant-owned Square sales links. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src),lang=window.MSI18N?.lang||document.documentElement.lang||'en';
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('ms-storefront.css?v=20261014-handover',base);document.head.append(css);
let dict={};const ready=fetch(new URL('lang/storefront-'+(['en','tr','es','de','fr'].includes(lang)?lang:'en')+'.json?v=20261014-handover',base)).then(r=>{if(!r.ok)throw Error('dictionary');return r.json();}).then(d=>dict=d).catch(()=>{});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tr=s=>dict[s]||window.MSI18N?.t(s)||s;
function price(v){return v.price==null?tr('Ask the shop for pricing'):new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:v.currency||'USD'}).format(v.price/100);}
const safeImage=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function purchase(v,site){return window.MsSiteCatalog?.purchaseURL(v.purchase_url,site)||'';}
function detailURL(item,v,site){if(site!=='rufcut')return '';const u=new URL((location.pathname.startsWith('/rufcut/')?'/rufcut/':'/')+'product/',location.origin);u.searchParams.set('id',item.id);u.searchParams.set('variation',v.id);u.searchParams.set('lang',lang);return u.pathname+u.search;}
function action(item,v,site){
 if(item.section==='repair')return `<a class="text-link" href="repair/">${esc(tr('Plan the repair'))} ↗</a>`;
 const url=purchase(v,site);
 if(url)return `<a class="text-link store-buy" data-store-link href="${esc(url)}" rel="noreferrer">${esc(tr(item.section==='workshop'?'View & book on Square':'View & buy on Square'))} ↗</a><small class="store-sale-note">${esc(tr('Choose your options on Square. Its current offers, availability, shipping and tax determine the final total.'))}</small>`;
 return `${detailURL(item,v,site)?`<a class="text-link" data-store-page href="${esc(detailURL(item,v,site))}">${esc(tr('Details & availability'))} ↗</a>`:`<button type="button" class="text-link" data-store-details>${esc(tr('Details & availability'))} ↗</button>`}<small class="store-sale-note">${esc(tr('Online checkout is not available for this piece yet.'))}</small>`;
}
function photo(item,v){const image=safeImage(v.image||item.image);return image?`<img src="${esc(image)}" alt="${esc(item.name)}" loading="lazy">`:`<span class="photo-missing"><b>${esc(tr('Photo coming soon'))}</b></span>`;}
function card(item,index,site=''){
 const v=item.variations[0];if(!v)return '';
 const select=item.variations.length>1?`<label class="store-choice"><span>${esc(tr('Choose a size or style'))}</span><select data-store-choice="${index}" aria-label="${esc(tr('Choose a size or style'))}">${item.variations.map((v,i)=>`<option value="${i}">${esc(v.name||item.name)}</option>`).join('')}</select></label>`:(v.name&&v.name!=='Regular'&&v.name!==item.name?`<p data-noi18n>${esc(v.name)}</p>`:'');
 const url=detailURL(item,v,site),image=photo(item,v);
 return `<article class="item" data-store-card="${index}" data-store-site="${esc(site)}"><div class="ph">${url?`<a data-store-page href="${esc(url)}" aria-label="${esc(item.name)}">${image}</a>`:image}</div><div class="in"><h3 data-noi18n>${url?`<a data-store-page href="${esc(url)}">${esc(item.name)}</a>`:esc(item.name)}</h3>${select}<p data-store-price data-noi18n>${esc(price(v))}</p><div data-store-action>${action(item,v,site)}</div></div></article>`;
}
function details(item,v,site){
 let dialog=document.getElementById('msStoreDetails');if(!dialog){dialog=document.createElement('dialog');dialog.id='msStoreDetails';dialog.className='store-dialog';document.body.append(dialog);}
 dialog.innerHTML=`<form method="dialog"><button class="store-close" aria-label="${esc(tr('Close'))}">×</button></form><h2 id="storeDetailsTitle" data-noi18n>${esc(item.name)}</h2><p data-noi18n>${esc(v.name&&v.name!=='Regular'?v.name:'')}</p><p class="store-detail-price" data-noi18n>${esc(price(v))}</p>${item.description?`<p class="store-description" data-noi18n>${esc(item.description.replace(/<[^>]*>/g,' ').slice(0,2000))}</p>`:''}<p>${esc(tr('Online checkout is not available for this piece yet.'))}</p><p>${esc(tr('Call the shop to confirm this choice, its availability and delivery options.'))}</p>${site==='rufcut'?`<a class="btn primary" href="tel:+13104735384">${esc(tr('Call the shop'))} ↗</a>`:''}`;
 dialog.setAttribute('aria-labelledby','storeDetailsTitle');dialog.showModal();dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
}
function bind(root,items){root.querySelectorAll('[data-store-card]').forEach(card=>{
 const item=items[+card.dataset.storeCard],site=card.dataset.storeSite;const choice=()=>item.variations[+(card.querySelector('[data-store-choice]')?.value||0)];
 const bindAction=()=>{const button=card.querySelector('[data-store-details]');if(button)button.onclick=()=>details(item,choice(),site);};bindAction();
 const select=card.querySelector('[data-store-choice]');if(select)select.onchange=()=>{const v=choice();card.querySelector('[data-store-price]').textContent=price(v);const image=photo(item,v),url=detailURL(item,v,site);card.querySelector('.ph').innerHTML=url?`<a data-store-page href="${esc(url)}" aria-label="${esc(item.name)}">${image}</a>`:image;card.querySelectorAll('[data-store-page]').forEach(a=>a.href=url);card.querySelector('[data-store-action]').innerHTML=action(item,v,site);bindAction();};
 });}
window.MsStorefront={card,bind,price,photo,purchase,detailURL,action,t:tr,ready};
})();
