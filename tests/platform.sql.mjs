// Gerçek PostgreSQL semantiğiyle izole test. Canlı veritabanı kullanılmaz.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.MS_PGLITE_MODULE;
if(!modulePath)throw new Error('MS_PGLITE_MODULE test-only PGlite entry path required');
const {PGlite}=await import(pathToFileURL(modulePath));
const db=new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
create function public.ms_is_admin() returns boolean language sql stable as $$select coalesce(auth.jwt()->>'email','')='owner@example.test'$$;
create function public.ms_role() returns text language sql stable as $$select case when public.ms_is_admin() then 'admin' when auth.jwt()->>'email'='viewer@example.test' then 'viewer' else null end$$;
create table public.ms_sites(slug text primary key,name text,url text,status text,site_key uuid,kind text);
create table public.ms_changes(id bigserial primary key,site text references ms_sites,kind text,target text,request text,requested_by text,status text default 'new',created_at timestamptz default now(),done_at timestamptz);
create table public.ms_site_users(email text,site text references ms_sites,primary key(email,site));
create table public.ms_activity(id bigserial primary key,site text,who text,action text);
create function public.ms_quota(text) returns table(small_used int,small_quota int,big_used int,big_quota int) language sql as $$select 0,4,0,2$$;
create function public.ms_decide_change(p_id bigint,p_status text,p_note text default null) returns void language sql security definer as $$update public.ms_changes set status=p_status where id=p_id$$;
insert into ms_sites values
('heron','Heron','https://example.test/heron','live','11111111-1111-4111-8111-111111111111','own'),
('laloo','Laloo','https://example.test/laloo','live','22222222-2222-4222-8222-222222222222','own'),
('rufcut','Rufcut','https://example.test/rufcut','live','33333333-3333-4333-8333-333333333333','client');
alter table ms_sites add column plan text default 'first';
create table public.ms_square(site text,location_name text,public_catalog boolean,connected_at timestamptz,access_token text);
insert into ms_site_users values('heron@example.test','heron'),('rufcut@example.test','rufcut');
`);
const sql=fs.readFileSync(new URL('../ms/mrspace-platform.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql);
let passed=0;
async function run(label,fn){await fn();passed++;console.log(`PASS ${label}`);}
const query=async(q,p=[])=> (await db.query(q,p)).rows;
async function as(role,email,sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'){
  await db.exec('reset role');await query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(email?{email,sub}:{})]);await db.exec(`set role ${role}`);
}
await run('migration reruns without resetting profiles',async()=>{assert.equal((await query('select count(*)::int as n from ms_site_profiles'))[0].n,3);});
await run('client sees only its assigned site and no secrets',async()=>{
 await as('authenticated','heron@example.test');const data=(await query('select ms_workspace_snapshot() as d'))[0].d;
 assert.deepEqual(data.sites.map(s=>s.slug),['heron']);assert.equal(data.admin,false);assert.equal(data.jobs.length,0);
 for(const key of ['site_key','log_key','contact','monthly_cents','paid_until','notes'])assert.equal(key in data.sites[0],false);
});
await run('cross-site reads fail',async()=>{await assert.rejects(()=>query("select ms_workspace_snapshot('rufcut')"),/not_allowed/);});
await run('unassigned viewer gets no workspace data',async()=>{await as('authenticated','viewer@example.test');assert.equal((await query('select ms_workspace_snapshot() as d'))[0].d.sites.length,0);});
await run('viewer role cannot write even with accidental membership or a site capability',async()=>{
 await as('postgres',null);await query("insert into ms_site_users values('viewer@example.test','heron')");await as('authenticated','viewer@example.test');
 assert.equal((await query('select ms_workspace_snapshot() as d'))[0].d.sites.length,0);assert.deepEqual((await query('select ms_my_sites() as d'))[0].d,[]);
 await assert.rejects(()=>query("select ms_workspace_request('heron','text','A viewer change',$1,$2)",['eeeeeeee-1111-4111-8111-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111']),/not_allowed/);
});
await run('anonymous snapshot and direct table reads fail',async()=>{await as('anon',null);await assert.rejects(()=>query('select ms_workspace_snapshot()'),/permission denied/);await assert.rejects(()=>query('select * from ms_site_profiles'),/permission denied/);});
await run('bad capability cannot send requests',async()=>{await assert.rejects(()=>query("select ms_workspace_request('heron','text','A change',$1,$2)",['44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222']),/not_allowed/);});
await run('an unconfigured null site key cannot bypass capability checks',async()=>{
 await as('postgres',null);await query("insert into ms_sites values('unset','Unset','https://example.test','live',null,'client','first')");await as('anon',null);
 await assert.rejects(()=>query("select ms_workspace_request('unset','text','A change',$1,$2)",['ffffffff-1111-4111-8111-ffffffffffff','11111111-1111-4111-8111-111111111111']),/not_allowed/);
});
await run('valid capability creates one request and retry deduplicates',async()=>{
 const args=['heron','hours','Open at 10','55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111'];
 const first=(await query('select ms_workspace_request($1,$2,$3,$4,$5) as d',args))[0].d;
 const second=(await query('select ms_workspace_request($1,$2,$3,$4,$5) as d',args))[0].d;
 assert.equal(first.id,second.id);assert.equal(second.duplicate,true);
});
await run('null target and empty request are rejected',async()=>{await assert.rejects(()=>query("select ms_workspace_request('heron',null,'A change',$1,$2)",['66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111']),/invalid_request/);});
await run('member can submit without capability but not to another site',async()=>{
 await as('authenticated','rufcut@example.test');assert.equal((await query("select ms_workspace_request('rufcut','photo','Replace photo',$1) as d",['77777777-7777-4777-8777-777777777777']))[0].d.ok,true);
 await assert.rejects(()=>query("select ms_workspace_request('laloo','photo','Replace photo',$1)",['88888888-8888-4888-8888-888888888888']),/not_allowed/);
});
await run('member cannot update profiles, connections, or queue jobs',async()=>{
 await assert.rejects(()=>query("select ms_set_site_profile('rufcut','package_1','general','client',false)"),/not_admin/);
 await assert.rejects(()=>query("update ms_service_connections set state='connected'"),/permission denied/);
 await assert.rejects(()=>query("select ms_queue_draft('fashion','tool','A useful denim tool',$1)",['99999999-9999-4999-8999-999999999999']),/not_admin/);
});
await run('admin sees all sites but cannot fake connection success',async()=>{
 await as('authenticated','owner@example.test');assert.equal((await query('select ms_workspace_snapshot() as d'))[0].d.sites.length,4);
 await assert.rejects(()=>query("update ms_service_connections set state='connected'"),/permission denied/);
});
await run('draft enqueue is idempotent and ready requires human review',async()=>{
 const token='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',args=['fashion','design','A focused tailoring design',token];
 const a=(await query('select ms_queue_draft($1,$2,$3,$4) as id',args))[0].id,b=(await query('select ms_queue_draft($1,$2,$3,$4) as id',args))[0].id;assert.equal(a,b);
 await assert.rejects(()=>query("select ms_review_draft($1,'ready')",[a]),/not_reviewable/);
 await as('service_role',null);const job=(await query('select ms_claim_draft() as j'))[0].j;assert.equal(job.id,a);assert.equal(job.status,'working');assert.equal((await query('select ms_claim_draft() as j'))[0].j,null);
 await query("update ms_draft_jobs set status='review' where id=$1",[a]);await as('authenticated','owner@example.test');await query("select ms_review_draft($1,'ready')",[a]);
 assert.equal((await query('select status from ms_draft_jobs where id=$1',[a]))[0].status,'ready');
});
await run('review approval does not publish and release requires an exact prepared SHA',async()=>{
 await as('authenticated','owner@example.test');
 const id=(await query('select ms_workspace_snapshot() as d'))[0].d.sites.find(s=>s.slug==='heron').requests[0].id;
 await assert.rejects(()=>query("select ms_review_change($1,'approved','','',null)",[id]),/preview_required/);
 await query("select ms_review_change($1,'approved','New hours','#hours',null)",[id]);
 await as('postgres',null);assert.equal((await query('select status from ms_changes where id=$1',[id]))[0].status,'new');
 const sha='a'.repeat(40);await query("update ms_changes set pr_head_sha=$2,ai_status='ready' where id=$1",[id,sha]);
 await as('authenticated','owner@example.test');await assert.rejects(()=>query('select ms_release_change($1,$2)',[id,sha]),/review_required/);
 await query("select ms_review_change($1,'approved','New hours','#hours',null)",[id]);
 await assert.rejects(()=>query('select ms_release_change($1,$2)',[id,'b'.repeat(40)]),/review_required/);
 await query('select ms_release_change($1,$2)',[id,sha]);assert.equal((await query('select released_at from ms_change_reviews where change_id=$1',[id]))[0].released_at!==null,true);
 await query("select ms_review_change($1,'pending','New hours','#hours',null)",[id]);assert.equal((await query('select released_at from ms_change_reviews where change_id=$1',[id]))[0].released_at,null);
});
await run('request and release claims are atomic and non-admin review is blocked',async()=>{
 await as('postgres',null);const id=(await query("insert into ms_changes(site,kind,target,request) values('heron','small','text','A prepared edit') returning id"))[0].id;
 await as('service_role',null);assert.equal((await query('select ms_claim_request($1) as ok',[id]))[0].ok,true);assert.equal((await query('select ms_claim_request($1) as ok',[id]))[0].ok,false);
 const sha='e'.repeat(40);await query("update ms_changes set ai_status='ready',pr_head_sha=$2 where id=$1",[id,sha]);
 await as('authenticated','heron@example.test');await assert.rejects(()=>query("select ms_review_change($1,'approved','Prepared content','#content',null)",[id]),/not_admin/);
 await as('authenticated','owner@example.test');await query("select ms_review_change($1,'approved','Prepared content','#content',null)",[id]);await query('select ms_release_change($1,$2)',[id,sha]);
 await as('service_role',null);assert.equal((await query('select ms_claim_release($1,$2) as ok',[id,sha]))[0].ok,true);assert.equal((await query('select ms_claim_release($1,$2) as ok',[id,sha]))[0].ok,false);
 await as('authenticated','owner@example.test');await assert.rejects(()=>query("select ms_review_change($1,'pending','Changed again','#content',null)",[id]),/not_reviewable/);
});
await run('customer work cannot become a public portfolio by relabeling it',async()=>{
 await assert.rejects(()=>query("select ms_set_site_profile('rufcut','package_3','retail','portfolio',true)"),/showcase/);
});
await run('prepared draft is visible only to the operator',async()=>{
 const id=(await query('select id from ms_draft_jobs limit 1'))[0].id;
 await as('authenticated','heron@example.test');await assert.rejects(()=>query('select ms_draft_preview($1)',[id]),/not_admin/);
 await as('authenticated','owner@example.test');await assert.rejects(()=>query('select ms_draft_preview($1)',[id]),/not_prepared/);
 const token='cccccccc-1111-4111-8111-cccccccccccc';const newID=(await query("select ms_queue_draft('food','design','A quiet neighborhood cafe',$1) as id",[token]))[0].id;
 await as('service_role',null);await query('select ms_claim_draft()');await query('select ms_complete_draft($1,$2,null)',[newID,'<!doctype html><html><body>Draft</body></html>']);
 await as('authenticated','owner@example.test');assert.match((await query('select ms_draft_preview($1) as html',[newID]))[0].html,/Draft/);
});
await run('project applications are private, deduplicated and rate limited',async()=>{
 const token='dddddddd-1111-4111-8111-dddddddddddd',sender='d'.repeat(64);
 await as('anon',null);await assert.rejects(()=>query('select ms_intake_list()'),/permission denied/);await assert.rejects(()=>query('select * from ms_intakes'),/permission denied/);
 await assert.rejects(()=>query('select ms_submit_intake($1,$2,$3,$4,$5,$6,$7,$8)',[token,'New owner','New business','new@example.test',null,'retail',{},sender]),/permission denied/);
 await as('service_role',null);
 const args=[token,'New owner','New business','new@example.test',null,'retail',{About:'A new project'},sender];
 const a=(await query('select ms_submit_intake($1,$2,$3,$4,$5,$6,$7,$8) as d',args))[0].d;
 const b=(await query('select ms_submit_intake($1,$2,$3,$4,$5,$6,$7,$8) as d',args))[0].d;assert.equal(a.id,b.id);assert.equal(b.duplicate,true);
 for(let i=1;i<5;i++){args[0]=`dddddddd-1111-4111-8111-ddddddddddd${i}`;await query('select ms_submit_intake($1,$2,$3,$4,$5,$6,$7,$8)',args);}
 args[0]='dddddddd-1111-4111-8111-ddddddddddd5';await assert.rejects(()=>query('select ms_submit_intake($1,$2,$3,$4,$5,$6,$7,$8)',args),/too_many/);
 await as('authenticated','viewer@example.test');await assert.rejects(()=>query('select ms_intake_list()'),/not_admin/);
 await as('authenticated','owner@example.test');const list=(await query('select ms_intake_list() as d'))[0].d;assert.equal(list.length,5);assert.equal('token' in list[0],false);assert.equal('sender_hash' in list[0],false);
 await query("select ms_handle_intake($1,'reviewing','Clarify scope')",[a.id]);assert.equal((await query('select ms_intake_list() as d'))[0].d.find(x=>x.id===a.id).status,'reviewing');
});
await run('anonymous cannot claim drafts or read receipts',async()=>{await as('anon',null);await assert.rejects(()=>query('select ms_claim_draft()'),/permission denied/);await assert.rejects(()=>query('select * from ms_request_receipts'),/permission denied/);});
await as('postgres',null);await run('paused site blocks new submissions',async()=>{await db.exec("update ms_sites set status='paused' where slug='heron'");await as('anon',null);await assert.rejects(()=>query("select ms_workspace_request('heron','text','A change',$1,$2)",['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111']),/site_paused/);});
console.log(`${passed} database checks passed`);await db.close();
