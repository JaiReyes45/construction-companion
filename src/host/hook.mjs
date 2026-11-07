import {normalizeHook} from './normalize.mjs';
import {appendSpool} from './spool.mjs';
import {signContext} from './context.mjs';
export function runHook({host,input,context,spoolDirectory}){
 try{
  const event=normalizeHook(host,input,context);if(!event)return {exitCode:0};
  appendSpool({directory:spoolDirectory,event});
  if(input.hook_event_name==='UserPromptSubmit'&&context.questionSupportVerified&&event.turnId&&context.secret){
   const scope={host,projectId:event.projectId,sessionId:event.sessionId};
   const key=signContext({scope,turnId:event.turnId,expiresAt:Date.now()+3600000},context.secret);
   return {exitCode:0,additionalContext:'Construction Companion is enabled for this project. Use the construction-companion skill with context: '+key};
  }
 }catch{/* Observational hooks must not interrupt the coding host. */}
 return {exitCode:0};
}
