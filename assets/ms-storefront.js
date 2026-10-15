/* Shared product cards and merchant-owned Square sales links. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src),lang=window.MSI18N?.lang||document.documentElement.lang||'en';
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('ms-storefront.css?v=20261014-cart',base);document.head.append(css);
let dict={};const dictReady=fetch(new URL('lang/storefront-'+(['en','tr','es','de','fr'].includes(lang)?lang:'en')+'.json?v=20261014-cart',base)).then(r=>{if(!r.ok)throw Error('dictionary');return r.json();}).then(d=>dict=d).catch(()=>{});
const FN=(window.MS_CONFIG?.url||'https://tizfdnsjhhepxnqqrzuk.supabase.co')+'/functions/v1/ms-square';
const commerceSite=/(^|\.)rufcutjeans\.com$/.test(location.hostname)||location.pathname.startsWith('/rufcut/')?'rufcut':'';
let commerce={live:false,variations:[]};
const commerceReady=commerceSite?fetch(FN+'/commerce?site='+commerceSite).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.live)commerce=d;}).catch(()=>{}):Promise.resolve();
const ready=Promise.all([dictReady,commerceReady]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tr=s=>dict[s]||window.MSI18N?.t(s)||s;
function price(v){return v.price==null?tr('Ask the shop for pricing'):new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:v.currency||'USD'}).format(v.price/100);}
const safeImage=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function purchase(v,site){return window.MsSiteCatalog?.purchaseURL(v.purchase_url,site)||'';}
function detailURL(item,v,site){if(site!=='rufcut')return '';const u=new URL((location.pathname.startsWith('/rufcut/')?'/rufcut/':'/')+'product/',location.origin);u.searchParams.set('id',item.id);u.searchParams.set('variation',v.id);u.searchParams.set('lang',lang);return u.pathname+u.search;}
function action(item,v,site){
 if(item.section==='repair')return `<a class="text-link" href="repair/">${esc(tr('Plan the repair'))} ↗</a>`;
 if(canBuy(item,v,site)){known.set(v.id,{item,v});return `<button type="button" class="btn primary store-add" data-cart-add="${esc(v.id)}">${esc(tr('Add to cart'))}</button><small class="store-sale-note">${esc(tr('Pay securely with Square. Choose shipping or shop pickup in the cart.'))}</small>`;}
 const url=purchase(v,site);
 if(url)return `<a class="text-link store-buy" data-store-link href="${esc(url)}" rel="noreferrer">${esc(tr(item.section==='workshop'?'View & book on Square':'View & buy on Square'))} ↗</a><small class="store-sale-note">${esc(tr('Choose your options on Square. Its current offers, availability, shipping and tax determine the final total.'))}</small>`;
 return `${detailURL(item,v,site)?`<a class="text-link" data-store-page href="${esc(detailURL(item,v,site))}">${esc(tr('Details & availability'))} ↗</a>`:`<button type="button" class="text-link" data-store-details>${esc(tr('Details & availability'))} ↗</button>`}<small class="store-sale-note">${esc(tr('Online checkout is not available for this piece yet.'))}</small>`;
}
const known=new Map();
function canBuy(item,v,site){return site===commerceSite&&commerce.live&&item.section!=='repair'&&commerce.variations.includes(v.id);}
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
// ---------- cart ----------
const KEY='ms-cart-'+(commerceSite||'site');
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(l=>l&&typeof l.variation==='string'&&Number.isSafeInteger(l.quantity)&&l.quantity>0).slice(0,20):[];}catch{return [];}}
let cart=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart));}catch{}paint();}
const money=(cents,cur)=>new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:cur||commerce.currency||'USD'}).format(cents/100);
function add(id){const k=known.get(id);if(!k)return;const max=Math.min(10,Number.isSafeInteger(k.v.stock)?k.v.stock:10);const line=cart.find(l=>l.variation===id);
 if(line){if(line.quantity>=max){open(tr('No more of this piece is available.'));return;}line.quantity++;}
 else cart.push({variation:id,quantity:1,name:k.item.name,choice:k.v.name&&k.v.name!=='Regular'?k.v.name:'',price:k.v.price,currency:k.v.currency,image:k.v.image||k.item.image||'',max});
 save();open();}
let button,dialog;
function paint(){
 cart=cart.filter(l=>!commerce.live||commerce.variations.includes(l.variation));
 const count=cart.reduce((n,l)=>n+l.quantity,0);
 if(!button){button=document.createElement('button');button.type='button';button.className='cart-fab';button.onclick=()=>open();document.body.append(button);}
 button.hidden=!commerce.live||!count;button.innerHTML=`${esc(tr('Cart'))} <b>${count}</b>`;button.setAttribute('aria-label',tr('Cart')+' ('+count+')');
 if(dialog?.open)render();
}
function open(message){if(!dialog){dialog=document.createElement('dialog');dialog.className='store-dialog cart-dialog';document.body.append(dialog);dialog.onclick=e=>{if(e.target===dialog)dialog.close();};}render(message);if(!dialog.open)dialog.showModal();}
function render(message){
 const subtotal=cart.reduce((n,l)=>n+l.price*l.quantity,0),ship=commerce.countries?.length,pick=commerce.pickup;
 const options=[pick?`<label><input type="radio" name="delivery" value="pickup" checked> ${esc(tr('Pick up at the shop (free)'))}</label>`:'',ship?`<label><input type="radio" name="delivery" value="ship" ${pick?'':'checked'}> ${esc(tr('Ship to me'))}</label><select name="country" aria-label="${esc(tr('Country'))}">${commerce.countries.map(c=>`<option value="${esc(c)}">${esc(new Intl.DisplayNames([document.documentElement.lang||'en'],{type:'region'}).of(c)||c)}</option>`).join('')}</select>`:''].join('');
 dialog.innerHTML=`<form method="dialog"><button class="store-close" aria-label="${esc(tr('Close'))}">×</button></form><h2>${esc(tr('Your cart'))}</h2>${message?`<p class="cart-msg" role="status">${esc(message)}</p>`:''}`+
 (cart.length?`<ul class="cart-lines">${cart.map((l,i)=>`<li>${l.image?`<img src="${esc(l.image)}" alt="">`:'<span></span>'}<div><strong data-noi18n>${esc(l.name)}</strong>${l.choice?`<small data-noi18n>${esc(l.choice)}</small>`:''}<small data-noi18n>${esc(money(l.price,l.currency))}</small></div><div class="cart-qty"><button type="button" data-q="${i}" data-d="-1" aria-label="${esc(tr('Remove one'))}">−</button><span>${l.quantity}</span><button type="button" data-q="${i}" data-d="1" aria-label="${esc(tr('Add one'))}" ${l.quantity>=(l.max||10)?'disabled':''}>+</button></div></li>`).join('')}</ul>
 <p class="cart-total"><span>${esc(tr('Subtotal'))}</span><b data-noi18n>${esc(money(subtotal))}</b></p><small class="store-sale-note">${esc(tr('Tax and any shipping fee are added on the secure Square payment page.'))}</small>
 <fieldset class="cart-delivery"><legend>${esc(tr('Delivery'))}</legend>${options}</fieldset><button type="button" class="btn primary cart-pay">${esc(tr('Checkout'))} ↗</button>`:`<p>${esc(tr('Your cart is empty.'))}</p>`);
 dialog.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const l=cart[+b.dataset.q];l.quantity+=+b.dataset.d;if(l.quantity<1)cart.splice(+b.dataset.q,1);save();});
 const pay=dialog.querySelector('.cart-pay');if(pay)pay.onclick=()=>checkout(pay);
}
async function checkout(pay){
 const delivery=dialog.querySelector('[name=delivery]:checked')?.value;if(!delivery){render(tr('Choose pickup or shipping.'));return;}
 pay.disabled=true;pay.textContent=tr('Opening secure checkout…');
 try{const r=await fetch(FN+'/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({site:commerceSite,delivery,country:dialog.querySelector('[name=country]')?.value||'',lines:cart.map(l=>({variation:l.variation,quantity:l.quantity}))})});
  const d=await r.json().catch(()=>({}));if(r.ok&&d.url){location.href=d.url;return;}
  render(tr(d.error==='commerce_unavailable'?'A piece in your cart just sold out or changed. Please remove it and try again.':d.error==='checkout_closed'?'Online checkout is paused. Please call the shop.':'Checkout could not start. Please try again or call the shop.'));
 }catch{render(tr('Checkout could not start. Please try again or call the shop.'));}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cart-add]');if(b){e.preventDefault();add(b.dataset.cartAdd);}});
window.addEventListener('storage',e=>{if(e.key===KEY){cart=load();paint();}});
ready.then(()=>{if(commerceSite)paint();});
window.MsStorefront={card,bind,price,photo,purchase,detailURL,action,canBuy,t:tr,ready,clearCart(){cart=[];save();}};
})();
