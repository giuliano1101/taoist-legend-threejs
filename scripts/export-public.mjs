import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public-export');
if(fs.existsSync(output))throw Error('public-export already exists. Review or move it before creating a new candidate.');
const excluded=[];
function copy(dir,relative=''){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const rel=(relative?relative+'/':'')+e.name;
    if(['.git','node_modules','.game-browser','public-export'].includes(e.name)||rel==='dist/assets'||rel==='docs/media'||rel==='tools/game.ico'||rel==='docs/runtime-manifest.json'||rel==='TaoistLegend.exe') {excluded.push(rel);continue;}
    const target=path.join(output,rel);
    if(e.isDirectory()){fs.mkdirSync(target,{recursive:true});copy(path.join(dir,e.name),rel);}
    else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(dir,e.name),target);}
  }
}
fs.mkdirSync(output);copy(root);
fs.writeFileSync(path.join(output,'PUBLIC_CANDIDATE.md'),`# Source-only public candidate\n\nThis directory intentionally excludes all gameplay assets, promotional media, the icon and Git history. It is **not a playable public distribution**. Review README image references, licensing, branding and third-party libraries before publishing. Add authorized replacement assets and regenerate the runtime manifest before running checks. No repository visibility has been changed.\n\nExcluded paths:\n${excluded.map(p=>'- '+p).join('\n')}\n`);
console.log('Created a local source-only candidate in public-export. Nothing was published.');
