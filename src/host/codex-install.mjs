import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fail} from '../contracts.mjs';

// Native cache installation and configuration edits are delegated to Codex.
// No thread/model is started and hook trust is never changed here.
export async function registerCodexPackage(plan,{executable='codex',env=process.env}={}){
 const child=spawn(executable,['app-server','--stdio'],{cwd:plan.projectRoot,env,windowsHide:true,stdio:['pipe','pipe','ignore']});
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
  return result.layers?.find(layer=>layer.name?.type==='user');
 };
 try{
  await call('initialize',{clientInfo:{name:'construction-companion-setup',version:'0.2.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  const before=await userLayer();
  if(before?.config?.plugins?.[plan.selector]?.enabled===true)fail('CONFLICT','This companion is already enabled user-wide. Disable it in Codex before project-only setup.');
  let attempted=false;
  try{
   attempted=true;
   await call('plugin/install',{pluginName:'construction-companion',marketplacePath:plan.paths.market});
  }finally{
   if(attempted){
    // Codex currently enables packages user-wide on install. End that activation
    // before the project block is written; leave native hook trust untouched.
    const current=await userLayer();
    await call('config/batchWrite',{edits:[{keyPath:'plugins',value:{[plan.selector]:{enabled:false}},mergeStrategy:'upsert'}],filePath:current?.name?.file??null,expectedVersion:current?.version??null,reloadUserConfig:true});
    const after=await userLayer();
    if(after?.config?.plugins?.[plan.selector]?.enabled!==false)fail('CONFLICT','Confirm this companion is disabled user-wide in Codex before continuing.');
   }
  }
  return {cacheInstalled:true,userWideEnabled:false};
 }finally{
  rejectPending(Error('Codex setup finished.'));child.stdin.end();
  if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{child.kill();resolve()},2000).unref()});
  lines.close();
 }
}
