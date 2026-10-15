/* Shared, local photo preparation. No image is uploaded by this module. */
(function(){
 'use strict';
 const copy={
  title:['Prepare your photo','Fotoğrafını düzenle','Prepara tu foto','Foto bearbeiten','Préparer votre photo'],
  hint:['Crop, rotate and adjust the photo before uploading. The website’s photo styling stays in place.','Yüklemeden önce fotoğrafı kırp, döndür ve ayarla. Sitenin fotoğraf stili korunur.','Recorta, gira y ajusta la foto antes de subirla. Se conserva el estilo del sitio.','Foto vor dem Hochladen zuschneiden, drehen und anpassen. Der Fotostil der Website bleibt erhalten.','Recadrez, tournez et ajustez avant l’envoi. Le style photo du site est conservé.'],
  ratio:['Crop shape','Kırpma biçimi','Formato','Zuschnitt','Format'],original:['Original','Özgün','Original','Original','Original'],area:['Match this area','Bu alana uydur','Ajustar a esta zona','An diesen Bereich anpassen','Adapter à cette zone'],square:['Square','Kare','Cuadrado','Quadrat','Carré'],portrait:['Portrait 4:5','Dikey 4:5','Vertical 4:5','Hochformat 4:5','Portrait 4:5'],landscape:['Landscape 16:9','Yatay 16:9','Horizontal 16:9','Querformat 16:9','Paysage 16:9'],
  zoom:['Zoom','Yakınlaştırma','Zoom','Zoom','Zoom'],horizontal:['Left / right','Sol / sağ','Izquierda / derecha','Links / rechts','Gauche / droite'],vertical:['Up / down','Yukarı / aşağı','Arriba / abajo','Oben / unten','Haut / bas'],brightness:['Brightness','Parlaklık','Brillo','Helligkeit','Luminosité'],contrast:['Contrast','Kontrast','Contraste','Kontrast','Contraste'],rotate:['Rotate 90°','90° döndür','Girar 90°','90° drehen','Tourner de 90°'],reset:['Reset adjustments','Ayarları sıfırla','Restablecer ajustes','Anpassungen zurücksetzen','Réinitialiser'],cancel:['Cancel','Vazgeç','Cancelar','Abbrechen','Annuler'],use:['Use this photo','Bu fotoğrafı kullan','Usar esta foto','Dieses Foto verwenden','Utiliser cette photo'],error:['This photo could not be opened. Choose a JPG, PNG, WebP or GIF under 5 MB.','Fotoğraf açılamadı. 5 MB altında JPG, PNG, WebP veya GIF seç.','No se pudo abrir. Elige JPG, PNG, WebP o GIF de menos de 5 MB.','Foto konnte nicht geöffnet werden. JPG, PNG, WebP oder GIF unter 5 MB wählen.','Impossible d’ouvrir cette photo. Choisissez JPG, PNG, WebP ou GIF de moins de 5 Mo.'],still:['Editing a GIF saves one still image.','GIF düzenlemek tek bir durağan görsel kaydeder.','Editar un GIF guarda una sola imagen fija.','Ein bearbeitetes GIF wird als Einzelbild gespeichert.','Modifier un GIF enregistre une seule image fixe.']
 };
 const langs=['en','tr','es','de','fr'],esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let busy=false;
 async function open(file,{lang=document.documentElement.lang,ratio=1}={}){
  if(busy)return null;busy=true;
  const index=Math.max(0,langs.indexOf(lang)),t=k=>copy[k][index];let bitmap,dialog,url;
  try{
   if(!file||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||!file.size||file.size>5*1024*1024)throw Error('photo');
   url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();
   if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>48000000)throw Error('photo');bitmap=img;
   dialog=document.createElement('dialog');dialog.className='ms-photo-studio';dialog.setAttribute('aria-labelledby','msPhotoTitle');
   const ranges=[['zoom',1,3,.01,1],['horizontal',-100,100,1,0],['vertical',-100,100,1,0],['brightness',60,140,1,100],['contrast',60,140,1,100]];
   dialog.innerHTML=`<header><div><h2 id="msPhotoTitle">${esc(t('title'))}</h2><p>${esc(t('hint'))}</p></div><button type="button" data-photo-cancel aria-label="${esc(t('cancel'))}">×</button></header><div class="ms-photo-work"><div class="ms-photo-canvas"><canvas aria-label="${esc(t('title'))}"></canvas></div><div class="ms-photo-controls"><label>${esc(t('ratio'))}<select data-photo-ratio>${['area','original','square','portrait','landscape'].map(k=>`<option value="${k}">${esc(t(k))}</option>`).join('')}</select></label>${ranges.map(([key,min,max,step,value])=>`<label>${esc(t(key))}<input type="range" data-photo-range="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`).join('')}<div class="ms-photo-tools"><button type="button" data-photo-rotate>${esc(t('rotate'))}</button><button type="button" data-photo-reset>${esc(t('reset'))}</button></div>${file.type==='image/gif'?`<p>${esc(t('still'))}</p>`:''}</div></div><p data-photo-error role="status"></p><footer><button type="button" data-photo-cancel>${esc(t('cancel'))}</button><button type="button" data-photo-use>${esc(t('use'))}</button></footer>`;
   document.body.append(dialog);const preview=dialog.querySelector('canvas');let turn=0;
   const range=key=>Number(dialog.querySelector(`[data-photo-range=${key}]`).value);
   function draw(canvas,max){
    const swapped=turn%2,iw=swapped?bitmap.naturalHeight:bitmap.naturalWidth,ih=swapped?bitmap.naturalWidth:bitmap.naturalHeight;
    const shape=dialog.querySelector('[data-photo-ratio]').value,r=({area:Math.max(.25,Math.min(4,ratio)),original:iw/ih,square:1,portrait:.8,landscape:16/9})[shape];
    canvas.width=Math.round(r>=1?max:max*r);canvas.height=Math.round(r>=1?max/r:max);
    const context=canvas.getContext('2d'),scale=Math.max(canvas.width/iw,canvas.height/ih)*range('zoom'),dw=iw*scale,dh=ih*scale;
    const x=(canvas.width-dw)/2-range('horizontal')/200*(dw-canvas.width),y=(canvas.height-dh)/2-range('vertical')/200*(dh-canvas.height);
    context.clearRect(0,0,canvas.width,canvas.height);context.filter=`brightness(${range('brightness')}%) contrast(${range('contrast')}%)`;
    context.save();context.translate(x+dw/2,y+dh/2);context.rotate(turn*Math.PI/2);context.drawImage(bitmap,-bitmap.naturalWidth*scale/2,-bitmap.naturalHeight*scale/2,bitmap.naturalWidth*scale,bitmap.naturalHeight*scale);context.restore();
   }
   const repaint=()=>draw(preview,800);dialog.querySelectorAll('input,select').forEach(el=>el.oninput=repaint);
   dialog.querySelector('[data-photo-rotate]').onclick=()=>{turn=(turn+1)%4;repaint();};
   dialog.querySelector('[data-photo-reset]').onclick=()=>{turn=0;ranges.forEach(([key,,,,value])=>dialog.querySelector(`[data-photo-range=${key}]`).value=value);dialog.querySelector('[data-photo-ratio]').value='area';repaint();};
   repaint();dialog.showModal();
   return await new Promise(resolve=>{
    let done=false;const finish=value=>{if(done)return;done=true;dialog.close();resolve(value);};dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.onclose=()=>finish(null);dialog.querySelectorAll('[data-photo-cancel]').forEach(b=>b.onclick=()=>finish(null));
    dialog.querySelector('[data-photo-use]').onclick=async e=>{e.target.disabled=true;try{const canvas=document.createElement('canvas');draw(canvas,1600);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob||blob.size>5*1024*1024)throw Error('export');finish(new File([blob],file.name.replace(/\.[^.]+$/,'')+'-edited.webp',{type:'image/webp'}));}catch{dialog.querySelector('[data-photo-error]').textContent=t('error');e.target.disabled=false;}};
   });
  }catch{throw Error(t('error'));}
  finally{dialog?.remove();if(url)URL.revokeObjectURL(url);busy=false;}
 }
 window.MsPhotoStudio={open};
})();
