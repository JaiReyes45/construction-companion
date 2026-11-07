export function fail(code,message=code) {throw Object.assign(new Error(message),{code});}
export function object(v) {return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
export function id(v) {if(typeof v!=='string'||!v.trim()||v.length>256||/[\u0000-\u001f]/.test(v))fail('INVALID','Invalid identifier');return v;}
export function scopeKey(s) {if(!object(s)||!['codex','claude'].includes(s.host))fail('INVALID','Invalid scope');return JSON.stringify([id(s.projectId),s.host,id(s.sessionId)]);}
export function canonical(v) {if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export function exact(v,allowed) {if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('INVALID','Unexpected fields');}
const types={
 'session.start':['label'],'session.end':['success'],'turn.start':['label'],'turn.end':['success'],
 'task.start':['label'],'task.verify':['label'],'task.complete':['success','durationMs'],'task.fail':['label'],
 'skill.declare':['label'],'actor.start':['label'],'actor.end':['success'],'permission.wait':['label'],
 'permission.resolved':['success'],'history.gap':['count','label']
};
export function validateEvent(e) {
 exact(e,['schema','projectId','host','sessionId','eventId','sequence','occurredAt','adapterVersion','runtimeVersion','turnId','type','evidence','actorId','taskId','skillId','payload']);
 scopeKey(e);
 if(e.schema!==1||!Number.isSafeInteger(e.sequence)||e.sequence<0||!types[e.type]||!['declared','observed','unknown'].includes(e.evidence))fail('INVALID','Invalid event');
 for(const k of ['eventId','adapterVersion','runtimeVersion'])id(e[k]);
 for(const k of ['turnId','actorId','taskId','skillId'])if(e[k]!==undefined)id(e[k]);
 if(typeof e.occurredAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(e.occurredAt)||!Number.isFinite(Date.parse(e.occurredAt)))fail('INVALID','Invalid time');
 exact(e.payload,types[e.type]);
 for(const [k,v]of Object.entries(e.payload)){
  if(v!==null&&!['string','number','boolean'].includes(typeof v))fail('INVALID','Payload must be metadata');
  if(typeof v==='number'&&!Number.isFinite(v))fail('INVALID');
  if(k==='label'&&typeof v!=='string'||k==='success'&&typeof v!=='boolean')fail('INVALID');
 }
 if(Buffer.byteLength(JSON.stringify(e.payload))>16384)fail('LIMIT','Event payload exceeds 16 KiB');
 return structuredClone(e);
}
