import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore} from '../src/core/store.mjs';
import {createService} from '../src/core/service.mjs';
import {startServer} from '../src/server.mjs';
import {copyToken} from '../src/cli.mjs';
export async function startDemo({notebook,completeAfterMs=3000}={}){
const scope={projectId:'interactive-demo',host:'codex',sessionId:'demo-session'},tokens={ui:randomBytes(32).toString('hex'),ingest:randomBytes(32).toString('hex')};
notebook??=await mkdtemp(path.join(tmpdir(),'companion-demo-'));
const service=createService({store:openStore(':memory:'),memoryRoot:notebook});service.registerSession(scope);
const sessions=service.sessions;service.sessions=()=>sessions().map(s=>({...s,demo:true}));
const server=await startServer({service,tokens});let closed=false;
const close=async()=>{if(closed)return;closed=true;await server.close();service.close();};
let n=0;const report=(type,taskId,payload={})=>service.ingest({...scope,schema:1,eventId:randomUUID(),sequence:++n,occurredAt:new Date().toISOString(),adapterVersion:'demo',runtimeVersion:process.versions.node,type,evidence:'observed',taskId,payload});
const origin={...scope,turnId:'demo-turn',requestId:'demo-discovery'};
const finished=(async()=>{
const first=await service.ask({...origin,id:'website-audience',text:'Who is this website for?',options:[{id:'customers',label:'Potential customers'},{id:'team',label:'Our team'}],allowFreeText:true,expiresAt:new Date(Date.now()+600000).toISOString()},{timeoutMs:600000});
if(first.status==='answered'&&!closed){
 const skills=await service.inventory(),skill=skills.find(s=>s.name.includes('UI/UX'))??skills[0];
 if(skill){const result=await service.offerSkills({...origin,requestId:'demo-crew'},{taskId:'website',role:'architect',candidates:[{taskId:'website',role:'architect',skillId:skill.id,reason:'Provides website layout, typography and accessibility guidance.'}]},{timeoutMs:600000});
  if(result.status==='chosen'&&!closed){report('task.start','example-build',{label:'Example website task'});await new Promise(resolve=>setTimeout(resolve,completeAfterMs));if(!closed)report('task.complete','example-build',{success:true});}
 }
}
})();
return {service,tokens,origin:server.origin,close,finished};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv.includes('--copy-token'))console.log('Run node scripts/demo.mjs --copy-token to start the labelled local demo.');
 else{
  const demo=await startDemo();process.once('SIGINT',demo.close);process.once('SIGTERM',demo.close);
  try{await copyToken(demo.tokens.ui);console.log('Construction Companion DEMO FIXTURE — no coding agent or model call.\n'+demo.origin+'\nDemo token copied; paste it into the page. Ctrl+C stops the demo. Opted-in demo notes are retained in your temporary folder.');await demo.finished;}
  catch(error){await demo.close();console.error('Demo stopped: '+error.message);process.exitCode=1;}
 }
}
