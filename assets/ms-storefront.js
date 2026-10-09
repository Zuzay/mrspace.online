/* Render the public catalog contract. One item card retains its real choices. */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tr=s=>window.MSI18N?MSI18N.t(s):s;
function price(v){return v.price==null?tr('Ask the shop for pricing'):new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:v.currency||'USD'}).format(v.price/100);}
const safeImage=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function card(item,index){
 const v=item.variations[0],image=safeImage(v.image||item.image),select=item.variations.length>1?`<label class="store-choice"><span>${tr('Choose a size or style')}</span><select data-store-choice="${index}" aria-label="${esc(tr('Choose a size or style'))}">${item.variations.map((v,i)=>`<option value="${i}">${esc(v.name||item.name)}</option>`).join('')}</select></label>`:(v.name&&v.name!=='Regular'&&v.name!==item.name?`<p data-noi18n>${esc(v.name)}</p>`:'');
 const link=item.section==='repair'?['repair/',tr('Plan the repair')]:['#visit',tr(item.section==='workshop'?'Ask about this workshop':'Ask the shop')];
 return `<article class="item" data-store-card="${index}"><div class="ph">${image?`<img src="${esc(image)}" alt="${esc(item.name)}" loading="lazy">`:`<span class="photo-missing"><b>${tr('Photo coming soon')}</b></span>`}</div><div class="in"><h3 data-noi18n>${esc(item.name)}</h3>${select}<p data-store-price data-noi18n>${esc(price(v))}</p>${v.stock==null&&item.section==='shop'?`<small>${tr('Contact the shop to confirm availability.')}</small>`:''}<a class="text-link" href="${link[0]}">${esc(link[1])} ↗</a></div></article>`;
}
function bind(root,items){root.querySelectorAll('[data-store-choice]').forEach(select=>select.onchange=()=>{const item=items[+select.dataset.storeChoice],v=item.variations[+select.value],card=select.closest('[data-store-card]');card.querySelector('[data-store-price]').textContent=price(v);const image=safeImage(v.image||item.image),ph=card.querySelector('.ph');if(image)ph.innerHTML=`<img src="${esc(image)}" alt="${esc(item.name)}" loading="lazy">`;else ph.innerHTML=`<span class="photo-missing"><b>${esc(tr('Photo coming soon'))}</b></span>`;});}
window.MsStorefront={card,bind};
})();
