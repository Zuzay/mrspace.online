(async function(){
  try{await MsPlatform.ready;}catch{MsPlatform.fail('library');return;}document.title=MsPlatform.t('select_design')+' | Mr. Space';
  const {t,esc}=MsPlatform,root=document.getElementById('library'),params=new URLSearchParams(location.search);
  const entries=MsCatalog.entries.filter(e=>e.kind==='design');
  let selected=entries.find(e=>e.id===params.get('design'))||entries[0],phone=false;
  const lang=document.documentElement.lang;document.getElementById('builderLink').textContent=t('builder')+' ↗';
  function draw(){
    root.innerHTML=`<div class="ms-platform-head"><div><span class="ms-eyebrow">MR. SPACE / ${esc(t('package_1'))}</span><h1>${esc(t('select_design'))}</h1><p>${esc(t('keep_content'))}</p></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">${entries.map(e=>`<button class="btn ${e.id===selected.id?'sun':''}" data-design="${e.id}" aria-pressed="${e.id===selected.id}">${esc(t(e.title))}</button>`).join('')}<button class="btn" id="device">${esc(t(phone?'desktop':'phone'))}</button></div>
      <div style="background:var(--line);padding:18px;border-radius:12px;overflow:auto"><iframe id="designPreview" title="${esc(t(selected.title))}" sandbox="allow-same-origin" style="display:block;width:${phone?'min(390px,100%)':'100%'};height:680px;margin:auto;border:0;border-radius:8px"></iframe></div>
      <div class="edit-actions"><span class="ms-eyebrow">${esc(t('available'))} / ${esc(t(selected.sector[0]))}</span><a class="btn sun" href="../build/?try=1&design=${selected.id}">${esc(t('apply_design'))}</a></div>`;
    const content=MsRender.example(selected.preset,lang);
    document.getElementById('designPreview').srcdoc=MsRender.render(content,{preset:selected.preset},{noindex:true,assetBase:new URL('../assets/',location.href).href});
    root.querySelectorAll('[data-design]').forEach(b=>b.onclick=()=>{selected=entries.find(e=>e.id===b.dataset.design);history.replaceState(null,'',`?design=${selected.id}`);draw();});
    document.getElementById('device').onclick=()=>{phone=!phone;draw();};
  }
  draw();
})();
