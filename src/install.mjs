import {readFile,writeFile,mkdir,cp,access,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privatePaths,projectIdentity,secureDirectory,writePrivateJson} from './lifecycle.mjs';
import {fail} from './contracts.mjs';
const execute=promisify(execFile),digest=value=>createHash('sha256').update(value??'').digest('hex');
async function read(file){try{return await readFile(file,'utf8')}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function exists(file){try{await access(file);return true}catch{return false}}
const begin='# BEGIN construction-companion\n',end='# END construction-companion\n';
export async function planInstall({host,projectRoot,packageRoot,receiptRoot}){
 if(!['codex','claude'].includes(host))fail('INVALID','Choose codex or claude');
 const identity=await projectIdentity(projectRoot);projectRoot=identity.root;receiptRoot??=(await privatePaths(projectRoot)).dataRoot;
 const packageStorage=path.join(projectRoot,'.construction-companion',host),marketName='construction-companion-'+identity.id.slice(0,12);
 const paths={config:path.join(projectRoot,'.codex/config.toml'),market:path.join(projectRoot,'.agents/plugins/marketplace.json'),ignore:path.join(projectRoot,'.gitignore')};
 const before=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,file])=>[key,await read(file)])));
 let market=before.market?JSON.parse(before.market):{name:marketName,plugins:[]};
 if(!Array.isArray(market.plugins)||typeof market.name!=='string')fail('INVALID','Invalid existing project marketplace');
 if(market.plugins.some(p=>p.name==='construction-companion')||before.config?.includes('construction-companion@')||await exists(packageStorage))fail('CONFLICT','Companion already exists; remove or review it before replacing');
 const selector='construction-companion@'+market.name;
 const entry={name:'construction-companion',source:{source:'local',path:'./.construction-companion/codex'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Developer Tools'};
 const block=begin+'[plugins.'+JSON.stringify(selector)+']\nenabled = true\n'+end;
 const ignoreBlock=begin+'/.construction-companion/\n'+end;
 const commands=host==='claude'?[{command:'claude',args:['plugin','marketplace','add',packageStorage]},{command:'claude',args:['plugin','install','construction-companion@'+marketName,'--scope','local']}]:[];
 return {host,projectRoot,projectId:identity.id,packageRoot:path.resolve(packageRoot),packageStorage,receiptRoot,activationScope:host==='claude'?'local':'project',marketName,selector,paths,before,hashes:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,digest(v)])),market,entry,block,ignoreBlock,commands,notice:'Review native hooks and restart the coding host. Game question delivery is unverified; native-chat fallback is active.'};
}
export async function applyInstall(plan,{run=execute}={}){
 for(const [key,file]of Object.entries(plan.paths))if(digest(await read(file))!==plan.hashes[key])fail('CONFLICT','Project settings changed since preview');
 if(await exists(plan.packageStorage))fail('CONFLICT','Package destination already exists');
 await secureDirectory(plan.receiptRoot);
 const receiptFile=path.join(plan.receiptRoot,'install-'+plan.host+'.json');if(await exists(receiptFile))fail('CONFLICT','An existing install receipt needs review');
 const receipt={...plan,status:'applying',owned:[]};await writePrivateJson(receiptFile,receipt);
 await mkdir(path.dirname(plan.packageStorage),{recursive:true});await cp(plan.packageRoot,plan.packageStorage,{recursive:true,dereference:true,errorOnExist:true,force:false});
 async function saveFile(kind,text){const file=plan.paths[kind];await mkdir(path.dirname(file),{recursive:true});await writeFile(file,text);receipt.owned.push({kind,afterHash:digest(text)});await writePrivateJson(receiptFile,receipt);}
 if(plan.host==='codex'){
  await saveFile('market',JSON.stringify({...plan.market,plugins:[...plan.market.plugins,plan.entry]},null,2)+'\n');
  await saveFile('config',(plan.before.config??'')+(plan.before.config&&!plan.before.config.endsWith('\n')?'\n':'')+plan.block);
 }else{
  await mkdir(path.join(plan.packageStorage,'.claude-plugin'),{recursive:true});
  // A local marketplace with a distinct name; native activation is local to this project.
  await writeFile(path.join(plan.packageStorage,'.claude-plugin/marketplace.json'),JSON.stringify({name:plan.marketName,owner:{name:'Construction Companion contributors'},plugins:[{name:'construction-companion',source:'./'}]}));
  for(const command of plan.commands)await run(command.command,command.args,{cwd:plan.projectRoot,windowsHide:true,shell:false,timeout:30000,maxBuffer:1048576});
  receipt.nativeInstalled=true;await writePrivateJson(receiptFile,receipt);
 }
 await saveFile('ignore',(plan.before.ignore??'')+(plan.before.ignore&&!plan.before.ignore.endsWith('\n')?'\n':'')+plan.ignoreBlock);
 const projectFile=path.join(plan.receiptRoot,'project.json'),old=JSON.parse(await read(projectFile)??'{}');
 await writePrivateJson(projectFile,{...old,projectId:plan.projectId,hosts:[...new Set([...(old.hosts??[]),plan.host])],skillRoots:old.skillRoots??[]});
 receipt.status='installed';await writePrivateJson(receiptFile,receipt);return receipt;
}
export async function uninstall({receipt,run=execute}){
 const {projectRoot,paths,host}=receipt,removed=[],preserved=[],conflicts=[];
 // First disable observation for this project even if edited native entries need manual review.
 const projectFile=path.join(receipt.receiptRoot,'project.json'),config=JSON.parse(await read(projectFile)??'{}');
 await writePrivateJson(projectFile,{...config,hosts:(config.hosts??[]).filter(h=>h!==host)});
 if(host==='claude'&&receipt.nativeInstalled){try{await run('claude',['plugin','uninstall','construction-companion@'+receipt.marketName,'--scope','local'],{cwd:projectRoot,windowsHide:true,shell:false,timeout:30000});removed.push('local Claude activation')}catch{conflicts.push('Claude removal failed; run its local plugin uninstall command.')}}
 for(const owned of receipt.owned){
  const current=await read(paths[owned.kind]);if(current===null)continue;let next=current;
  if(owned.kind==='market'){
   const market=JSON.parse(current),index=market.plugins?.findIndex(p=>p.name==='construction-companion');
   if(index===-1)continue;
   if(index===undefined||JSON.stringify(market.plugins[index])!==JSON.stringify(receipt.entry)){conflicts.push(paths.market);continue;}
   market.plugins.splice(index,1);next=JSON.stringify(market,null,2)+'\n';
   if(digest(current)===owned.afterHash)next=receipt.before.market;
  }else{
   const block=owned.kind==='config'?receipt.block:receipt.ignoreBlock;
   if(!current.includes(block)){conflicts.push(paths[owned.kind]);continue;}
   next=digest(current)===owned.afterHash?receipt.before[owned.kind]:current.replace(block,'');
  }
  if(next===null)await unlink(paths[owned.kind]);else await writeFile(paths[owned.kind],next);removed.push(paths[owned.kind]);
 }
 preserved.push(receipt.packageStorage,'Project code, notes and private event history');
 const receiptFile=path.join(receipt.receiptRoot,'install-'+host+'.json');if(!conflicts.length)await unlink(receiptFile).catch(()=>{});
 return {removed,preserved,conflicts};
}
