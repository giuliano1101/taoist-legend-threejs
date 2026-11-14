import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.glb':'model/gltf-binary', '.fbx':'application/octet-stream', '.spz':'application/octet-stream', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.ogg':'audio/ogg', '.woff2':'font/woff2' };

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow:'GET, HEAD' }); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (pathname.includes('\0')) { res.writeHead(400); res.end('Bad request'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': statSync(file).size, 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose a different PORT.` : error.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Local: ${url}`);
  if (process.argv.includes('--open') && process.platform === 'win32') execFile('rundll32.exe', ['url.dll,FileProtocolHandler',url], { windowsHide:true }, () => {});
});
