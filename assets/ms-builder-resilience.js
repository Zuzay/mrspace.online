(() => {
  'use strict';
  const languages=['en','tr','es','de','fr'];
  const copy={
    recover:['An unsent draft is saved on this device. The server may have changed; review the current page before restoring it.','Bu cihazda gönderilmemiş bir taslak var. Sunucudaki içerik değişmiş olabilir; geri yüklemeden önce mevcut sayfayı incele.','Hay un borrador sin enviar en este dispositivo. El servidor puede haber cambiado; revisa la página antes de restaurarlo.','Auf diesem Gerät liegt ein ungesendeter Entwurf. Der Serverstand könnte geändert sein; prüfe die Seite vor dem Wiederherstellen.','Un brouillon non envoyé est enregistré sur cet appareil. Le serveur peut avoir changé ; vérifiez la page avant de le restaurer.'],
    restore:['Restore my draft','Taslağımı geri yükle','Restaurar mi borrador','Meinen Entwurf wiederherstellen','Restaurer mon brouillon'],
    discard:['Keep the server version','Sunucudaki sürümü kullan','Usar la versión del servidor','Serverversion behalten','Garder la version du serveur'],
    local:['Changes are saved on this device for 7 days, but have not reached the server. Keep this link to recover them on this browser.','Değişiklikler bu cihazda 7 gün saklanır, henüz sunucuya ulaşmadı. Bu tarayıcıda geri açmak için bağlantını koru.','Los cambios se conservan en este dispositivo durante 7 días, pero no han llegado al servidor. Conserva este enlace para recuperarlos en este navegador.','Änderungen bleiben 7 Tage auf diesem Gerät, sind aber noch nicht auf dem Server. Bewahre den Link zum Wiederherstellen in diesem Browser auf.','Les modifications restent 7 jours sur cet appareil, mais pas encore sur le serveur. Gardez ce lien pour les retrouver dans ce navigateur.'],
    offline:['Connection lost. Server saves and submissions are paused.','Bağlantı kesildi. Sunucuya kayıt ve gönderim duraklatıldı.','Sin conexión. El guardado y el envío al servidor están en pausa.','Verbindung unterbrochen. Speichern und Senden zum Server pausieren.','Connexion interrompue. L’enregistrement et l’envoi au serveur sont suspendus.'],
    storage:['Device storage is unavailable or full. Keep this page open until the server confirms your changes.','Cihaz depolaması kullanılamıyor veya dolu. Sunucu kaydı doğrulanana kadar bu sayfayı açık tut.','El almacenamiento no está disponible o está lleno. Mantén esta página abierta hasta confirmar el guardado en el servidor.','Gerätespeicher ist nicht verfügbar oder voll. Lass die Seite offen, bis der Server das Speichern bestätigt.','Le stockage est indisponible ou plein. Gardez cette page ouverte jusqu’à confirmation de l’enregistrement par le serveur.'],
    retry:['Retry server save','Sunucuya kaydı yeniden dene','Reintentar guardar','Speichern erneut versuchen','Réessayer l’enregistrement'],
    reload:['Reconnect and load','Bağlanıp yeniden yükle','Reconectar y cargar','Verbinden und neu laden','Reconnecter et charger'],
    recheck:['Connection returned. Reload to check the server before sending device changes.','Bağlantı geri geldi. Cihazdaki değişiklikleri göndermeden önce sunucuyu kontrol etmek için yeniden yükle.','La conexión volvió. Recarga para comprobar el servidor antes de enviar tus cambios.','Verbindung wieder da. Lade die Seite neu, um vor dem Senden den Serverstand zu prüfen.','Connexion rétablie. Rechargez pour vérifier le serveur avant d’envoyer vos modifications.'],
    loadError:['The workspace could not be loaded. Reconnect to check the current server version. Device drafts are kept.','Çalışma alanı yüklenemedi. Güncel sunucu sürümünü kontrol etmek için yeniden bağlan. Cihaz taslakları korunuyor.','No se pudo cargar el espacio. Reconecta para comprobar la versión actual. Los borradores se conservan.','Arbeitsbereich konnte nicht geladen werden. Verbinde dich erneut für den aktuellen Stand. Geräteentwürfe bleiben erhalten.','Impossible de charger l’espace. Reconnectez-vous pour vérifier la version actuelle. Les brouillons sont conservés.'],
    locked:['A device draft is kept, but the server has closed editing or created a different version. You can download the draft for review.','Cihaz taslağın korunuyor, ancak sunucu düzenlemeyi kapattı veya farklı bir sürüm oluşturdu. İncelemek için taslağı indirebilirsin.','Se conserva el borrador, pero el servidor ha cerrado la edición o creado otra versión. Puedes descargarlo para revisarlo.','Dein Geräteentwurf bleibt erhalten, aber die Bearbeitung ist gesperrt oder eine andere Version liegt vor. Lade den Entwurf zur Prüfung herunter.','Le brouillon est conservé, mais le serveur a fermé l’édition ou créé une autre version. Téléchargez-le pour l’examiner.'],
    download:['Download device draft','Cihaz taslağını indir','Descargar borrador','Geräteentwurf herunterladen','Télécharger le brouillon'],
    savedHere:['Saved on this device','Bu cihazda saklandı','Guardado en este dispositivo','Auf diesem Gerät gespeichert','Enregistré sur cet appareil']
  };
  function create(options){
    const {state,params,language,redraw,schedule,save}=options;
    const li=Math.max(0,languages.indexOf(language)),t=k=>copy[k][li];
    const banner=document.createElement('aside');banner.className='ms-resilience';banner.hidden=true;banner.setAttribute('aria-live','polite');
    document.getElementById('root').before(banner);
    let store=null,pending=null,journalRevision=null,storageWarning=false,failed=false,loaded=false,loadError=false,recheck=false;
    const privateMode=()=>params.has('b') || params.has('ta') || state.admin;
    const sameVersion=row=>String(row?.buildId)===String(state.build?.id);
    const valid=row=>row && row.content && typeof row.content==='object' && !Array.isArray(row.content) && row.theme && typeof row.theme==='object' && !Array.isArray(row.theme);
    const canonical=value=>JSON.stringify(value,(_,row)=>row && typeof row==='object' && !Array.isArray(row)?Object.keys(row).sort().reduce((result,key)=>{result[key]=row[key];return result;},Object.create(null)):row);
    function button(label,callback){const node=document.createElement('button');node.type='button';node.textContent=label;node.onclick=callback;return node;}
    function render(){
      banner.replaceChildren();const messages=[];
      if(pending && loaded)messages.push(t(options.editable() && sameVersion(pending.value)?'recover':'locked'));
      if(loadError)messages.push(t('loadError'));
      if(!state.local && !navigator.onLine)messages.push(t('offline'));
      else if(recheck)messages.push(t('recheck'));
      if(failed && journalRevision && !storageWarning)messages.push(t('local'));
      if(storageWarning)messages.push(t('storage'));
      banner.hidden=!messages.length;
      messages.forEach(text=>{const line=document.createElement('p');line.textContent=text;banner.append(line);});
      const root=document.getElementById('root'),paused=Boolean(pending && loaded && options.editable());
      // Keep preview navigation available while preventing edits until the user chooses a version.
      root.querySelectorAll('input,textarea,select,button').forEach(node=>{
        if(node.matches('[data-act="guide"],[data-act="view"],[data-act="device"],#copyLink'))return;
        if(paused){if(!node.disabled)node.dataset.draftPaused='1';node.disabled=true;}
        else if(node.dataset.draftPaused){node.disabled=false;delete node.dataset.draftPaused;}
      });
      const actions=document.createElement('div');actions.className='ms-draft-actions';
      if(pending && loaded){
        if(options.editable() && sameVersion(pending.value))actions.append(button(t('restore'),()=>{
          state.data={content:structuredClone(pending.value.content),theme:structuredClone(pending.value.theme)};
          pending=null;schedule();redraw();render();
        }));
        actions.append(button(t('discard'),()=>{
          if(!store.clear(pending.revision)){storageWarning=true;const current=store.read();if(current.ok)pending=current.value?current:null;render();return;}
          pending=null;redraw();render();
        }));
        actions.append(button(t('download'),()=>{
          const blob=new Blob([JSON.stringify({content:pending.value.content,theme:pending.value.theme},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='mrspace-device-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }));
      }else if(loadError || recheck){actions.append(button(t('reload'),()=>{if(options.dirty())persist();location.reload();}));}
      else if(failed && loaded && options.editable()){const retry=button(t('retry'),async()=>{retry.disabled=true;await save();render();});retry.disabled=!navigator.onLine;actions.append(retry);}
      if(actions.childElementCount)banner.append(actions);
    }
    async function init(){
      if(store || privateMode() || state.local)return;
      const token=params.get('t') || params.get('k');if(!token)return;
      try{store=await MsDrafts.open(params.has('t')?'trial-builder':'site-builder',token);}catch(_){storageWarning=true;render();}
    }
    function persist(){
      if(!store || pending || !loaded || !options.editable())return null;
      const result=store.write({buildId:state.build.id,content:state.data.content,theme:state.data.theme});
      storageWarning=!result.ok;if(result.ok)journalRevision=result.revision;
      render();return result.ok?result.revision:null;
    }
    function serverLoaded(){
      loaded=true;loadError=false;failed=false;journalRevision=null;recheck=false;pending=null;
      if(store){
        const record=store.read();storageWarning=!record.ok;
        if(record.value && valid(record.value)){
          if(sameVersion(record.value) && canonical(record.value.content)===canonical(state.data.content) && canonical(record.value.theme)===canonical(state.data.theme))store.clear(record.revision);
          else pending=record;
        }else if(record.value)storageWarning=true;
      }
      render();
    }
    function fail(){failed=true;render();return journalRevision && !storageWarning?t('savedHere'):null;}
    function acknowledge(revision){if(store && revision)store.clear(revision);const row=store?.read();journalRevision=row?.value?row.revision:null;failed=Boolean(journalRevision);render();}
    MsConnectivity.subscribe(online=>{if(!online && loaded && !state.local)recheck=true;render();});
    addEventListener('pagehide',()=>{if(failed || options.dirty())persist();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden && options.dirty())persist();});
    return {init,persist,serverLoaded,render,fail,acknowledge,canSave:()=>loaded && (state.local || !pending && !recheck && navigator.onLine),loadFailed:()=>{loaded=false;loadError=true;render();}};
  }
  window.MsBuilderResilience=Object.freeze({create});
})();
