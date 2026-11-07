import {createHash} from 'node:crypto';
import {exact,fail,id,scopeKey} from './contracts.mjs';
const key=q=>'question:'+createHash('sha256').update(id(q.id)).digest('hex');
const sameOrigin=(a,b)=>scopeKey(a)===scopeKey(b)&&a.turnId===b.turnId&&a.requestId===b.requestId;
export function createQuestionBroker({store,now=Date.now}){
 const pending=new Map(),pendingKey=q=>scopeKey(q)+key(q);
 function get(s){const active=store.read(s,'active-question');return active?store.read(s,active.value.key)?.value??null:null;}
 function finish(q,status,result,answer){
  const next=store.transaction(()=>{const row=store.read(q,key(q));if(!row||row.value.status!=='open')fail('CONFLICT','Question is no longer open');
   const next={...row.value,status,...(answer?{answer}:{} )};store.compareAndSet(q,key(q),row.version,next);return next;});
  const waiter=pending.get(pendingKey(q));if(waiter){clearTimeout(waiter.timer);waiter.cleanup();pending.delete(pendingKey(q));waiter.resolve(result??{status:'answered',question:next});}
  return next;
 }
 const broker={
  get,
  ask(input,{signal,timeoutMs=45000}={}){
   exact(input,['projectId','host','sessionId','turnId','requestId','id','text','options','allowFreeText','expiresAt']);scopeKey(input);id(input.id);id(input.turnId);id(input.requestId);
   if(typeof input.text!=='string'||!input.text.trim()||input.text.length>4000||!Array.isArray(input.options)||input.options.length>6||typeof input.allowFreeText!=='boolean')fail('INVALID','Invalid question');
   const seen=new Set();for(const o of input.options){exact(o,['id','label']);id(o.id);if(seen.has(o.id)||typeof o.label!=='string'||!o.label.trim()||o.label.length>1000)fail('INVALID','Invalid options');seen.add(o.id);}
   if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>600000)fail('INVALID','Invalid timeout');
   const expiry=Date.parse(input.expiresAt);if(!Number.isFinite(expiry)||expiry<=now())fail('EXPIRED');
   if(signal?.aborted)return Promise.resolve({status:'cancelled'});
   const q=store.transaction(()=>{
    if(get(input)?.status==='open')fail('CONFLICT','A question is already open');
    const old=store.read(input,key(input)),q={...structuredClone(input),version:(old?.value.version??0)+1,status:'open'};
    store.compareAndSet(input,key(input),old?.version??null,q);
    const active=store.read(input,'active-question');store.compareAndSet(input,'active-question',active?.version??null,{key:key(input)});
    return q;
   });
   return new Promise(resolve=>{
    const onAbort=()=>broker.cancel(q);
    const timer=setTimeout(()=>finish(q,'expired',{status:'fallback',reason:'timeout'}),Math.min(timeoutMs,expiry-now()));
    pending.set(pendingKey(q),{resolve,timer,cleanup:()=>signal?.removeEventListener('abort',onAbort),q});
    signal?.addEventListener('abort',onAbort,{once:true});
   });
  },
  reply(reply){
   exact(reply,['projectId','host','sessionId','turnId','requestId','id','version','answer']);
   const q=store.read(reply,key(reply))?.value;
   if(!q||!sameOrigin(q,reply)||q.version!==reply.version||q.status!=='open'||!pending.has(pendingKey(q)))fail('CONFLICT','Stale or unrelated answer');
   if(Date.parse(q.expiresAt)<=now()){finish(q,'expired',{status:'fallback',reason:'timeout'});fail('CONFLICT','Question expired');}
   exact(reply.answer,['optionId','text']);const {optionId,text}=reply.answer;
   if(Buffer.byteLength(JSON.stringify(reply.answer))>16384)fail('LIMIT');
   if(optionId!==undefined&&!q.options.some(o=>o.id===optionId))fail('INVALID','Unknown choice');
   if(text!==undefined&&(!q.allowFreeText||typeof text!=='string'||!text.trim()))fail('INVALID','Free text unavailable');
   if(optionId===undefined&&text===undefined)fail('INVALID','Answer required');
   return finish(q,'answered',null,reply.answer);
  },
  cancel(origin){const q=get(origin);if(q?.status==='open'&&sameOrigin(q,origin))finish(q,'cancelled',{status:'cancelled'});},
  disconnect(origin){const q=get(origin);if(q?.status==='open'&&sameOrigin(q,origin))finish(q,'cancelled',{status:'fallback',reason:'disconnected'});},
  recover(){for(const row of store.scan('question:'))if(row.value.status==='open')store.compareAndSet(row.value,row.key,row.version,{...row.value,status:'cancelled'});},
  close(){for(const {q}of [...pending.values()]){if(get(q)?.status==='open')finish(q,'cancelled',{status:'cancelled'});else{const w=pending.get(pendingKey(q));clearTimeout(w.timer);w.cleanup();w.resolve({status:'cancelled'});pending.delete(pendingKey(q));}}}
 };return broker;
}
