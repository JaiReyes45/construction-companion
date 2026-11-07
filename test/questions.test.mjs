import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../src/core/store.mjs';
import {createQuestionBroker} from '../src/questions.mjs';
import {scope} from './helpers.mjs';
function fixture(t){const store=openStore(':memory:');const broker=createQuestionBroker({store});t.after(()=>{broker.close();store.close()});const q={...scope,turnId:'t',requestId:'r',id:'q',text:'Audience?',options:[{id:'a',label:'Customers'}],allowFreeText:true,expiresAt:new Date(Date.now()+45000).toISOString()};return {store,broker,q,reply:{...scope,turnId:'t',requestId:'r',id:'q',version:1,answer:{optionId:'a'}}};}
test('answer resolves once; wrong origin, invalid option and duplicate reject',async t=>{
 const {broker,q,reply}=fixture(t),pending=broker.ask(q,{timeoutMs:45000});
 for(const bad of [{sessionId:'other'},{turnId:'other'},{requestId:'other'},{projectId:'other'},{version:0},{answer:{optionId:'missing'}},{answer:{text:'x'.repeat(16385)}}]) assert.throws(()=>broker.reply({...reply,...bad}));
 assert.throws(()=>broker.ask({...q,id:'second'},{}),{code:'CONFLICT'});
 broker.reply(reply);assert.equal((await pending).status,'answered');assert.throws(()=>broker.reply(reply),{code:'CONFLICT'});
});
test('timeout, interrupt and disconnect never fabricate an answer',async t=>{
 const {broker,q,reply}=fixture(t);
 assert.deepEqual(await broker.ask(q,{timeoutMs:5}),{status:'fallback',reason:'timeout'});
 assert.throws(()=>broker.reply(reply),{code:'CONFLICT'});
 const abort=new AbortController(),p=broker.ask({...q,id:'two'},{signal:abort.signal});abort.abort();assert.equal((await p).status,'cancelled');
 const p2=broker.ask({...q,id:'three'},{});broker.disconnect(q);assert.deepEqual(await p2,{status:'fallback',reason:'disconnected'});
 assert.equal(broker.get(scope).answer,undefined);
});
test('separate sessions and versioned replacement keep answers isolated',async t=>{
 const {broker,q,reply}=fixture(t);const a=broker.ask(q,{}),b=broker.ask({...q,sessionId:'b'},{});
 broker.reply({...reply,sessionId:'b'});assert.equal((await b).question.sessionId,'b');
 broker.cancel(q);assert.equal((await a).status,'cancelled');
 const c=broker.ask(q,{});assert.equal(broker.get(scope).version,2);
 assert.throws(()=>broker.reply(reply),{code:'CONFLICT'});broker.reply({...reply,version:2});assert.equal((await c).status,'answered');
});
test('recovery cancels durable open questions; failed creation rolls back active pointer',t=>{
 const {store,broker,q}=fixture(t);
 store.compareAndSet(scope,'question:fixture',null,{...q,status:'open',version:1});
 broker.recover();assert.equal(store.read(scope,'question:fixture').value.status,'cancelled');
 assert.throws(()=>broker.ask({...q,options:Array.from({length:7},(_,i)=>({id:String(i),label:'x'}))},{}));
 assert.equal(broker.get(scope),null);
});
