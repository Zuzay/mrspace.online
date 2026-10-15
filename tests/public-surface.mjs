import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {isPublicFile,secureHTML,buildPublicSite} from '../tools/build-public-site.mjs';

test('private source, secrets, snapshots and configuration never qualify',()=>{
  for(const file of ['.env','.git/config','supabase/functions/ms-square/index.ts','ms/mrspace-system.sql','ms/worker/worker.mjs','AGENTS.md','README.md','package.json','tests/example.spec.js','assets/app.js.map','sites/rufcut/site.json','rufcut/site.json','studio-direction/review/screen.png','assets/.env.json','tools/build-site.mjs']) assert.equal(isPublicFile(file),false,file);
  for(const file of ['index.html','assets/ms-config.js','assets/lang/tr.json','admin/index.html','panel/panel.webmanifest','ms/guard.js','tools/denim/denim.js','rufcut/media/store.webp','assets/fonts/Anton-OFL.txt']) assert.equal(isPublicFile(file),true,file);
});
test('referrer policy precedes assets; sensitive pages are not indexed',()=>{
  const source=`<html><head><meta name='referrer' content='unsafe-url'><link href='https://example.com/font'></head><body><a target='_blank' rel='external' href='https://example.com'>Go</a></body></html>`;
  const output=secureHTML(source,'request/index.html');
  assert.ok(output.indexOf('no-referrer') < output.indexOf('<link'));
  assert.ok(!output.includes('unsafe-url'));
  assert.ok(output.includes('noindex,nofollow,noarchive'));
  assert.ok(output.includes('rel="external noopener noreferrer"'));
  assert.equal(secureHTML(output,'request/index.html'),output);
  assert.ok(!secureHTML(source,'index.html').includes('noindex'));
});
test('artifact excludes tracked internals and untracked secrets; refuses stale output and symlinks',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'mrspace-security-'));
  try {
    const source=path.join(temp,'source'),output=path.join(temp,'public');
    await mkdir(path.join(source,'ms'),{recursive:true});
    execFileSync('git',['init','-q'],{cwd:source});
    await writeFile(path.join(source,'index.html'),'<html><head></head></html>');
    await writeFile(path.join(source,'ms/private.sql'),'private');
    await writeFile(path.join(source,'ms/guard.js'),'/* public */');
    execFileSync('git',['add','.'],{cwd:source});
    await writeFile(path.join(source,'secret.html'),'untracked');
    assert.equal(await buildPublicSite(source,output),2);
    await assert.rejects(access(path.join(output,'ms/private.sql')));
    await assert.rejects(access(path.join(output,'secret.html')));
    assert.ok((await readFile(path.join(output,'index.html'),'utf8')).includes('no-referrer'));
    await assert.rejects(buildPublicSite(source,output));
    await symlink(path.join(source,'ms/private.sql'),path.join(source,'assets.js'));
    await mkdir(path.join(source,'assets'));
    await symlink(path.join(source,'ms/private.sql'),path.join(source,'assets/leak.js'));
    execFileSync('git',['add','.'],{cwd:source});
    await assert.rejects(buildPublicSite(source,path.join(temp,'symlink-output')),/Symlink/);
  } finally {await rm(temp,{recursive:true,force:true});}
});
