import {randomUUID,createHash} from 'node:crypto';
import {scopeKey,fail,validateEvent,exact} from '../contracts.mjs';
import {createQuestionBroker} from '../questions.mjs';
import {dispatchRpc} from '../host/rpc.mjs';
import {readInventory,skillContext} from '../skills/inventory.mjs';
import {createSkillChoices} from '../skills/choices.mjs';
import {visibleInstallation} from '../skills/intents.mjs';
import {attachMemory} from '../memory/service.mjs';
import {emptyScene,applyEvent} from '../../public/projection.mjs';
import {fileURLToPath} from 'node:url';
export function createService({store,now=Date.now,memoryRoot,contextSecret,capability={questionMode:'native-chat'},skillRoots=[],installRecipes={},catalogPath=fileURLToPath(new URL('../../catalog/skills.json',import.meta.url))}){
 const handles=new Map();
 const scenes=new Map();
 const broker=createQuestionBroker({store,now});broker.recover();
 for(const row of store.scan('session'))if(row.key==='session')handles.set(row.value.sessionKey,row.value.scope);
 const service={
  store,now,memoryRoot,broker,installRecipes,
  inventory:()=>readInventory({roots:skillRoots,catalogPath}),
  async skillContext(sessionKey,input){service.resolveSession(sessionKey);return skillContext({skills:await service.inventory(),...input});},
  async offerSkills(origin,input,options){
   const result=await service.choices.offer(origin,input,options);
   if(result.status==='chosen'&&['use','decline'].includes(result.choice.action)){
    try{await service.captureSkillDecision(origin,result.choice,await service.inventory(),'choice-'+createHash('sha256').update(JSON.stringify(origin)).digest('hex'));}
    catch{return {...result,memory:{status:'needs-review'}};}
   }
   return result;
  },
  skillRecommendations(key){return service.choices.recommendations(service.resolveSession(key));},
  bindings(key,taskId){return service.choices.bindings(service.resolveSession(key),taskId);},
  registerSession(s){
   const key=scopeKey(s),scope=JSON.parse(key),clean={projectId:scope[0],host:scope[1],sessionId:scope[2]};
   const old=store.read(clean,'session');if(old)return old.value.sessionKey;
   const sessionKey=randomUUID();store.compareAndSet(clean,'session',null,{sessionKey,scope:clean,status:'active'});handles.set(sessionKey,clean);return sessionKey;
  },
  resolveSession(key){const s=handles.get(key);if(!s)fail('NOT_FOUND','Unknown session');return s;},
  ingest(e){
   validateEvent(e);service.registerSession(e);const result=store.append(e);
   if(!result.duplicate&&e.turnId&&['turn.start','turn.end'].includes(e.type)){
    const old=store.read(e,'active-turn');
    if(e.type==='turn.start'||old?.value.turnId===e.turnId){
     store.compareAndSet(e,'active-turn',old?.version??null,{turnId:e.turnId,active:e.type==='turn.start'});
     const q=broker.get(e);if(q?.status==='open'&&(e.type==='turn.end'||q.turnId!==e.turnId))broker.cancel(q);
    }
   }
   return result;
  },
  sessions(){return [...handles].map(([sessionKey,s])=>({sessionKey,host:s.host,status:store.read(s,'session').value.status}));},
  events(key,after=0){return store.list(service.resolveSession(key),{after});},
  scene(key){
   const scope=service.resolveSession(key);let state=scenes.get(key)??emptyScene();
   for(;;){const batch=store.list(scope,{after:state.cursor});if(!batch.length)break;state=batch.reduce(applyEvent,state);}
   scenes.set(key,state);return state;
  },
  ask(input,options){service.registerSession(input);return broker.ask(input,options);},
  question(key){return broker.get(service.resolveSession(key));},
  answer(sessionKey,data){
   exact(data,['id','version','answer']);const scope=service.resolveSession(sessionKey),q=broker.get(scope);
   if(!q)fail('CONFLICT','No question is open');
   return broker.reply({...scope,turnId:q.turnId,requestId:q.requestId,...data});
  },
  cancel(origin){broker.cancel(origin);},
  async handleRoute({route,method,data,url,res}){
   if(route==='/host/rpc'&&method==='POST'){
    const controller=new AbortController(),disconnected=()=>{if(!res.writableEnded)controller.abort('disconnected')};
    res.once('close',disconnected);
    try{return await dispatchRpc({service,contextSecret,capability,data,signal:controller.signal});}
    finally{res.off('close',disconnected);}
   }
   if(route==='/api/question'&&method==='GET')return service.question(url.searchParams.get('sessionKey'));
   if(route==='/api/scene'&&method==='GET')return service.scene(url.searchParams.get('sessionKey'));
   if(route==='/api/skills'&&method==='GET')return service.skillRecommendations(url.searchParams.get('sessionKey'));
   if(route==='/api/installation'&&method==='GET')return visibleInstallation(store,service.resolveSession(url.searchParams.get('sessionKey')));
   if(route==='/api/memory'&&method==='GET')return service.memoryStatus(url.searchParams.get('sessionKey'));
   if(route==='/api/memory/consent'&&method==='POST'){exact(data,['sessionKey','enabled','selectedRoot']);const {sessionKey,...input}=data;return service.setMemoryConsent(sessionKey,input);}
   if(route==='/api/question/answer'&&method==='POST'){exact(data,['sessionKey','id','version','answer']);const {sessionKey,...reply}=data;return service.answer(sessionKey,reply);}
  },
  close(){broker.close();store.close();}
 };service.choices=createSkillChoices({store,broker,inventory:service.inventory,now});return attachMemory(service);
}
