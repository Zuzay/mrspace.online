import fs from 'node:fs';
import path from 'node:path';

const TEXT = /\.(html?|css|js|mjs|json|md|txt|svg|xml)$/i;
const PRIVATE = /(^|\/)(?:\.git|\.github|node_modules|supabase|admin|ms)(\/|$)|(?:^|\/)(?:admin|auth|secrets?|credentials|ms-config)\.[^/]+$/i;
export function scopedPath(root, scope, file = scope) {
  if (typeof scope !== 'string' || !scope.trim() || typeof file !== 'string' || !file.trim()) throw new Error('Invalid workspace scope');
  for (const value of [scope,file]) if (path.isAbsolute(value) || value.includes('\\') || value.split('/').includes('..') || value.includes('\0')) throw new Error('Unsafe workspace path');
  const base=fs.realpathSync(root), directory=path.resolve(base,scope), target=path.resolve(base,file);
  const within=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
  if(!within(base,directory)||!within(directory,target)||!within(directory,fs.realpathSync(target))) throw new Error('Outside workspace scope');
  // No symlink, even one currently pointing inside the workspace.
  let current=base;for(const part of path.relative(base,target).split(path.sep)){if(!part)continue;current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw new Error('Symlinks are not editable');}
  return target;
}
export function listScopedFiles(root,scope) {
  const out=[];scopedPath(root,scope);
  function walk(rel){for(const f of fs.readdirSync(scopedPath(root,scope,rel),{withFileTypes:true})){
    if(f.name.startsWith('.')||f.name==='node_modules'||f.isSymbolicLink())continue;
    const file=path.posix.join(rel,f.name);if(PRIVATE.test(file))continue;
    if(f.isDirectory())walk(file);else if(TEXT.test(file)){const size=fs.statSync(scopedPath(root,scope,file)).size;if(size<=120000)out.push({file,size});}
  }}walk(scope.replace(/\/$/,''));return out.sort((a,b)=>a.file.localeCompare(b.file));
}
export function compileEdits(root,scope,allowed,edits) {
  if(!Array.isArray(edits)||!edits.length||edits.length>20)throw new Error('Invalid edits');
  const outputs=new Map();
  for(const edit of edits){
    if(!allowed.includes(edit.file)||PRIVATE.test(edit.file)||!TEXT.test(edit.file)||/\.(?:js|mjs|json|svg|xml)$/i.test(edit.file))throw new Error('File requires human implementation');
    if(typeof edit.find!=='string'||!edit.find.length||typeof edit.replace!=='string'||edit.replace.length>120000)throw new Error('Invalid replacement');
    const file=scopedPath(root,scope,edit.file),src=outputs.get(edit.file)??fs.readFileSync(file,'utf8');
    if(src.split(edit.find).length-1!==1)throw new Error('Replacement must match exactly once, in sequence');
    if(/\.html?$/i.test(edit.file)){
      const start=src.indexOf(edit.find),end=start+edit.find.length;
      for(const block of src.matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi))if(start<block.index+block[0].length&&end>block.index)throw new Error('Executable block requires human implementation');
      if(src.lastIndexOf('<',start-1)>src.lastIndexOf('>',start-1))throw new Error('Attribute replacement requires human implementation');
    }
    // Changes to executable blocks, credentials, forms or external origins require a developer.
    const dangerous=/<\/?(?:script|iframe|object|embed|form|meta|link|style)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html|\b(?:service_role|secret_key|apikey)\b|@import|url\s*\(|(?:href|src|srcset)\s*=\s*["']?\/\//i;
    if(dangerous.test(edit.find)||dangerous.test(edit.replace))throw new Error('Executable or private content requires human implementation');
    const origins=value=>new Set([...value.matchAll(/https?:\/\/[^\s"'<>)/]+/g)].map(m=>{try{return new URL(m[0]).origin;}catch{return 'invalid';}}));
    const before=origins(edit.find);if([...origins(edit.replace)].some(origin=>!before.has(origin)))throw new Error('New external origin requires human review');
    const next=src.replace(edit.find,()=>edit.replace);if(next.length>500000)throw new Error('File too large');outputs.set(edit.file,next);
  }
  if([...outputs].every(([file,content])=>content===fs.readFileSync(scopedPath(root,scope,file),'utf8')))throw new Error('No effective changes');
  return outputs;
}
export function releaseAllowed(change,review,head) {
  return change.status==='approved' && review?.decision==='approved' && !!review.released_at && /^[a-f0-9]{40}$/.test(head||'') && head===change.pr_head_sha && head===review.reviewed_sha;
}
