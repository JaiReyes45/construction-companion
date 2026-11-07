import {createHash} from 'node:crypto';
import {canonical,fail,id,scopeKey} from '../contracts.mjs';
import {validateMemoryWrite} from './validate.mjs';
export const memoryScope=s=>({projectId:s.projectId,host:s.host,sessionId:'@project-memory'});
const enabled=(store,scope)=>store.read(memoryScope(scope),'memory-consent')?.value.enabled===true;
export function enqueueMemory({store,scope,write}){
 if(!enabled(store,scope))return {status:'disabled'};
 validateMemoryWrite(write);
 id(write.operationId);const key='memory-outbox:'+createHash('sha256').update(write.operationId).digest('hex');
 const old=store.read(scope,key);if(old){if(canonical(old.value.write)!==canonical(write))fail('CONFLICT','Memory operation ID reused');return {status:old.value.status};}
 store.compareAndSet(scope,key,null,{write,status:'pending'});return {status:'pending'};
}
export async function flushMemory({store,scope,vault}){
 let written=0,conflicts=0;
 const rows=()=>store.scan('memory-outbox:').filter(r=>JSON.stringify(r.scope)===scopeKey(scope));
 for(const row of rows()){
  if(!enabled(store,scope))break;
  if(row.value.status==='conflict'){conflicts++;continue;}
  if(row.value.status!=='pending')continue;
  let result;try{validateMemoryWrite(row.value.write);result=await vault.write(row.value.write);}catch(e){if(e.code==='CONFLICT'){result={status:'conflict',currentHash:null};}else if(['INVALID','LIMIT','NOT_FOUND'].includes(e.code)){
   store.compareAndSet(scope,row.key,row.version,{...row.value,status:'failed',result:{code:e.code,message:'Invalid notebook item; submit a corrected operation.'}});conflicts++;continue;
  }else throw e;}
  if(result.status==='disabled')break;
  store.compareAndSet(scope,row.key,row.version,{...row.value,status:result.status==='written'?'written':'conflict',result});
  if(result.status==='written')written++;else conflicts++;
 }
 return {written,conflicts,pending:rows().filter(r=>r.value.status!=='written').length};
}
