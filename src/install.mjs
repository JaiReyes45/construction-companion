import {readFile,writeFile,mkdir,cp,access,unlink,lstat,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privatePaths,projectIdentity,secureDirectory,writePrivateJson} from './lifecycle.mjs';
import {fail} from './contracts.mjs';
import {registerCodexPackage,disableCodexPackage} from './host/codex-install.mjs';
const execute=promisify(execFile),digest=value=>createHash('sha256').update(value??'').digest('hex');
async function read(file){try{return await readFile(file,'utf8')}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function exists(file){try{await access(file);return true}catch{return false}}
export async function bindCodexMcp(packageStorage){
 const filename=path.join(packageStorage,'mcp.json'),text=await read(filename);if(text===null)return;
 const config=JSON.parse(text),server=config.mcpServers?.['construction-companion'];if(!server)fail('INVALID','Codex package has no companion MCP entry');
 // The legacy Codex loader resolves cwd but does not expand PLUGIN_ROOT in args.
 // Bind the retained project copy; keep the host session cwd for project identity.
 server.command=process.execPath;server.args=[path.join(packageStorage,'bin/mcp.mjs'),'--host','codex'];delete server.cwd;
 await writeFile(filename,JSON.stringify(config,null,2)+'\n');
}
const begin='# BEGIN construction-companion\n',end='# END construction-companion\n';
async function assertProjectPath(root,target){
 const relative=path.relative(root,target);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))fail('INVALID','Setup path is outside the project');
 let current=root;for(const part of relative.split(path.sep)){if(!part)continue;current=path.join(current,part);try{if((await lstat(current)).isSymbolicLink())fail('INVALID','Setup path uses a symbolic link or junction')}catch(e){if(e.code==='ENOENT')break;throw e;}}
}
export async function planInstall({host,projectRoot,packageRoot,receiptRoot}){
 if(!['codex','claude'].includes(host))fail('INVALID','Choose codex or claude');
 const identity=await projectIdentity(projectRoot);projectRoot=identity.root;receiptRoot??=(await privatePaths(projectRoot)).dataRoot;
 const packageStorage=path.join(projectRoot,'.construction-companion',host),marketName='construction-companion-'+identity.id.slice(0,12);
 // A dedicated marketplace keeps native cache identity project-specific even
 // when repositories already share an organization marketplace name.
 const paths={...(host==='codex'?{config:path.join(projectRoot,'.codex/config.toml'),market:path.join(packageStorage,'.agents/plugins/marketplace.json')}:{}),ignore:path.join(projectRoot,'.gitignore')};
 for(const target of [...Object.values(paths),packageStorage])await assertProjectPath(projectRoot,target);
 const before=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,file])=>[key,await read(file)])));
 let market=before.market?JSON.parse(before.market):{name:marketName,plugins:[]};
 if(!Array.isArray(market.plugins)||typeof market.name!=='string')fail('INVALID','Invalid existing project marketplace');
 if(host==='codex'&&(market.plugins.some(p=>p.name==='construction-companion')||before.config?.includes('construction-companion@'))||await exists(packageStorage))fail('CONFLICT','Companion already exists; remove or review it before replacing');
 const selector='construction-companion@'+market.name;
 const entry={name:'construction-companion',source:{source:'local',path:'.'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Developer Tools'};
 const block=begin+'[plugins.'+JSON.stringify(selector)+']\nenabled = true\n'+end;
 const ignoreBlock=begin.replace('companion','companion '+host)+'/.construction-companion/\n'+end.replace('companion','companion '+host);
 const commands=host==='claude'?[{command:'claude',args:['plugin','marketplace','add',packageStorage]},{command:'claude',args:['plugin','install','construction-companion@'+marketName,'--scope','local']}]:[];
 return {host,projectRoot,projectId:identity.id,packageRoot:path.resolve(packageRoot),packageStorage,receiptRoot,activationScope:host==='claude'?'local':'project',marketName,selector,paths,before,hashes:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,digest(v)])),market,entry,block,ignoreBlock,commands,notice:host==='codex'?'Registers a native cache package and one disabled user-wide entry; enables only this project. Review project trust and native hooks, restart Codex, and run doctor for supported versions.':'Review native hooks and restart Claude. Native Claude question delivery is unverified; fallback stays in host chat.'};
}
export async function applyInstall(plan,{run=execute,registerCodex=registerCodexPackage}={}){
 for(const [key,file]of Object.entries(plan.paths)){await assertProjectPath(plan.projectRoot,file);if(digest(await read(file))!==plan.hashes[key])fail('CONFLICT','Project settings changed since preview');}
 await assertProjectPath(plan.projectRoot,plan.packageStorage);
 if(await exists(plan.packageStorage))fail('CONFLICT','Package destination already exists');
 await secureDirectory(plan.receiptRoot);
 const receiptFile=path.join(plan.receiptRoot,'install-'+plan.host+'.json');if(await exists(receiptFile))fail('CONFLICT','An existing install receipt needs review');
 const receipt={...plan,status:'applying',owned:[]};await writePrivateJson(receiptFile,receipt);
 await mkdir(path.dirname(plan.packageStorage),{recursive:true});await cp(plan.packageRoot,plan.packageStorage,{recursive:true,dereference:true,errorOnExist:true,force:false});
 if(plan.host==='codex')await bindCodexMcp(plan.packageStorage);
 async function saveFile(kind,text){
  const file=plan.paths[kind];await assertProjectPath(plan.projectRoot,file);
  if(digest(await read(file))!==plan.hashes[kind])fail('CONFLICT','Project settings changed during installation; edits preserved');
  await mkdir(path.dirname(file),{recursive:true});
  // Preserve prior text and journal ownership before changing the filesystem.
  const owned={kind,beforeHash:plan.hashes[kind],afterHash:digest(text),state:'planned'};receipt.owned.push(owned);await writePrivateJson(receiptFile,receipt);
  const temp=file+'.companion-'+randomUUID()+'.tmp';await writeFile(temp,text,{flag:'wx',mode:0o600});
  try{await assertProjectPath(plan.projectRoot,file);if(digest(await read(file))!==plan.hashes[kind])fail('CONFLICT','Project settings changed during installation; edits preserved');await rename(temp,file);}
  finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  owned.state='written';await writePrivateJson(receiptFile,receipt);
 }
 if(plan.host==='codex'){
  await saveFile('market',JSON.stringify({...plan.market,plugins:[...plan.market.plugins,plan.entry]},null,2)+'\n');
  receipt.nativeRegistration=await registerCodex(plan,{beforeInstall:async()=>{
   receipt.nativeRegistration={status:'pending',selector:plan.selector};await writePrivateJson(receiptFile,receipt);
  }});await writePrivateJson(receiptFile,receipt);
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
export async function uninstall({receipt,run=execute,disableCodex=disableCodexPackage}){
 const {projectRoot,paths,host}=receipt,removed=[],preserved=[],conflicts=[];
 for(const target of Object.values(paths))await assertProjectPath(projectRoot,target);
 // First disable observation for this project even if edited native entries need manual review.
 const projectFile=path.join(receipt.receiptRoot,'project.json'),config=JSON.parse(await read(projectFile)??'{}');
 await writePrivateJson(projectFile,{...config,hosts:(config.hosts??[]).filter(h=>h!==host)});
 if(host==='codex'&&receipt.nativeRegistration){
  try{receipt.nativeRegistration={...receipt.nativeRegistration,...await disableCodex(receipt)};await writePrivateJson(path.join(receipt.receiptRoot,'install-codex.json'),receipt);}
  catch{conflicts.push('Native activation is unverified for '+receipt.selector+'. Retry uninstall to disable this exact user-wide entry; recovery receipt retained.');}
 }else if(host==='codex'&&receipt.status==='applying'&&receipt.owned.some(owned=>owned.kind==='market'&&owned.state==='written')){
  conflicts.push('Legacy incomplete native setup for '+receipt.selector+' needs review in Codex; recovery receipt retained.');
 }
 if(host==='claude'&&receipt.nativeInstalled){try{await run('claude',['plugin','uninstall','construction-companion@'+receipt.marketName,'--scope','local'],{cwd:projectRoot,windowsHide:true,shell:false,timeout:30000});removed.push('local Claude activation')}catch{conflicts.push('Claude removal failed; run its local plugin uninstall command.')}}
 for(const owned of receipt.owned){
  const current=await read(paths[owned.kind]);if(current===null)continue;let next=current;
  if(owned.state==='planned'&&digest(current)===owned.beforeHash)continue;
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
