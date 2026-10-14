(async function(){
'use strict';
const root=document.getElementById('product'),params=new URLSearchParams(location.search),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=['en','tr','es','de','fr'].includes(params.get('lang'))?params.get('lang'):'en';document.documentElement.lang=lang;
await MsStorefront.ready;const t=MsStorefront.t;
document.getElementById('backToShop').textContent=t('All pieces')+' ↗';
const unavailable=message=>{root.innerHTML=`<div class="product-empty"><h1>${esc(t(message))}</h1><p>${esc(t('Call the shop to confirm this choice, its availability and delivery options.'))}</p><a class="btn primary" href="tel:+13104735384">${esc(t('Call the shop'))} ↗</a></div>`;};
try{
 const response=await fetch('https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-square/public?site=rufcut');if(!response.ok)throw Error('catalog');
 const data=await response.json(),id=params.get('id')||location.pathname.split('/').filter(Boolean).at(-1),requested=params.get('variation'),matches=(data.items||[]).filter(i=>i.id===id||i.id.split(':')[0]===id),item=matches.find(i=>i.variations.some(v=>v.id===requested))||matches[0];
 if(!item?.variations?.length){unavailable('This piece is no longer available.');return;}
 let selected=item.variations.findIndex(v=>v.id===requested);const missingChoice=!!requested&&selected<0;if(selected<0&&!missingChoice)selected=0;
 document.title=item.name+' | Rufcut';
 root.innerHTML=`<div class="product-layout"><div id="productPhoto" class="product-photo"></div><div class="product-info"><p class="section-kicker">${esc(t(item.section==='shop'?'From the shop':item.section==='workshop'?'Workshop':'Repairs'))}</p><h1>${esc(item.name)}</h1><label class="store-choice" ${item.variations.length===1?'hidden':''}><span>${esc(t('Choose a size or style'))}</span><select id="productChoice">${item.variations.map((v,i)=>`<option value="${i}">${esc(v.name||item.name)}</option>`).join('')}</select></label><p id="productVariant" data-noi18n></p><p id="productPrice" class="product-price" data-noi18n></p><p id="productAvailability"></p><div id="productAction" data-store-action></div><div class="product-description">${esc(item.description.replace(/<[^>]*>/g,' ').slice(0,10000))}</div></div></div>`;
 const choice=document.getElementById('productChoice');if(missingChoice){choice.insertAdjacentHTML('afterbegin',`<option value="" disabled>${esc(t('Choose a size or style'))}</option>`);choice.closest('label').hidden=false;choice.value='';}else choice.value=String(selected);
 function update(){if(choice.value===''){document.getElementById('productPhoto').innerHTML=MsStorefront.photo(item,item.variations[0]);document.getElementById('productAvailability').textContent=t('This size or style is no longer available. Please choose again.');document.getElementById('productAction').innerHTML='';return;}const v=item.variations[+choice.value];document.getElementById('productPhoto').innerHTML=MsStorefront.photo(item,v);document.getElementById('productVariant').textContent=v.name==='Regular'?'':v.name;document.getElementById('productPrice').textContent=MsStorefront.price(v);document.getElementById('productAvailability').textContent=t(v.stock==null?'Call the shop to confirm availability.':'Available at the shop');
 const url=MsStorefront.purchase(v,'rufcut');document.getElementById('productAction').innerHTML=item.section==='repair'?`<a class="btn primary" href="../repair/">${esc(t('Plan the repair'))} ↗</a>`:url?MsStorefront.action(item,v,'rufcut'):`<p>${esc(t('Online checkout is not available for this piece yet.'))}</p><a class="btn primary" href="tel:+13104735384">${esc(t('Call the shop'))} ↗</a>`;
 const u=new URL(location.href);u.searchParams.set('variation',v.id);history.replaceState(null,'',u);}
 choice.onchange=update;update();
}catch{unavailable('We could not load the collection. Please refresh or call the shop.');}
})();
