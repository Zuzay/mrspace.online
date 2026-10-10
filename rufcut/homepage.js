(function(){
 'use strict';
 const $=id=>document.getElementById(id),tr=s=>window.MSI18N?MSI18N.t(s):s;
 const root=document.documentElement,themeKey='rufcut-theme',draftKey='rufcut-jean-maker-v1';
 const shopMap=document.querySelector('[data-ms-field="visit.a.4"]');
 if(shopMap)shopMap.href='https://www.google.com/maps?cid=9639345455576202975';
 try{const theme=localStorage.getItem(themeKey);if(['light','dark'].includes(theme))root.dataset.theme=theme}catch{}
 const currentTheme=()=>root.dataset.theme||'dark';
 const frame=$('repairFrame');
 function syncRepairTheme(){try{if(frame.contentDocument)frame.contentDocument.documentElement.dataset.theme=currentTheme()}catch{}}
 $('themeToggle').onclick=()=>{root.dataset.theme=currentTheme()==='dark'?'light':'dark';try{localStorage.setItem(themeKey,root.dataset.theme)}catch{}syncRepairTheme()};
 const defaults={fit:'Straight',denim:'Raw',wash:'Dark indigo',thread:'Pig-skin',fly:'Button fly',hem:'Chain stitch'};
 const s={...defaults};
 try{const stored=JSON.parse(localStorage.getItem(draftKey)||'{}');Object.keys(defaults).forEach(k=>{const allowed=[...document.querySelectorAll(`[data-k="${k}"] button`)].map(b=>b.dataset.v);if(allowed.includes(stored[k]))s[k]=stored[k]})}catch{}
 const washC={'Dark indigo':'#1E3466','Wide blue/white stripe':'url(#stripeWide)','Narrow blue/white stripe':'url(#stripeNarrow)',Black:'#232427',White:'#F6F3EC'};
 const thrC={'Pig-skin':'#B88762','Mellow yellow':'#E2B33C',White:'#F6F3EC',Tonal:'#3B4F77'};
 const tonalC={'Dark indigo':'#3B4F77','Wide blue/white stripe':'#52648D','Narrow blue/white stripe':'#52648D',Black:'#414141',White:'#D3CEC5'};
 const legs={Slim:'M12 24 L14 200 H54 L65 86 L76 200 H116 L118 24 Z',Straight:'M12 24 L6 200 H56 L65 86 L74 200 H124 L118 24 Z',Relaxed:'M12 24 L2 200 H58 L65 90 L72 200 H128 L118 24 Z',Wide:'M12 24 L-4 200 H60 L65 94 L70 200 H134 L118 24 Z'};
 let view='front',activeTab=0;
 ['vFit','vDenim','vWash','vThread','vFly','vHem','summary'].forEach(id=>$(id).setAttribute('data-noi18n',''));
 function render(){
  document.querySelectorAll('[data-k] button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===s[b.parentElement.dataset.k]));
  $('jBody').setAttribute('d',legs[s.fit]);$('jClip').setAttribute('d',legs[s.fit]);
  $('jBody').setAttribute('fill',washC[s.wash]);$('jBand').setAttribute('fill',washC[s.wash]);
  const tc=s.thread==='No contrast'?washC[s.wash]:s.thread==='Tonal'?tonalC[s.wash]:thrC[s.thread];
  $('jStitch').setAttribute('stroke',tc);$('jBack').setAttribute('stroke',tc);
  $('jBody').setAttribute('stroke-width',s.denim==='Stretch'?'1.5':'2.5');
  document.querySelector('[data-v="Tonal"]').style.background=tonalC[s.wash];
  const cssWash=s.wash.includes('stripe')?`repeating-linear-gradient(90deg,#1E3466 0 ${s.wash.startsWith('Wide')?8:4}px,#F6F3EC ${s.wash.startsWith('Wide')?8:4}px ${s.wash.startsWith('Wide')?16:8}px)`:washC[s.wash];
  document.querySelector('[data-v="No contrast"]').style.background=cssWash;
  $('hemL').style.display=$('hemR').style.display=s.hem==='Raw edge'?'none':'';
  const cuff=s.hem==='Cuffed',off={Slim:2,Straight:0,Relaxed:-4,Wide:-10}[s.fit];
  ['cuffL','cuffR'].forEach((id,i)=>{const el=$(id);el.setAttribute('fill',cuff?washC[s.wash]:'none');el.setAttribute('stroke',cuff?'#929cad':'none');el.setAttribute('stroke-width',cuff?'1':'0');el.setAttribute('x',i?74-off/2:4+off)});
  $('jFly').innerHTML=s.fly==='Button fly'?'<circle cx="62" cy="36" r="1.8" fill="#B87333"/><circle cx="62" cy="48" r="1.8" fill="#B87333"/><circle cx="62" cy="60" r="1.8" fill="#B87333"/>':'<rect x="60" y="30" width="4" height="34" rx="1" fill="#B87333" opacity=".7"/>';
  $('jFly').style.display=view==='back'?'none':'';$('jBack').toggleAttribute('hidden',view!=='back');
  $('jStitch').querySelectorAll('path').forEach((path,i)=>{if(i===1||i===2||i===3)path.style.display=view==='back'?'none':''});
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
  const summary=$('summary');summary.replaceChildren();
  Object.keys(defaults).forEach(key=>{const name=key[0].toUpperCase()+key.slice(1);$('v'+name).textContent=tr(s[key]);const chip=document.createElement('span');chip.className='summary-chip';const label=document.createElement('span');label.className='summary-key';label.textContent=tr(name)+':';const value=document.createElement('strong');value.className='summary-value';value.textContent=tr(s[key]);chip.append(label,value);summary.append(chip)});
  $('requestPair').onclick=()=>window.MsPairOrder.open({...s},$('jeansPreview'));
  try{localStorage.setItem(draftKey,JSON.stringify(s))}catch{}
 }
 document.querySelectorAll('[data-k] button').forEach(b=>b.addEventListener('click',()=>{s[b.parentElement.dataset.k]=b.dataset.v;render()}));
 // The shared editor previews a swatch without replacing its label or choice ID.
 document.addEventListener('ms:editor-color-preview',e=>{
  const swatch=e.target;if(!swatch.matches('[data-ms-color]'))return;
  const colors=swatch.parentElement.dataset.k==='wash'?washC:thrC;
  if(Object.hasOwn(colors,swatch.dataset.v)){colors[swatch.dataset.v]=swatch.style.backgroundColor;render();}
 });
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;render()}));
 const tabs=[...document.querySelectorAll('.maker-tabs [role="tab"]')];
 function setTab(index,focus=false){activeTab=index;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',i===index);tab.tabIndex=i===index?0:-1;$('maker-panel-'+i).hidden=i!==index});$('makerPrevious').hidden=index===0;$('makerNext').hidden=index===2;if(focus)tabs[index].focus()}
 tabs.forEach((tab,i)=>{tab.onclick=()=>setTab(i);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%3;if(e.key==='ArrowLeft')next=(i+2)%3;if(e.key==='Home')next=0;if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();setTab(next,true)}}});
 $('makerNext').onclick=()=>setTab(Math.min(2,activeTab+1),true);$('makerPrevious').onclick=()=>setTab(Math.max(0,activeTab-1),true);
 render();
 let frameObserver;
 function connectFrame(){try{frameObserver?.disconnect();const doc=frame.contentDocument;if(!doc?.body)return;syncRepairTheme();const resize=()=>{const main=doc.querySelector('main');if(main){const height=Math.ceil(main.getBoundingClientRect().height);if(height>0&&frame.style.height!==height+'px')frame.style.height=height+'px'}};frameObserver=new ResizeObserver(resize);frameObserver.observe(doc.querySelector('main'));resize();doc.fonts.ready.then(resize)}catch{}}
 frame.addEventListener('load',connectFrame);
 frame.src='repair/?embed=1&lang='+encodeURIComponent(window.MSI18N?.lang||root.lang||'en')+'&theme='+currentTheme();
 if(window.MSI18N)MSI18N.ready.then(render);
 window.addEventListener('pagehide',()=>frameObserver?.disconnect());
})();
