/* Customer change requests: page locations, local drafts and explicit review. */
'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=window.MS_CONFIG,frame=$('#site'),qs=new URLSearchParams(location.search),KEY=qs.get('k'),EDIT=qs.get('e');
const EMPTY='[Remove the text in this area]',NOTE='\n\nNote: ',GENERAL='__general',uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const S={items:new Map(),doc:null,win:null,parts:[],selected:null,view:'areas',editing:true,sub:null,quota:null,siteName:'',other:'',name:'',email:'',dirty:false,busy:false,storage:'',storageOK:true,restored:false,search:'',filter:'all',pending:null,approved:[]};
let noticeTimer;
const textOf=el=>(el.innerText||el.textContent||'').trim();
const valueOf=el=>isImage(el)?(el.getAttribute('src')||bgURL(el)):textOf(el);
const isImage=el=>el.tagName==='IMG'||(/url\(/i.test(el.style?.backgroundImage||'')&&!textOf(el));
const bgURL=el=>(el.style?.backgroundImage||'').match(/url\(["']?(.*?)["']?\)/)?.[1]||'';
const outline=it=>it.type==='image'?(it.el?.closest('figure,.hero-art')||it.el):it.el;
const schema=window.MsEditorSchema;
const sitePath=()=>S.previewPath||(S.snapshotURL?new URL(S.snapshotURL).pathname:'')||S.win?.location.pathname||'';
const langName={en:'English',tr:'Türkçe',es:'Español',de:'Deutsch',fr:'Français'};
function imageURL(value,base=S.snapshotURL||S.win?.location.href||location.href){
  try{const u=new URL(String(value).trim(),base);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
function photoValue(value){return /^https?:\/\/\S+$/i.test(value.trim())?imageURL(value):'';}
async function rpc(fn,args){
  const r=await fetch(cfg.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:cfg.anon,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('rpc');return r.json();
}
function notify(message){clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').classList.add('on');noticeTimer=setTimeout(()=>$('#notice').classList.remove('on'),7000);}
function pathOf(el){return schema.selector(el,S.doc);}
function sectionOf(el){return schema.section(el,S.schema,lang,t.home);}
function labelOf(el,original=valueOf(el)){
  const type=isImage(el)?t.photo:/^H\d$/.test(el.tagName)?t.heading:['A','BUTTON'].includes(el.tagName)?t.button:t.text;
  const fallback=isImage(el)?type:type+': '+original.replace(/\s+/g,' ').slice(0,65);
  return schema.label(el,S.schema,lang,fallback);
}
function locationOf(it){return [it.page||it.anchor?.split('::')[0]||t.home,it.section,it.label||it.target].filter(Boolean).join(' › ');}
function crumb(it){return `<div class="crumb"><span>${esc(it.page||t.home)}</span>${it.section?`<span>${esc(it.section)}</span>`:''}<span>${esc(it.label||it.target)}</span></div>`;}
function partOf(el){return S.parts.find(p=>p.el===el);}
function capture(el){
  const original=valueOf(el);return {anchor:sitePath()+'::'+pathOf(el),el,type:isImage(el)?'image':'text',original,originalURL:isImage(el)?imageURL(original):'',origHTML:el.innerHTML,origSrcset:el.getAttribute('srcset'),origSizes:el.getAttribute('sizes'),origBg:el.style.backgroundImage,page:schema.page(S.doc,S.schema,lang,t.home),section:sectionOf(el),label:labelOf(el,original)};
}
function restore(it){
  if(!it.el)return;
  if(it.type==='image'){
    if(it.el.tagName==='IMG'){it.el.src=it.originalURL||it.original;if(it.origSrcset)it.el.setAttribute('srcset',it.origSrcset);else it.el.removeAttribute('srcset');if(it.origSizes)it.el.setAttribute('sizes',it.origSizes);}
    else it.el.style.backgroundImage=it.origBg||'';
  }else if(it.origHTML!=null)it.el.innerHTML=it.origHTML;
}
function preview(it,value){
  if(!it.el)return;
  if(it.type==='image'){
    const url=photoValue(value);if(!url){restore(it);return;}
    if(it.el.tagName==='IMG'){it.el.removeAttribute('srcset');it.el.removeAttribute('sizes');it.el.src=url;}
    else it.el.style.backgroundImage='url("'+url+'")';
  }else if(value===it.original)restore(it);else it.el.innerText=value;
}
function serialize(it){return Object.fromEntries(['id','anchor','kind','text','note','status','original','originalURL','type','page','section','label','target'].map(k=>[k,it[k]]));}
function persist(){
  if(!S.storage)return;
  const pending=S.selected&&S.dirty?{...serialize(S.selected),text:$('#content')?.value||'',note:$('#editNote')?.value||'',kind:$('#big')?.checked?'big':'small'}:null;
  try{localStorage.setItem(S.storage,JSON.stringify({version:1,serverVersion:S.sub?.version||0,at:Date.now(),items:[...S.items.values()].map(serialize),pending,other:S.other}));S.storageOK=true;}catch{S.storageOK=false;}
  $('#draftStatus').textContent=!S.storageOK?t.storageError:S.dirty?t.unsaved:t.local;
}
function header(){
  document.title=t.editor+' | '+(S.siteName||'Mr. Space');$('#siteName').textContent=S.siteName;frame.title=t.editor;
  $('#mEdit').textContent=t.edit;$('#mBrowse').textContent=t.browse;$('#mode').setAttribute('aria-label',t.editor);
  $('#reviewBtn').textContent=t.review+([...S.items.values()].length?' ('+S.items.size+')':'');$('#areasToggle').textContent='☰';$('#areasToggle').setAttribute('aria-label',t.areas);$('#areasToggle').title=t.areas;
  $('#editorLang').setAttribute('aria-label',t.language);$('#editorLang').innerHTML=(rufcutEnglish?['en']:editorLangs).map(l=>`<option value="${l}" ${l===lang?'selected':''}>${langName[l]}</option>`).join('');
  $('#contextBar').textContent=(S.selected?locationOf(S.selected):t.previewOnly)+(S.snapshotURL?' · '+t.snapshotNote:'');
}
const CAND='[data-ms-field],[data-ms-edit],h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,button,a,label,td,th,dt,dd,small,img,[style*="background-image"]';
function eligible(el){
  if(el.closest('[data-ms-skip],[data-lang-host],#themeToggle,.skip-link,[aria-hidden=true],[data-ms-editor-ui]')||el.closest('svg'))return false;
  if(!isImage(el)&&!textOf(el))return false;
  if(el.tagName==='P'&&el.closest('a,button'))return false;
  if(el.matches('label')&&el.querySelector('input,textarea,select'))return false;
  const ancestor=el.parentElement?.closest('[data-ms-field],[data-ms-edit],h1,h2,h3,h4,h5,h6,p,li,blockquote,button,a');
  if(ancestor&&!isImage(el)&&ancestor.matches(CAND)&&ancestor.contains(el))return false;
  return true;
}
function buildParts(){S.parts=[...S.doc.querySelectorAll(CAND)].filter(eligible).filter(el=>pathOf(el)).map(capture);}
function resolveSelection(el){
  if(!el?.closest)return null;
  let node=el.closest(CAND);while(node){const p=partOf(node);if(p)return p;node=node.parentElement?.closest(CAND);}
  return null;
}
async function externalSnapshot(){
 let target;try{target=new URL(S.snapshotURL||frame.src);}catch{return;}
 if(target.protocol!=='https:'||!['heronca.com','www.heronca.com','laloo.org','www.laloo.org'].includes(target.hostname))return;
 S.snapshotPending=true;const nonce=crypto.randomUUID();
 await new Promise(resolve=>{
  let timer;
  const finish=()=>{clearTimeout(timer);window.removeEventListener('message',receive);S.snapshotPending=false;resolve();};
  const receive=event=>{
   if(event.source!==frame.contentWindow||event.origin!==target.origin||event.data?.type!=='ms:editor:snapshot:result'||event.data.nonce!==nonce||typeof event.data.html!=='string'||event.data.html.length>1000000)return;
   let url;try{url=new URL(event.data.url);if(url.origin!==target.origin||!['/','/index.html','/about.html'].includes(url.pathname))return;}catch{return;}
   // Treat even an allowlisted partner's HTML as data. The sandbox never runs it.
   const doc=new DOMParser().parseFromString(event.data.html,'text/html');
   doc.querySelectorAll('script,iframe,object,embed,form,input,textarea,select,base,meta[http-equiv]').forEach(el=>el.remove());
   doc.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||a.name==='srcdoc')el.removeAttribute(a.name);}));
   const base=doc.createElement('base');base.href=url.href;doc.head.prepend(base);
   S.snapshotURL=url.href;S.previewPath=url.pathname;frame.setAttribute('sandbox','allow-same-origin');frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;finish();
  };
  window.addEventListener('message',receive);timer=setTimeout(finish,6000);
  frame.contentWindow.postMessage({type:'ms:editor:snapshot',nonce},target.origin);
 });
}
async function wire(){
  try{S.win=frame.contentWindow;S.doc=frame.contentDocument;if(!S.doc?.body)throw 0;}catch{S.doc=null;if(!S.snapshotPending)await externalSnapshot();return renderAreas();}
  await S.win.MSI18N?.ready;
  await Promise.race([S.doc.fonts.ready,new Promise(resolve=>setTimeout(resolve,2500))]);
  S.schema=schema.config(S.doc);S.selected=null;S.dirty=false;buildParts();
  const style=S.doc.createElement('style');style.textContent=`.ms-editor-hover{outline:2px dashed #eeb44a!important;outline-offset:5px!important;cursor:pointer!important}.ms-editor-selected{outline:3px solid #f6b93b!important;outline-offset:6px!important}.ms-editor-changed{outline:2px solid #69bb91!important;outline-offset:4px!important}.ms-editor-selected.ms-editor-changed{outline-color:#f6b93b!important}`;S.doc.head.append(style);
  let hovered=null;
  S.doc.addEventListener('pointerover',e=>{if(!S.editing||e.pointerType!=='mouse')return;hovered?.classList.remove('ms-editor-hover');hovered=resolveSelection(e.target)?.el;hovered?.classList.add('ms-editor-hover');});
  S.doc.addEventListener('pointerout',()=>hovered?.classList.remove('ms-editor-hover'));
  S.doc.addEventListener('click',e=>{if(!S.editing)return;e.preventDefault();e.stopImmediatePropagation();const p=resolveSelection(e.target);if(p)guard(()=>select(p));},true);
  S.doc.addEventListener('submit',e=>{if(S.editing)e.preventDefault();},true);
  if(S.snapshotURL)S.doc.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();},true);
  // Restore each known request by its full page + selector. Never guess another location.
  for(const it of S.items.values()){
    it.el=null;if(it.anchor?.split('::')[0]!==sitePath())continue;
    const el=schema.resolve(S.doc,it.anchor.split('::')[1]);if(!el||!eligible(el))continue;
    const live=capture(el);it.conflict=live.original!==it.original;
    Object.assign(it,{el,type:live.type,origHTML:live.origHTML,origSrcset:live.origSrcset,origSizes:live.origSizes,origBg:live.origBg,originalURL:it.originalURL||imageURL(it.original),page:live.page,section:live.section,label:live.label});
    preview(it,it.text);mark(it);
  }
  canvasMode();header();renderAreas();
  if(S.pending){const pending=S.pending;S.pending=null;let el;try{if(pending.anchor?.split('::')[0]===sitePath())el=schema.resolve(S.doc,pending.anchor.split('::')[1]);}catch{}
    if(el){select(partOf(el)||capture(el));if(S.selected.status==='new'){$('#content').value=pending.text||'';$('#editNote').value=pending.note||'';$('#big').checked=pending.kind==='big';editInput();}}
    else notify(t.missing);
  }
  if(S.restored){notify(t.recovered);S.restored=false;}
}
function mark(it){outline(it)?.classList.add('ms-editor-changed');if(it.el){it.el.setAttribute('data-ms-change-location',locationOf(it));it.el.setAttribute('title',t.saved+' · '+locationOf(it));}}
function reveal(el){
  const hidden=el.closest('[role=tabpanel][hidden]');if(hidden){const tab=S.doc.querySelector('[aria-controls="'+CSS.escape(hidden.id)+'"]');tab?.click();hidden.hidden=false;}
  el.scrollIntoView({block:matchMedia('(max-width:640px)').matches?'start':'center',behavior:'auto'});
  if(matchMedia('(max-width:640px)').matches)S.win.scrollBy(0,-70);
}
function select(part){
  outline(S.selected||{})?.classList.remove('ms-editor-selected');
  const it=S.items.get(part.anchor)||[...S.items.values()].find(it=>it.el===part.el)||{...part,id:null,kind:'small',text:part.type==='image'?'':part.original,note:'',status:'new'};
  S.selected=it;S.dirty=false;S.view='field';S.editing=true;canvasMode();$('#mEdit').setAttribute('aria-pressed','true');$('#mBrowse').setAttribute('aria-pressed','false');
  outline(it)?.classList.add('ms-editor-selected');if(it.el)reveal(it.el);document.body.classList.add('sidebar-open');header();renderField();
  $('#sidebar').scrollTop=0;$('#sidebarTitle').tabIndex=-1;$('#sidebarTitle').focus({preventScroll:true});
}
function guard(action){
  if(S.busy)return;
  if(!S.dirty){action();return;}
  const it=S.selected;showDialog(t.where,`<p class="dialog-intro">${esc(t.discardAsk)}</p>${crumb(it)}${compareHTML({...it,text:$('#content').value,note:$('#editNote').value})}`,[
    {label:t.keep,run:()=>{}},{label:t.discard,run:()=>{if(S.items.has(it.anchor))preview(it,it.text);else restore(it);S.dirty=false;persist();action();}},{label:t.addDraft,primary:true,run:()=>{if(commit())action();}}
  ]);
}
function showDialog(title,body,actions){
  const d=$('#confirm');$('#confirmTitle').textContent=title;$('#confirmBody').innerHTML=body;
  $('#confirmActions').className='dialog-actions';$('#confirmActions').innerHTML='';
  actions.forEach(a=>{const b=document.createElement('button');b.className=a.primary?'btn':'ghost';b.textContent=a.label;b.onclick=()=>{d.close();a.run();};$('#confirmActions').append(b);});
  d.querySelector('[data-close]').textContent=t.close;d.querySelector('[data-close]').onclick=()=>d.close();if(!d.open)d.showModal();
}
function sidebarTitle(title,hint){$('#sidebarEyebrow').textContent=t.editor;$('#sidebarTitle').textContent=title;$('#sidebarHint').textContent=hint;}
function renderAreas(){
  S.view='areas';sidebarTitle(t.areas,t.choose);
  $('#sideBody').innerHTML=`<input class="search" id="search" type="search" aria-label="${esc(t.search)}" placeholder="${esc(t.search)}" value="${esc(S.search)}"><div class="area-filters"><button data-filter="all" aria-pressed="${S.filter==='all'}">${esc(t.backAreas)}</button><button data-filter="photos" aria-pressed="${S.filter==='photos'}">${esc(t.photo)} · ${S.parts.filter(p=>p.type==='image').length}</button></div><div id="areaList"></div>`;
  $('#search').oninput=e=>{S.search=e.target.value;renderAreaList();};$('#sideBody').querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{S.filter=b.dataset.filter;S.search='';renderAreas();});renderAreaList();header();
  $('#draftStatus').textContent=S.storageOK?t.local:t.storageError;
}
function renderAreaList(){
  const list=$('#areaList');list.innerHTML='';const groups=new Map(),q=S.search.toLocaleLowerCase(lang).trim();
  for(const part of S.parts){if(S.filter==='photos'&&part.type!=='image')continue;if(q&&!`${part.section} ${part.label} ${part.original}`.toLocaleLowerCase(lang).includes(q))continue;const parts=groups.get(part.section)||[];parts.push(part);groups.set(part.section,parts);}
  for(const [name,parts]of groups){const d=document.createElement('details');d.className='area-group';d.open=!!q||S.filter==='photos'||groups.size===1||[...groups.keys()][0]===name;
    const summary=document.createElement('summary');summary.textContent=name+' · '+parts.length;d.append(summary);
    for(const part of parts){const b=document.createElement('button'),edited=S.items.has(part.anchor)||[...S.items.values()].some(it=>it.el===part.el);b.className='area-button'+(edited?' changed':'');b.dataset.anchor=part.anchor;
      b.innerHTML=`<span>${esc(edited?t.edited:part.type==='image'?t.photo:t.chooseArea)}</span>${part.type==='image'&&part.originalURL?`<img src="${esc(part.originalURL)}" alt="" loading="lazy">`:''}${esc(part.label)}`;
      b.onclick=()=>guard(()=>select(part));d.append(b);
    }list.append(d);
  }
  if(!groups.size){list.innerHTML=`<p class="empty">${esc(t.noResults)}</p>`;}
}
function compareHTML(it){
  const img=it.type==='image',url=img?photoValue(it.text||''):'';
  if(img)return `<div class="image-compare"><figure><figcaption>${esc(t.before)}</figcaption><img src="${esc(it.originalURL||imageURL(it.original))}" alt="${esc(t.before)}"></figure><figure><figcaption>${esc(t.after)}</figcaption><img src="${esc(url||it.originalURL||imageURL(it.original))}" alt="${esc(t.after)}"></figure></div>${!url&&(it.text||it.note)?`<p class="help">${esc(it.text||t.photoNote)}</p>`:''}${it.note?`<p class="help">${esc(t.note)}: ${esc(it.note)}</p>`:''}`;
  return `<dl><dt>${esc(t.before)}</dt><dd>${esc(it.original)}</dd><dt>${esc(t.after)}</dt><dd class="after">${esc(it.text||t.removeText)}</dd>${it.note?`<dt>${esc(t.note)}</dt><dd>${esc(it.note)}</dd>`:''}</dl>`;
}
function renderField(){
  const it=S.selected;if(!it)return renderAreas();const img=it.type==='image',saved=S.items.has(it.anchor),locked=it.status!=='new';
  sidebarTitle(it.label||it.target,t.previewOnly);
  $('#sideBody').innerHTML=`<button class="ghost" id="backAreas">← ${esc(t.backAreas)}</button>${crumb(it)}${it.conflict?`<p class="restore-note">${esc(t.currentChanged)}</p>`:''}
  ${locked?`<p class="help">${esc(t.locked)}</p><article class="change-card">${compareHTML(it)}</article>`:
  `${img?`<div id="photoCompare">${compareHTML(it)}</div><label class="file-label">${esc(t.upload)}<input id="photoFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="${esc(t.upload)}"></label><p class="help">${esc(t.uploadHint)}</p><p id="uploadStatus" class="status" role="status"></p>`:`<label class="field-label">${esc(t.before)}</label><div class="before-value">${esc(it.original)}</div>`}
  <label class="field-label" for="content">${esc(img?t.imageLink:t.content)}</label><textarea class="content-input" id="content" maxlength="1800" rows="4">${esc(it.text??(img?'':it.original))}</textarea>
  <label class="field-label" for="editNote">${esc(t.note)}</label><textarea id="editNote" class="note-input" maxlength="180" rows="2" placeholder="${esc(t.notePh)}">${esc(it.note||'')}</textarea>
  <label class="check"><input type="checkbox" id="big" ${it.kind==='big'?'checked':''}><span>${esc(t.big)}</span></label>
  <p id="fieldStatus" class="status" role="status">${saved?esc(t.saved+' · '+locationOf(it)):''}</p>
  <div class="actions"><button class="ghost" id="cancelField">${esc(t.cancel)}</button><button class="btn" id="saveField">${esc(t.addDraft)}</button></div>${saved?`<button class="ghost" id="undoField" style="width:100%;margin-top:10px">${esc(t.undo)}</button>`:''}`}`;
  $('#backAreas').onclick=()=>guard(clearSelection);
  if(locked)return;
  if(S.demo&&img){$('#photoFile').disabled=true;$('#uploadStatus').textContent=t.demoNote;}
  $('#content').oninput=editInput;$('#editNote').oninput=editInput;$('#big').onchange=editInput;
  $('#saveField').onclick=commit;$('#cancelField').onclick=()=>{if(S.busy)return;S.dirty=false;preview(it,saved?it.text:it.original);persist();clearSelection();};
  if(saved)$('#undoField').onclick=()=>guard(()=>removeChange(it));
  if(img)$('#photoFile').onchange=uploadPhoto;
}
function clearSelection(){outline(S.selected||{})?.classList.remove('ms-editor-selected');S.selected=null;S.dirty=false;renderAreas();header();}
function editInput(){
  const it=S.selected;if(!it)return;const text=$('#content').value,note=$('#editNote').value,kind=$('#big').checked?'big':'small';
  S.dirty=text!==(it.text||'')||note!==(it.note||'')||kind!==it.kind;preview(it,text);
  if(it.type==='image'){
    $('#photoCompare').innerHTML=compareHTML({...it,text,note});const im=$('#photoCompare figure:last-child img');
    if(photoValue(text))im.onerror=()=>{if(S.selected===it)$('#uploadStatus').textContent=t.imageFailed;};
  }
  $('#fieldStatus').textContent=S.dirty?t.unsaved:S.items.has(it.anchor)?t.saved+' · '+locationOf(it):'';persist();
}
function commit(){
  if(S.busy||!S.selected)return false;const it=S.selected,text=$('#content').value.trim(),note=$('#editNote').value.trim();
  if((!S.items.has(it.anchor)&&S.items.size>=40)||text.length+note.length+NOTE.length>2000){$('#fieldStatus').textContent=t.limit;return false;}
  const unchanged=it.type==='image'?!text||text===it.original||photoValue(text)===it.originalURL:text===it.original;
  if(unchanged&&!note){removeChange(it);return true;}
  it.text=text;it.note=note;it.kind=$('#big').checked?'big':'small';
  // The existing API keeps target (60 chars) and a stable full selector separately.
  it.target=[it.section,it.label].filter(Boolean).join(' / ').slice(0,60);
  S.items.set(it.anchor,it);S.dirty=false;preview(it,text);mark(it);persist();header();renderField();notify(t.saved+'\n'+locationOf(it));return true;
}
function removeChange(it){
  restore(it);outline(it)?.classList.remove('ms-editor-changed','ms-editor-selected');it.el?.removeAttribute('data-ms-change-location');it.el?.removeAttribute('title');S.items.delete(it.anchor);S.selected=null;S.dirty=false;persist();renderAreas();header();notify(t.removed+'\n'+locationOf(it));
}
async function uploadPhoto(e){
  const file=e.target.files?.[0],it=S.selected;if(S.demo||!file||!it||S.busy)return;
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||!file.size||file.size>5*1024*1024){$('#uploadStatus').textContent=t.uploadInvalid;e.target.value='';return;}
  S.busy=true;$('#uploadStatus').textContent=t.uploading;$('#saveField').disabled=true;e.target.disabled=true;
  const form=new FormData();form.append(KEY?'key':'edit',KEY||EDIT);form.append('file',file);
  try{
    const r=await fetch(cfg.url+'/functions/v1/ms-builder',{method:'POST',headers:{apikey:cfg.anon},body:form,signal:AbortSignal.timeout(45000)});const data=await r.json();
    // Upload responses must be public URLs in the current project's media bucket.
    const expected=cfg.url+'/storage/v1/object/public/ms-media/';
    if(!r.ok||!data.url?.startsWith(expected)||!photoValue(data.url))throw new Error('upload');
    if(S.selected!==it)return;$('#content').value=data.url;editInput();$('#uploadStatus').classList.remove('error');$('#uploadStatus').textContent=file.name;
  }catch{if(S.selected===it){$('#uploadStatus').textContent=t.uploadError;$('#uploadStatus').classList.add('error');}}
  finally{S.busy=false;if(S.selected===it){$('#saveField').disabled=false;e.target.disabled=false;e.target.value='';}}
}
function changeCard(it,jump=true){return `<article class="change-card"><h3>${esc(locationOf(it))}</h3>${compareHTML(it)}${it.status!=='new'?`<p class="help">${esc(t.inProgress)}</p>`:''}${jump?`<button class="ghost" data-locate="${esc(it.anchor)}">${esc(t.locate)}</button>`:''}</article>`;}
function renderReview(){
  S.view='review';outline(S.selected||{})?.classList.remove('ms-editor-selected');S.selected=null;header();sidebarTitle(t.sheet,t.submitNote);
  $('#sideBody').innerHTML=`<button class="ghost" id="backAreas">← ${esc(t.backAreas)}</button>${S.quota?`<p class="help">${esc(t.quota(S.quota))}</p>`:''}<div id="changesList">${[...S.items.values()].map(it=>changeCard(it)).join('')||`<p class="empty">${esc(t.empty)}</p>`}</div><div class="review-fields">
    <label for="fOther">${esc(t.other)}</label><textarea id="fOther" maxlength="2000">${esc(S.other)}</textarea><label for="fName">${esc(t.name)}</label><input id="fName" maxlength="80" autocomplete="name" value="${esc(S.name)}"><label for="fEmail">${esc(t.email)}</label><input id="fEmail" type="email" maxlength="160" autocomplete="email" value="${esc(S.email)}"></div><div class="review-submit"><p id="sendStatus" class="field-error" role="status"></p><button class="btn" id="sendReview">${esc(t.sendCheck)}</button></div>`;
  $('#backAreas').onclick=clearSelection;
  $('#sideBody').querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>locate(S.items.get(b.dataset.locate)));
  for(const [id,key]of [['fOther','other'],['fName','name'],['fEmail','email']])$('#'+id).oninput=e=>{S[key]=e.target.value;persist();};
  $('#sendReview').disabled=!!S.demo;if(S.demo)$('#sendStatus').textContent=t.demoNote;$('#sendReview').onclick=confirmSend;document.body.classList.add('sidebar-open');$('#sidebar').scrollTop=0;
}
function locate(it){
  if(it.el){select(it);return;}
  const pg=it.anchor?.split('::')[0];
  if(!pg||pg===sitePath()||!pg.startsWith('/')||pg.startsWith('//')){notify(t.missing);return;}
  S.pending={...serialize(it)};frame.src=pg;
}
function itemsPayload(){
  const items=[...S.items.values()].map(it=>({id:it.id,kind:it.kind,target:it.target,anchor:it.anchor,original:it.original,request:(it.type==='text'&&!it.text?EMPTY:it.text||'')+(it.note?NOTE+it.note:'')||'(see note)'}));
  if(S.other.trim())items.push({id:S.generalId||null,kind:'small',target:t.general,anchor:null,original:null,request:S.other.trim()});return items;
}
function confirmSend(){
  if(S.demo)return;
  const items=itemsPayload();if(!items.length&&!S.sub){$('#sendStatus').textContent=t.needOne;return;}
  if(items.length>40||items.some(x=>x.request.length>2000)){$('#sendStatus').textContent=t.limit;return;}
  if(!/^\S+@\S+\.\S+$/.test(S.email)){$('#sendStatus').textContent=t.needEmail;$('#fEmail').focus();return;}
  showDialog(t.sendCheck,`<p class="dialog-intro">${esc(t.submitNote)}</p>${[...S.items.values()].map(it=>changeCard(it,false)).join('')}${S.other.trim()?`<article class="change-card"><h3>${esc(t.general)}</h3><p>${esc(S.other)}</p></article>`:''}`,[{label:t.keep,run:()=>{}},{label:S.sub?t.update:t.send,primary:true,run:send}]);
}
async function send(){
  if(S.demo||S.busy)return;S.busy=true;$('#sendReview').disabled=true;$('#sendStatus').textContent=t.sending;
  try{
    const r=await rpc(S.sub?'ms_revise':'ms_submit',S.sub?{p_edit:EDIT,p_items:itemsPayload(),p_name:S.name,p_email:S.email}:{p_key:KEY,p_items:itemsPayload(),p_name:S.name,p_email:S.email});
    if(!r?.ok||(!S.sub&&!uuid(r.edit_key)))throw new Error('unconfirmed');
    const editKey=EDIT||r.edit_key;
    try{localStorage.removeItem(S.storage);}catch{}
    $('#doneTitle').textContent=S.sub?(r.changed?t.updated:t.noChange):t.sent;$('#doneText').textContent=t.submitNote;
    $('#doneList').innerHTML=`<p class="eyebrow">${esc(t.receivedAreas)}</p>${[...S.items.values()].map(it=>changeCard(it,false)).join('')}${S.other.trim()?`<article class="change-card"><h3>${esc(t.general)}</h3><p>${esc(S.other)}</p></article>`:''}`;
    const link=location.origin+location.pathname+'?e='+encodeURIComponent(editKey);$('#reviseBtn').textContent=t.revise;$('#reviseBtn').onclick=()=>location.assign(link);$('#copyBtn').textContent=t.copy;$('#copyBtn').onclick=async()=>{try{await navigator.clipboard.writeText(link);$('#copyBtn').textContent=t.copied;}catch{notify(link);}};
    S.submitted=true;$('#done').showModal();$('#done').oncancel=e=>e.preventDefault();
  }catch{$('#sendStatus').textContent=t.err;}
  finally{S.busy=false;$('#sendReview').disabled=false;}
}
function fatal(message=t.bad){const node=$('#fatal');node.replaceChildren();const p=document.createElement('p');p.textContent=message;node.append(p);if(message===t.err){const button=document.createElement('button');button.className='btn';button.textContent=t.keep;button.onclick=()=>location.reload();node.append(button);}node.hidden=false;}
function canvasMode(){S.doc?.querySelectorAll('iframe').forEach(f=>{f.style.pointerEvents=S.editing?'none':'';});}
$('#mEdit').onclick=()=>guard(()=>{S.editing=true;canvasMode();$('#mEdit').setAttribute('aria-pressed','true');$('#mBrowse').setAttribute('aria-pressed','false');});
$('#mBrowse').onclick=()=>guard(()=>{S.editing=false;canvasMode();clearSelection();document.body.classList.remove('sidebar-open');$('#mEdit').setAttribute('aria-pressed','false');$('#mBrowse').setAttribute('aria-pressed','true');});
$('#reviewBtn').onclick=()=>guard(renderReview);
$('#areasToggle').onclick=()=>guard(()=>{if(document.body.classList.contains('sidebar-open'))document.body.classList.remove('sidebar-open');else{clearSelection();document.body.classList.add('sidebar-open');}});
$('#editorLang').onchange=e=>{const next=e.target.value;e.target.value=lang;guard(()=>{persist();try{localStorage.setItem('ms_lang',next);}catch{}location.reload();});};
window.addEventListener('beforeunload',e=>{if(S.submitted)return;persist();if(S.dirty||S.items.size||S.other){e.preventDefault();e.returnValue='';}});
function fromServer(c){
  if(!c.anchor){S.other=c.request||'';S.generalId=c.id;return;}
  let text=c.request||'',note='';const n=text.lastIndexOf(NOTE);if(n>-1){note=text.slice(n+NOTE.length);text=text.slice(0,n);}
  if(text===EMPTY)text='';
  S.items.set(c.anchor,{id:c.id,anchor:c.anchor,kind:c.kind,target:c.target,label:c.target,original:c.original||'',text,note,status:c.status,type:'text'});
}
(async function init(){
  header();sidebarTitle(t.areas,t.choose);
  const demo=qs.get('preview');
  if(demo&&!KEY&&!EDIT){
    const pages={mrspace:['/','Mr. Space'],rufcut:['/rufcut/','Rufcut']},page=pages[demo];
    if(!page)return fatal();S.demo=true;S.siteName=page[1];S.storage='';header();
    frame.addEventListener('load',()=>wire().then(()=>{$('#draftStatus').textContent=t.demoNote;}).catch(()=>fatal(t.err)));frame.src=page[0];return;
  }
  if(!uuid(KEY||EDIT)||!cfg||!schema)return fatal();
  try{
    let d;if(EDIT){d=await rpc('ms_get_submission',{p_edit:EDIT});if(!d)throw new Error('badlink');S.sub=d;(d.items||[]).forEach(fromServer);S.name=d.name||'';S.email=d.email||'';S.siteName=d.site||'';}
    else{d=await rpc('ms_client_view',{p_key:KEY});if(!d)throw new Error('badlink');S.siteName=d.name||d.site||'';}
    if((String(d.site||d.name||'').toLowerCase()==='rufcut'||/\/rufcut(?:\/|$)/.test(new URL(d.url||'/',location.href).pathname))&&!rufcutEnglish){const next=new URL(location.href);next.searchParams.set('site','rufcut');location.replace(next.href);return;}
    S.quota=d.quota;
    // Keep capability URLs out of browser storage keys. Only content drafts are kept on this device, never access keys or contact details.
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(EDIT||KEY));S.storage='ms-request-draft:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
    try{
      const saved=JSON.parse(localStorage.getItem(S.storage)||'null');
      if(saved?.version===1&&Date.now()-saved.at<7*86400000&&Array.isArray(saved.items)&&saved.items.length<=40){
        let recover=true;
        if((saved.serverVersion||0)!==(S.sub?.version||0)){recover=await new Promise(resolve=>{showDialog(t.recovered,`<p>${esc(t.recoverConflict)}</p>`,[{label:t.useServer,run:()=>resolve(false)},{label:t.restoreDraft,primary:true,run:()=>resolve(true)}]);$('#confirm').addEventListener('close',()=>resolve(false),{once:true});});}
        if(recover){
        if((saved.serverVersion||0)===(S.sub?.version||0)){for(const [anchor,it]of S.items)if(it.status==='new'&&!saved.items.some(x=>x.anchor===anchor))S.items.delete(anchor);}
        for(const it of saved.items){if(typeof it.anchor!=='string'||it.anchor.length>400||typeof it.text!=='string'||it.text.length>2000)continue;const current=S.items.get(it.anchor);if(!current||current.status==='new')S.items.set(it.anchor,{...it,status:current?.status||'new',id:current?.id||null});}
        if(typeof saved.other==='string')S.other=saved.other.slice(0,2000);S.pending=saved.pending||null;S.restored=true;
        }else{try{localStorage.removeItem(S.storage);}catch{}}
      }
    }catch{}
    header();
    if(!d.url){renderReview();return;}
    const u=new URL(d.url,location.href);
    if(u.origin!==location.origin&&(u.protocol!=='https:'||!['heronca.com','www.heronca.com','laloo.org','www.laloo.org'].includes(u.hostname)||!['/','/index.html','/about.html'].includes(u.pathname))){renderReview();return;}
    frame.addEventListener('load',()=>wire().catch(()=>fatal(t.err)));frame.src=u.href;
  }catch(error){fatal(error?.message==='badlink'?t.bad:t.err);}
})();
