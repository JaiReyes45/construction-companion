import {mkdir,realpath,readFile,writeFile,rename,unlink,chmod,stat} from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {resolvePrivatePaths} from './private-paths.mjs';
import {fail} from './contracts.mjs';
const execute=promisify(execFile),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const file=(paths,name)=>path.join(paths.dataRoot,name);
export async function projectIdentity(projectRoot){const root=await realpath(projectRoot);return {root,id:createHash('sha256').update(process.platform==='win32'?root.toLowerCase():root).digest('hex')};}
export async function privatePaths(projectRoot){const {root}=await projectIdentity(projectRoot);return resolvePrivatePaths({projectRoot:root});}
async function json(filename){try{return JSON.parse(await readFile(filename,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function writePrivateJson(filename,value){const tmp=filename+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});try{await rename(tmp,filename)}finally{await unlink(tmp).catch(()=>{})}}
export async function secureDirectory(directory){
 await mkdir(directory,{recursive:true,mode:0o700});
 if(process.platform!=='win32'){await chmod(directory,0o700);return;}
 const {stdout}=await execute('whoami.exe',['/user','/fo','csv','/nh'],{windowsHide:true,timeout:5000});
 const sid=stdout.match(/S-1-5-[0-9-]+/)?.[0];if(!sid)fail('FORBIDDEN','Cannot determine private storage owner');
 await execute('icacls.exe',[directory,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'],{windowsHide:true,timeout:5000});
}
export async function readLaunch(paths){return json(file(paths,'launch.json'));}
async function control(launch,action){
 if(!launch||!/^http:\/\/127\.0\.0\.1:\d+$/.test(launch.origin)||typeof launch.tokens?.ingest!=='string')return null;
 try{const r=await fetch(launch.origin+'/host/control',{method:'POST',headers:{authorization:'Bearer '+launch.tokens.ingest},body:JSON.stringify({action,instance:launch.instance}),signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null}catch{return null;}
}
export async function probeProject({projectRoot,paths}){
 paths??=await privatePaths(projectRoot);const launch=await readLaunch(paths),identity=await projectIdentity(projectRoot);
 if(launch?.projectId!==identity.id)return {status:'stopped'};
 const live=await control(launch,'status');return live?.instance===launch.instance?{status:'running',origin:launch.origin,instance:live.instance}:{status:'stopped'};
}
function alive(pid){if(!Number.isSafeInteger(pid)||pid<1)return true;try{process.kill(pid,0);return true}catch(e){return e.code!=='ESRCH'}}
async function removeOwned(paths,name,nonce){const filename=file(paths,name),value=await json(filename);if(value?.nonce===nonce||value?.instance===nonce)await unlink(filename).catch(e=>{if(e.code!=='ENOENT')throw e;});}
export async function startProject({projectRoot,paths,waitMs=15000}){
 const identity=await projectIdentity(projectRoot);paths??=await privatePaths(identity.root);await secureDirectory(paths.dataRoot);
 const lock=file(paths,'runtime-lock.json'),nonce=randomUUID(),deadline=Date.now()+waitMs;
 while(Date.now()<deadline){
  const live=await probeProject({projectRoot:identity.root,paths});if(live.status==='running')return {origin:live.origin,alreadyRunning:true};
  try{await writeFile(lock,JSON.stringify({pid:process.pid,nonce,projectId:identity.id}),{flag:'wx',mode:0o600});break;}
  catch(e){if(e.code!=='EEXIST')throw e;const owner=await json(lock);
   // Never signal a PID read from disk. A dead owner can be removed; an ambiguous/live owner requires review.
   if(owner&&!alive(owner.pid)){await removeOwned(paths,'runtime-lock.json',owner.nonce);continue;}
   if(Date.now()+100>=deadline)fail('CONFLICT','Project is starting or its lock owner needs review; no process was killed');await pause(100);
  }
 }
 const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/daemon.mjs',import.meta.url)),identity.root,paths.dataRoot,nonce],{cwd:identity.root,detached:true,stdio:'ignore',windowsHide:true});
 let spawnError;child.on('error',e=>{spawnError=e});child.unref();
 while(Date.now()<deadline){
  if(spawnError)break;const live=await probeProject({projectRoot:identity.root,paths});if(live.status==='running')return {origin:live.origin,alreadyRunning:false};
  const error=await json(file(paths,'startup-error.json'));if(error?.instance===nonce){await removeOwned(paths,'runtime-lock.json',nonce);fail('INVALID',error.message);}
  await pause(100);
 }
 await removeOwned(paths,'runtime-lock.json',nonce);fail('CONFLICT','Local runner did not start; run doctor for prerequisites and storage access');
}
export async function stopProject({projectRoot,paths}){
 paths??=await privatePaths(projectRoot);const launch=await readLaunch(paths),identity=await projectIdentity(projectRoot);if(launch?.projectId!==identity.id)return;
 const result=await control(launch,'stop');if(!result)return;
 const deadline=Date.now()+5000;while(Date.now()<deadline){if(!(await control(launch,'status')))return;await pause(100)}
 fail('CONFLICT','Local runner has not stopped; no process was force-killed');
}
export async function runDaemon({projectRoot,paths,instance}){
 const identity=await projectIdentity(projectRoot),lock=await json(file(paths,'runtime-lock.json'));if(lock?.nonce!==instance)fail('CONFLICT','Startup ownership changed');
 await writePrivateJson(file(paths,'runtime-lock.json'),{...lock,pid:process.pid});
 const [{openStore},{createService},{startServer},{drainSpool}]=await Promise.all([import('./core/store.mjs'),import('./core/service.mjs'),import('./server.mjs'),import('./host/spool.mjs')]);
 const tokens={ui:randomBytes(32).toString('hex'),ingest:randomBytes(32).toString('hex')},contextSecret=randomBytes(32).toString('hex');
 const config=await json(file(paths,'project.json'))??{};
 const service=createService({store:openStore(file(paths,'events.sqlite')),memoryRoot:paths.memoryRoot??file(paths,'memory'),contextSecret,skillRoots:config.skillRoots??[],capability:{questionMode:'native-chat'}});
 let stopping=false,draining=false,timer;
 const server=await startServer({service,tokens,control:async data=>{
  if(data.instance!==instance)fail('FORBIDDEN');if(data.action==='status')return {instance};if(data.action!=='stop')fail('INVALID');
  setTimeout(()=>shutdown(),25);return {stopping:true};
 }});
 async function shutdown(){if(stopping)return;stopping=true;clearInterval(timer);await server.close();service.close();await removeOwned(paths,'launch.json',instance);await removeOwned(paths,'runtime-lock.json',instance);}
 const drain=async()=>{if(draining||stopping)return;draining=true;try{await drainSpool({directory:file(paths,'spool'),send:e=>{if(e.projectId!==identity.id)fail('FORBIDDEN');return service.ingest(e)}})}finally{draining=false;}};
 timer=setInterval(()=>drain().catch(()=>{}),150);await drain();
 await writePrivateJson(file(paths,'launch.json'),{origin:server.origin,tokens,contextSecret,instance,projectId:identity.id,projectRoot:identity.root,pid:process.pid,capability:{questionMode:'native-chat'}});
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 return {shutdown};
}
