// RFC 8291 aes128gcm + RFC 8292 VAPID, using Web Crypto only.
const encoder = new TextEncoder();
export const bytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
export const base64url = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const concat = (...values: Uint8Array[]) => {const out=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let i=0;for(const v of values){out.set(v,i);i+=v.length;}return out;};
const hmac = async (key: Uint8Array, value: Uint8Array) => new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']),value));
const expand = (key: Uint8Array, info: Uint8Array) => hmac(key,concat(info,new Uint8Array([1])));
export function pushEndpoint(value: unknown) {
 try{const u=new URL(String(value));const h=u.hostname;return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.href.length<=2048&&
 (h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.services.mozilla.com')||h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com'))?u.href:'';}catch{return '';}
}
export async function vapidKey() {
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return {publicKey:base64url(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),privateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey)};
}
export async function encryptedPush(subscription: {endpoint:string;p256dh:string;auth:string}, payload: unknown, signing: {publicKey:string;privateJwk:JsonWebKey}) {
 const endpoint=pushEndpoint(subscription.endpoint);if(!endpoint)throw new Error('invalid_endpoint');
 const ua=bytes(subscription.p256dh),auth=bytes(subscription.auth);if(ua.length!==65||ua[0]!==4||auth.length!==16)throw new Error('invalid_subscription');
 const ephemeral=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const as=new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey));
 const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},ephemeral.privateKey,256));
 const ikm=await expand(await hmac(auth,shared),concat(encoder.encode('WebPush: info\0'),ua,as));
 const salt=crypto.getRandomValues(new Uint8Array(16)),prk=await hmac(salt,ikm);
 const cek=(await expand(prk,encoder.encode('Content-Encoding: aes128gcm\0'))).slice(0,16);
 const nonce=(await expand(prk,encoder.encode('Content-Encoding: nonce\0'))).slice(0,12);
 const text=encoder.encode(JSON.stringify(payload));if(text.length>3000)throw new Error('payload_too_large');
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']),concat(text,new Uint8Array([2]))));
 const body=concat(salt,new Uint8Array([0,0,16,0,65]),as,cipher);
 const header=base64url(encoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const claims=base64url(encoder.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'mailto:hello@mrspace.online'})));
 const input=header+'.'+claims,privateKey=await crypto.subtle.importKey('jwk',signing.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=base64url(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(input))));
 return {endpoint,body,headers:{'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm',TTL:'86400',Urgency:'normal',Authorization:'vapid t='+input+'.'+signature+', k='+signing.publicKey}};
}
export async function sendPush(subscription: {endpoint:string;p256dh:string;auth:string},payload: unknown,signing: {publicKey:string;privateJwk:JsonWebKey}) {
 const request=await encryptedPush(subscription,payload,signing);
 const response=await fetch(request.endpoint,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(8000)});
 return {ok:response.ok,expired:response.status===404||response.status===410};
}
