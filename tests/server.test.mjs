import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let child,port;
before(async()=>{
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));port=probe.address().port;await new Promise(r=>probe.close(r));
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);
    child.stdout.on('data',b=>{if(b.toString().includes('Local:')){clearTimeout(timer);resolve();}});
    child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited: '+code));});
  });
});
after(()=>child?.kill());
function request(url,method='GET'){
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path:url,method},res=>{
      const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end();
  });
}
test('serves game entry and local resource types',async()=>{
  const entry=await request('/');assert.equal(entry.status,200);assert.match(entry.body.toString(),/道士林正英传奇/);
  assert.match((await request('/assets/corridor-navigation.json','HEAD')).headers['content-type'],/application\/json/);
  assert.match((await request('/fonts/kongjing-serif.woff2','HEAD')).headers['content-type'],/font\/woff2/);
});
test('HEAD has headers without a body and missing files stay missing',async()=>{
  const r=await request('/game.js','HEAD');assert.equal(r.status,200);assert.equal(r.body.length,0);assert(Number(r.headers['content-length'])>0);
  assert.equal((await request('/does-not-exist')).status,404);
});
test('private project files and traversal cannot leave dist',async()=>{
  for(const p of ['/package.json','/.git/config','/..%2fpackage.json','/%2e%2e%5cpackage.json']){
    const r=await request(p);assert(r.status>=400,p);assert(!r.body.includes(Buffer.from('"name": "taoist-legend-threejs"')));
  }
});
test('rejects unsafe methods and malformed paths',async()=>{
  assert.equal((await request('/','POST')).status,405);
  assert.equal((await request('/%zz')).status,400);
  assert.equal((await request('/%00')).status,400);
});
