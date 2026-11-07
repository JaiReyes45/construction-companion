// Explicit native acceptance probe. Uses a temporary CODEX_HOME; never trusts or runs hooks.
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {codexPackage} from '../packaging/codex.mjs';
import {registerCodexPackage,disableCodexPackage} from '../src/host/codex-install.mjs';
import {planInstall,applyInstall,uninstall} from '../src/install.mjs';
const execute=promisify(execFile);
export async function verifyNativeCodex({executable='codex'}={}){
 const root=await mkdtemp(path.join(tmpdir(),'companion native ')),home=path.join(root,'home'),market=path.join(root,'market'),plugin=path.join(market,'construction-companion');
 let child;const pending=new Map();let next=0;
 try{
  await mkdir(home,{recursive:true});
  const versionTag='0.2.0-native-test',files=codexPackage(versionTag).files;
  for(const [name,value] of Object.entries(files)){const dest=path.join(plugin,name);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,JSON.stringify(value));}
  await mkdir(path.join(plugin,'skills'),{recursive:true});
  const env={...process.env,CODEX_HOME:home};
  const run=args=>execute(executable,args,{cwd:root,env,windowsHide:true,timeout:30000,maxBuffer:1048576});
  const version=(await run(['--version'])).stdout.trim(),plans=[],receipts=[];
  const projects=['project A','project B'].map(name=>path.join(root,name));
  await writeFile(path.join(home,'config.toml'),projects.map(project=>'[projects.'+JSON.stringify(process.platform==='win32'?project.toLowerCase():project)+']\ntrust_level = "trusted"\n').join('\n'));
  const original=JSON.stringify({name:'shared-company-market',plugins:[]});
  for(const [index,projectRoot] of projects.entries()){
   await mkdir(path.join(projectRoot,'.agents/plugins'),{recursive:true});
   await writeFile(path.join(projectRoot,'.agents/plugins/marketplace.json'),original);
   const plan=await planInstall({host:'codex',projectRoot,packageRoot:plugin,receiptRoot:path.join(root,'private-'+index)});plans.push(plan);
   receipts.push(await applyInstall(plan,{registerCodex:(plan,options)=>registerCodexPackage(plan,{...options,executable,env})}));
  }
  assert.notEqual(plans[0].selector,plans[1].selector);
  for(const plan of plans){
   const cached=JSON.parse(await readFile(path.join(home,'plugins/cache',plan.marketName,'construction-companion',versionTag,'mcp.json'),'utf8'));
   assert.equal(cached.mcpServers['construction-companion'].args[0],path.join(plan.packageStorage,'bin/mcp.mjs'),'Each native cache must keep its own project executable');
   assert.equal(await readFile(path.join(plan.projectRoot,'.agents/plugins/marketplace.json'),'utf8'),original);
  }
  child=spawn(executable,['app-server','--stdio','--enable','hooks'],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','ignore']});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
  const call=(method,params)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject,timer:setTimeout(()=>{pending.delete(id);reject(Error('Native probe timeout: '+method))},20000)});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
  await call('initialize',{clientInfo:{name:'companion-native-acceptance',version:'1.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  const result=await call('hooks/list',{cwds:[projects[0]]});
  const hooks=result.data.flatMap(x=>x.hooks).filter(h=>h.pluginId===plans[0].selector);
  assert.equal(hooks.length,10,'Native Codex must discover all 10 packaged lifecycle hooks');
  assert.ok(hooks.some(h=>h.eventName==='userPromptSubmit'),'Native discovery must include prompt context injection');
  assert.ok(hooks.every(h=>h.trustStatus==='untrusted'),'Installing the package must not silently trust hooks');
  const outside=await call('hooks/list',{cwds:[tmpdir()]});
  assert.equal(outside.data.flatMap(d=>d.hooks).filter(h=>h.pluginId===plans[0].selector).length,0,'Native registration must not activate this plugin outside its project');
  const removed=await uninstall({receipt:receipts[0],disableCodex:plan=>disableCodexPackage(plan,{executable,env})});assert.deepEqual(removed.conflicts,[]);
  const after=await call('hooks/list',{cwds:projects});
  assert.equal(after.data[0].hooks.filter(h=>h.pluginId===plans[0].selector).length,0);
  assert.equal(after.data[1].hooks.filter(h=>h.pluginId===plans[1].selector).length,10);
  return {kind:'native',host:'codex',version,platform:process.platform,discoveredHooks:hooks.length,trust:'untrusted',outsideProjectHooks:0,independentProjectCaches:2,removalPreservedOtherProject:true,modelRequests:0};
 }finally{
  for(const p of pending.values())clearTimeout(p.timer);
  if(child){child.stdin.end();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{child.kill();resolve()},2000).unref()});}
  await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await verifyNativeCodex(),null,2));
