import {randomUUID} from 'node:crypto';
import {scopeKey,fail,validateEvent,exact} from '../contracts.mjs';
import {createQuestionBroker} from '../questions.mjs';
export function createService({store,now=Date.now,memoryRoot}){
 const handles=new Map();
 const broker=createQuestionBroker({store,now});broker.recover();
 for(const row of store.scan('session'))if(row.key==='session')handles.set(row.value.sessionKey,row.value.scope);
 const service={
  store,now,memoryRoot,broker,
  registerSession(s){
   const key=scopeKey(s),scope=JSON.parse(key),clean={projectId:scope[0],host:scope[1],sessionId:scope[2]};
   const old=store.read(clean,'session');if(old)return old.value.sessionKey;
   const sessionKey=randomUUID();store.compareAndSet(clean,'session',null,{sessionKey,scope:clean,status:'active'});handles.set(sessionKey,clean);return sessionKey;
  },
  resolveSession(key){const s=handles.get(key);if(!s)fail('NOT_FOUND','Unknown session');return s;},
  ingest(e){validateEvent(e);service.registerSession(e);return store.append(e);},
  sessions(){return [...handles].map(([sessionKey,s])=>({sessionKey,host:s.host,status:store.read(s,'session').value.status}));},
  events(key,after=0){return store.list(service.resolveSession(key),{after});},
  ask(input,options){service.registerSession(input);return broker.ask(input,options);},
  question(key){return broker.get(service.resolveSession(key));},
  answer(sessionKey,data){
   exact(data,['id','version','answer']);const scope=service.resolveSession(sessionKey),q=broker.get(scope);
   if(!q)fail('CONFLICT','No question is open');
   return broker.reply({...scope,turnId:q.turnId,requestId:q.requestId,...data});
  },
  cancel(origin){broker.cancel(origin);},
  handleRoute({route,method,data,url}){
   if(route==='/api/question'&&method==='GET')return service.question(url.searchParams.get('sessionKey'));
   if(route==='/api/question/answer'&&method==='POST'){exact(data,['sessionKey','id','version','answer']);const {sessionKey,...reply}=data;return service.answer(sessionKey,reply);}
  },
  close(){broker.close();store.close();}
 };return service;
}
