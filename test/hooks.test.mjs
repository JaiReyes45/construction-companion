import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {scope,event,temporaryDirectory} from './helpers.mjs';
import {signContext,verifyContext} from '../src/host/context.mjs';
import {normalizeHook} from '../src/host/normalize.mjs';
import {appendSpool,drainSpool} from '../src/host/spool.mjs';
test('signed context rejects tampering and expiry',()=>{
 const secret=Buffer.alloc(32,7),token=signContext({scope,turnId:'t',expiresAt:1000},secret);
 assert.deepEqual(verifyContext(token,secret,0).scope,scope);
 assert.throws(()=>verifyContext(token+'x',secret,0),{code:'UNAUTHORIZED'});
 assert.throws(()=>verifyContext(token,secret,1000),{code:'EXPIRED'});
});
test('concurrent writers retain valid records or an explicit gap; benchmark 100 appends',async t=>{
 const directory=temporaryDirectory(t),url=new URL('../src/host/spool.mjs',import.meta.url).href;
 const workers=Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>{
  const w=new Worker(`const {parentPort,workerData}=require('node:worker_threads');import(workerData.url).then(({appendSpool})=>{for(let i=0;i<20;i++)appendSpool({directory:workerData.directory,event:{...workerData.event,eventId:workerData.worker+'-'+i}});parentPort.postMessage('done')})`,{eval:true,workerData:{url,directory,event:event(),worker:i}});
  w.on('error',reject);w.on('exit',code=>code?reject(Error('worker failed')):resolve());
 }));
 await Promise.all(workers);const received=[];await drainSpool({directory,send:async e=>received.push(e)});
 assert.ok(received.length===80||received.some(e=>e.type==='history.gap'));
 const times=[];for(let i=0;i<100;i++){const start=performance.now();appendSpool({directory,event:event({eventId:'bench-'+i})});times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);t.diagnostic(JSON.stringify({appendMsP50:times[50],appendMsP95:times[95],samples:100}));
});
test('normalizers discard prompts, tool contents and unknown event types',()=>{
 for(const host of ['codex','claude']){
  const raw={hook_event_name:'UserPromptSubmit',session_id:'s',turn_id:'t',prompt:'synthetic-secret',tool_input:{password:'synthetic-secret'}};
  const e=normalizeHook(host,raw,{projectId:'p',turnId:'t',sequence:1,now:0});
  assert.equal(e.type,'turn.start');assert.ok(!JSON.stringify(e).includes('synthetic-secret'));
  assert.equal(normalizeHook(host,{...raw,hook_event_name:'Unknown'},{}),null);
  const a=normalizeHook(host,{...raw,hook_event_name:'SubagentStart',agent_id:'a'},{projectId:'p',sequence:2,now:0});
  assert.equal(a.actorId,'a');assert.equal(a.skillId,undefined);
 }
});
test('offline spool preserves IDs, retries failures and bounds overflow',async t=>{
 const directory=temporaryDirectory(t);
 appendSpool({directory,event:event()});
 assert.equal((await drainSpool({directory,send:async()=>{throw Error('offline')}})).sent,0);
 const sent=[];await drainSpool({directory,send:async e=>{sent.push(e);}});
 assert.equal(sent[0].eventId,'event-a');
 for(let i=0;i<20;i++)appendSpool({directory,event:event({eventId:String(i),payload:{label:'x'.repeat(2000)}}),maxBytes:8192});
 const bytes=readdirSync(directory).filter(n=>n.endsWith('.json')).reduce((sum,n)=>sum+readFileSync(path.join(directory,n)).length,0);
 assert.ok(bytes<=8192);
 const recovered=[];await drainSpool({directory,send:async e=>recovered.push(e)});
 assert.ok(recovered.some(e=>e.type==='history.gap'));
});

test('replay drains events in observed order and native interrupt ends its turn',async t=>{
 const directory=temporaryDirectory(t),sent=[];
 for(let i=0;i<12;i++)appendSpool({directory,event:event({eventId:'ordered-'+i,sequence:i})});
 await drainSpool({directory,send:async e=>sent.push(e.sequence)});assert.deepEqual(sent,Array.from({length:12},(_,i)=>i));
 assert.equal(normalizeHook('codex',{hook_event_name:'Interrupt',session_id:'s',turn_id:'t'},{projectId:'p'}).type,'turn.end');
});
