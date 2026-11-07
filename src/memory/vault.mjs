import {mkdirSync,readFileSync,writeFileSync,realpathSync,existsSync,openSync,closeSync,unlinkSync,renameSync,statSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fail,id,exact} from '../contracts.mjs';
import {pages,begin,end,template} from './templates.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
export async function openVault({root,projectId,captureEnabled=false}){
 if(!path.isAbsolute(root))fail('INVALID','Absolute vault folder required');id(projectId);
 const owner=hash(projectId);let enabled=Boolean(captureEnabled);
 function confined(target){const r=realpathSync.native(root),p=realpathSync.native(target),rel=path.relative(r,p);if(rel.startsWith('..')||path.isAbsolute(rel))fail('INVALID','Vault path escapes project folder');return p;}
 function initialize(){
  mkdirSync(root,{recursive:true,mode:0o700});const file=path.join(root,'.companion-manifest.json');
  if(!existsSync(file)){try{writeFileSync(file,JSON.stringify({project:owner,pages}),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e;}}
  confined(file);if(JSON.parse(readFileSync(file,'utf8')).project!==owner)fail('INVALID','Vault belongs to another project');
 }
 function filename(page){if(!Object.hasOwn(pages,page))fail('INVALID','Unknown project page');return path.join(root,pages[page]);}
 function readOwned(page){
  const file=filename(page);if(!existsSync(file))fail('NOT_FOUND','Page not created');
  confined(file);if(statSync(file).size>131072)fail('LIMIT','Project page exceeds read limit');
  const content=readFileSync(file,'utf8');
  if(!content.startsWith('---\ncompanion_project: '+owner+'\n')||!content.includes(begin)||!content.includes(end))fail('CONFLICT','This page is not companion-owned');
  return {content,hash:hash(content)};
 }
 const vault={
  setCapture(value){enabled=Boolean(value);},
  async list(){if(!existsSync(root))return [];return Object.keys(pages).filter(page=>{try{readOwned(page);return true}catch{return false}});},
  async read(page){return readOwned(page);},
  async write(input){
   if(!enabled)return {status:'disabled'};
   exact(input,['page','expectedHash','operationId','content']);id(input.operationId);
   if(typeof input.content!=='string'||Buffer.byteLength(input.content)>65536||input.content.includes('<!-- companion:'))fail('INVALID','Invalid memory content');
   const file=filename(input.page);initialize();mkdirSync(path.dirname(file),{recursive:true});confined(path.dirname(file));
   const lock=file+'.lock';let fd;try{fd=openSync(lock,'wx',0o600);}catch{fail('CONFLICT','Another memory write is active');}
   let temp;
   try{
    const old=existsSync(file)?readOwned(input.page):null,operation='<!-- companion:operation '+hash(input.operationId)+' -->';
    if(old?.content.includes(operation))return {status:'written',hash:old.hash};
    if((old?.hash??null)!==input.expectedHash)return {status:'conflict',currentHash:old?.hash??null};
    if(!enabled)return {status:'disabled'};
    const original=old?.content??template(input.page,owner),start=original.indexOf(begin),finish=original.indexOf(end,start);
    if(finish<start||original.indexOf(begin,start+begin.length)>=0)fail('CONFLICT','Managed markers were edited');
    const content=original.slice(0,start)+begin+'\n'+operation+'\n'+input.content+'\n'+original.slice(finish);
    if(old){const backup=path.join(root,'.companion-backups');mkdirSync(backup,{recursive:true,mode:0o700});confined(backup);writeFileSync(path.join(backup,old.hash+'.md'),old.content,{mode:0o600});}
    temp=file+'.'+randomUUID()+'.tmp';writeFileSync(temp,content,{mode:0o600,flag:'wx'});
    const latest=existsSync(file)?readOwned(input.page):null;
    if((latest?.hash??null)!==(old?.hash??null))return {status:'conflict',currentHash:latest?.hash??null};
    confined(path.dirname(file));renameSync(temp,file);temp=null;
    return {status:'written',hash:hash(content)};
   }finally{if(temp&&existsSync(temp))unlinkSync(temp);closeSync(fd);unlinkSync(lock);}
  }
 };return vault;
}
