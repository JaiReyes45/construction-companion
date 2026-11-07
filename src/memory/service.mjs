import path from 'node:path';
import {createHash} from 'node:crypto';
import {exact,fail,scopeKey} from '../contracts.mjs';
import {openVault} from './vault.mjs';
import {selectContext} from './context.mjs';
import {memoryScope,enqueueMemory,flushMemory} from './outbox.mjs';
import {begin,end} from './templates.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function attachMemory(service){
 const cache=new Map(),{store}=service;
 const consent=s=>store.read(memoryScope(s),'memory-consent')?.value??{enabled:false};
 async function vaultFor(scope){
  const config=consent(scope);if(!config.enabled)fail('MEMORY_DISABLED','Project memory is disabled');
  const root=config.root??service.memoryRoot;if(!root)fail('UNSUPPORTED','No project memory folder configured');
  const key=scopeKey(memoryScope(scope));let vault=cache.get(key);
  if(!vault){vault=await openVault({root,projectId:scope.projectId,captureEnabled:true});cache.set(key,vault);}return vault;
 }
 service.memoryStatus=key=>{
  const scope=service.resolveSession(key),rows=store.scan('memory-outbox:').filter(r=>JSON.stringify(r.scope)===scopeKey(scope));
  const failed=rows.filter(r=>r.value.status==='failed').length;
  return {enabled:consent(scope).enabled,conflicts:rows.filter(r=>r.value.status==='conflict').length+failed,failed};
 };
 service.setMemoryConsent=async(key,input)=>{
  exact(input,['enabled','selectedRoot']);if(typeof input.enabled!=='boolean')fail('INVALID');
  const scope=service.resolveSession(key),s=memoryScope(scope),old=store.read(s,'memory-consent');
  let root=old?.value.root??service.memoryRoot;
  if(input.selectedRoot!==undefined){if(typeof input.selectedRoot!=='string'||!path.isAbsolute(input.selectedRoot))fail('INVALID','Select an absolute vault folder');root=path.join(input.selectedRoot,'Construction Companion',hash(scope.projectId));}
  const ck=scopeKey(s);cache.get(ck)?.setCapture(false);cache.delete(ck);
  store.compareAndSet(s,'memory-consent',old?.version??null,{enabled:input.enabled,...(root?{root}:{})});
  return service.memoryStatus(key);
 };
 service.memoryContext=async(key,input)=>{
  exact(input,['pages']);const scope=service.resolveSession(key);return selectContext({vault:await vaultFor(scope),pages:input.pages});
 };
 service.memoryWrite=async(key,write)=>{
  const scope=service.resolveSession(key),vault=await vaultFor(scope);
  enqueueMemory({store,scope,write});return flushMemory({store,scope,vault});
 };
 service.captureSkillDecision=async(scope,choice,skills,operationId)=>{
  if(!consent(scope).enabled)return {status:'disabled'};
  const vault=await vaultFor(scope),skill=skills.find(s=>s.id===choice.skillId);
  const summary='- '+choice.role+' for '+choice.taskId+': '+(skill?skill.name+' ('+skill.source+' @ '+skill.revision+')':choice.action)+(choice.reason?' — '+choice.reason:'')+'.';
  let old=null;try{old=await vault.read('decisions')}catch(e){if(e.code!=='NOT_FOUND')throw e;}
  const existing=old?old.content.split(begin)[1].split(end)[0].replace(/<!-- companion:operation [a-f0-9]+ -->\n?/g,'').trim():'';
  const write={page:'decisions',expectedHash:old?.hash??null,operationId,content:(existing?existing+'\n':'')+summary};
  enqueueMemory({store,scope,write});return flushMemory({store,scope,vault});
 };
 return service;
}
