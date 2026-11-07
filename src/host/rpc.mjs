import {randomUUID} from 'node:crypto';
import {verifyContext} from './context.mjs';
import {exact,fail,id} from '../contracts.mjs';
export async function dispatchRpc({service,contextSecret,capability,data,signal}){
 exact(data,['method','input','context','requestId']);
 if(!contextSecret)fail('UNSUPPORTED','No native context verifier configured');
 const verified=verifyContext(data.context,contextSecret,service.now());
 const origin={...verified.scope,turnId:verified.turnId,requestId:id(data.requestId)};
 const active=service.store.read(origin,'active-turn');
 if(!active?.value.active||active.value.turnId!==origin.turnId)fail('CONFLICT','Native turn is not active');
 const input=data.input;
 if(data.method==='skill_context'){exact(input,['goal','role']);return {skills:await service.skillContext(service.registerSession(origin),input)};}
 if(data.method==='choose_skill'){
  exact(input,['taskId','role','candidates']);
  if(capability.questionMode==='native-chat')return {status:'fallback',reason:'unsupported'};
  return service.offerSkills(origin,input,{signal,timeoutMs:capability.questionMode==='verified-long'?600000:45000});
 }
 if(data.method==='reopen_skill'){exact(input,['taskId','role']);service.choices.reopen(origin,input);return {status:'reopened'};}
 if(data.method==='ask'){
  exact(input,['id','text','options','allowFreeText','timeoutMs']);
  if(capability.questionMode==='native-chat')return {status:'fallback',reason:'unsupported'};
  const timeoutMs=capability.questionMode==='verified-long'?600000:45000;
  const {timeoutMs:ignored,...question}=input;
  return service.ask({...origin,...question,expiresAt:new Date(service.now()+timeoutMs).toISOString()},{signal,timeoutMs});
 }
 if(data.method==='report'){
  exact(input,['event']);exact(input.event,['type','taskId','skillId','payload']);
  if(!['task.start','task.verify','task.complete','task.fail','skill.declare'].includes(input.event.type))fail('INVALID');
  return service.ingest({...verified.scope,turnId:origin.turnId,schema:1,eventId:randomUUID(),sequence:service.now(),occurredAt:new Date(service.now()).toISOString(),adapterVersion:'0.1.0',runtimeVersion:process.versions.node,...input.event,evidence:'declared'});
 }
 if(service.domainRpc)return service.domainRpc(data.method,input,origin,{signal});
 fail('NOT_FOUND','Unknown companion method');
}
