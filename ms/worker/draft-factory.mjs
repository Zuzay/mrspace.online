// Ücretli API, ağ veya dosya değişikliği yok. Mevcut renderer ile incelenebilir taslak üretir.
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../assets/ms-render.js',import.meta.url),'utf8'),sandbox,{timeout:1000});
const render=sandbox.window.MsRender;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createDraft(job){
  if(!['general','retail','fashion','food','services','community'].includes(job.sector)||typeof job.brief!=='string'||job.brief.length<10||job.brief.length>2000)throw new Error('invalid_brief');
  if(job.kind==='tool'){
    if(!['fashion','retail'].includes(job.sector)||!/(jean|denim|paça|inseam)/i.test(job.brief))throw new Error('human_implementation_required');
    return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Denim aracı / Taslak</title><style>body{font:18px/1.6 sans-serif;max-width:780px;margin:48px auto;padding:24px;background:#f6f5ef;color:#20221d}small{color:#6b655a}a{color:#78510e}pre{white-space:pre-wrap}</style><small>MR. SPACE / TASLAK / İNSAN İNCELEMESİ BEKLİYOR</small><h1>Denim prova notu</h1><p>${escape(job.brief)}</p><p>Çalışan araç mevcut ve istenen boy ile mevcut boy arasındaki farkı hesaplar. Bu taslak yeni bir dikim veya kesim algoritması iddia etmez.</p><a href="https://mrspace.online/tools/denim/" target="_blank" rel="noopener">Aracı aç</a></html>`;
  }
  if(job.kind!=='design')throw new Error('invalid_kind');
  const preset={retail:'commerce',fashion:'atelier',food:'table',services:'atelier',community:'table',general:'commerce'}[job.sector];
  const data=render.starter('Yeni marka','tr');data.business.tagline='İşletmenize özel bir başlangıç';
  data.sections[0].text=job.brief;data.sections[1].text='Bu alan işletmenin gerçek içeriğiyle hazırlanacak. Taslak insan incelemesi bekliyor.';
  const html=render.render(data,{preset},{noindex:true});
  return html.replace(/<body([^>]*)>/i,'<body$1><div style="padding:12px 24px;background:#fff1d0;color:#503611;font:14px sans-serif">MR. SPACE / TASLAK / İnsan incelemesi bekliyor. Örnek içerik canlı müşteri verisi değildir.</div>');
}
