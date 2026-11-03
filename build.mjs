import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
let html=read('src/index.html');
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const js=strip(read('src/data.js'))+'\nconst C = CASE;\n'+['src/model.js','src/app.js'].map(p=>strip(read(p))).join('\n\n');
html=html.replace('/* STYLES */',()=>read('src/styles.css')).replace('/* APPLICATION */',()=>`(()=>{\n'use strict';\n${js}\n})();`);
mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html',html);
console.log(`HTML autocontenido: ${Buffer.byteLength(html)} bytes. Sin dependencias de red.`);
