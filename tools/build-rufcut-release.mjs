// First release: www.rufcutjeans.com. Keep rufcut.com on Square Online and the studio CNAME unchanged.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.resolve(process.argv[2]||'/private/tmp/rufcut-release-20261014');
if(output===repo||output.startsWith(repo+path.sep)||repo.startsWith(output+path.sep))throw Error('Choose an output outside the source repository.');
await fs.mkdir(output,{recursive:true});
// Refuse an existing populated output so an old release cannot be mixed in.
if((await fs.readdir(output)).length)throw Error('Output must be empty; choose a new release directory.');
await fs.cp(path.join(repo,'rufcut'),output,{recursive:true,filter:src=>!path.basename(src).startsWith('www.rufcut.com')});
await fs.mkdir(path.join(output,'assets','lang'),{recursive:true});
for(const file of ['ms-config.js','i18n.js','ms-site-catalog.js','ms-storefront.js','ms-storefront.css'])await fs.copyFile(path.join(repo,'assets',file),path.join(output,'assets',file));
await fs.cp(path.join(repo,'assets','fonts'),path.join(output,'assets','fonts'),{recursive:true});
for(const lang of ['en','tr','es','de','fr'])for(const prefix of ['storefront-','rufcut-']){
 const file=prefix+lang+'.json';try{await fs.copyFile(path.join(repo,'assets','lang',file),path.join(output,'assets','lang',file));}catch(error){if(error.code!=='ENOENT')throw error;}
}
let home=await fs.readFile(path.join(output,'index.html'),'utf8');
home=home.replace('<meta name="robots" content="noindex">','<meta name="robots" content="index,follow"><link rel="canonical" href="https://www.rufcutjeans.com/">').replace('Rufcut, a concept by Mr. Space','Rufcut | Custom denim, vintage & repairs').replace('Concept for Rufcut, Venice Beach','Rufcut, Venice Beach').replaceAll('href="../"', 'href="https://mrspace.online/"').replace('https://mrspace.online/rufcut/media/rufcut-store.webp','https://www.rufcutjeans.com/media/rufcut-store.webp').replace('class="craft-story" data-ms-section="workshop"','id="workshop" class="craft-story" data-ms-section="workshop"');
home=home.replace(/(ms-storefront\.js|ms-site-catalog\.js|homepage-stock\.js)\?v=[^"']+/g,'$1?v=20261014-handover');
await fs.writeFile(path.join(output,'index.html'),home);
const repairPath=path.join(output,'repair','index.html');await fs.writeFile(repairPath,(await fs.readFile(repairPath,'utf8')).replaceAll('href="../../"','href="https://mrspace.online/"'));
await fs.writeFile(path.join(output,'CNAME'),'www.rufcutjeans.com\n');
await fs.writeFile(path.join(output,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://www.rufcutjeans.com/sitemap.xml\n');
await fs.writeFile(path.join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.rufcutjeans.com/</loc></url><url><loc>https://www.rufcutjeans.com/repair/</loc></url></urlset>\n');
await fs.writeFile(path.join(output,'_redirects'),'/s/shop /#vintage 301\n/product/:slug/:id /product/?id=:id 301\n/contact-us /#visit 301\n/workshop-reviews /#workshop 301\n/alterations-repairs /#repairs 301\n');
console.log('Prepared standalone release: '+output+'\nNo DNS or live deployment changed. Configure the host to honor _redirects.');
