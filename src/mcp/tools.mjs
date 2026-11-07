import {z} from 'zod';
export function registerTools(server,{client,capability}){
 const context=z.string().max(4096),identifier=z.string().min(1).max(256);
 function register(name,description,schema,fn){
  server.registerTool(name,{description,inputSchema:schema},async(args,extra)=>{
   try{const result=await fn(args,extra);return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}
   catch(e){return {isError:true,content:[{type:'text',text:JSON.stringify({error:{code:e.code??'INVALID',message:e.code?e.message:'Companion request failed'}})}]};}
  });
 }
 const forward=(method,transform=args=>args)=>async(args,extra)=>{
  const {context,...input}=args;
  return client.call(method,transform(input),{context,requestId:String(extra.requestId),signal:extra.signal});
 };
 register('companion_status','Inspect companion availability and verified host capabilities.',z.object({}).strict(),()=>({capability}));
 register('companion_skill_context','Read bounded installed and verified catalog metadata for a project role.',z.object({context,goal:z.string().max(4000),role:z.string().max(64)}).strict(),forward('skill_context'));
 register('companion_choose_skill','Offer explained crew skills and let the user accept, choose another or decline.',z.object({context,taskId:identifier,role:identifier,candidates:z.array(z.object({taskId:identifier,role:identifier,skillId:identifier,reason:z.string().min(1).max(2000)}).strict()).min(1).max(3)}).strict(),forward('choose_skill'));
 register('companion_reopen_skill_choice','Reopen a declined role only when the user explicitly asks.',z.object({context,taskId:identifier,role:identifier}).strict(),forward('reopen_skill'));
 register('companion_install_intent','Prepare a pinned installation and wait for explicit user review.',z.object({context,taskId:identifier,role:identifier,skillId:identifier}).strict(),forward('install_prepare'));
 register('companion_request_install','Check the affirmative review and exact installation digest before native execution.',z.object({context,intentId:identifier,version:z.number().int().positive(),digest:z.string().length(64)}).strict(),forward('install_request'));
 register('companion_verify_install','Rediscover the installed package; report any required reload.',z.object({context,intentId:identifier,hostReloaded:z.boolean()}).strict(),forward('install_verify'));
 register('companion_fail_install','Record a native installation failure without marking a worker active.',z.object({context,intentId:identifier,reason:z.string().max(1000)}).strict(),forward('install_fail'));
 register('companion_ask','Ask one project question. Native permissions must remain in the host.',z.object({context,id:identifier,text:z.string().min(1).max(4000),options:z.array(z.object({id:identifier,label:z.string().min(1).max(1000)}).strict()).max(6),allowFreeText:z.boolean()}).strict(),async(args,extra)=>{
  if(capability.questionMode==='native-chat')return {status:'fallback',reason:'unsupported'};
  return forward('ask',input=>({...input,timeoutMs:capability.questionMode==='verified-long'?600000:45000}))(args,extra);
 });
 register('companion_report','Report declared task/skill metadata; this does not prove native execution.',z.object({context,event:z.object({type:z.enum(['task.start','task.verify','task.complete','task.fail','skill.declare']),taskId:identifier.optional(),skillId:identifier.optional(),payload:z.object({label:z.string().max(4000).optional(),success:z.boolean().optional()}).strict()}).strict()}).strict(),forward('report'));
}
