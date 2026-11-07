import {createHash,randomUUID} from 'node:crypto';
import {fail,id,scopeKey,exact} from '../contracts.mjs';
const key=({taskId,role})=>'choice:'+createHash('sha256').update(JSON.stringify([id(taskId),id(role)])).digest('hex');
export function createSkillChoices({store,broker,inventory,now=Date.now}){
 const choices={
  async offer(origin,input,options={}){
   const {taskId,role,candidates}=input;id(taskId);id(role);
   const old=store.read(origin,key(input));if(old?.value.declined)return {status:'chosen',choice:{taskId,role,action:'decline'}};
   if(!Array.isArray(candidates)||candidates.length<1||candidates.length>3)fail('INVALID','Choose one to three candidates');
   const skills=await inventory(),ids=new Set();
   const proposed=candidates.map(c=>{
    exact(c,['taskId','role','skillId','reason']);
    if(c.taskId!==taskId||c.role!==role||typeof c.reason!=='string'||!c.reason.trim()||c.reason.length>2000||ids.has(c.skillId))fail('INVALID','Invalid recommendation');
    ids.add(c.skillId);const skill=skills.find(s=>s.id===c.skillId);
    if(!skill||skill.availability==='unavailable')fail('INVALID','Skill unavailable');return {...structuredClone(skill),reason:c.reason};
   });
   const questionId=randomUUID();
   const pointer=store.read(origin,'skill-recommendations');
   store.compareAndSet(origin,'skill-recommendations',pointer?.version??null,{questionId,taskId,role,candidates:proposed});
   const result=await broker.ask({...origin,id:questionId,text:'Choose a skill for your '+role+'.',options:[...proposed.map(s=>({id:'skill:'+s.id,label:s.name+' — '+(s.availability==='installed'?'Use installed':'Review installation')})),{id:'choose-another',label:'Choose another skill'},{id:'decline',label:'Continue without'}],allowFreeText:false,expiresAt:new Date(now()+(options.timeoutMs??45000)).toISOString()},options);
   if(result.status!=='answered')return result;
   const selected=result.question.answer.optionId;
   if(['decline','choose-another'].includes(selected)){
    if(selected==='decline'){const current=store.read(origin,key(input));store.compareAndSet(origin,key(input),current?.version??null,{taskId,role,declined:true});}
    return {status:'chosen',choice:{taskId,role,action:selected}};
   }
   const skill=proposed.find(s=>'skill:'+s.id===selected);
   if(skill.availability!=='installed'||skill.reloadRequired)return {status:'chosen',choice:{taskId,role,skillId:skill.id,action:'request-install'}};
   const fresh=(await inventory()).find(s=>s.id===skill.id);
   if(fresh?.availability!=='installed'||fresh.revision!==skill.revision||fresh.reloadRequired)fail('CONFLICT','Skill changed; review a fresh choice');
   const current=store.read(origin,key(input));
   store.compareAndSet(origin,key(input),current?.version??null,{taskId,role,declined:false,binding:{taskId,role,skillId:skill.id,revision:skill.revision,state:'selected'}});
   return {status:'chosen',choice:{taskId,role,skillId:skill.id,action:'use',reason:skill.reason}};
  },
  reopen(scope,input){const k=key(input),old=store.read(scope,k);if(old)store.compareAndSet(scope,k,old.version,{...old.value,declined:false});},
  bindings(scope,taskId){return store.scan('choice:').filter(r=>JSON.stringify(r.scope)===scopeKey(scope)&&(taskId===undefined||r.value.taskId===taskId)&&r.value.binding).map(r=>r.value.binding);},
  recommendations(scope){return store.read(scope,'skill-recommendations')?.value??null;}
 };return choices;
}
