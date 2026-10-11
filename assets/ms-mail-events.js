// Giriş maili yalnızca sunucunun doğruladığı yeni oturumda kuyruğa girer.
// Bildirim arızası giriş yapmayı engellemez. Reload ve token yenilemede çağrılmaz.
(function(){'use strict';window.MsMailEvents={login(session){
 if(!session?.access_token)return;
 fetch(MS_CONFIG.url+'/rest/v1/rpc/ms_mail_login',{method:'POST',headers:{apikey:MS_CONFIG.anon,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)}).catch(()=>{});
}};})();
