/* Customer change requests: page locations, local drafts and explicit review. */
'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=window.MS_CONFIG,frame=$('#site'),qs=new URLSearchParams(location.search),KEY=qs.get('k'),EDIT=qs.get('e');
const EMPTY='[Remove the text in this area]',NOTE='\n\nNote: ',GENERAL='__general',uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const S={items:new Map(),doc:null,win:null,parts:[],selected:null,view:'areas',editing:true,sub:null,quota:null,siteName:'',other:'',name:'',email:'',dirty:false,busy:false,storage:'',storageOK:true,restored:false,search:'',filter:'all',pending:null,approved:[]};
let noticeTimer;
const textOf=el=>(el.innerText||el.textContent||'').trim();
const isColor=el=>el.hasAttribute('data-ms-color');
const isChoice=el=>el.hasAttribute('data-ms-choice');
const hexColor=value=>{const v=String(value||'').trim();if(/^#[0-9a-f]{6}$/i.test(v))return v.toLowerCase();const rgb=v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);return rgb?'#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'';};
const valueOf=el=>isColor(el)?hexColor(el.style.backgroundColor):isChoice(el)?el.getAttribute('aria-label')||el.dataset.v||textOf(el):isImage(el)?(el.getAttribute('src')||bgURL(el)):textOf(el);
const isImage=el=>el.tagName==='IMG'||(/url\(/i.test(el.style?.backgroundImage||'')&&!textOf(el));
const bgURL=el=>(el.style?.backgroundImage||'').match(/url\(["']?(.*?)["']?\)/)?.[1]||'';
const outline=it=>it.type==='image'?(it.el?.closest('figure,.hero-art')||it.el):it.el;
const schema=window.MsEditorSchema;
const sitePath=()=>S.previewPath||S.win?.location.pathname||'';
const langName={en:'English',tr:'Türkçe',es:'Español',de:'Deutsch',fr:'Français'};
function imageURL(value,base=S.win?.location.href||location.href){
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
  if(isColor(el)||isChoice(el))return [S.win.MSI18N?.t(el.dataset.msColorGroup)||el.dataset.msColorGroup,el.getAttribute('aria-label')||el.dataset.v].filter(Boolean).join(': ');
  const type=isImage(el)?t.photo:/^H\d$/.test(el.tagName)?t.heading:['A','BUTTON'].includes(el.tagName)?t.button:t.text;
  const fallback=isImage(el)?type:type+': '+original.replace(/\s+/g,' ').slice(0,65);
  return schema.label(el,S.schema,lang,fallback);
}
function locationOf(it){return [it.page||it.anchor?.split('::')[0]||t.home,it.section,it.label||it.target].filter(Boolean).join(' › ');}
function crumb(it){return `<div class="crumb"><span>${esc(it.page||t.home)}</span>${it.section?`<span>${esc(it.section)}</span>`:''}<span>${esc(it.label||it.target)}</span></div>`;}
function partOf(el){return S.parts.find(p=>p.el===el);}
function capture(el){
  const original=valueOf(el);return {anchor:sitePath()+'::'+pathOf(el),el,type:isColor(el)?'color':isChoice(el)?'choice':isImage(el)?'image':'text',original,originalURL:isImage(el)?imageURL(original):'',origHTML:el.innerHTML,origStyle:el.getAttribute('style'),origSrcset:el.getAttribute('srcset'),origSizes:el.getAttribute('sizes'),origBg:el.style.backgroundImage,page:schema.page(S.doc,S.schema,lang,t.home),section:sectionOf(el),label:labelOf(el,original)};
}
function colorChanged(it){it.el.dispatchEvent(new S.win.CustomEvent('ms:editor-color-preview',{bubbles:true}));}
function restore(it){
  if(!it.el)return;
  if(it.type==='color'){if(it.origStyle==null)it.el.removeAttribute('style');else it.el.setAttribute('style',it.origStyle);colorChanged(it);}
  else if(it.type==='choice')return;
  else if(it.type==='image'){
    if(it.el.tagName==='IMG'){it.el.src=it.originalURL||it.original;if(it.origSrcset)it.el.setAttribute('srcset',it.origSrcset);else it.el.removeAttribute('srcset');if(it.origSizes)it.el.setAttribute('sizes',it.origSizes);}
    else it.el.style.backgroundImage=it.origBg||'';
  }else if(it.origHTML!=null)it.el.innerHTML=it.origHTML;
}
function preview(it,value){
  if(!it.el)return;
  if(it.type==='color'){const color=hexColor(value);if(!color||color===hexColor(it.original)){restore(it);return;}it.el.style.background=color;colorChanged(it);}
  else if(it.type==='choice')return;
  else if(it.type==='image'){
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
  $('#editorLang').setAttribute('aria-label',t.language);$('#editorLang').innerHTML=editorLangs.map(l=>`<option value="${l}" ${l===lang?'selected':''}>${langName[l]}</option>`).join('');
  $('#contextBar').textContent=S.selected?locationOf(S.selected):t.previewOnly;
}
const CAND='[data-ms-field],[data-ms-edit],h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,button,a,label,td,th,dt,dd,small,img,[style*="background-image"]';
function eligible(el){
  if(el.closest('[data-ms-skip],[data-ms-runtime],[data-lang-host],#themeToggle,.skip-link,[aria-hidden=true],[data-ms-editor-ui]')||el.closest('svg'))return false;
  if(!isImage(el)&&!isColor(el)&&!isChoice(el)&&!textOf(el))return false;
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
async function wire(){
  try{S.win=frame.contentWindow;S.doc=frame.contentDocument;if(!S.doc?.body)throw 0;}catch{S.doc=null;return renderAreas();}
  await S.win.MSI18N?.ready;
  await Promise.race([S.doc.fonts.ready,new Promise(resolve=>setTimeout(resolve,2500))]);
  S.schema=schema.config(S.doc);S.selected=null;S.dirty=false;buildParts();
  const style=S.doc.createElement('style');style.textContent=`.ms-editor-hover{outline:2px dashed #eeb44a!important;outline-offset:5px!important;cursor:pointer!important}.ms-editor-selected{outline:3px solid #f6b93b!important;outline-offset:6px!important}.ms-editor-changed{outline:2px solid #69bb91!important;outline-offset:4px!important}.ms-editor-selected.ms-editor-changed{outline-color:#f6b93b!important}`;S.doc.head.append(style);
  let hovered=null;
  S.doc.addEventListener('pointerover',e=>{if(!S.editing||e.pointerType!=='mouse')return;hovered?.classList.remove('ms-editor-hover');hovered=resolveSelection(e.target)?.el;hovered?.classList.add('ms-editor-hover');});
  S.doc.addEventListener('pointerout',()=>hovered?.classList.remove('ms-editor-hover'));
  S.doc.addEventListener('click',e=>{if(!S.editing)return;e.preventDefault();e.stopImmediatePropagation();const control=e.target.closest('button[role=tab][aria-controls],button[data-ms-editor-nav]');if(control){guard(()=>{interact(control);clearSelection();document.body.classList.remove('sidebar-open');});return;}const p=resolveSelection(e.target);if(p)guard(()=>select(p));},true);
  S.doc.addEventListener('keydown',e=>{if(!S.editing||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tab=e.target.closest('button[role=tab][aria-controls]');if(!tab)return;e.preventDefault();e.stopImmediatePropagation();guard(()=>{const editing=S.editing;S.editing=false;try{tab.dispatchEvent(new S.win.KeyboardEvent('keydown',{key:e.key,bubbles:true,cancelable:true}));}finally{S.editing=editing;}clearSelection();document.body.classList.remove('sidebar-open');});},true);
  S.doc.addEventListener('submit',e=>{if(S.editing)e.preventDefault();},true);
  // Restore each known request by its full page + selector. Never guess another location.
  for(const it of S.items.values()){
    it.el=null;if(it.anchor?.split('::')[0]!==sitePath())continue;
    const el=schema.resolve(S.doc,it.anchor.split('::')[1]);if(!el||!eligible(el))continue;
    const live=capture(el);it.conflict=live.original!==it.original;
    Object.assign(it,{el,type:live.type,origHTML:live.origHTML,origStyle:live.origStyle,origSrcset:live.origSrcset,origSizes:live.origSizes,origBg:live.origBg,originalURL:it.originalURL||imageURL(it.original),page:live.page,section:live.section,label:live.label});
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
// Run only page-declared local controls, bypassing the editor's capture handler.
function interact(control){const editing=S.editing;S.editing=false;try{control.click();}finally{S.editing=editing;}}
function reveal(el){
  if(el.matches('button[role=tab][aria-controls]'))interact(el);
  const panels=[];for(let p=el.closest('[role=tabpanel]');p;p=p.parentElement?.closest('[role=tabpanel]'))panels.unshift(p);
  for(const panel of panels)if(panel.hidden){const tab=S.doc.querySelector('button[role=tab][aria-controls="'+CSS.escape(panel.id)+'"]');if(tab)interact(tab);}
  el.scrollIntoView({block:matchMedia('(max-width:640px)').matches?'start':'center',behavior:'auto'});
  if(matchMedia('(max-width:640px)').matches)S.win.scrollBy(0,-70);
}
function select(part){
  outline(S.selected||{})?.classList.remove('ms-editor-selected');
  const it=S.items.get(part.anchor)||[...S.items.values()].find(it=>it.el===part.el)||{...part,id:null,kind:['color','choice'].includes(part.type)?'big':'small',text:part.type==='image'?'':part.original,note:'',status:'new'};
  S.selected=it;S.dirty=false;S.view='field';S.editing=true;canvasMode();$('#mEdit').setAttribute('aria-pressed','true');$('#mBrowse').setAttribute('aria-pressed','false');
  outline(it)?.classList.add('ms-editor-selected');if(it.el){reveal(it.el);if(it.type==='color')interact(it.el);}document.body.classList.add('sidebar-open');header();renderField();
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
  if(it.type==='color')return `<div class="color-compare">${[['before',it.original],['after',it.text]].map(([key,value])=>`<figure><figcaption>${esc(t[key])}</figcaption><span class="color-sample" style="background:${hexColor(value)||'transparent'}"></span><code>${esc(value)}</code></figure>`).join('')}</div>${it.note?`<p class="help">${esc(t.note)}: ${esc(it.note)}</p>`:''}`;
  const img=it.type==='image',url=img?photoValue(it.text||''):'';
  if(img)return `<div class="image-compare"><figure><figcaption>${esc(t.before)}</figcaption><img src="${esc(it.originalURL||imageURL(it.original))}" alt="${esc(t.before)}"></figure><figure><figcaption>${esc(t.after)}</figcaption><img src="${esc(url||it.originalURL||imageURL(it.original))}" alt="${esc(t.after)}"></figure></div>${!url&&(it.text||it.note)?`<p class="help">${esc(it.text||t.photoNote)}</p>`:''}${it.note?`<p class="help">${esc(t.note)}: ${esc(it.note)}</p>`:''}`;
  return `<dl><dt>${esc(t.before)}</dt><dd>${esc(it.original)}</dd><dt>${esc(t.after)}</dt><dd class="after">${esc(it.text||t.removeText)}</dd>${it.note?`<dt>${esc(t.note)}</dt><dd>${esc(it.note)}</dd>`:''}</dl>`;
}
function renderField(){
  const it=S.selected;if(!it)return renderAreas();const img=it.type==='image',color=it.type==='color',choice=it.type==='choice',saved=S.items.has(it.anchor),locked=it.status!=='new';
  sidebarTitle(it.label||it.target,t.previewOnly);
  $('#sideBody').innerHTML=`<button class="ghost" id="backAreas">← ${esc(t.backAreas)}</button>${crumb(it)}${it.conflict?`<p class="restore-note">${esc(t.currentChanged)}</p>`:''}
  ${locked?`<p class="help">${esc(t.locked)}</p><article class="change-card">${compareHTML(it)}</article>`:
  `${img?`<div id="photoCompare">${compareHTML(it)}</div><label class="file-label">${esc(t.upload)}<input id="photoFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="${esc(t.upload)}"></label><p class="help">${esc(t.uploadHint)}</p><p id="uploadStatus" class="status" role="status"></p>`:color?'':`<label class="field-label">${esc(t.before)}</label><div class="before-value">${esc(it.original)}</div>`}
  ${color?`<div id="colorCompare">${compareHTML(it)}</div><label class="field-label" for="colorPicker">${esc(t.colorPicker)}</label><input type="color" id="colorPicker" value="${hexColor(it.text)||hexColor(it.original)||'#000000'}"><p class="help">${esc(t.colorHint)}</p>`:choice?`<p class="help">${esc(t.choiceHint)}</p>`:''}
  <label class="field-label" for="content">${esc(color?t.colorHex:choice?t.choiceRequest:img?t.imageLink:t.content)}</label><textarea class="content-input" id="content" maxlength="${color?'7':'1800'}" rows="${color?'1':'4'}">${esc(it.text??(img?'':it.original))}</textarea>
  <label class="field-label" for="editNote">${esc(t.note)}</label><textarea id="editNote" class="note-input" maxlength="180" rows="2" placeholder="${esc(t.notePh)}">${esc(it.note||'')}</textarea>
  <label class="check"><input type="checkbox" id="big" ${color||choice?'checked disabled':it.kind==='big'?'checked':''}><span>${esc(color||choice?t.designReview:t.big)}</span></label>
  <p id="fieldStatus" class="status" role="status">${saved?esc(t.saved+' · '+locationOf(it)):''}</p>
  <div class="actions field-actions"><button class="ghost" id="cancelField">${esc(t.cancel)}</button><button class="btn" id="saveField">${esc(t.addDraft)}</button></div>${saved?`<button class="ghost" id="undoField" style="width:100%;margin-top:10px">${esc(t.undo)}</button>`:''}`}`;
  $('#backAreas').onclick=()=>guard(clearSelection);
  if(locked)return;
  if(S.demo&&img){$('#photoFile').disabled=true;$('#uploadStatus').textContent=t.demoNote;}
  $('#content').oninput=editInput;$('#editNote').oninput=editInput;$('#big').onchange=editInput;
  if(color)$('#colorPicker').oninput=e=>{$('#content').value=e.target.value;editInput();};
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
  if(it.type==='color'){const hex=hexColor(text);if(hex)$('#colorPicker').value=hex;$('#colorCompare').innerHTML=compareHTML({...it,text,note});}
  $('#fieldStatus').textContent=S.dirty?t.unsaved:S.items.has(it.anchor)?t.saved+' · '+locationOf(it):'';persist();
}
function commit(){
  if(S.busy||!S.selected)return false;const it=S.selected,text=$('#content').value.trim(),note=$('#editNote').value.trim();
  if(it.type==='color'&&!hexColor(text)){$('#fieldStatus').textContent=t.colorInvalid;return false;}
  if((!S.items.has(it.anchor)&&S.items.size>=40)||text.length+note.length+NOTE.length>2000){$('#fieldStatus').textContent=t.limit;return false;}
  const unchanged=it.type==='image'?!text||text===it.original||photoValue(text)===it.originalURL:text===it.original;
  if(unchanged&&!note){removeChange(it);return true;}
  it.text=it.type==='color'?hexColor(text):text;it.note=note;it.kind=['color','choice'].includes(it.type)?'big':$('#big').checked?'big':'small';
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
    const u=new URL(d.url,location.href);if(u.origin!==location.origin){renderReview();return;}
    frame.addEventListener('load',()=>wire().catch(()=>fatal(t.err)));frame.src=u.href;
  }catch(error){fatal(error?.message==='badlink'?t.bad:t.err);}
})();

/* ---------- Media (slideshow, brand colour match, video) + Claude bridge ----------
   Added 2026-10-15. Everything below only extends the request flow above: media and
   Claude changes become normal change requests that Mr. Space reviews before publishing. */
const MX=(()=>{const tr={addSlides:'Fotoğraf ekle (slayt)',slidesHint:'Birden fazla fotoğraf eklersen bu alan slayt gösterisine dönüşür.',addVideo:'Video ekle',videoHint:'MP4 veya MOV, en fazla 25 MB. Sitede sessiz ve döngülü oynar.',match:'Fotoğrafları sitenin renklerine uydur',slides:'Slayt',video:'Video',remove:'Kaldır',processing:'Hazırlanıyor…',videoBig:'Video 25 MB’den büyük. Daha kısa ya da küçük bir video seç.',claude:'Claude ile düzenle',claudeTitle:'Claude ile düzenle',claudeSteps:['Bu sayfa açıkken Chrome’da Claude’u aç (araç çubuğundaki Claude simgesi).','Aşağıdaki metni Claude’a yapıştır. Panoya kopyalandı.','Ne istediğini Claude’a anlat. Claude değişikliği önizler, sen onaylayınca gönderir.'],copied:'Panoya kopyalandı',copy:'Metni kopyala',claudeNote:'Fotoğraf ve video yüklemeyi dosya seçme penceresi gerektirdiği için sen yaparsın; Claude nereye ekleyeceğini gösterir.'};
const en={addSlides:'Add photos (slideshow)',slidesHint:'Add more than one photo and this area becomes a slideshow.',addVideo:'Add video',videoHint:'MP4 or MOV, up to 25 MB. Plays muted and looping on the site.',match:'Match photos to the site colours',slides:'Slideshow',video:'Video',remove:'Remove',processing:'Preparing…',videoBig:'This video is over 25 MB. Choose a shorter or smaller one.',claude:'Edit with Claude',claudeTitle:'Edit with Claude',claudeSteps:['With this page open, open Claude in Chrome (the Claude icon in the toolbar).','Paste the text below into Claude. It is already copied.','Tell Claude what you want. Claude previews the change and sends it after you approve.'],copied:'Copied',copy:'Copy text',claudeNote:'Photo and video uploads need the file picker, so you do those; Claude shows you where.'};
return (typeof lang!=='undefined'&&lang==='tr')?tr:en;})();
const MEDIA_ROOT=cfg.url+'/storage/v1/object/public/ms-media/';
const mediaOf=it=>it.media||(it.media={slides:[],video:'',match:true});
const _serialize=serialize;serialize=it=>({..._serialize(it),media:it.media&&(it.media.slides.length||it.media.video)?{slides:it.media.slides.slice(0,12),video:it.media.video||'',match:!!it.media.match}:undefined});
const _itemsPayload=itemsPayload;itemsPayload=()=>_itemsPayload().map(x=>{const it=S.items.get(x.anchor);const m=it?.media;if(!m||(!m.slides.length&&!m.video))return x;
  const extra=(m.slides.length?'\nSlideshow ('+m.slides.length+'): '+m.slides.join(' , '):'')+(m.video?'\nVideo: '+m.video:'')+(m.match?'\nColour match: on':'');
  return {...x,kind:'big',request:(x.request+extra).slice(0,2000)};});
function siteColours(){
  const read=v=>{try{return S.win.getComputedStyle(S.doc.documentElement).getPropertyValue(v).trim();}catch{return '';}};
  const rgb=c=>{const m=String(c).match(/^#([0-9a-f]{6})$/i);if(m)return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));const r=String(c).match(/(\d+)\D+(\d+)\D+(\d+)/);return r?[+r[1],+r[2],+r[3]]:null;};
  let a=rgb(read('--ink'))||[17,27,51],b=rgb(read('--paper'))||[243,234,216];const lum=c=>c[0]*.299+c[1]*.587+c[2]*.114;
  if(lum(a)>lum(b))[a,b]=[b,a];return {dark:a,light:b,accent:rgb(read('--cop'))||null};
}
// Colour-grade a photo towards the site palette in the browser (no server cost). Keeps 55% of the original.
async function brandFile(file){
  const bmp=await createImageBitmap(file);const max=2400,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);const g=c.getContext('2d');g.drawImage(bmp,0,0,c.width,c.height);
  const {dark,light,accent}=siteColours(),img=g.getImageData(0,0,c.width,c.height),d=img.data,k=.45;
  for(let i=0;i<d.length;i+=4){const l=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255,s=l*l*(3-2*l),mid=accent?Math.max(0,1-Math.abs(l-.5)*2)*.08:0;
    for(let ch=0;ch<3;ch++){const duo=dark[ch]+(light[ch]-dark[ch])*s;let v=d[i+ch]*(1-k)+duo*k;if(mid)v=v*(1-mid)+accent[ch]*mid;d[i+ch]=v;}}
  g.putImageData(img,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/webp',.9));
  return blob&&blob.size<=5*1024*1024?new File([blob],file.name.replace(/\.\w+$/,'')+'.webp',{type:'image/webp'}):file;
}
async function sendFile(file){
  const form=new FormData();form.append(KEY?'key':'edit',KEY||EDIT);form.append('file',file);
  const r=await fetch(cfg.url+'/functions/v1/ms-builder',{method:'POST',headers:{apikey:cfg.anon},body:form,signal:AbortSignal.timeout(120000)});const data=await r.json().catch(()=>({}));
  if(!r.ok||!String(data.url||'').startsWith(MEDIA_ROOT))throw new Error(data.error||'upload');return data.url;
}
function mediaPanel(it){
  const m=mediaOf(it),box=document.createElement('div');box.className='mx-media';box.setAttribute('data-ms-editor-ui','');
  box.innerHTML=`<label class="check"><input type="checkbox" id="mxMatch" ${m.match?'checked':''}><span>${esc(MX.match)}</span></label>
  <label class="file-label">${esc(MX.addSlides)}<input id="mxSlides" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><p class="help">${esc(MX.slidesHint)}</p>
  <div class="mx-thumbs">${m.slides.map((u,i)=>`<figure><img src="${esc(u)}" alt=""><button type="button" class="ghost" data-mx-del="${i}" aria-label="${esc(MX.remove)}">×</button></figure>`).join('')}</div>
  <label class="file-label">${esc(MX.addVideo)}<input id="mxVideo" type="file" accept="video/mp4,video/quicktime,video/webm"></label><p class="help">${esc(MX.videoHint)}</p>
  ${m.video?`<div class="mx-video"><video src="${esc(m.video)}" muted loop autoplay playsinline></video><button type="button" class="ghost" id="mxVideoDel">${esc(MX.remove)}</button></div>`:''}<p id="mxStatus" class="status" role="status"></p>`;
  return box;
}
function mediaChanged(it){S.dirty=true;persist();$('#fieldStatus')&&($('#fieldStatus').textContent=t.unsaved);
  // First slide previews in the page; the slideshow itself appears after publishing.
  const first=mediaOf(it).slides[0];if(first&&!photoValue($('#content').value)){$('#content').value=first;editInput();S.dirty=true;}}
function bindMedia(it){
  const box=$('#sideBody .mx-media');if(!box)return;const m=mediaOf(it),status=$('#mxStatus');
  $('#mxMatch').onchange=e=>{m.match=e.target.checked;mediaChanged(it);};
  box.querySelectorAll('[data-mx-del]').forEach(b=>b.onclick=()=>{m.slides.splice(+b.dataset.mxDel,1);mediaChanged(it);renderField();});
  $('#mxVideoDel')&&($('#mxVideoDel').onclick=()=>{m.video='';mediaChanged(it);renderField();});
  $('#mxSlides').onchange=async e=>{const files=[...e.target.files].slice(0,12-m.slides.length);if(!files.length||S.busy)return;S.busy=true;status.textContent=MX.processing;
    try{for(const f of files){const ready=m.match?await brandFile(f):f;if(ready.size>5*1024*1024)throw new Error('size');m.slides.push(await sendFile(ready));status.textContent=MX.processing+' '+m.slides.length;}
      mediaChanged(it);}catch{status.textContent=t.uploadError;}finally{S.busy=false;renderField();}};
  $('#mxVideo').onchange=async e=>{const f=e.target.files?.[0];if(!f||S.busy)return;if(f.size>25*1024*1024){status.textContent=MX.videoBig;return;}
    S.busy=true;status.textContent=MX.processing;try{m.video=await sendFile(f);mediaChanged(it);}catch{status.textContent=t.uploadError;}finally{S.busy=false;renderField();}};
  const photo=$('#photoFile');if(photo)photo.onchange=async e=>{const f=e.target.files?.[0];if(!f||!m.match)return uploadPhoto(e);
    try{const ready=await brandFile(f);const dt=new DataTransfer();dt.items.add(ready);Object.defineProperty(e,'target',{value:{files:dt.files,set value(v){photo.value=v;},get disabled(){return photo.disabled;},set disabled(v){photo.disabled=v;}}});}catch{}
    return uploadPhoto(e);};
}
const _renderField=renderField;renderField=function(){_renderField();const it=S.selected;
  if(it&&it.type==='image'&&it.status==='new'&&!S.demo){const anchor=$('#sideBody .field-label[for=content]');if(anchor){anchor.before(mediaPanel(it));bindMedia(it);}}};

// ---------- Claude bridge: a stable, documented API for Claude in Chrome ----------
const claudeGuide=`You are helping the owner of this website request changes in the Mr. Space editor.
Rules: ask ONE question at a time in the owner's language; never publish anything yourself; every change goes to Mr. Space for review.
Use window.MsEditorAPI (run JavaScript in this page):
- MsEditorAPI.parts('search words') -> editable areas on the current page [{id,section,label,type,current}]
- MsEditorAPI.pages() -> other pages you can open; MsEditorAPI.open(path)
- MsEditorAPI.propose(id, newValue, {note}) -> shows the change in the preview. For type "image", newValue must be an https image link; for photos/videos from the owner's computer, call MsEditorAPI.select(id) and ask the owner to use the "Add photos (slideshow)" / "Add video" buttons in the left panel.
- Show the owner the preview, ask "Keep this change?". If yes: MsEditorAPI.keep(). If no: MsEditorAPI.discard().
- Requests the editor cannot do (new pages, new features, layout or design changes): ask which section, what exactly, and any example link, then MsEditorAPI.note('Section: ... / Request: ... / Example: ...').
- When the owner is done: MsEditorAPI.changes() and read the list back, then MsEditorAPI.contact(name, email) (ask for them) and MsEditorAPI.send(). A confirmation dialog opens; click its Send button only after the owner says yes.`;
window.MsEditorAPI=Object.freeze({
  guide:()=>claudeGuide,
  parts:(q='')=>{const words=String(q).toLowerCase().split(/\s+/).filter(Boolean);return S.parts.map(p=>({id:p.anchor,page:p.page,section:p.section,label:p.label,type:p.type,current:String(p.original||'').replace(/\s+/g,' ').slice(0,160),changed:S.items.has(p.anchor)})).filter(p=>words.every(w=>(p.section+' '+p.label+' '+p.current).toLowerCase().includes(w))).slice(0,80);},
  pages:()=>{try{return [...new Set([...S.doc.querySelectorAll('a[href]')].map(a=>{try{const u=new URL(a.getAttribute('href'),S.win.location.href);return u.origin===location.origin?u.pathname:'';}catch{return '';}}).filter(Boolean))];}catch{return [];}},
  open:path=>{if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))return false;guard(()=>{frame.src=path;});return true;},
  select:id=>{const p=S.parts.find(p=>p.anchor===id);if(!p)return null;guard(()=>select(p));return locationOf(S.selected||p);},
  propose:(id,value,opts={})=>{const p=S.parts.find(p=>p.anchor===id);if(!p)return {ok:false,error:'unknown_area'};
    if(S.selected?.anchor!==id){if(S.dirty)return {ok:false,error:'unsaved_change_open',hint:'call keep() or discard() first'};select(p);}
    $('#content').value=String(value??'');if(opts.note!=null)$('#editNote').value=String(opts.note).slice(0,180);if(opts.big!=null&&!$('#big').disabled)$('#big').checked=!!opts.big;editInput();
    return {ok:true,location:locationOf(S.selected),type:S.selected.type,preview:'visible in the page'};},
  keep:()=>({ok:commit()}),
  discard:()=>{const it=S.selected;if(!it)return {ok:true};S.dirty=false;preview(it,S.items.has(it.anchor)?it.text:it.original);persist();clearSelection();return {ok:true};},
  note:text=>{const v=String(text||'').trim();if(!v)return {ok:false};S.other=(S.other?S.other+'\n\n':'')+v.slice(0,1800);S.other=S.other.slice(0,2000);persist();return {ok:true};},
  changes:()=>({changes:[...S.items.values()].map(it=>({location:locationOf(it),before:String(it.original||'').slice(0,160),after:String(it.text||'').slice(0,300),note:it.note||'',media:it.media||null})),note:S.other}),
  contact:(name,email)=>{S.name=String(name||'').slice(0,80);S.email=String(email||'').slice(0,160);persist();return {ok:/^\S+@\S+\.\S+$/.test(S.email)};},
  review:()=>{guard(renderReview);return true;},
  send:()=>{guard(()=>{renderReview();confirmSend();});return {ok:true,next:'A confirmation dialog is open. Click its Send button only after the owner says yes.'};}
});
(function claudeButton(){
  const bar=$('.toolbar-actions');if(!bar)return;const b=document.createElement('button');b.className='ghost';b.id='claudeBtn';b.textContent='✳ '+MX.claude;bar.prepend(b);
  const prompt=`I'm editing my website in the Mr. Space editor (this page). Read the guide first by running this JavaScript in the page: MsEditorAPI.guide() — then follow it. Ask me one question at a time.`;
  b.onclick=async()=>{let copied=false;try{await navigator.clipboard.writeText(prompt);copied=true;}catch{}
    showDialog(MX.claudeTitle,`<ol class="mx-steps">${MX.claudeSteps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><textarea class="note-input" readonly rows="4">${esc(prompt)}</textarea><p class="help">${esc(copied?MX.copied:'')}</p><p class="help">${esc(MX.claudeNote)}</p>`,[{label:MX.copy,primary:true,run:async()=>{try{await navigator.clipboard.writeText(prompt);notify(MX.copied);}catch{}}}]);};
  const guideEl=document.createElement('script');guideEl.type='text/plain';guideEl.id='ms-claude-guide';guideEl.textContent=claudeGuide;document.body.append(guideEl);
})();
