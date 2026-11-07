import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function checkRelease({root,claims,evidence}){
 const blockers=[],warnings=[];
 for(const claim of claims){
  if(!claim.ready){warnings.push(claim.host+' '+claim.capability+': preview / unverified');continue;}
  const receipt=evidence.find(e=>e.kind==='native'&&e.passed===true&&['host','hostVersion','platform','packageHash','capability'].every(k=>e[k]===claim[k])&&Date.parse(e.testedAt)>Date.now()-30*86400000&&Date.parse(e.testedAt)<=Date.now());
  if(!receipt)blockers.push('Missing matching successful native evidence: '+claim.host+' '+claim.capability);
 }
 const excluded=new Set(['.git','node_modules','.scratch','.superpowers','dist']);
 async function scan(dir,prefix=''){
  for(const name of await readdir(dir)){if(excluded.has(name))continue;const full=path.join(dir,name),relative=prefix+name,s=await lstat(full);
   if(s.isSymbolicLink()){blockers.push('Symlink in release source: '+relative);continue;}
   if(/^(?:\.env(?:\..*)?|launch\.json|project\.json|runtime-lock\.json|auth\.json)$/.test(name)||/\.(?:db|sqlite)(?:-|$)|\.bundle$|\.log$/.test(name))blockers.push('Private/runtime file: '+relative);
   if(s.isDirectory()){await scan(full,relative+'/');continue;}
   if(s.size>2097152||!/[.](?:md|mjs|js|json|yml|yaml|toml|txt|html|css)$/.test(name))continue;
   const text=await readFile(full,'utf8');
   if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/.test(text))blockers.push('Potential credential in '+relative);
  }
 }
 await scan(root);return {ready:blockers.length===0,blockers,warnings};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../',import.meta.url));
 const {claims,evidence}=JSON.parse(await readFile(path.join(root,'docs/evidence/release.json'),'utf8'));
 const result=await checkRelease({root,claims,evidence});console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:1;
}
