import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openStore} from '../src/core/store.mjs';
import {createService} from '../src/core/service.mjs';
import {startServer} from '../src/server.mjs';
import {copyToken} from '../src/cli.mjs';
const scope={projectId:'interactive-demo',host:'codex',sessionId:'demo-session'},tokens={ui:randomBytes(32).toString('hex'),ingest:randomBytes(32).toString('hex')};
const notebook=await mkdtemp(path.join(tmpdir(),'companion-demo-'));
const service=createService({store:openStore(':memory:'),memoryRoot:notebook});service.registerSession(scope);
const sessions=service.sessions;service.sessions=()=>sessions().map(s=>({...s,demo:true}));
const server=await startServer({service,tokens});let closed=false;
const close=async()=>{if(closed)return;closed=true;await server.close();service.close();};process.once('SIGINT',close);process.once('SIGTERM',close);
console.log('Construction Companion DEMO FIXTURE — no coding agent or model call.\n'+server.origin);
if(process.argv.includes('--copy-token')){await copyToken(tokens.ui);console.log('Demo connection token copied. Paste it into the local page.');}
else{console.log('Add --copy-token to copy the connection token.');await close();process.exit(0);}
console.log('Ctrl+C stops the demo. Any opted-in demo notebook is retained in your temporary folder.');
let n=0;const report=(type,taskId,payload={})=>service.ingest({...scope,schema:1,eventId:randomUUID(),sequence:++n,occurredAt:new Date().toISOString(),adapterVersion:'demo',runtimeVersion:process.versions.node,type,evidence:'observed',taskId,payload});
const origin={...scope,turnId:'demo-turn',requestId:'demo-discovery'};
const first=await service.ask({...origin,id:'website-audience',text:'Who is this website for?',options:[{id:'customers',label:'Potential customers'},{id:'team',label:'Our team'}],allowFreeText:true,expiresAt:new Date(Date.now()+600000).toISOString()},{timeoutMs:600000});
if(first.status==='answered'&&!closed){
 const skills=await service.inventory(),skill=skills.find(s=>s.name.includes('UI/UX'))??skills[0];
 if(skill){const result=await service.offerSkills({...origin,requestId:'demo-crew'},{taskId:'website',role:'architect',candidates:[{taskId:'website',role:'architect',skillId:skill.id,reason:'Provides website layout, typography and accessibility guidance.'}]},{timeoutMs:600000});
  if(result.status==='chosen'&&!closed){report('task.start','example-build',{label:'Example website task'});setTimeout(()=>{if(!closed)report('task.complete','example-build',{label:'Example task finished',success:true});},3000);}
 }
}
