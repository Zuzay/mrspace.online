// Builds a standalone client site from sites/<slug>/site.json.
// Usage: node tools/build-site.mjs <slug> <empty-output-dir>
// Same contract for every client: copy the site folder, add the shared Mr. Space
// assets it lists, apply text rewrites, then write CNAME, robots, sitemap, _redirects.
import fs from 'node:fs/promises'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, outArg] = process.argv.slice(2);
if (!slug || !outArg) { console.error('Usage: node tools/build-site.mjs <slug> <empty-output-dir>'); process.exit(2); }
if (!/^[a-z0-9-]+$/.test(slug)) throw Error('Bad slug: ' + slug);
const cfg = JSON.parse(await fs.readFile(path.join(repo, 'sites', slug, 'site.json'), 'utf8'));
const output = path.resolve(outArg);
if (output === repo || output.startsWith(repo + path.sep) || repo.startsWith(output + path.sep)) throw Error('Choose an output outside the source repository.');
await fs.mkdir(output, { recursive: true });
if ((await fs.readdir(output)).length) throw Error('Output must be empty; choose a new release directory.');

const src = path.join(repo, cfg.source);
const skip = cfg.skip_prefixes || [];
await fs.cp(src, output, { recursive: true, filter: p => !skip.some(s => path.basename(p).startsWith(s)) });

// Internal notes stay in the studio repo, never on the client domain.
for (const rel of cfg.exclude || []) {
  if (rel.includes('..') || path.isAbsolute(rel)) throw Error('Bad exclude: ' + rel);
  await fs.rm(path.join(output, rel), { force: true });
}

const sh = cfg.shared || {};
if ((sh.files || []).length || (sh.lang_prefixes || []).length) await fs.mkdir(path.join(output, 'assets', 'lang'), { recursive: true });
for (const f of sh.files || []) await fs.copyFile(path.join(repo, 'assets', f), path.join(output, 'assets', f));
for (const d of sh.dirs || []) await fs.cp(path.join(repo, 'assets', d), path.join(output, 'assets', d), { recursive: true });
for (const lang of sh.langs || []) for (const prefix of sh.lang_prefixes || []) {
  const file = prefix + lang + '.json';
  try { await fs.copyFile(path.join(repo, 'assets', 'lang', file), path.join(output, 'assets', 'lang', file)); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}

const missing = [];
const byFile = new Map();
for (const r of cfg.rewrites || []) { if (!byFile.has(r.file)) byFile.set(r.file, []); byFile.get(r.file).push(r); }
for (const [file, rules] of byFile) {
  const p = path.join(output, file); let t = await fs.readFile(p, 'utf8');
  for (const r of rules) {
    if (!t.includes(r.find)) { missing.push(file + ': ' + r.find.slice(0, 60)); continue; }
    t = r.all ? t.replaceAll(r.find, r.replace) : t.replace(r.find, r.replace);
  }
  await fs.writeFile(p, t);
}
if (cfg.cache_version && (cfg.versioned || []).length) {
  const p = path.join(output, 'index.html'); const t = await fs.readFile(p, 'utf8');
  const names = cfg.versioned.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  await fs.writeFile(p, t.replace(new RegExp('(' + names + ')\\?v=[^"\']+', 'g'), '$1?v=' + cfg.cache_version));
}

if (cfg.domain) {
  const base = 'https://' + cfg.domain;
  await fs.writeFile(path.join(output, 'CNAME'), cfg.domain + (cfg.cname_newline === false ? '' : '\n'));
  await fs.writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  const urls = (cfg.pages || ['/']).map(p => `<url><loc>${base}${p}</loc></url>`).join('');
  await fs.writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
}
if ((cfg.redirects || []).length) await fs.writeFile(path.join(output, '_redirects'), cfg.redirects.join('\n') + '\n');

if (missing.length) { console.error('Rewrite text not found (source changed?):\n  ' + missing.join('\n  ')); process.exit(1); }
console.log(`Built ${cfg.name} -> ${output}${cfg.domain ? ' (' + cfg.domain + ')' : ' (preview, no domain)'}`);
