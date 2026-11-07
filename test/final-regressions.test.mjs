import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,symlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {temporaryDirectory,scope,event} from './helpers.mjs';
import {openStore} from '../src/core/store.mjs';
import {createService} from '../src/core/service.mjs';
import {dispatchRpc} from '../src/host/rpc.mjs';
import {signContext} from '../src/host/context.mjs';
import {planInstall,applyInstall} from '../src/install.mjs';
import {projectScene} from '../public/projection.mjs';
test('session end invalidates native RPC and pending browser answers',async()=>{
 const secret='s'.repeat(64),service=createService({store:openStore(':memory:')});
 try{
  service.ingest(event({type:'turn.start',turnId:'t',taskId:undefined,payload:{}}));const key=service.registerSession(scope);
  const pending=service.ask({...scope,turnId:'t',requestId:'r',id:'q',text:'Question?',options:[{id:'a',label:'A'}],allowFreeText:false,expiresAt:new Date(Date.now()+45000).toISOString()},{});
  service.ingest(event({type:'session.end',eventId:'ended',taskId:undefined,payload:{}}));
  assert.equal(service.question(key).status,'cancelled');assert.equal((await pending).status,'cancelled');
  assert.equal(service.store.read(scope,'active-turn').value.active,false);assert.equal(service.sessions()[0].status,'ended');
  assert.throws(()=>service.answer(key,{id:'q',version:1,answer:{optionId:'a'}}),{code:'CONFLICT'});
  const context=signContext({scope,turnId:'t',expiresAt:Date.now()+50000},secret);
  await assert.rejects(()=>dispatchRpc({service,contextSecret:secret,capability:{questionMode:'native-chat'},data:{method:'memory_status',context,requestId:'new',input:{}}}),{code:'CONFLICT'});
 }finally{service.close();}
});
test('invalid and legacy poisoned memory items cannot block valid writes',async t=>{
 const service=createService({store:openStore(':memory:'),memoryRoot:temporaryDirectory(t)}),key=service.registerSession(scope);
 try{await service.setMemoryConsent(key,{enabled:true});
  await assert.rejects(()=>service.memoryWrite(key,{page:'unknown-page',operationId:'bad',expectedHash:null,content:'bad'}));
  assert.equal(service.store.scan('memory-outbox:').length,0);
  service.store.compareAndSet(scope,'memory-outbox:legacy',null,{status:'pending',write:{page:'unknown-page',operationId:'legacy',expectedHash:null,content:'bad'}});
  const result=await service.memoryWrite(key,{page:'decisions',operationId:'good',expectedHash:null,content:'Approved'});
  assert.equal(result.written,1);assert.equal(service.memoryStatus(key).failed,1);assert.ok((await service.memoryContext(key,{pages:['decisions']})).text.includes('Approved'));
 }finally{service.close();}
});
test('permission waits end on correlated work or session end without claiming approval',()=>{
 const events=[event({type:'permission.wait',turnId:'t'}),event({type:'task.verify',turnId:'t'}),event({type:'turn.end',turnId:'t',payload:{}})].map((e,i)=>({...e,cursor:i+1}));
 const scene=projectScene(events);assert.notEqual(scene.permissions['task-a'].status,'waiting');assert.notEqual(scene.tasks['task-a'].status,'completed');
 const ended=projectScene([{...events[0],taskId:undefined},{...event({type:'session.end',payload:{}}),cursor:2}]);assert.notEqual(ended.permissions['native-permission'].status,'waiting');
});
test('setup preserves edits made during native installation',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),packageRoot=path.join(root,'package');await mkdir(projectRoot);await mkdir(packageRoot);
 const ignore=path.join(projectRoot,'.gitignore');await writeFile(ignore,'original\n');
 const plan=await planInstall({host:'claude',projectRoot,packageRoot,receiptRoot:path.join(root,'private')});
 let changed=false;const run=async()=>{if(!changed){changed=true;await writeFile(ignore,'original\nimportant-new-user-ignore\n')}return {stdout:''}};
 await assert.rejects(()=>applyInstall(plan,{run}),/changed/i);assert.equal(await readFile(ignore,'utf8'),'original\nimportant-new-user-ignore\n');
});
test('project setup refuses configuration junctions outside the selected project',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),outside=path.join(root,'outside'),packageRoot=path.join(root,'package');await mkdir(projectRoot);await mkdir(outside);await mkdir(packageRoot);
 await symlink(outside,path.join(projectRoot,'.codex'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(()=>planInstall({host:'codex',projectRoot,packageRoot,receiptRoot:path.join(root,'private')}),/path|link|outside/i);
});
test('failed daemon startup exits without inaccessible listener or interval',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),dataRoot=path.join(root,'data');await mkdir(projectRoot);await mkdir(dataRoot);
 await writeFile(path.join(dataRoot,'runtime-lock.json'),JSON.stringify({nonce:'fixture',pid:process.pid}));await writeFile(path.join(dataRoot,'spool'),'not a directory');
 const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/daemon.mjs',import.meta.url)),projectRoot,dataRoot,'fixture'],{stdio:'ignore',windowsHide:true});
 let timer;const exited=new Promise(resolve=>child.once('exit',code=>resolve(code)));
 try{const result=await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(()=>resolve('still-running'),3000)})]);assert.equal(result,1);}
 finally{clearTimeout(timer);if(child.exitCode===null){child.kill();await exited;}}
});
