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
 register('companion_ask','Ask one project question. Native permissions must remain in the host.',z.object({context,id:identifier,text:z.string().min(1).max(4000),options:z.array(z.object({id:identifier,label:z.string().min(1).max(1000)}).strict()).max(6),allowFreeText:z.boolean()}).strict(),async(args,extra)=>{
  if(capability.questionMode==='native-chat')return {status:'fallback',reason:'unsupported'};
  return forward('ask',input=>({...input,timeoutMs:capability.questionMode==='verified-long'?600000:45000}))(args,extra);
 });
 register('companion_report','Report declared task/skill metadata; this does not prove native execution.',z.object({context,event:z.object({type:z.enum(['task.start','task.verify','task.complete','task.fail','skill.declare']),taskId:identifier.optional(),skillId:identifier.optional(),payload:z.object({label:z.string().max(4000).optional(),success:z.boolean().optional()}).strict()}).strict()}).strict(),forward('report'));
}
