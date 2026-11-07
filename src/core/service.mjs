import {randomUUID} from 'node:crypto';
import {scopeKey,fail,validateEvent} from '../contracts.mjs';
export function createService({store,now=Date.now,memoryRoot}){
 const handles=new Map();
 for(const row of store.scan('session'))if(row.key==='session')handles.set(row.value.sessionKey,row.value.scope);
 const service={
  store,now,memoryRoot,
  registerSession(s){
   const key=scopeKey(s),scope=JSON.parse(key),clean={projectId:scope[0],host:scope[1],sessionId:scope[2]};
   const old=store.read(clean,'session');if(old)return old.value.sessionKey;
   const sessionKey=randomUUID();store.compareAndSet(clean,'session',null,{sessionKey,scope:clean,status:'active'});handles.set(sessionKey,clean);return sessionKey;
  },
  resolveSession(key){const s=handles.get(key);if(!s)fail('NOT_FOUND','Unknown session');return s;},
  ingest(e){validateEvent(e);service.registerSession(e);return store.append(e);},
  sessions(){return [...handles].map(([sessionKey,s])=>({sessionKey,host:s.host,status:store.read(s,'session').value.status}));},
  events(key,after=0){return store.list(service.resolveSession(key),{after});},
  close(){store.close();}
 };return service;
}
