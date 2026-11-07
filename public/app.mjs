import {createApi} from './api.mjs';
import {makeViewModel} from './view-model.mjs';
import {emptyScene} from './projection.mjs';
import {mountSite} from './site.mjs';
const $=id=>document.getElementById(id),node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let api=null,sessionKey=null,timer=null,questionKey=null,online=false,paused=false,lastSnapshot=null,polling=false,memoryDirty=false;
let site=mountSite({canvas:$('site'),scene:emptyScene(),reducedMotion:reduce.matches});site.setPaused(true);
const notice=text=>{$('notice').textContent=text;};
function render(snapshot){
 lastSnapshot=snapshot;const vm=makeViewModel({...snapshot,connected:online});
 $('status-text').textContent=vm.statusText;$('native-permission').hidden=!vm.permission;
 $('installation').hidden=!vm.installationText;$('installation').textContent=vm.installationText;
 $('activity-label').textContent=vm.tasks.some(t=>t.status==='working'&&t.evidence==='observed')?'Observed work in progress':'Crew standing by';
 const completed=vm.tasks.filter(t=>t.status==='completed').length;$('completion-count').textContent=completed+' observed task'+(completed===1?'':'s')+' completed';
 site.update(snapshot.scene);site.setPaused(paused||!online);
 const q=snapshot.question,newKey=sessionKey+':'+(q?q.id+':'+q.version+':'+q.status:'none');
 if(newKey!==questionKey){
  const restoreFocus=$('question').contains(document.activeElement);
  questionKey=newKey;$('question').replaceChildren();
  if(q){
   $('question').append(node('h3',q.text));
   if(q.status==='open'){
    const actions=node('div',undefined,'answers');
    for(const action of vm.actions){const button=node('button',action.label);button.type='button';button.disabled=!action.enabled;button.addEventListener('click',()=>answer(q,{optionId:action.id}));actions.append(button);}
    $('question').append(actions);
    if(q.allowFreeText){const form=node('form',undefined,'free-answer'),input=node('input'),button=node('button','Send');input.setAttribute('aria-label','Your answer');input.required=true;input.maxLength=16000;form.append(input,button);form.addEventListener('submit',e=>{e.preventDefault();answer(q,{text:input.value})});$('question').append(form);}
   }else $('question').append(node('p',q.status==='answered'?'Answer delivered. Your coding host can continue.':'This question is '+q.status+'. Continue in your coding host.','muted'));
  }else{$('question').append(node('h3','Ready when you are.'),node('p','Continue in your coding host. Supported questions and crew choices appear here.'));}
  if(restoreFocus)$('question').focus();
 }
 for(const control of $('question').querySelectorAll('button,input'))control.disabled=!online;
 $('tasks').replaceChildren();
 for(const task of vm.tasks.slice(-12).reverse()){const li=node('li');li.append(node('strong',task.label),node('span',task.status+' · '+task.evidence));$('tasks').append(li);}
 if(!vm.tasks.length)$('tasks').append(node('li','Real activity appears here as the host reports it.','muted'));
 $('crew').replaceChildren();
 for(const binding of snapshot.bindings??[]){const row=node('div',undefined,'crew-row');row.append(node('strong',binding.role),node('span',binding.state+' · '+binding.taskId));$('crew').append(row);}
 if(!snapshot.bindings?.length)$('crew').append(node('p','Choose skills with your head engineer to assemble the crew.','muted'));
 $('recommendations').replaceChildren();
 if(snapshot.recommendations&&q?.id===snapshot.recommendations.questionId&&q.status==='open'){
  for(const skill of snapshot.recommendations.candidates){const detail=node('article',undefined,'skill-detail');detail.append(node('h3',skill.name),node('p',skill.reason),node('small',skill.availability+' · '+(skill.version??skill.revision)+' · '+(skill.license??'unknown license')),node('small',skill.source));if(skill.prerequisites?.length)detail.append(node('small',skill.prerequisites.join(' ')));$('recommendations').append(detail);}
 }
 if(!memoryDirty)$('memory-enabled').checked=Boolean(snapshot.memory.enabled);
 $('memory-enabled').disabled=!online;$('save-memory').disabled=!online;
 $('memory-state').textContent=snapshot.memory.conflicts? snapshot.memory.conflicts+' notebook conflict(s) need review. Your coding answers remain accepted.':snapshot.memory.enabled?'Approved decisions are saved to your project notebook.':'Memory capture is off.';
 if(vm.historyGap)notice('Some activity metadata is missing. The site shows only the evidence available.');
}
async function answer(q,reply){
 const key=sessionKey,current=api;if(!online||!current)return;
 for(const control of $('question').querySelectorAll('button,input'))control.disabled=true;
 try{await current.answer(key,{id:q.id,version:q.version,answer:reply});if(api===current&&key===sessionKey){notice('Answer delivered.');questionKey=null;await refresh();}}
 catch(e){if(api!==current||key!==sessionKey)return;notice(e.code==='CONFLICT'?'This question changed. Review the current question before answering.':e.message);questionKey=null;await refresh();}
}
async function refresh(){
 if(!api||polling||document.hidden)return;polling=true;const current=api,keyAtStart=sessionKey;
 try{
  const sessions=await current.sessions();if(api!==current)return;
  const signature=sessions.map(s=>s.sessionKey).join('|');
  $('demo-notice').hidden=!sessions.some(s=>s.demo);
  if($('session').dataset.signature!==signature){$('session').dataset.signature=signature;$('session').replaceChildren(...sessions.map(s=>{const option=node('option',s.host+' · '+s.sessionKey.slice(0,8));option.value=s.sessionKey;return option}));if(!sessions.length)$('session').append(node('option','Waiting for your coding host'));}
  if(!sessionKey&&sessions.length)sessionKey=sessions[0].sessionKey;
  if(sessionKey&&!sessions.some(s=>s.sessionKey===sessionKey))sessionKey=sessions[0]?.sessionKey??null;
  $('session').disabled=!sessions.length;if(sessionKey)$('session').value=sessionKey;
  const selected=sessionKey;
  if(selected){const snapshot=await current.load(selected);if(api!==current||selected!==sessionKey)return;online=true;render(snapshot);}
  online=true;$('connection').textContent='Connected locally';$('connect-panel').hidden=true;$('disconnect').hidden=false;
 }catch(e){if(api===current){online=false;$('connection').textContent='Connection lost';site.setPaused(true);if(lastSnapshot)render(lastSnapshot);notice(e.message+' Reconnect or check that the local runner is still open.');}}
 finally{polling=false;clearTimeout(timer);if(api)timer=setTimeout(refresh,online?1200:4000);}
}
$('connect-form').addEventListener('submit',async e=>{e.preventDefault();api?.dispose();api=createApi({origin:location.origin,token:$('token').value.trim()});$('token').value='';sessionKey=null;questionKey=null;notice('Connecting…');await refresh();if(online)notice('Connected. Continue in your coding host.');});
$('session').addEventListener('change',()=>{sessionKey=$('session').value;questionKey=null;memoryDirty=false;$('vault-path').value='';refresh();});
$('disconnect').addEventListener('click',()=>{api?.dispose();api=null;clearTimeout(timer);online=false;sessionKey=null;questionKey=null;lastSnapshot=null;memoryDirty=false;$('vault-path').value='';site.update(emptyScene());site.setPaused(true);for(const id of ['tasks','crew','recommendations'])$(id).replaceChildren();$('native-permission').hidden=true;$('installation').hidden=true;$('demo-notice').hidden=true;$('completion-count').textContent='No observed completions yet';$('activity-label').textContent='Crew standing by';$('status-text').textContent='Connect to bring your project into view.';$('memory-state').textContent='Memory capture is off.';$('memory-enabled').checked=false;$('connection').textContent='Not connected';$('connect-panel').hidden=false;$('disconnect').hidden=true;$('session').replaceChildren(node('option','Connect a project to begin'));delete $('session').dataset.signature;$('session').disabled=true;$('memory-enabled').disabled=true;$('save-memory').disabled=true;$('question').replaceChildren(node('h3','Disconnected.'),node('p','Reconnect to continue with your project.'));notice('Connection token cleared from this tab.');});
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').setAttribute('aria-pressed',String(paused));$('pause').textContent=paused?'Resume motion':'Pause motion';site.setPaused(paused||!online);});
$('memory-form').addEventListener('input',()=>{memoryDirty=true;});
$('memory-form').addEventListener('submit',async e=>{e.preventDefault();if(!api||!sessionKey)return;try{const root=$('vault-path').value.trim();await api.setMemoryConsent(sessionKey,{enabled:$('memory-enabled').checked,...(root?{selectedRoot:root}:{})});memoryDirty=false;notice('Notebook preference saved.');await refresh();}catch(error){notice(error.message);}});
reduce.addEventListener('change',()=>{site.destroy();site=mountSite({canvas:$('site'),scene:lastSnapshot?.scene??emptyScene(),reducedMotion:reduce.matches});site.setPaused(paused||!online)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();else clearTimeout(timer)});
window.addEventListener('pagehide',()=>{site.destroy();api?.dispose();clearTimeout(timer)});

