import {randomUUID} from 'node:crypto';
import {exact,fail} from '../contracts.mjs';
import {createIntent,recordReview,requestIntent,verifyIntent,failIntent} from './intents.mjs';
export async function handleInstallation(service,method,input,origin,{signal}={}){
 const common={store:service.store,origin,now:service.now()};
 if(method==='install_prepare'){
  exact(input,['taskId','role','skillId']);const skill=(await service.inventory()).find(s=>s.id===input.skillId);if(!skill)fail('NOT_FOUND','Skill not found');
  const intent=createIntent({...common,...input,skill,recipe:service.installRecipes[skill.id]});
  const text='Review installation of '+skill.name+' from '+intent.source+' at '+intent.revision+'. Scope: '+intent.scope+'. Destination: '+intent.destination+'. Expected files: '+intent.expectedFiles.join(', ')+'. Request installation through your coding host?';
  const review=await service.ask({...origin,id:randomUUID(),text,options:[{id:'request-install',label:'Request installation'},{id:'decline',label:'Continue without installing'}],allowFreeText:false,expiresAt:new Date(service.now()+45000).toISOString()},{signal,timeoutMs:45000});
  if(review.status==='answered'&&review.question.answer.optionId==='request-install')recordReview({...common,intentId:intent.id,question:review.question,digest:intent.digest});
  return {intent,review};
 }
 if(method==='install_request'){exact(input,['intentId','version','digest']);return requestIntent({...common,...input});}
 if(method==='install_verify'){exact(input,['intentId','hostReloaded']);return verifyIntent({...common,...input,inventory:await service.inventory()});}
 if(method==='install_fail'){exact(input,['intentId','reason']);return failIntent({...common,...input});}
 fail('NOT_FOUND');
}
