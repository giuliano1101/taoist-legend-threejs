import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const skipped = new Set(['.git', 'node_modules', '.game-browser', 'public-export', 'TaoistLegend.exe']);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes:true }).flatMap(d => skipped.has(d.name) ? [] : d.isDirectory() ? walk(path.join(dir,d.name)) : [path.join(dir,d.name)]);
}
const files = walk(root);
const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['cloud key', /\bAKIA[A-Z0-9]{16}\b/],
  ['API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ['private user path', /[A-Za-z]:[\\/](?:Users|Codex|Documents|Downloads|Desktop|Program Files)[\\/]/i],
  ['private chat identifier', /\bwxid_[A-Za-z0-9_]+\b|thread:\/\//],
];
for (const file of files) {
  const rel = path.relative(root,file).replaceAll('\\','/');
  if (fs.statSync(file).size >= 50 * 1024 * 1024) failures.push(`${rel}: exceeds 50 MiB budget`);
  if (/^(?:backups|runtime|artwork|test-results|release-[^/]+)\//.test(rel)) failures.push(`${rel}: excluded archive directory`);
  if (/\.(?:zip|7z|pem|key|pfx|pdb|blend1?)$/i.test(rel)) failures.push(`${rel}: prohibited file type`);
  if (/(?:^|\/)\.env(?:\.|$)/.test(rel)) failures.push(`${rel}: environment file`);
  // Decode bytes only for pattern detection; never print matching secret values.
  const data = fs.readFileSync(file);
  const text = data.toString('utf8');
  for (const [name, pattern] of rules) if (pattern.test(text)) failures.push(`${rel}: ${name}`);
  if (/\.(?:js|mjs)$/.test(rel)) {
    const check = spawnSync(process.execPath, ['--check',file], { encoding:'utf8' });
    if (check.status !== 0) failures.push(`${rel}: JavaScript syntax failed`);
  }
}

// Verify static HTML/CSS/module references. Dynamic asset names are covered by the manifest and browser smoke test.
const dist = path.join(root,'dist');
for (const file of files.filter(p => p.startsWith(dist+path.sep) && /\.(?:html|css|js)$/.test(p))) {
  const s=fs.readFileSync(file,'utf8');
  const refs = file.endsWith('.html') ? [...s.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]) : file.endsWith('.css') ? [...s.matchAll(/url\(["']?([^"')]+)/g)].map(m=>m[1]) : [...s.matchAll(/^\s*import\s+(?:[^;]*?\bfrom\s*)?["']([^"']+)["']/gm)].map(m=>m[1]);
  for (let ref of refs) {
    ref=ref.split('?')[0].split('#')[0];
    if (!ref || /^[a-z]+:|^\//i.test(ref)) continue;
    const resolved=ref==='three' ? path.join(dist,'vendor/three.module.js') : ref.startsWith('three/addons/') ? path.join(dist,'vendor',ref.slice(13)) : path.resolve(path.dirname(file),ref);
    if (!fs.existsSync(resolved)) failures.push(`${path.relative(root,file)}: missing dependency ${ref}`);
  }
}

const runtime = files.filter(f=>f.startsWith(dist+path.sep)).map(f=>({ path:path.relative(root,f).replaceAll('\\','/'), bytes:fs.statSync(f).size, sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') })).sort((a,b)=>a.path.localeCompare(b.path));
const manifestPath=path.join(root,'docs/runtime-manifest.json');
if (process.argv.includes('--update-manifest')) fs.writeFileSync(manifestPath,JSON.stringify(runtime,null,2)+'\n');
const stored=JSON.parse(fs.readFileSync(manifestPath,'utf8')).sort((a,b)=>a.path.localeCompare(b.path));
if(JSON.stringify(runtime)!==JSON.stringify(stored)) failures.push('Runtime manifest differs; review assets then run node scripts/check.mjs --update-manifest');
const bytes=files.reduce((n,f)=>n+fs.statSync(f).size,0);
if(bytes>100*1024*1024) failures.push('Project exceeds 100 MiB budget');
if(failures.length) { console.error(failures.join('\n'));process.exitCode=1; }
else console.log(JSON.stringify({pass:true,files:files.length,bytes,runtimeFiles:runtime.length,checks:['syntax','static dependencies','runtime hashes','privacy patterns','size budget']},null,2));
