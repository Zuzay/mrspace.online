/* Mr. Space site media: slideshows and muted video loops.
   Markup (written by Mr. Space when a media request is approved):
   <img data-ms-slides='["https://…/1.webp","https://…/2.webp"]' …>   -> crossfading slideshow
   <img data-ms-video="https://…/clip.mp4" …>                           -> muted looping video (img becomes poster)
   Add data-ms-match to tint videos towards the site palette. */
(function(){
'use strict';
const css=`.ms-slides{position:relative;overflow:hidden}.ms-slides>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .9s ease}.ms-slides>img.on{opacity:1;position:relative}.ms-slides>img.on~img{position:absolute}.ms-dots{position:absolute;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:8px;z-index:2}.ms-dots button{width:9px;height:9px;padding:0;border-radius:50%;border:1px solid #fff;background:#fff5;cursor:pointer}.ms-dots button[aria-current=true]{background:#fff}.ms-video{display:block;width:100%;height:100%;object-fit:cover}.ms-video-wrap{position:relative;display:block;width:100%;height:100%}.ms-video-wrap.match::after{content:"";position:absolute;inset:0;background:var(--cop,#d9822b);mix-blend-mode:color;opacity:.16;pointer-events:none}.ms-video-wrap.match video{filter:saturate(.85) contrast(1.04)}@media(prefers-reduced-motion:reduce){.ms-slides>img{transition:none}}`;
const safe=u=>{try{const x=new URL(u,location.href);return x.protocol==='https:'||x.origin===location.origin?x.href:'';}catch{return '';}};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function slides(img){
  let list=[];try{list=JSON.parse(img.dataset.msSlides).map(safe).filter(Boolean).slice(0,12);}catch{}
  if(list.length<2)return;
  const box=document.createElement('div');box.className='ms-slides '+(img.className||'');box.style.cssText=img.getAttribute('style')||'';
  const alt=img.alt||'';img.replaceWith(box);
  const imgs=list.map((src,i)=>{const el=document.createElement('img');el.src=src;el.alt=i?'':alt;el.loading=i?'lazy':'eager';el.decoding='async';if(i===0)el.className='on';box.append(el);return el;});
  const dots=document.createElement('div');dots.className='ms-dots';dots.innerHTML=imgs.map((_,i)=>`<button type="button" aria-label="${i+1} / ${imgs.length}" ${i===0?'aria-current="true"':''}></button>`).join('');box.append(dots);
  let at=0,timer;const show=i=>{imgs[at].classList.remove('on');dots.children[at].removeAttribute('aria-current');at=(i+imgs.length)%imgs.length;imgs[at].classList.add('on');dots.children[at].setAttribute('aria-current','true');};
  const play=()=>{clearInterval(timer);if(!reduce)timer=setInterval(()=>show(at+1),5000);};
  [...dots.children].forEach((b,i)=>b.onclick=()=>{show(i);play();});
  let x0=null;box.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});box.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40){show(at+(dx<0?1:-1));play();}x0=null;});
  box.addEventListener('mouseenter',()=>clearInterval(timer));box.addEventListener('mouseleave',play);play();
}
function video(img){
  const src=safe(img.dataset.msVideo);if(!src)return;
  const wrap=document.createElement('span');wrap.className='ms-video-wrap'+(img.hasAttribute('data-ms-match')?' match':'');
  const v=document.createElement('video');v.className='ms-video '+(img.className||'');v.src=src;v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='metadata';if(img.currentSrc||img.src)v.poster=img.currentSrc||img.src;v.setAttribute('aria-label',img.alt||'');
  if(!reduce)v.autoplay=true;else v.controls=true;wrap.append(v);img.replaceWith(wrap);
}
function run(){const s=document.createElement('style');s.textContent=css;document.head.append(s);
  document.querySelectorAll('img[data-ms-video]').forEach(video);document.querySelectorAll('img[data-ms-slides]').forEach(slides);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
