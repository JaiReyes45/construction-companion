import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
export const scope={projectId:'project-a',host:'codex',sessionId:'session-a'};
export const event=(overrides={})=>({...scope,schema:1,eventId:'event-a',sequence:0,occurredAt:'2026-11-07T00:00:00.000Z',adapterVersion:'0.1.0',runtimeVersion:'22.16.0',type:'task.start',evidence:'observed',taskId:'task-a',payload:{label:'Build'},...overrides});
export function temporaryDirectory(t) { const dir=mkdtempSync(path.join(tmpdir(),'companion-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir; }
