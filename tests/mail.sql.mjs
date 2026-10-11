import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.MS_PGLITE_MODULE));
const db=new PGlite(),q=async(sql,p=[]) => (await db.query(sql,p)).rows;
await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema vault;grant usage on schema public,auth to anon,authenticated,service_role;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now());
create table public.ms_admins(email text primary key);
create function ms_is_admin() returns boolean language sql stable as $$select auth.jwt()->>'email'='owner@example.test'$$;
create function ms_role() returns text language sql stable as $$select case when ms_is_admin() then 'admin' when auth.jwt()->>'email'='viewer@example.test' then 'viewer' else null end$$;
create table ms_sites(slug text primary key,name text,contact text);
create table ms_site_users(email text,site text references ms_sites,created_at timestamptz default now(),primary key(email,site));
create table ms_submissions(id bigserial primary key,site text references ms_sites,edit_key uuid default gen_random_uuid(),email text,version int default 1);
create table ms_changes(submission_id bigint,status text);
create table ms_viewers(email text,until date);
create table ms_notification_preferences(site text,owner_email text,delivery_email text,email_enabled boolean,lang text);
create table ms_settings(key text primary key,value text);
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table ms_repair_jobs(id uuid primary key default gen_random_uuid(),site text,ticket text,kind text default 'repair',customer_email text,customer_name text,customer_phone text,items jsonb default '[]',design jsonb default '{}',status text default 'received',updated_at timestamptz default now());
insert into ms_sites values('rufcut','Rufcut',null),('heron','Heron CA','owner@example.test'),('laloo','Laloo',null);
insert into ms_site_users(email,site) values('old@example.test','rufcut');
insert into ms_admins values('owner@example.test');
insert into auth.users values('11111111-1111-4111-8111-111111111111','owner@example.test',now()),('22222222-2222-4222-8222-222222222222','client@example.test',now());
insert into auth.sessions(id,user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
`);
const sql=fs.readFileSync(new URL('../ms/mrspace-mail.sql',import.meta.url),'utf8'),control=fs.readFileSync(new URL('../ms/mrspace-control-access.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql);await db.exec(control);await db.exec(control);
let count=0;const test=async(label,fn)=>{await fn();count++;console.log('PASS '+label);};
const as=async(role,email='owner@example.test',sub='11111111-1111-4111-8111-111111111111',session_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({email,sub,session_id})]);await db.exec('set role '+role);};
const enqueue=async(event,to='client@example.test',payload={name:'Rufcut'})=>(await q("select ms_mail_enqueue($1,'rufcut','welcome',$2,'en',$3) as id",[event,to,payload]))[0].id;
await test('repeatable setup sends nothing to old records and all new tables have RLS',async()=>{
 assert.equal((await q('select count(*)::int as n from ms_mail_outbox'))[0].n,0);
 assert.equal((await q("select count(*)::int as n from pg_class where relname in ('ms_mail_outbox','ms_mail_settings','ms_mail_events','ms_mail_inbox') and relrowsecurity"))[0].n,4);
});
await test('anonymous, clients and viewers cannot read contacts, secrets or dispatch queue',async()=>{
 for(const [role,email] of [['anon',''],['authenticated','client@example.test'],['authenticated','viewer@example.test']]){
  await as(role,email);await assert.rejects(()=>q('select * from ms_mail_outbox'),/permission denied/);
  await assert.rejects(()=>q('select ms_mail_secrets()'),/permission denied/);await assert.rejects(()=>q('select ms_mail_claim()'),/permission denied/);
  await assert.rejects(()=>q('select ms_mail_status()'),/not_admin|permission denied/);
  await assert.rejects(()=>q("select ms_mail_inbox_read('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')"),/not_admin|permission denied/);
 }await as('postgres');
});
await test('disabled sending keeps durable queue; enabling needs verified domain',async()=>{
 await enqueue('disabled');assert.equal((await q('select * from ms_mail_claim()')).length,0);
 await as('authenticated');await assert.rejects(()=>q('select ms_mail_toggle(true)'),/domain_not_verified/);
 await as('postgres');await q('update ms_mail_settings set domain_verified_at=now(),enabled=true');
});
await test('idempotent event insert rejects a changed recipient or payload',async()=>{
 const id=await enqueue('dedup');assert.equal(await enqueue('dedup'),id);
 await assert.rejects(()=>enqueue('dedup','other@example.test'),/event_conflict/);
 await assert.rejects(()=>enqueue('dedup','client@example.test',{name:'changed'}),/event_conflict/);
});
await test('leased delivery freezes its exact body and stale worker cannot acknowledge it',async()=>{
 const a=(await q('select * from ms_mail_claim()'))[0],b=(await q('select * from ms_mail_claim()'))[0];assert.notEqual(a.id,b.id);
 assert.equal((await q('select * from ms_mail_claim()')).length,0);
 const body={from:'Mr. Space <hello@mrspace.online>',text:'original'};
 assert.deepEqual((await q('select ms_mail_prepare($1,$2,$3) as body',[a.id,a.lease,body]))[0].body,body);
 assert.deepEqual((await q('select ms_mail_prepare($1,$2,$3) as body',[a.id,a.lease,{text:'changed'}]))[0].body,body);
 await q("update ms_mail_outbox set lease_until=now()-interval '1 minute' where id=$1",[a.id]);
 const again=(await q('select * from ms_mail_claim()'))[0];assert.equal(again.id,a.id);assert.notEqual(again.lease,a.lease);
 assert.equal((await q("select ms_mail_finish($1,$2,null,'old',false) as ok",[a.id,a.lease]))[0].ok,false);
 const provider='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await q("select ms_mail_event('before-ack',$1,'delivered')",[provider]);
 await q('select ms_mail_finish($1,$2,$3,null,false)',[again.id,again.lease,provider]);
 assert.equal((await q('select status from ms_mail_outbox where id=$1',[a.id]))[0].status,'delivered');
 await q("select ms_mail_finish($1,$2,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',null,false)",[b.id,b.lease]);
 assert.equal((await q('select status from ms_mail_outbox where id=$1',[b.id]))[0].status,'accepted');
 await q("select ms_mail_event('complaint',$1,'complained')",[provider]);await q("select ms_mail_event('late-delivery',$1,'delivered')",[provider]);
 assert.equal((await q('select status from ms_mail_outbox where id=$1',[a.id]))[0].status,'complained');
});
await test('daily first-send limit is shared across dispatchers and uncertain deliveries stop before 24h',async()=>{
 await q('update ms_mail_settings set daily_limit=1');await enqueue('limited');assert.equal((await q('select * from ms_mail_claim()')).length,0);
 await q('update ms_mail_settings set daily_limit=50');const job=(await q('select * from ms_mail_claim()'))[0];
 await q("select ms_mail_finish($1,$2,null,'send_uncertain',true)",[job.id,job.lease]);
 assert.equal((await q('select status from ms_mail_outbox where id=$1',[job.id]))[0].status,'queued');
 await q("update ms_mail_outbox set first_attempt_at=now()-interval '23 hours 1 minute',next_attempt_at=now() where id=$1",[job.id]);
 assert.equal((await q('select * from ms_mail_claim()')).length,0);assert.equal((await q('select error_code from ms_mail_outbox where id=$1',[job.id]))[0].error_code,'retry_window_expired');
});
await test('welcome events use real contacts and never treat internal usernames as customer mailboxes',async()=>{
 await q("insert into ms_site_users(email,site) values('rufcut@mrspace.online','rufcut'),('new@example.test','rufcut')");
 assert.equal((await q("select count(*)::int as n from ms_mail_outbox where kind='welcome' and recipient='rufcut@mrspace.online'"))[0].n,0);
 assert.equal((await q("select count(*)::int as n from ms_mail_outbox where event_key like 'welcome/%'"))[0].n,1);
});
await test('sign-in mail requires verified current session; refresh is deduplicated and revoked sessions fail Heron access',async()=>{
 await as('authenticated');const a=(await q('select ms_mail_login() as id'))[0].id;assert.equal((await q('select ms_mail_login() as id'))[0].id,a);
 assert.equal((await q('select ms_heron_admin_access() as ok'))[0].ok,true);
 await as('authenticated','client@example.test','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');assert.equal((await q('select ms_mail_login() as id'))[0].id,null);assert.equal((await q('select ms_heron_admin_access() as ok'))[0].ok,false);
 await as('postgres');await q("update auth.sessions set created_at=now()-interval '11 minutes' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'");await as('authenticated');assert.equal((await q('select ms_mail_login() as id'))[0].id,null);
 await as('authenticated','owner@example.test','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');assert.equal((await q('select ms_heron_admin_access() as ok'))[0].ok,false);await as('postgres');
});
await test('order insert and status change atomically create bounded messages, deduplicate staff and recheck revoked access',async()=>{
 await q("insert into ms_site_users(email,site) values('staff@example.test','rufcut'),('otherstaff@example.test','rufcut')");
 await q("insert into ms_notification_preferences values('rufcut','staff@example.test','team@example.test',true,'tr'),('rufcut','otherstaff@example.test','team@example.test',true,'de')");
 const svg='x'.repeat(100000),id=(await q("insert into ms_repair_jobs(site,ticket,customer_email,customer_name,items) values('rufcut','RC-TEST123','order@example.test','Customer',$1) returning id",[[{garment:'jacket',actions:['repair'],note:'Fit sleeve',preview_svg:svg}]]))[0].id;
 assert.equal((await q("select count(*)::int as n from ms_mail_outbox where event_key like $1",['order/'+id+'/%']))[0].n,2);
 const payload=(await q("select payload from ms_mail_outbox where recipient='order@example.test'"))[0].payload;assert.ok(JSON.stringify(payload).length<1000);assert.ok(!JSON.stringify(payload).includes(svg));
 await q('update ms_repair_jobs set status=status where id=$1',[id]);assert.equal((await q("select count(*)::int as n from ms_mail_outbox where event_key like $1",['order/'+id+'/%']))[0].n,2);
 await q("update ms_repair_jobs set status='ready',updated_at=now() where id=$1",[id]);assert.equal((await q("select count(*)::int as n from ms_mail_outbox where event_key like $1",['order/'+id+'/%']))[0].n,3);
 assert.equal((await q("select ms_mail_staff_allowed('staff@example.test','rufcut','team@example.test') as ok"))[0].ok,true);
 await q("insert into ms_viewers values('staff@example.test',null)");assert.equal((await q("select ms_mail_staff_allowed('staff@example.test','rufcut','team@example.test') as ok"))[0].ok,false);
});
await test('editor confirmations share the durable queue and retain one private return link per version',async()=>{
 const sub=(await q("insert into ms_submissions(site,email) values('rufcut','editor@example.test') returning id,edit_key"))[0];
 await q("insert into ms_changes values($1,'new'),($1,'withdrawn')",[sub.id]);
 await q('select ms_mail_link($1,false)',[sub.id]);await q('select ms_mail_link($1,false)',[sub.id]);
 const jobs=await q("select * from ms_mail_outbox where kind='request_link'");assert.equal(jobs.length,2);assert.equal(jobs[0].payload.count,1);assert.equal(jobs[0].payload.edit_key,sub.edit_key);
 await q('update ms_submissions set version=2 where id=$1',[sub.id]);await q('select ms_mail_link($1,true)',[sub.id]);assert.equal((await q("select count(*)::int as n from ms_mail_outbox where kind='request_link'"))[0].n,4);
 const id=(await q("select ms_mail_enqueue('english','rufcut','site_ready','client@example.test','tr','{}') as id"))[0].id;assert.equal((await q('select lang from ms_mail_outbox where id=$1',[id]))[0].lang,'en');
 await as('anon');await assert.rejects(()=>q('select ms_mail_link($1,false)',[sub.id]),/permission denied/);await as('postgres');
});
await test('administrator can cancel only an unclaimed queued message',async()=>{
 const uncertain=await enqueue('uncertain-cancel');await q('update ms_mail_outbox set attempts=1 where id=$1',[uncertain]);
 const id=await enqueue('cancel-me');await as('authenticated');await assert.rejects(()=>q('select ms_mail_cancel($1)',[uncertain]),/not_cancellable/);await q('select ms_mail_cancel($1)',[id]);await assert.rejects(()=>q('select ms_mail_cancel($1)',[id]),/not_cancellable/);
});
await db.close();console.log(`${count} isolated mail SQL checks passed; no live mutation or email`);
