/* Connectivity is a hint. A server receipt, never navigator.onLine, confirms a save. */
(() => {
  'use strict';
  const listeners=new Set();
  function update(){listeners.forEach(listener=>listener(navigator.onLine));}
  addEventListener('online',update);addEventListener('offline',update);
  window.MsConnectivity=Object.freeze({
    subscribe(listener){listeners.add(listener);listener(navigator.onLine);return ()=>listeners.delete(listener);},
    async fetchWithTimeout(input,options={}){
      const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);
      if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
      try{return await fetch(input,{...options,signal:controller.signal});}
      finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
    }
  });
})();
