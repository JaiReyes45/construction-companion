// Explicit native acceptance probe. Uses a temporary CODEX_HOME; never trusts or runs hooks.
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {codexPackage} from '../packaging/codex.mjs';
const execute=promisify(execFile);
export async function verifyNativeCodex({executable='codex'}={}){
 const root=await mkdtemp(path.join(tmpdir(),'companion native ')),home=path.join(root,'home'),market=path.join(root,'market'),plugin=path.join(market,'construction-companion');
 let child;const pending=new Map();let next=0;
 try{
  await mkdir(home,{recursive:true});await mkdir(path.join(market,'.agents/plugins'),{recursive:true});
  const files=codexPackage('0.1.0-native-test').files;
  for(const [name,value] of Object.entries(files)){const dest=path.join(plugin,name);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,JSON.stringify(value));}
  await mkdir(path.join(plugin,'skills'),{recursive:true});
  await writeFile(path.join(market,'.agents/plugins/marketplace.json'),JSON.stringify({name:'companion-native-test',plugins:[{name:'construction-companion',source:{source:'local',path:'./construction-companion'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Developer Tools'}]}));
  const env={...process.env,CODEX_HOME:home};
  const run=args=>execute(executable,args,{cwd:root,env,windowsHide:true,timeout:30000,maxBuffer:1048576});
  const version=(await run(['--version'])).stdout.trim();
  await run(['plugin','marketplace','add',market,'--json']);
  await run(['plugin','add','construction-companion@companion-native-test','--json']);
  child=spawn(executable,['app-server','--stdio','--enable','hooks'],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','ignore']});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
  const call=(method,params)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject,timer:setTimeout(()=>{pending.delete(id);reject(Error('Native probe timeout: '+method))},20000)});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
  await call('initialize',{clientInfo:{name:'companion-native-acceptance',version:'1.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  const result=await call('hooks/list',{cwds:[root]});
  const hooks=result.data.flatMap(x=>x.hooks).filter(h=>h.pluginId==='construction-companion@companion-native-test');
  assert.equal(hooks.length,10,'Native Codex must discover all 10 packaged lifecycle hooks');
  assert.ok(hooks.some(h=>h.eventName==='userPromptSubmit'),'Native discovery must include prompt context injection');
  assert.ok(hooks.every(h=>h.trustStatus==='untrusted'),'Installing the package must not silently trust hooks');
  return {kind:'native',host:'codex',version,platform:process.platform,discoveredHooks:hooks.length,trust:'untrusted',modelRequests:0};
 }finally{
  for(const p of pending.values())clearTimeout(p.timer);
  if(child){child.stdin.end();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{child.kill();resolve()},2000).unref()});}
  await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await verifyNativeCodex(),null,2));
