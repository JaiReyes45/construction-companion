import {mkdirSync,readdirSync,writeFileSync,renameSync,unlinkSync,rmdirSync,statSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {validateEvent} from '../contracts.mjs';
const files=directory=>readdirSync(directory).filter(n=>/^(?:[0-9a-f-]+|gap)\.json$/.test(n));
function atomic(directory,name,value){const tmp=path.join(directory,randomUUID()+'.tmp');writeFileSync(tmp,JSON.stringify(value),{mode:0o600});renameSync(tmp,path.join(directory,name));}
function gap(directory,e){const record={schema:1,host:e.host,projectId:e.projectId,sessionId:e.sessionId,eventId:randomUUID(),sequence:e.sequence,occurredAt:e.occurredAt,adapterVersion:e.adapterVersion,runtimeVersion:e.runtimeVersion,type:'history.gap',evidence:'observed',payload:{label:'Some activity metadata could not be retained',count:1}};try{writeFileSync(path.join(directory,'gap.json'),JSON.stringify(record),{flag:'wx',mode:0o600});}catch(err){if(!['EEXIST','EPERM','EACCES'].includes(err.code))throw err;}}
export function appendSpool({directory,event,maxBytes=5242880}){
 const e=validateEvent(event);mkdirSync(directory,{recursive:true,mode:0o700});const lock=path.join(directory,'.lock');
 try{mkdirSync(lock);}catch(err){if(!['EEXIST','EPERM','EACCES'].includes(err.code))throw err;try{if(Date.now()-statSync(lock).mtimeMs>5000)rmdirSync(lock);}catch{}gap(directory,e);return {written:false,gap:true};}
 try{
  const used=files(directory).reduce((n,f)=>n+statSync(path.join(directory,f)).size,0),bytes=Buffer.byteLength(JSON.stringify(e));
  if(used+bytes>Math.max(0,maxBytes-4096)){gap(directory,e);return {written:false,gap:true};}
  atomic(directory,randomUUID()+'.json',e);return {written:true,gap:false};
 }finally{rmdirSync(lock);}
}
export async function drainSpool({directory,send}){
 mkdirSync(directory,{recursive:true,mode:0o700});let sent=0;
 for(const file of files(directory)){
  let full=path.join(directory,file);let data;
  try{if(file==='gap.json'){const claimed=path.join(directory,randomUUID()+'.json');renameSync(full,claimed);full=claimed;}data=readFileSync(full,'utf8');const e=validateEvent(JSON.parse(data));await send(e);
   // A concurrently replaced gap marker must survive for the next pass.
   if(readFileSync(full,'utf8')===data)unlinkSync(full);sent++;
  }catch(err){if(err.code==='ENOENT')continue;break;}
 }
 return {sent,remaining:files(directory).length};
}
