import assert from 'node:assert/strict';
import {calendarDate,fittingRequest,fittingUpdate,shopToday} from '../supabase/functions/_shared/fitting.ts';
const now=new Date('2026-10-10T02:00:00Z');
assert.equal(shopToday(now),'2026-10-09');assert.equal(calendarDate('2026-02-30'),false);assert.equal(calendarDate('2028-02-29'),true);
const request={reason:'custom_jeans',preferred_date:'2026-10-09',time_window:'afternoon',note:'Fitting'};
assert.equal(fittingRequest(request,now).timezone,'America/Los_Angeles');assert.equal(fittingRequest({...request,preferred_date:'2026-10-08'},now),null);assert.equal(fittingRequest({...request,preferred_date:'2027-10-10'},now),null);assert.equal(fittingRequest({...request,reason:'<script>'},now),null);assert.equal(fittingRequest({...request,time_window:'03:00'},now),null);
assert.equal(fittingUpdate({status:'confirmed',confirmed_date:'2026-10-12',confirmed_time:'14:30'},request,now).confirmed_time,'14:30');assert.equal(fittingUpdate({status:'confirmed',confirmed_date:'2026-10-12',confirmed_time:'24:30'},request,now),null);assert.equal(fittingUpdate({status:'confirmed'},request,now),null);assert.equal(fittingUpdate({status:'ready'},request,now),null);
const past={...request,confirmed_date:'2026-10-01',confirmed_time:'14:30'};assert.ok(fittingUpdate({status:'confirmed',confirmed_date:'2026-10-01',confirmed_time:'14:30'},past,now));assert.equal(fittingUpdate({status:'confirmed',confirmed_date:'2026-10-01',confirmed_time:'14:31'},past,now),null);
console.log('Fitting date, shop timezone, confirmation and invalid-input checks passed');
