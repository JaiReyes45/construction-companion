import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {temporaryDirectory} from './helpers.mjs';
import {registerCodexPackage,disableCodexPackage} from '../src/host/codex-install.mjs';
import {planInstall,applyInstall,uninstall} from '../src/install.mjs';

async function fixture(t,conflicts){
 const root=temporaryDirectory(t),file=path.join(root,'native-state.json'),script=path.join(root,'app-server.mjs');
 await writeFile(file,JSON.stringify({version:1,conflicts,plugins:{'unrelated@market':{enabled:true}}}));
 await writeFile(script,`import {readFileSync,writeFileSync} from 'node:fs';import {createInterface} from 'node:readline';
 const file=process.env.CC_TEST_STATE;const lines=createInterface({input:process.stdin});
 lines.on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;const state=JSON.parse(readFileSync(file,'utf8'));let result={};
 if(m.method==='config/read')result={layers:[{name:{type:'user',file},version:String(state.version),config:{plugins:state.plugins}}]};
 if(m.method==='plugin/install'){state.plugins[process.env.CC_TEST_SELECTOR]={enabled:true};state.version++;}
 if(m.method==='config/batchWrite'){
  if(state.conflicts>0){state.conflicts--;state.version++;writeFileSync(file,JSON.stringify(state));console.log(JSON.stringify({id:m.id,error:{message:'version mismatch'}}));return;}
  if(m.params.expectedVersion!==String(state.version))throw Error('Stale write');
  Object.assign(state.plugins,m.params.edits[0].value);state.version++;
 }
 writeFileSync(file,JSON.stringify(state));console.log(JSON.stringify({id:m.id,result}));});`);
 const projectRoot=path.join(root,'project'),packageRoot=path.join(root,'package');await mkdir(projectRoot);await mkdir(packageRoot);
 const plan=await planInstall({host:'codex',projectRoot,packageRoot,receiptRoot:path.join(root,'private')});
 const options={env:{...process.env,CC_TEST_STATE:file,CC_TEST_SELECTOR:plan.selector},spawnProcess:(_exe,_args,opt)=>spawn(process.execPath,[script],opt)};
 return {file,plan,options,state:async()=>JSON.parse(await readFile(file,'utf8'))};
}
test('native registration retries a concurrent config version conflict and preserves other plugins',async t=>{
 const f=await fixture(t,1);const result=await registerCodexPackage(f.plan,f.options);
 assert.equal(result.userWideEnabled,false);const state=await f.state();assert.equal(state.plugins[f.plan.selector].enabled,false);assert.equal(state.plugins['unrelated@market'].enabled,true);
});
test('unfinished native activation is journaled and uninstall retains recovery until disable is verified',async t=>{
 const f=await fixture(t,99),receiptFile=path.join(f.plan.receiptRoot,'install-codex.json');
 await assert.rejects(()=>applyInstall(f.plan,{registerCodex:(plan,options)=>registerCodexPackage(plan,{...f.options,...options})}),/disable|unverified|version/i);
 const receipt=JSON.parse(await readFile(receiptFile,'utf8'));assert.equal(receipt.nativeRegistration.status,'pending');assert.equal((await f.state()).plugins[f.plan.selector].enabled,true);
 const failed=await uninstall({receipt,disableCodex:plan=>disableCodexPackage(plan,f.options)});assert.ok(failed.conflicts.some(text=>text.includes(f.plan.selector)));await access(receiptFile);
 const state=await f.state();state.conflicts=0;await writeFile(f.file,JSON.stringify(state));
 const recovered=await uninstall({receipt,disableCodex:plan=>disableCodexPackage(plan,f.options)});assert.deepEqual(recovered.conflicts,[]);assert.equal((await f.state()).plugins[f.plan.selector].enabled,false);await assert.rejects(()=>access(receiptFile),{code:'ENOENT'});
});
