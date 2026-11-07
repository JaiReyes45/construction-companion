import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fail} from '../contracts.mjs';

// Native cache installation and configuration edits are delegated to Codex.
// No thread/model is started and hook trust is never changed here.
async function withCodex(plan,{executable='codex',env=process.env,spawnProcess=spawn}={},operation){
 const child=spawnProcess(executable,['app-server','--stdio'],{cwd:plan.projectRoot,env,windowsHide:true,stdio:['pipe','pipe','ignore']});
 const pending=new Map();let next=0,closed=false;
 const rejectPending=error=>{closed=true;for(const item of pending.values()){clearTimeout(item.timer);item.reject(error)}pending.clear();};
 child.on('error',()=>rejectPending(Error('Cannot start Codex; check its installation and PATH.')));
 child.on('exit',code=>rejectPending(Error('Codex setup process exited '+code+'. Run codex --version and check its configuration.')));
 child.stdin.on('error',()=>rejectPending(Error('Codex setup connection closed.')));
 const lines=createInterface({input:child.stdout});
 lines.on('line',line=>{
  let data;try{data=JSON.parse(line)}catch{return}
  const item=pending.get(data.id);if(!item)return;
  pending.delete(data.id);clearTimeout(item.timer);
  data.error?item.reject(Error(data.error.message??'Codex setup request failed')):item.resolve(data.result);
 });
 const call=(method,params)=>new Promise((resolve,reject)=>{
  if(closed){reject(Error('Codex setup connection is unavailable.'));return;}
  const id=++next;pending.set(id,{resolve,reject,timer:setTimeout(()=>{pending.delete(id);reject(Error('Codex setup timed out: '+method))},30000)});
  child.stdin.write(JSON.stringify({id,method,params})+'\n');
 });
 const userLayer=async()=>{
  const result=await call('config/read',{cwd:plan.projectRoot,includeLayers:true});
  const layer=result.layers?.find(layer=>layer.name?.type==='user');
  if(!layer?.name?.file||!layer.version)fail('CONFLICT','Cannot identify the native user configuration for safe setup.');
  return layer;
 };
 try{
  await call('initialize',{clientInfo:{name:'construction-companion-setup',version:'0.2.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  return await operation({call,userLayer});
 }finally{
  rejectPending(Error('Codex setup finished.'));child.stdin.end();
  if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{child.kill();resolve()},2000).unref()});
  lines.close();
 }
}

async function ensureDisabled(plan,{call,userLayer}){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const current=await userLayer();
   if(current.config?.plugins?.[plan.selector]?.enabled===false)return {status:'disabled',userWideEnabled:false};
   await call('config/batchWrite',{edits:[{keyPath:'plugins',value:{[plan.selector]:{enabled:false}},mergeStrategy:'upsert'}],filePath:current.name.file,expectedVersion:current.version,reloadUserConfig:true});
   const after=await userLayer();
   if(after.config?.plugins?.[plan.selector]?.enabled===false)return {status:'disabled',userWideEnabled:false};
  }catch{/* A fresh read/version safely retries a concurrent configuration edit. */}
 }
 fail('CONFLICT','Native activation is unverified for '+plan.selector+'. Run companion uninstall for this project to retry disabling it; keep the recovery receipt.');
}
export async function disableCodexPackage(plan,options={}){
 return withCodex(plan,options,client=>ensureDisabled(plan,client));
}
export async function registerCodexPackage(plan,{beforeInstall=async()=>{},...options}={}){
 return withCodex(plan,options,async client=>{
  const before=await client.userLayer();
  if(before.config?.plugins?.[plan.selector]?.enabled===true)fail('CONFLICT','This companion is already enabled user-wide. Disable it in Codex before project-only setup.');
  // Journal before the first native side effect. A crash must leave enough
  // information for uninstall to verify/repair this exact owned selector.
  await beforeInstall();
  try{await client.call('plugin/install',{pluginName:'construction-companion',marketplacePath:plan.paths.market});}
  finally{await ensureDisabled(plan,client);}
  return {status:'disabled',cacheInstalled:true,userWideEnabled:false};
 });
}
