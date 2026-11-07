import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {canonical,fail,id,scopeKey} from '../contracts.mjs';
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
function load(store,intentId,origin,strict=true){
 id(intentId);scopeKey(origin);
 const row=store.scan('intent:').find(r=>r.key==='intent:'+intentId);
 if(!row||row.value.origin.projectId!==origin.projectId||row.value.origin.host!==origin.host)fail('NOT_FOUND');
 if(strict&&(row.value.origin.sessionId!==origin.sessionId||row.value.origin.turnId!==origin.turnId))fail('CONFLICT','Installation belongs to another turn');
 return row;
}
function save(store,row,value){store.compareAndSet(row.value.origin,row.key,row.version,value);return value.intent;}
export function createIntent({store,origin,taskId,role,skill,recipe,now}){
 scopeKey(origin);id(origin.turnId);id(taskId);id(role);
 if(!recipe)fail('UNSUPPORTED','No reviewed installation recipe. Use the canonical source for manual setup.');
 if(skill.availability==='installed')fail('CONFLICT','An installed package must not be overwritten automatically');
 if(recipe.source!==skill.source||recipe.revision!==skill.revision)fail('INVALID','Recipe provenance mismatch');
 if(!path.isAbsolute(recipe.destination)||!['project-local','project-shared','user'].includes(recipe.scope)||!Array.isArray(recipe.expectedFiles)||!recipe.expectedFiles.length||recipe.expectedFiles.some(f=>typeof f!=='string'||path.isAbsolute(f)||f.split(/[\\/]/).some(p=>p==='..'||p==='')))fail('INVALID','Invalid destination or files');
 if(typeof recipe.command?.executable!=='string'||!Array.isArray(recipe.command.args)||recipe.command.args.some(a=>typeof a!=='string'))fail('INVALID','Invalid reviewed command');
 const bound={source:recipe.source,revision:recipe.revision,destination:recipe.destination,scope:recipe.scope,expectedFiles:recipe.expectedFiles,prerequisites:recipe.prerequisites??[],command:recipe.command};
 const intent={id:randomUUID(),version:1,taskId,role,skillId:skill.id,...structuredClone(bound),digest:hash(bound),expiresAt:new Date(now+600000).toISOString(),status:'pending-review'};
 store.transaction(()=>{
  for(const row of store.scan('intent:'))if(scopeKey(row.value.origin)===scopeKey(origin)&&row.value.intent.taskId===taskId&&row.value.intent.role===role&&['pending-review','requested'].includes(row.value.intent.status))save(store,row,{...row.value,intent:{...row.value.intent,status:'superseded'}});
  store.compareAndSet(origin,'intent:'+intent.id,null,{origin,intent,review:null});
  const current=store.read(origin,'current-installation');store.compareAndSet(origin,'current-installation',current?.version??null,{id:intent.id});
 });return intent;
}
export function recordReview({store,intentId,origin,question,digest}){
 const row=load(store,intentId,origin);
 if(question.status!=='answered'||question.answer?.optionId!=='request-install'||scopeKey(question)!==scopeKey(origin)||question.turnId!==origin.turnId||digest!==row.value.intent.digest)fail('CONFLICT','Review does not match this installation');
 return save(store,row,{...row.value,review:{id:question.id,version:question.version,digest}});
}
export function requestIntent({store,intentId,version,digest,origin,now}){
 const row=load(store,intentId,origin),{intent,review}=row.value;
 if(now>=Date.parse(intent.expiresAt)){save(store,row,{...row.value,intent:{...intent,status:'expired'}});fail('EXPIRED');}
 if(!['pending-review','requested'].includes(intent.status)||intent.version!==version||intent.digest!==digest||review?.digest!==digest)fail('CONFLICT','A matching affirmative review is required');
 return save(store,row,{...row.value,intent:{...intent,status:'requested'}});
}
export function verifyIntent({store,intentId,origin,inventory,hostReloaded}){
 const row=load(store,intentId,origin,false),{intent}=row.value;
 if(!['requested','awaiting-reload','verified'].includes(intent.status))fail('CONFLICT','No installation request is awaiting verification');
 const actual=inventory.find(s=>s.id===intent.skillId&&s.source===intent.source&&s.revision===intent.revision&&s.availability==='installed');
 const status=!actual?'failed':actual.reloadRequired&&!hostReloaded?'awaiting-reload':'verified';
 return save(store,row,{...row.value,intent:{...intent,status}});
}
export function failIntent({store,intentId,origin,reason}){
 const row=load(store,intentId,origin);return save(store,row,{...row.value,intent:{...row.value.intent,status:'failed'},failure:String(reason).slice(0,1000)});
}
export function visibleInstallation(store,scope){
 const current=store.read(scope,'current-installation');const intent=current?store.read(scope,'intent:'+current.value.id)?.value.intent:null;if(!intent)return null;
 const {destination,command,...publicIntent}=intent;return {...publicIntent,destinationLabel:intent.scope+' skill directory'};
}
