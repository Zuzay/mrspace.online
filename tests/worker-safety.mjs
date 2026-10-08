import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {scopedPath,listScopedFiles,compileEdits,releaseAllowed} from '../ms/worker/safety.mjs';
import {createDraft} from '../ms/worker/draft-factory.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ms-safety-test-'));
fs.mkdirSync(path.join(root,'client'));fs.mkdirSync(path.join(root,'other'));
fs.writeFileSync(path.join(root,'client','index.html'),'<h1>Original</h1><p>Before</p>');
fs.writeFileSync(path.join(root,'other','index.html'),'private');fs.writeFileSync(path.join(root,'client','admin.html'),'Admin');fs.writeFileSync(path.join(root,'client','scripted.html'),'<h1>Safe</h1><script>const protectedValue=1;</script>');fs.symlinkSync('../other/index.html',path.join(root,'client','linked.html'));
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name);};
test('traversal and symlinks cannot escape a customer workspace',()=>{
 for(const file of ['../other/index.html','other/index.html','client/linked.html','/etc/passwd','client\\index.html'])assert.throws(()=>scopedPath(root,'client',file));
 assert.deepEqual(listScopedFiles(root,'client').map(f=>f.file),['client/index.html','client/scripted.html']);
});
const allowed=['client/index.html'],edit=(find,replace)=>({file:allowed[0],find,replace});
test('replacements are checked together before any file is written',()=>{
 const map=compileEdits(root,'client',allowed,[edit('Original','Changed'),edit('Changed','Final')]);assert.match(map.get(allowed[0]),/Final/);
 assert.throws(()=>compileEdits(root,'client',allowed,[edit('Original','Changed'),edit('Original','Final')]));
 assert.match(fs.readFileSync(path.join(root,allowed[0]),'utf8'),/Original/);
});
test('script, form, credential and new origin changes require human implementation',()=>{
 for(const value of ['<script>alert(1)</script>','<form>','<img onerror="alert(1)">','https://unknown.test','service_role','url(https://x.test)'])assert.throws(()=>compileEdits(root,'client',allowed,[edit('Original',value)]));
});
test('inline script fragments and admin pages cannot be edited indirectly',()=>{
 assert.throws(()=>compileEdits(root,'client',['client/scripted.html'],[{file:'client/scripted.html',find:'protectedValue=1',replace:'protectedValue=2'}]),/Executable block/);
 assert.throws(()=>compileEdits(root,'client',['client/admin.html'],[{file:'client/admin.html',find:'Admin',replace:'Changed'}]),/human implementation/);
});
test('a merge requires human release for the exact reviewed SHA',()=>{
 const sha='a'.repeat(40),change={status:'approved',pr_head_sha:sha},review={decision:'approved',released_at:new Date().toISOString(),reviewed_sha:sha};
 assert.equal(releaseAllowed(change,review,sha),true);
 for(const r of [{...review,released_at:null},{...review,reviewed_sha:'b'.repeat(40)},{...review,decision:'pending'},null])assert.equal(releaseAllowed(change,r,sha),false);
 assert.equal(releaseAllowed(change,review,'b'.repeat(40)),false);
});
test('draft factory produces script-free drafts, and does not pretend unknown tools exist',()=>{
 for(const sector of ['general','retail','fashion','food','services','community']){
 const html=createDraft({sector,kind:'design',brief:'Brand brief <script>alert(1)</script>'});assert.match(html,/TASLAK/);assert.doesNotMatch(html,/<script/i);
 }
 assert.match(createDraft({sector:'fashion',kind:'tool',brief:'Jeans inseam fitting helper'}),/Denim/);
 assert.throws(()=>createDraft({sector:'fashion',kind:'tool',brief:'An automatic photography application'}),/human_implementation_required/);
});
console.log(`${count} worker safety checks passed`);
