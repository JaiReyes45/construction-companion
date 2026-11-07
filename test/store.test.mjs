import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {openStore} from '../src/core/store.mjs';
import {scope,event,temporaryDirectory} from './helpers.mjs';
test('events deduplicate, conflict, isolate and survive restart',t=>{
 const file=path.join(temporaryDirectory(t),'test.db');let s=openStore(file);
 const a=s.append(event());assert.equal(s.append(event()).cursor,a.cursor);
 assert.throws(()=>s.append(event({payload:{label:'Changed'}})),{code:'CONFLICT'});
 s.append(event({eventId:'later',sequence:0}));s.append(event({eventId:'earlier',sequence:10}));
 assert.equal(s.list({...scope,sessionId:'other'},{}).length,0);
 assert.deepEqual(s.list(scope,{}).map(e=>e.sequence),[0,0,10]);
 s.close();s=openStore(file);assert.equal(s.list(scope,{}).length,3);s.close();
});
test('validation rejects unsupported schema, nested or secret payloads and oversized data',t=>{
 let s;t.after(()=>s?.close());s=openStore(path.join(temporaryDirectory(t),'test.db'));
 for(const bad of [{schema:2},{payload:{prompt:'secret'}},{payload:{label:{text:'secret'}}},{payload:{label:'x'.repeat(16385)}},{payload:{label:'token',password:'bad'}}]) assert.throws(()=>s.append(event(bad)));
 assert.equal(s.list(scope,{}).length,0);
 for(let i=0;i<110;i++)s.append(event({eventId:String(i),payload:{label:'x'.repeat(8000)}}));
 assert.ok(s.list(scope,{limit:101}).length<=100);assert.ok(Buffer.byteLength(JSON.stringify(s.list(scope,{limit:101})))<=786432);
});
test('CAS and nested transactions rollback atomically; async transactions rejected',t=>{
 let s;t.after(()=>s?.close());s=openStore(path.join(temporaryDirectory(t),'test.db'));
 s.compareAndSet(scope,'q',null,{answer:null});
 assert.throws(()=>s.compareAndSet(scope,'q',null,{}),{code:'CONFLICT'});
 assert.throws(()=>s.transaction(()=>{s.compareAndSet(scope,'q',1,{answer:'yes'});s.transaction(()=>{throw Error('rollback')})}));
 assert.equal(s.read(scope,'q').version,1);assert.equal(s.read(scope,'q').value.answer,null);
 assert.throws(()=>s.transaction(async()=>{}),{code:'INVALID'});
 assert.equal(s.read({...scope,sessionId:'other'},'q'),null);
 s.compareAndSet(scope,'q',1,{answer:'yes'});assert.equal(s.read(scope,'q').version,2);
});
