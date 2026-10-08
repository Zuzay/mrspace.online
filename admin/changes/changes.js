(async function(){
  'use strict';try{await MsPlatform.ready;}catch{MsPlatform.fail('changeReview');return;}document.title=MsPlatform.t('review_changes')+' | Mr. Space';
  const {t,esc}=MsPlatform,params=new URLSearchParams(location.search),demo=params.get('preview')==='1',api=MsApi.create();
  const root=document.getElementById('changeReview');
  let change=null,site=null,review={},source='',sourceURL='',selected=null,selector='',original='',image=false,red=true,phone=false,doc=null;
  function selectorOf(el){
    const target=el;
    if(el.id){const id='#'+CSS.escape(el.id);if(doc.querySelectorAll(id).length===1)return id;}
    const parts=[];while(el&&el!==doc.body&&parts.length<40){const tag=el.tagName.toLowerCase(),same=[...el.parentElement.children].filter(x=>x.tagName===el.tagName);parts.unshift(`${tag}:nth-of-type(${same.indexOf(el)+1})`);el=el.parentElement;}
    const result='body > '+parts.join(' > ');
    if(doc.querySelectorAll(result).length!==1||doc.querySelector(result)!==target)throw new Error('ambiguous_target');
    return result;
  }
  function draw(){
    root.innerHTML=`<div class="ms-platform-head"><div><span class="ms-eyebrow">MR. SPACE / ${esc(t('red_preview'))}</span><h1>${esc(t('review_changes'))}</h1><p>${esc(t('review_intro'))}</p></div></div>${demo?`<div class="ms-notice">${esc(t('preview_notice'))}</div>`:''}
      <div class="review-grid"><aside class="review-sidebar"><span class="ms-eyebrow">#${esc(change.id)} · ${esc(t(change.target))}</span><h2>${esc(t('client_request'))}</h2><div class="edit-summary">${esc(change.request)}</div><label>${esc(t('proposed_text'))}<textarea id="proposed" rows="5" maxlength="10000">${esc(review.proposed||'')}</textarea></label><label>${esc(t('operator_note'))}<textarea id="reviewNote" rows="3" maxlength="2000">${esc(review.note||'')}</textarea></label><p class="review-location" id="location">${esc(t('pick_target'))}</p><div class="review-actions"><button class="btn sun" id="approve">${esc(t('approve_review'))}</button><button class="btn" id="revise">${esc(t('request_revision'))}</button><button class="btn" id="saveReview">${esc(t('save'))}</button></div><p class="edit-hint">${esc(t('not_published'))}</p><p class="edit-status" id="decisionStatus" role="status"></p>${change.pr_url&&/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/.test(change.pr_url)?`<a class="btn" href="${esc(change.pr_url)}" target="_blank" rel="noopener">${esc(t('review_code'))}</a>`:''}${!demo&&change.ai_status==='ready'&&!review.released_at&&change.pr_head_sha&&review.decision==='approved'&&review.reviewed_sha===change.pr_head_sha?`<button class="btn" id="release">${esc(t('publish_request'))}</button><small>${esc(t('release_note'))}</small>`:''}</aside>
      <section class="review-canvas" data-device="desktop"><div class="review-toolbar"><button class="btn" id="toggleRed">${esc(t('show_original'))}</button><button class="btn" id="phone">${esc(t('phone'))}</button><span id="previewStatus">${esc(t('preview_pending'))}</span></div><iframe id="livePreview" sandbox="allow-same-origin" title="${esc(t('red_preview'))}"></iframe><p class="ms-notice">${esc(t('snapshot_notice'))}</p></section></div>`;
    root.querySelector('#proposed').addEventListener('input',()=>{review.proposed=root.querySelector('#proposed').value;paint();});
    root.querySelector('#reviewNote').addEventListener('input',()=>review.note=root.querySelector('#reviewNote').value);
    root.querySelector('#toggleRed').onclick=()=>{red=!red;root.querySelector('#toggleRed').textContent=t(red?'show_original':'show_changes');paint();};
    root.querySelector('#phone').onclick=()=>{phone=!phone;root.querySelector('.review-canvas').dataset.device=phone?'phone':'desktop';root.querySelector('#phone').textContent=t(phone?'desktop':'phone');};
    ['approve','revise','saveReview'].forEach(id=>root.querySelector('#'+id).onclick=()=>decide(id==='approve'?'approved':id==='revise'?'revision_requested':'pending'));
    root.querySelector('#release')?.addEventListener('click',async e=>{if(!confirm(t('release_note')))return;e.target.disabled=true;try{await api.rpc('ms_release_change',{p_id:change.id,p_expected_sha:change.pr_head_sha});root.querySelector('#decisionStatus').textContent=t('release_queued');}catch{root.querySelector('#decisionStatus').textContent=t('review_error');e.target.disabled=false;}});
  }
  function paint(){
    if(!selected)return;
    if(image){
      const value=(review.proposed||'').trim();let safe=false;try{safe=new URL(value).protocol==='https:';}catch{}
      selected.src=red&&safe?value:original;
      selected.classList.toggle('ms-review-change',red&&safe);
      selected.title=red&&safe?t('image_proposal'):'';return;
    }
    selected.replaceChildren();
    if(red&&review.proposed){const before=doc.createElement('del'),after=doc.createElement('ins');before.textContent=original;after.textContent=review.proposed;selected.append(before,after);selected.classList.add('ms-review-change');}
    else{selected.innerHTML=selected.dataset.msReviewOriginalHTML||'';selected.classList.remove('ms-review-change');}
  }
  function pick(el){
    const next=selectorOf(el);if(next.length>500)throw new Error('target_too_deep');
    if(selected){if(image)selected.src=original;else selected.innerHTML=selected.dataset.msReviewOriginalHTML||'';selected.classList.remove('ms-review-change','ms-review-selected');}
    selected=el;image=el.tagName==='IMG';selector=next;original=image?el.src:el.innerText||el.getAttribute('alt')||'';
    el.dataset.msReviewOriginalHTML=el.innerHTML;el.classList.add('ms-review-selected');root.querySelector('#location').textContent=selector;paint();
  }
  function attach(){
    const frame=root.querySelector('#livePreview');frame.onload=()=>{
      doc=frame.contentDocument;if(!doc?.body)return;
      const style=doc.createElement('style');style.textContent=`.ms-review-selected{outline:2px dashed #dc3030!important;outline-offset:5px!important}.ms-review-change{background:#fff1f1!important;color:#b21d28!important;outline:2px solid #df3434!important;padding:8px!important}.ms-review-change del{display:block!important;color:#9c6464!important;font-size:.8em!important;text-decoration:line-through!important}.ms-review-change ins{display:block!important;color:#c3232d!important;text-decoration:none!important;white-space:pre-wrap!important}body{cursor:crosshair!important}a,button{cursor:crosshair!important}`;doc.head.append(style);
      doc.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const el=e.target.closest('p,h1,h2,h3,h4,li,address,td,figcaption,img,[data-ms-edit],[data-ms-field]');if(el&&el!==doc.body){try{pick(el);}catch{root.querySelector('#location').textContent=t('preview_unlocated');}}},true);
      const anchor=review.selector || (change.anchor?.includes('::')?change.anchor.split('::').slice(1).join('::'):null);
      let found=null;try{if(anchor)found=doc.querySelector(anchor);}catch{}
      if(!found){const suggestions={hours:'[data-ms-field="hours"],.hours',contact:'[data-ms-field="contact"],address',text:'[data-ms-field="intro"],h1'};try{if(suggestions[change.target])found=doc.querySelector(suggestions[change.target]);}catch{}}
      if(found&&anchor){try{pick(found);}catch{root.querySelector('#location').textContent=t('preview_unlocated');}}else root.querySelector('#location').textContent=t('preview_unlocated');
      root.querySelector('#previewStatus').textContent=t('red_preview');
    };
    const parsed=new DOMParser().parseFromString(source,'text/html');
    parsed.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],link[rel="preload"],link[rel="prefetch"]').forEach(el=>el.remove());
    parsed.querySelectorAll('*').forEach(el=>{for(const a of [...el.attributes])if(a.name.startsWith('on'))el.removeAttribute(a.name);});
    const base=parsed.createElement('base');base.href=sourceURL;base.target='_blank';parsed.head.prepend(base);
    frame.srcdoc='<!doctype html>'+parsed.documentElement.outerHTML;
  }
  async function decide(decision){
    const status=root.querySelector('#decisionStatus');status.classList.remove('review-saved');
    if(decision==='approved'&&(!selected||!review.proposed?.trim())){status.textContent=t('need_preview');return;}
    if(decision==='revision_requested'&&(!review.note||review.note.trim().length<3)){status.textContent=t('revision_note_required');return;}
    if(image&&decision==='approved'){try{if(new URL(review.proposed.trim()).protocol!=='https:')throw new Error();}catch{status.textContent=t('image_url_required');return;}}
    if(demo){status.textContent=t('preview_only');return;}
    root.querySelectorAll('.review-actions button').forEach(b=>b.disabled=true);
    try{await api.rpc('ms_review_change',{p_id:change.id,p_decision:decision,p_proposed:review.proposed||'',p_selector:selector||null,p_note:review.note||null});review.decision=decision;review.reviewed_sha=change.pr_head_sha;status.textContent=t('review_saved');status.classList.add('review-saved');if(change.pr_head_sha&&decision==='approved')location.reload();}
    catch{status.textContent=t('review_error');}finally{root.querySelectorAll('.review-actions button').forEach(b=>b.disabled=false);}
  }
  try{
    if(demo){
      site={name:'Mr. Space / LAB',slug:'preview'};change={id:'PREVIEW',target:'text',request:t('content_hint'),anchor:'preview::h1'};review={proposed:t('commerce_title')};
      const content=MsRender.starter(t('brand_name'),document.documentElement.lang);content.sections[0].text=t('commerce_desc');source=MsRender.render(content,{preset:'commerce'},{assetBase:new URL('../../assets/',location.href).href});sourceURL=location.href;
    }else{
      if(await api.rpc('ms_role')!=='admin')throw new Error('not_admin');
      const id=params.get('id');if(!/^\d+$/.test(id||''))throw new Error('id');
      const rows=await api.get(`ms_changes?select=id,site,target,request,status,anchor,original,ai_status,pr_head_sha,pr_url&id=eq.${id}`);change=rows[0];if(!change)throw new Error('not_found');
      const sites=await api.get(`ms_sites?select=slug,name,url&slug=eq.${encodeURIComponent(change.site)}`);site=sites[0];
      const reviews=await api.get(`ms_change_reviews?select=decision,proposed,selector,note,reviewed_sha,released_at&change_id=eq.${id}`);review=reviews[0]||{};
    }
    document.getElementById('reviewBrand').textContent=site.name;draw();
    try{if(!demo){const snapshot=await api.control({action:'preview_snapshot',site:site.slug});source=snapshot.html;sourceURL=snapshot.source_url;}attach();}
    catch{root.querySelector('#previewStatus').textContent=t('preview_fetch_error');}
  }catch{root.innerHTML=`<div class="edit-card"><h1>${esc(t('review_changes'))}</h1><p>${esc(t('bad_link'))}</p><a class="btn" href="../">${esc(t('sign_in'))}</a></div>`;}
})();
