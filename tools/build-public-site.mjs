import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const roots = new Set(['admin','assets','build','edit','first-clients','handover','iwona-ash','library','mrspace','packages','panel','preview','request','rufcut','space-tailoring','site','square-sku-guide','squarebaglantisi','start','studio-direction','studio','try']);
const rootFiles = new Set(['index.html','404.html','CNAME','robots.txt','sitemap.xml','og.png']);
const extensions = new Set(['.html','.css','.js','.json','.webmanifest','.png','.jpg','.jpeg','.webp','.avif','.gif','.svg','.ico','.woff','.woff2','.ttf','.otf','.mp4','.webm','.mp3','.wav','.pdf']);
export function isPublicFile(file) {
  const parts = file.split('/');
  if (parts.some(p => p.startsWith('.') || p === '..' || ['node_modules','review','reviews','test-results','playwright-report'].includes(p))) return false;
  if (rootFiles.has(file) || file === 'ms/guard.js') return true;
  if (file.startsWith('assets/fonts/') && file.endsWith('-OFL.txt')) return true;
  if (file.startsWith('tools/denim/')) return extensions.has(path.extname(file));
  return roots.has(parts[0]) && extensions.has(path.extname(file)) && !['package.json','package-lock.json','site.json'].includes(parts.at(-1));
}
const privateRoots = new Set(['admin','panel','edit','request','preview','build','handover','studio','try']);
export function secureHTML(html, file) {
  // Set policy before any fetch-capable element. Client access tokens must never
  // be sent to linked sites or third-party assets through the Referer header.
  html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']referrer["'])[^>]*>/gi, '');
  let policy = '<meta name="referrer" content="no-referrer">';
  if (privateRoots.has(file.split('/')[0]) || file.startsWith('rufcut/')) {
    html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>/gi, '');
    policy += '<meta name="robots" content="noindex,nofollow,noarchive">';
  }
  html = html.replace(/<head\b[^>]*>/i, match => match + policy);
  return html.replace(/<a\b[^>]*>/gi, tag => {
    if (!/\btarget\s*=\s*(["'])_blank\1/i.test(tag)) return tag;
    const existing = tag.match(/\brel\s*=\s*(["'])(.*?)\1/i);
    const tokens = new Set((existing?.[2] || '').split(/\s+/).filter(Boolean));
    tokens.add('noopener'); tokens.add('noreferrer');
    const attr = 'rel="' + [...tokens].join(' ') + '"';
    return existing ? tag.replace(existing[0], attr) : tag.replace(/>$/, ' ' + attr + '>');
  });
}
export async function buildPublicSite(source, output) {
  source = path.resolve(source); output = path.resolve(output);
  if (output === source || source.startsWith(output + path.sep)) throw Error('Unsafe output directory');
  // Only tracked files are eligible. Untracked local exports and credentials
  // can never accidentally enter the deployment artifact.
  const files = execFileSync('git', ['ls-files','-z'], {cwd:source, encoding:'utf8'}).split('\0').filter(Boolean);
  await mkdir(output, {recursive:false}); // Fail instead of reusing stale content.
  let count = 0;
  for (const file of files.filter(isPublicFile)) {
    let current = source;
    for (const part of file.split('/')) {
      current = path.join(current, part);
      if ((await lstat(current)).isSymbolicLink()) throw Error('Symlink in public artifact: ' + file);
    }
    let content = await readFile(current);
    if (file.endsWith('.html')) content = secureHTML(content.toString(), file);
    const destination = path.join(output,file);
    await mkdir(path.dirname(destination),{recursive:true});
    await writeFile(destination,content); count++;
  }
  await writeFile(path.join(output,'.nojekyll'),'');
  return count;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = fileURLToPath(new URL('../',import.meta.url));
  const output = process.argv[2];
  if (!output) throw Error('Usage: node tools/build-public-site.mjs <new-output-directory>');
  console.log('Public artifact:', await buildPublicSite(source, output), 'files');
}
