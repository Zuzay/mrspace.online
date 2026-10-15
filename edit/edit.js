(async function () {
  'use strict';
  try{await MsPlatform.ready;}catch{MsPlatform.fail('editor');return;}document.title=MsPlatform.t('easy_edit')+' | Mr. Space';
  const {t,esc}=MsPlatform,params=new URLSearchParams(location.search),preview=params.get('preview')==='1';
  const key=params.get('k'),root=document.getElementById('editor');
  let site=null,step=0,session=null,storageKey='',visualKey=null,draft={target:'text',location:'',request:'',token:crypto.randomUUID()},pending=false,sent=false,manualOpen=false;
  const validKey=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'');
  let sessionStore='ms_panel';
  async function rpc(name,body){
    if(session && Date.now()/1000>Number(session.expires_at)-60){
      const r=await fetch(`${MS_CONFIG.url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:MS_CONFIG.anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
      if(!r.ok) throw new Error('session');
      const d=await r.json();session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Date.now()/1000+d.expires_in,email:d.user?.email};
      try{localStorage.setItem(sessionStore,JSON.stringify(session));}catch{}
    }
    const headers={apikey:MS_CONFIG.anon,'Content-Type':'application/json'};
    if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
    const r=await fetch(`${MS_CONFIG.url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('rpc');return r.json();
  }
  function hub(sites){
    document.getElementById('siteName').textContent=t('shared_editor_title');
    root.innerHTML=`<div class="edit-intro"><span class="ms-eyebrow">MR. SPACE / ${esc(t('shared_editor_title'))}</span><h1>${esc(t('shared_editor_title'))}</h1><p>${esc(t('shared_editor_intro'))}</p></div><div class="editor-sites">${sites.map(s=>`<article class="edit-card"><span class="ms-eyebrow">${esc(s.slug)}</span><h2>${esc(s.name)}</h2><p class="edit-hint">${esc(t('shared_editor_site_note'))}</p><a class="btn sun" href="?site=${encodeURIComponent(s.slug)}">${esc(t('visual_edit_open'))} ↗</a></article>`).join('')||`<section class="edit-card"><p>${esc(t(session?'no_workspaces':'shared_editor_signin'))}</p><a class="btn sun" href="../panel/">${esc(t('sign_in'))}</a></section>`}</div><section class="visual-entry editor-examples"><span class="ms-eyebrow">${esc(t('shared_editor_examples'))}</span><p>${esc(t('shared_editor_demo_note'))}</p><div class="edit-actions"><a class="btn" href="../request/?preview=mrspace">Mr. Space ↗</a><a class="btn" href="../request/?preview=rufcut">Rufcut ↗</a></div></section>`;
  }
  function persist(){
    let ok=true;try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{ok=false;}
    const p=root.querySelector('.edit-draft');if(p)p.textContent=t(ok?'device_draft':'device_unavailable');
  }
  function focusStep(){const heading=root.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});}}
  function render(){
    const steps=['choose_change','new_content','confirm_request'];
    root.innerHTML=`<div class="edit-intro"><span class="ms-eyebrow">MR. SPACE / ${esc(t('easy_edit'))}</span><h1>${esc(t(sent?'request_received':steps[step]))}</h1><p>${esc(t(sent?'received_note':'edit_intro'))}</p></div>
    ${visualKey&&!sent?`<p class="edit-secondary"><a href="../edit/">← ${esc(t('shared_editor_title'))}</a></p><section class="visual-entry"><span class="ms-eyebrow">${esc(t('visual_edit_title'))}</span><p>${esc(t('visual_edit_note'))}</p><a class="btn sun" href="../request/?k=${encodeURIComponent(visualKey)}">${esc(t('visual_edit_open'))} ↗</a></section><details class="manual-editor" ${manualOpen?'open':''}><summary>${esc(t('manual_edit_title'))}</summary>`:''}
    ${preview?`<div class="ms-notice">${esc(t('preview_edit_notice'))}</div>`:''}
    ${sent?'':`<ol class="edit-steps">${steps.map((s,i)=>`<li ${i===step?'aria-current="step"':''}><b>0${i+1}</b>${esc(t(s))}</li>`).join('')}</ol>`}
    <section class="edit-card">${sent?`<div class="edit-success"><small>${esc(t('requests'))}</small>#${esc(draft.receipt)}</div><p class="edit-hint">${esc(t('edit_affected_location'))}</p><div class="edit-summary">${esc(draft.location||'')}</div><p class="edit-hint">${esc(t('edit_requested_content'))}</p><div class="edit-summary">${esc(draft.request)}</div><div class="edit-actions"><a class="btn" href="../panel/">${esc(t('workspaces'))}</a><button class="btn sun" data-new>${esc(t('new_request'))}</button></div>`:
      step===0?`<div class="edit-targets">${['hours','contact','text','photo','design','general'].map(k=>`<button type="button" data-target="${k}" aria-pressed="${draft.target===k}">${esc(t(k))}</button>`).join('')}</div>`:
      step===1?`<label>${esc(t('edit_location_label'))}<input id="requestLocation" maxlength="120" value="${esc(draft.location||'')}"></label><p class="edit-hint">${esc(t('edit_location_hint'))}</p><label>${esc(t('new_content'))}<textarea id="requestText" maxlength="1800" minlength="3" rows="7">${esc(draft.request)}</textarea></label><p class="edit-hint">${esc(t('content_hint'))}</p><p class="edit-draft" role="status"></p>`:
      `<span class="ms-eyebrow">${esc(t(draft.target))}</span><p class="edit-hint">${esc(t('edit_affected_location'))}</p><div class="edit-summary">${esc(draft.location||'')}</div><p class="edit-hint">${esc(t('edit_requested_content'))}</p><div class="edit-summary">${esc(draft.request)}</div><p class="edit-hint">${esc(t('not_published'))}</p>`}
      ${sent?'':`<div class="edit-actions"><button type="button" class="btn" data-back ${step===0?'hidden':''}>${esc(t('back'))}</button><button type="button" class="btn sun" data-next ${step===2&&preview?'disabled':''}>${esc(t(step===2?'send_request':'next'))}</button></div><p class="edit-status" role="status"></p>`}</section>
      ${visualKey&&!sent?'</details>':''}
      ${key&&validKey(key)&&!preview?`<p class="edit-secondary"><a href="../request/?k=${encodeURIComponent(key)}">${esc(t('advanced_editor'))}</a></p>`:''}`;
    const manual=root.querySelector('.manual-editor');if(manual)manual.ontoggle=()=>{manualOpen=manual.open;};
    root.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{draft.target=b.dataset.target;draft.token=crypto.randomUUID();persist();render();root.querySelector(`[data-target="${draft.target}"]`)?.focus();});
    root.querySelector('[data-back]')?.addEventListener('click',()=>{step--;render();focusStep();});
    root.querySelector('[data-new]')?.addEventListener('click',()=>{sent=false;step=0;draft={target:'text',location:'',request:'',token:crypto.randomUUID()};render();});
    const area=root.querySelector('#requestLocation');if(area)area.oninput=()=>{draft.location=area.value;draft.token=crypto.randomUUID();persist();};
    const input=root.querySelector('#requestText');
    if(input){persist();input.addEventListener('input',()=>{draft.request=input.value;draft.token=crypto.randomUUID();persist();});}
    root.querySelector('[data-next]')?.addEventListener('click',async e=>{
      if(pending)return;
      if(step===1&&(draft.location||'').trim().length<2){root.querySelector('.edit-status').textContent=t('edit_location_required');area.focus();return;}
      if(step===1&&draft.request.trim().length<3){root.querySelector('.edit-status').textContent=t('validation_required');input.focus();return;}
      if(step<2){step++;render();focusStep();return;}
      if(preview)return;
      pending=true;e.target.disabled=true;
      try{
        const result=await rpc('ms_workspace_request',{p_site:site.slug,p_target:draft.target,p_request:`${t('edit_affected_location')}: ${draft.location}\n\n${draft.request}`,p_token:draft.token,p_key:key||null});
        if(!result?.ok||!result.id)throw new Error('unconfirmed');
        sent=true;draft.receipt=result.id;
        try{localStorage.removeItem(storageKey);}catch{}
        render();focusStep();
      }catch{root.querySelector('.edit-status').textContent=t('send_error');e.target.disabled=false;}
      finally{pending=false;}
    });
  }
  try{
    if(preview)site={slug:'preview',name:'Mr. Space'};
    else if(key&&validKey(key))site=await rpc('ms_workspace_link',{p_key:key});
    else{
      if(key)throw new Error('invalid_key');
      try{session=JSON.parse(localStorage.getItem('ms_panel')||'null');if(!session){sessionStore='ms_admin';session=JSON.parse(localStorage.getItem('ms_admin')||'null');}}catch{}
      const slug=params.get('site');
      if(!slug){
        if(!session?.access_token){hub([]);return;}
        const sites=await rpc('ms_my_sites',{});hub((Array.isArray(sites)?sites:[]).filter(s=>validKey(s.site_key)&&/^[a-z0-9_-]{1,80}$/.test(s.slug)));return;
      }
      if(!session?.access_token)throw new Error('session');
      if(!/^[a-z0-9_-]{1,80}$/.test(slug))throw new Error('site');
      const data=await rpc('ms_workspace_snapshot',{p_site:slug});site=data?.sites?.find(s=>s.slug===slug);
    }
    if(!site)throw new Error('site');
    if(site.slug==='rufcut'&&params.get('site')!=='rufcut'){const next=new URL(location.href);next.searchParams.set('site','rufcut');location.replace(next.href);return;}
    if(!preview&&key&&validKey(key)&&site.url)visualKey=key;
    else if(!preview&&session&&site.url){try{const sites=await rpc('ms_my_sites',{});visualKey=sites?.find(s=>s.slug===site.slug)?.site_key||null;}catch{}}
    document.getElementById('siteName').textContent=site.name;
    storageKey=`ms-easy-draft:${site.slug}:${preview?'preview':key||session?.email||'member'}`;
    try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&validKey(saved.token)&&typeof saved.request==='string'&&saved.request.length<=2000&&['hours','contact','text','photo','design','general'].includes(saved.target))draft=saved;}catch{}
    render();
  }catch{root.innerHTML=`<div class="edit-card"><h1>${esc(t('easy_edit'))}</h1><p>${esc(t('bad_link'))}</p><a class="btn" href="../panel/">${esc(t('sign_in'))}</a></div>`;}
})();
