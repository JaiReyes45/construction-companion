export function emptyScene(){return {cursor:0,tasks:{},actors:{},skills:{},permissions:{},historyGap:false};}
export function applyEvent(scene,e){
 if(e.cursor<=scene.cursor)return scene;
 const next={...scene,cursor:e.cursor};
 if(e.type==='history.gap')next.historyGap=true;
 if(e.type.startsWith('task.')&&e.taskId){
  const previous=Object.hasOwn(scene.tasks,e.taskId)?scene.tasks[e.taskId]:null;
  if(!['completed','failed','cancelled'].includes(previous?.status)){
   let status=previous?.status??'unknown';
   if(e.type==='task.start')status='working';
   if(e.type==='task.verify')status='verifying';
   if(e.type==='task.fail')status='failed';
   if(e.type==='task.complete'&&e.evidence==='observed'&&e.payload.success===true)status='completed';
   next.tasks={...scene.tasks,[e.taskId]:{id:e.taskId,label:e.payload.label??previous?.label??'Coding task',status,evidence:e.evidence}};
  }
 }
 if(e.type==='skill.declare'&&e.skillId)next.skills={...scene.skills,[e.skillId]:{id:e.skillId,state:'declared',label:e.payload.label??e.skillId}};
 if(e.type.startsWith('actor.')&&e.actorId)next.actors={...scene.actors,[e.actorId]:{id:e.actorId,status:e.type==='actor.start'?'working':'finished',evidence:e.evidence}};
 if(e.type.startsWith('permission.')){const id=e.taskId??'native-permission';next.permissions={...scene.permissions,[id]:{id,status:e.type==='permission.wait'?'waiting':'resolved'}};}
 return next;
}
export function projectScene(events){return events.reduce(applyEvent,emptyScene());}
