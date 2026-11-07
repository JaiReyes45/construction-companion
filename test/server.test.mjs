import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {openStore} from '../src/core/store.mjs';
import {createService} from '../src/core/service.mjs';
import {startServer} from '../src/server.mjs';
import {resolvePrivatePaths} from '../src/private-paths.mjs';
import {event,scope} from './helpers.mjs';
const tokens={ingest:'i'.repeat(64),ui:'u'.repeat(64)};
async function fixture(t){const store=openStore(':memory:');const service=createService({store});const server=await startServer({service,tokens});t.after(async()=>{await server.close();service.close();});return {...server,service};}
test('loopback token separation, origin and body limits',async t=>{
 const f=await fixture(t);
 const call=(route,token,body,origin)=>fetch(f.origin+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,...(origin?{origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await call('/api/sessions','wrong')).status,401);
 assert.equal((await call('/api/sessions',tokens.ingest)).status,401);
 assert.equal((await call('/ingest',tokens.ui,event())).status,401);
 assert.equal((await call('/ingest',tokens.ingest,event(),'https://evil.test')).status,403);
 assert.equal((await call('/ingest',tokens.ingest,{label:'x'.repeat(65537)})).status,413);
 assert.equal((await call('/ingest',tokens.ingest,event())).status,200);
 const sessions=await (await call('/api/sessions',tokens.ui)).json();
 assert.equal(sessions.length,1);assert.equal(sessions[0].host,'codex');
 assert.equal((await call('/api/events?sessionKey=missing',tokens.ui)).status,404);
 const rows=await (await call('/api/events?sessionKey='+sessions[0].sessionKey,tokens.ui)).json();assert.equal(rows.length,1);
 assert.ok(!JSON.stringify(sessions).includes(tokens.ingest));
 const status=await new Promise(resolve=>{const req=request(f.origin+'/api/sessions',{headers:{host:'evil.test',authorization:'Bearer '+tokens.ui}},res=>{res.resume();resolve(res.statusCode)});req.end();});assert.equal(status,403);
});
test('registered session handles survive service restart',()=>{
 const store=openStore(':memory:');const a=createService({store});const key=a.registerSession(scope);
 const b=createService({store});assert.equal(b.registerSession(scope),key);store.close();
});
test('private default paths reject project and OneDrive locations',()=>{
 const good=resolvePrivatePaths({platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\test\\AppData\\Local'},projectRoot:'C:\\Users\\test\\OneDrive\\repo'});
 assert.ok(good.dataRoot.startsWith('C:\\Users\\test\\AppData\\Local'));
 assert.throws(()=>resolvePrivatePaths({platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\test\\OneDrive'},projectRoot:'C:\\work'}));
});
test('browser answers derive origin on server and reject forged/stale replies',async t=>{
 const f=await fixture(t),key=f.service.registerSession(scope);
 const pending=f.service.ask({...scope,turnId:'t',requestId:'r',id:'q',text:'Audience?',options:[{id:'a',label:'Customers'}],allowFreeText:false,expiresAt:new Date(Date.now()+45000).toISOString()},{});
 const send=data=>fetch(f.origin+'/api/question/answer',{method:'POST',headers:{authorization:'Bearer '+tokens.ui,origin:f.origin},body:JSON.stringify(data)});
 const data={sessionKey:key,id:'q',version:1,answer:{optionId:'a'}};
 assert.equal((await send({...data,requestId:'forged'})).status,400);
 assert.equal((await send(data)).status,200);assert.equal((await pending).status,'answered');
 assert.equal((await send(data)).status,409);
});
test('public modules are served with CSP and no traversal outside public',async t=>{
 const f=await fixture(t);
 const r=await fetch(f.origin+'/projection.mjs');assert.equal(r.status,200);assert.ok(r.headers.get('content-security-policy').includes("script-src 'self'"));
 assert.equal((await fetch(f.origin+'/%2e%2e/package.json')).status,404);
});
