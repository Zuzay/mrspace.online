/* Mr. Space editor contract v1. No customer-specific behavior. */
(function(host){
  'use strict';
  const own=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k)?o[k]:undefined;
  function localized(value,lang){
    const text=typeof value==='string'?value:own(value,lang)||own(value,'en');
    return typeof text==='string'?text.trim().slice(0,120):'';
  }
  function config(doc){
    try{const raw=doc.getElementById('ms-editor-config')?.textContent;if(!raw||raw.length>50000)return {};const c=JSON.parse(raw);return c?.version===1?c:{};}catch{return {};}
  }
  function unique(doc,selector){
    try{const matches=doc.querySelectorAll(selector);return matches.length===1?matches[0]:null;}catch{return null;}
  }
  function selector(el,doc){
    const escape=doc.defaultView.CSS.escape;
    if(el.hasAttribute('data-ms-field')){
      const key=el.getAttribute('data-ms-field');
      if(!/^[a-zA-Z0-9_.:-]{1,100}$/.test(key))return '';
      const path='[data-ms-field="'+key+'"]';return unique(doc,path)===el?path:'';
    }
    const parts=[];let node=el;
    while(node&&node.nodeType===1&&node!==doc.body){
      if(node.id){const path='#'+escape(node.id);if(unique(doc,path)===node){parts.unshift(path);break;}}
      let n=1,p=node;while((p=p.previousElementSibling))if(p.tagName===node.tagName)n++;
      parts.unshift(node.tagName.toLowerCase()+':nth-of-type('+n+')');node=node.parentElement;
    }
    const path=(parts[0]?.startsWith('#')?'':'body>')+parts.join('>');return unique(doc,path)===el?path:'';
  }
  function page(doc,c,lang,fallback){return localized(c.page,lang)||fallback;}
  function section(el,c,lang,fallback){
    const s=el.closest('[data-ms-section],section,header,footer');
    return localized(own(c.sections,s?.dataset.msSection),lang)||s?.dataset.msSectionLabel||s?.querySelector('h2,h1')?.innerText.trim().replace(/\s+/g,' ').slice(0,60)||fallback;
  }
  function label(el,c,lang,fallback){
    return localized(own(c.fields,el.dataset.msField)||own(c.fields,el.dataset.msLabel),lang)||el.dataset.msFieldLabel||fallback;
  }
  host.MsEditorSchema=Object.freeze({version:1,config,localized,selector,resolve:unique,page,section,label});
})(typeof window!=='undefined'?window:globalThis);
