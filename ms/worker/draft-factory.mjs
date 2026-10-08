// Ücretli API, ağ veya dosya değişikliği yok. Mevcut renderer ile incelenebilir taslak üretir.
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../assets/ms-render.js',import.meta.url),'utf8'),sandbox,{timeout:1000});
const render=sandbox.window.MsRender;
import {createDraft as renderDraft} from '../draft-render.mjs';
export const createDraft=job=>renderDraft(job,render);
