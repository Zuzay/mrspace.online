// A preference is a request, never an automatically reserved calendar slot.
const reasons=new Set(['custom_jeans','alterations','repair','other']);
const windows=new Set(['any_time','morning','afternoon']);
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
export function shopToday(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function calendarDate(value:unknown){
 const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false;
 const date=new Date(text+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===text;
}
export function fittingRequest(raw:any,now=new Date()){
 if(!raw||typeof raw!=='object'||!reasons.has(raw.reason)||!windows.has(raw.time_window))return null;
 const preferred_date=clean(raw.preferred_date,10),today=shopToday(now);
 const latest=new Date(today+'T12:00:00Z');latest.setUTCDate(latest.getUTCDate()+365);
 if(!calendarDate(preferred_date)||preferred_date<today||preferred_date>latest.toISOString().slice(0,10))return null;
 return {reason:raw.reason,preferred_date,time_window:raw.time_window,note:clean(raw.note,600),timezone:'America/Los_Angeles'};
}
export const fittingStatuses=['received','confirmed','completed','cancelled'];
export function fittingUpdate(raw:any,previous:any,now=new Date()){
 if(!fittingStatuses.includes(raw.status))return null;
 const confirmed_date=clean(raw.confirmed_date,10),confirmed_time=clean(raw.confirmed_time,5);
 const previousDate=String(previous?.confirmed_date||''),previousTime=String(previous?.confirmed_time||'');
 if(confirmed_date||confirmed_time||raw.status==='confirmed'){
  if(!calendarDate(confirmed_date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(confirmed_time))return null;
  if(raw.status==='confirmed'&&confirmed_date<shopToday(now)&&(confirmed_date!==previousDate||confirmed_time!==previousTime))return null;
 }
 return {...previous,confirmed_date,confirmed_time,timezone:'America/Los_Angeles'};
}
