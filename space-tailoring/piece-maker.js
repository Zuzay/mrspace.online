/* A product design uses the same work-order receipt and tracking contract as jeans. */
(function(){'use strict';
 const $=id=>document.getElementById(id),t=v=>window.MSI18N?MSI18N.t(v):v,key='space-tailoring-pieces-v1';
 const ids=['pieceType','pieceShape','pieceFabric','pieceColor','pieceFinish'];
 const shapes={bag:['Tote','Crossbody','Weekender'],jacket:['Work jacket','Overshirt','Cropped jacket']};
 const allowed={pieceType:['bag','jacket'],pieceFabric:['Raw denim','Canvas','Stretch denim'],pieceColor:['Indigo','Black','Natural'],pieceFinish:['Contrast stitch','Tonal stitch']};
 let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
 for(const [id,values] of Object.entries(allowed))if(values.includes(saved[id]))$(id).value=saved[id];
 function shape(){const old=$('pieceShape').value||saved.pieceShape,values=shapes[$('pieceType').value];$('pieceShape').replaceChildren(...values.map(value=>{const opt=document.createElement('option');opt.value=value;opt.textContent=t(value);return opt}));if(values.includes(old))$('pieceShape').value=old;}
 function render(){
  const product=$('pieceType').value,cut=$('pieceShape').value,color={Indigo:'#263e60',Black:'#24282d',Natural:'#d9d9cd'}[$('pieceColor').value],thread=$('pieceFinish').value==='Tonal stitch'?color:'#b2c9df';
  const bag=cut==='Crossbody'?'<path d="M95 158Q80 35 250 70L265 158" fill="none"/><rect x="72" y="150" width="216" height="140" rx="24"/><path d="M74 190H286"/>':cut==='Weekender'?'<path d="M132 125V90Q180 40 228 90V125" fill="none"/><path d="M75 126H285L318 286H42Z"/><path d="M100 128L85 284M260 128L275 284"/>':'<path d="M120 128V80Q180 24 240 80V128" fill="none"/><path d="M75 120H285L270 302H90Z"/><path d="M120 120V295M240 120V295"/>';
  const hem=cut==='Cropped jacket'?260:cut==='Overshirt'?315:295;
  const jacket=`<path d="M110 70L68 88L28 214L74 232L110 146V${hem}H250V146L286 232L332 214L292 88L250 70L210 58H150Z"/><path d="M150 58L180 96L210 58M180 96V${hem}" fill="none"/><path d="M120 125H160V172H120ZM200 125H240V172H200Z"/>`;
  const svg=$('piecePreview');svg.innerHTML=`<g fill="${color}" stroke="${thread}" stroke-width="3" stroke-linejoin="round">${product==='bag'?bag:jacket}</g>`;
  const design={product,shape:cut,fabric:$('pieceFabric').value,color:$('pieceColor').value,finish:$('pieceFinish').value};
  $('pieceSummary').textContent=Object.values(design).map(t).join(' · ');
  $('sendPiece').onclick=()=>window.MsPairOrder.open(design,svg);
  try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(ids.map(id=>[id,$(id).value]))))}catch{}
 }
 const product=$('makerProduct');try{const last=localStorage.getItem('space-tailoring-product');if(['jeans','bag','jacket'].includes(last))product.value=last}catch{}
 function selectProduct(){const custom=product.value!=='jeans';$('jeansMaker').hidden=custom;$('pieceMaker').hidden=!custom;if(custom){$('pieceType').value=product.value;shape();render()}try{localStorage.setItem('space-tailoring-product',product.value)}catch{}}
 product.addEventListener('change',selectProduct);selectProduct();
 ids.forEach(id=>$(id).addEventListener('change',()=>{if(id==='pieceType')shape();render()}));shape();render();if(window.MSI18N)MSI18N.ready.then(()=>{shape();render()});
})();
