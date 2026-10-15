/* Shared photo series. Original IMG and stable editor field stay in the DOM. */
(function(host){
 'use strict';
 const decks=new WeakMap(),langs=['en','tr','es','de','fr'];
 const copy={previous:['Previous photo','Önceki fotoğraf','Foto anterior','Vorheriges Foto','Photo précédente'],next:['Next photo','Sonraki fotoğraf','Foto siguiente','Nächstes Foto','Photo suivante'],photo:['Photo','Fotoğraf','Foto','Foto','Photo']};
 function url(value,base=host.location?.href||'https://mrspace.online/'){
  try{if(typeof value!=='string'||value.length>350)return '';const u=new URL(value,base);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}
 }
 function parse(raw,base){
  try{
   const value=typeof raw==='string'?JSON.parse(raw):raw;if(!value||value.version!==1||!Array.isArray(value.slides)||value.slides.length<1||value.slides.length>6)return null;
   const slides=value.slides.map(item=>{if(!item||typeof item.alt!=='string'||item.alt.length>80)return null;const src=url(item.url,base);return src?{url:src,alt:item.alt}:null;});
   if(slides.some(s=>!s))return null;const result={version:1,slides};return JSON.stringify(result).length<=1700?result:null;
  }catch{return null;}
 }
 function destroy(image,restore=false){
  const d=decks.get(image);if(!d)return;d.controls?.remove();d.parent.classList.remove('ms-photo-deck');image.removeEventListener('touchstart',d.start);image.removeEventListener('touchend',d.end);
  if(restore){image.src=d.original.src;image.alt=d.original.alt;if(d.original.srcset)image.setAttribute('srcset',d.original.srcset);if(d.original.sizes)image.setAttribute('sizes',d.original.sizes);if(d.original.slides)image.setAttribute('data-ms-slides',d.original.slides);else image.removeAttribute('data-ms-slides');}
  decks.delete(image);if(restore&&d.original.slides)mount(image,d.original.slides);
 }
 function mount(image,raw){
  const config=parse(raw,image.ownerDocument.baseURI);if(!config||image.tagName!=='IMG'||!image.parentElement)return false;
  const original=decks.get(image)?.original||{src:image.src,alt:image.alt,srcset:image.getAttribute('srcset'),sizes:image.getAttribute('sizes'),slides:image.getAttribute('data-ms-slides')};destroy(image);
  const doc=image.ownerDocument,parent=image.parentElement,index=Math.max(0,langs.indexOf(doc.documentElement.lang)),t=k=>copy[k][index];let current=0,x=null;
  image.dataset.msSlides=JSON.stringify(config);image.removeAttribute('srcset');image.removeAttribute('sizes');parent.classList.add('ms-photo-deck');
  const controls=doc.createElement('div');controls.className='ms-photo-deck-controls';controls.dataset.msSkip='';controls.dataset.msEditorUi='';controls.setAttribute('data-noi18n','');
  const prev=doc.createElement('button'),next=doc.createElement('button'),counter=doc.createElement('span');
  [prev,next].forEach(b=>b.type='button');prev.textContent='←';next.textContent='→';prev.setAttribute('aria-label',t('previous'));next.setAttribute('aria-label',t('next'));counter.setAttribute('aria-live','polite');counter.setAttribute('aria-atomic','true');controls.append(prev,counter,next);
  function show(n){current=(n+config.slides.length)%config.slides.length;const slide=config.slides[current];image.src=slide.url;image.alt=slide.alt||original.alt;counter.textContent=String(current+1).padStart(2,'0')+' / '+String(config.slides.length).padStart(2,'0');counter.setAttribute('aria-label',t('photo')+' '+(current+1)+' / '+config.slides.length);}
  prev.onclick=()=>show(current-1);next.onclick=()=>show(current+1);
  const start=e=>{x=e.touches?.[0]?.clientX??null;},end=e=>{const endX=e.changedTouches?.[0]?.clientX;if(x!==null&&endX!==undefined&&Math.abs(endX-x)>45)show(current+(endX<x?1:-1));x=null;};
  image.addEventListener('touchstart',start,{passive:true});image.addEventListener('touchend',end,{passive:true});if(config.slides.length>1)parent.append(controls);show(0);decks.set(image,{parent,controls,original,start,end});return true;
 }
 function scan(doc=host.document){doc?.querySelectorAll('img[data-ms-slides]').forEach(img=>mount(img,img.dataset.msSlides));}
 host.MsPhotoDeck=Object.freeze({parse,mount,destroy,scan,url});
 if(host.document){if(host.document.readyState==='loading')host.document.addEventListener('DOMContentLoaded',()=>scan());else scan();}
})(typeof window!=='undefined'?window:globalThis);
