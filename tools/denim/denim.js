(async function(){
  'use strict';try{await MsPlatform.ready;}catch{MsPlatform.fail('denim');return;}document.title=MsPlatform.t('denim_title')+' | Mr. Space';const {t,esc}=MsPlatform,root=document.getElementById('denim');
  root.innerHTML=`<div class="edit-intro"><span class="ms-eyebrow">MR. SPACE / ${esc(t('experimental'))}</span><h1>${esc(t('denim_title'))}</h1><p>${esc(t('denim_scope'))}</p></div><section class="edit-card"><div class="ms-draft-form" style="padding:0;border:0;margin:0"><label>${esc(t('unit'))}<select id="unit"><option value="cm">cm</option><option value="in">in</option></select></label><label>${esc(t('current_length'))}<input id="current" type="number" min="0.1" max="200" step="0.1" inputmode="decimal"></label><label>${esc(t('desired_length'))}<input id="desired" type="number" min="0.1" max="200" step="0.1" inputmode="decimal"></label><label class="ms-wide">${esc(t('fit_note'))}<textarea id="note" rows="3" maxlength="800"></textarea></label></div><p class="edit-hint">${esc(t('privacy_note'))}</p><p id="error" class="edit-status" role="status"></p><div id="result" class="edit-summary" aria-live="polite"></div><div class="edit-actions"><button class="btn" id="print" disabled>${esc(t('print'))}</button><button class="btn sun" id="copy" disabled>${esc(t('copy_note'))}</button></div></section>`;
  let output='';
  const get=id=>document.getElementById(id);
  function calculate(){
    const current=Number(get('current').value),desired=Number(get('desired').value),unit=get('unit').value;
    const valid=current>0&&desired>0&&current<=200&&desired<=current&&Number.isFinite(current)&&Number.isFinite(desired);
    get('error').textContent=!valid&&(get('current').value||get('desired').value)?t('invalid_measure'):'';
    get('copy').disabled=get('print').disabled=!valid;
    output=valid?`${t('current_length')}: ${current} ${unit}\n${t('desired_length')}: ${desired} ${unit}\n${t('reduction')}: ${Number((current-desired).toFixed(2))} ${unit}\n${get('note').value.trim()?`\n${t('fit_note')}: ${get('note').value.trim()}\n`:''}\n${t('denim_scope')}`:'';
    get('result').textContent=output;
  }
  root.querySelectorAll('input,textarea,select').forEach(el=>el.addEventListener('input',calculate));
  get('unit').addEventListener('change',()=>{const to=get('unit').value,factor=to==='cm'?2.54:1/2.54;['current','desired'].forEach(id=>{if(get(id).value)get(id).value=Number((Number(get(id).value)*factor).toFixed(2));});calculate();});
  get('copy').onclick=async()=>{try{await navigator.clipboard.writeText(output);get('error').textContent=t('copied');}catch{get('error').textContent=t('copy_failed');}};
  get('print').onclick=()=>window.print();
})();
