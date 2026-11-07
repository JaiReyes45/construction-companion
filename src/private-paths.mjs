import path from 'node:path';
import {createHash} from 'node:crypto';
import {fail} from './contracts.mjs';
export function resolvePrivatePaths({platform=process.platform,env=process.env,projectRoot}){
 const p=platform==='win32'?path.win32:path.posix;
 const base=platform==='win32'?env.LOCALAPPDATA:(env.XDG_STATE_HOME||(env.HOME?p.join(env.HOME,'.local','state'):null));
 if(!base||!p.isAbsolute(base))fail('INVALID','Private user-data location unavailable');
 const project=p.resolve(projectRoot),dataBase=p.resolve(base),rel=p.relative(project,dataBase);
 if(/(^|[\\/])onedrive(?:[^\\/]*)?([\\/]|$)/i.test(dataBase)||(!rel.startsWith('..')&&!p.isAbsolute(rel)))fail('INVALID','Private state must be outside the repository and OneDrive');
 const key=createHash('sha256').update(platform==='win32'?project.toLowerCase():project).digest('hex');
 const dataRoot=p.join(dataBase,'construction-companion',key);
 return {dataRoot,memoryRoot:p.join(dataRoot,'memory')};
}
