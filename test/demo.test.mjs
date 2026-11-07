import test from 'node:test';
import assert from 'node:assert/strict';
import {temporaryDirectory} from './helpers.mjs';
import {startDemo} from '../scripts/demo.mjs';
test('demo completes discovery, crew decline and its sample build without a validation crash',async t=>{
 const demo=await startDemo({notebook:temporaryDirectory(t),completeAfterMs:10});
 try{
  const key=demo.service.sessions()[0].sessionKey;
  let q=demo.service.question(key);demo.service.answer(key,{id:q.id,version:q.version,answer:{optionId:'customers'}});
  for(let i=0;i<100;i++){q=demo.service.question(key);if(q.status==='open'&&q.id!=='website-audience')break;await new Promise(r=>setTimeout(r,5));}
  demo.service.answer(key,{id:q.id,version:q.version,answer:{optionId:'decline'}});await demo.finished;
  assert.equal(demo.service.scene(key).tasks['example-build'].status,'completed');assert.equal(demo.service.sessions()[0].demo,true);
 }finally{await demo.close();}
});
