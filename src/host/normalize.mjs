import {randomUUID} from 'node:crypto';
import {validateEvent} from '../contracts.mjs';
const map={SessionStart:'session.start',SessionEnd:'session.end',UserPromptSubmit:'turn.start',Stop:'turn.end',StopFailure:'turn.end',Interrupt:'turn.end',PreToolUse:'task.start',PostToolUse:'task.verify',PostToolUseFailure:'task.fail',SubagentStart:'actor.start',SubagentStop:'actor.end',PermissionRequest:'permission.wait',TaskCreated:'task.start',TaskCompleted:'task.complete'};
export function normalizeHook(host,raw,context){
 const type=map[raw?.hook_event_name];if(!type)return null;
 if(!['codex','claude'].includes(host))return null;
 const e={schema:1,host,projectId:context.projectId,sessionId:raw.session_id,eventId:context.eventId??randomUUID(),sequence:context.sequence??0,occurredAt:new Date(context.now??Date.now()).toISOString(),adapterVersion:'0.1.0',runtimeVersion:process.versions.node,type,evidence:'observed',payload:{}};
 const turn=raw.turn_id??context.turnId;if(turn)e.turnId=turn;
 if(raw.agent_id)e.actorId=raw.agent_id;
 if(raw.tool_use_id||raw.task_id)e.taskId=raw.tool_use_id??raw.task_id;
 if(type.startsWith('task.')&&!e.taskId)return null;
 if(type==='task.complete')e.payload.success=true;
 if(type==='turn.end'&&raw.hook_event_name==='StopFailure')e.payload.success=false;
 return validateEvent(e);
}
