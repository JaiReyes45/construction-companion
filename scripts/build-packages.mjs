import {cp,mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {codexPackage} from '../packaging/codex.mjs';
import {claudePackage} from '../packaging/claude.mjs';
export const hostManifest=host=>host==='codex'?codexPackage('0.1.0-preview.1'):host==='claude'?claudePackage('0.1.0-preview.1'):(()=>{throw Error('Unknown host')})();
export async function packageHash(root){
 const hash=createHash('sha256');
 async function walk(dir,prefix=''){for(const name of (await readdir(dir)).sort()){const full=path.join(dir,name),rel=prefix+name,s=await lstat(full);if(s.isSymbolicLink())throw Error('Package cannot contain symlinks');if(s.isDirectory())await walk(full,rel+'/');else{hash.update(rel+'\0');hash.update(await readFile(full));}}}
 await walk(root);return hash.digest('hex');
}
export async function buildPackages({sourceRoot,outputRoot,version}){
 const sources=['src','bin','public','skills','catalog','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md'];
 const result={hashes:{}};
 for(const host of ['codex','claude']){
  const root=path.join(outputRoot,host,'construction-companion');await mkdir(root,{recursive:true});
  for(const name of sources)await cp(path.join(sourceRoot,name),path.join(root,name),{recursive:true,errorOnExist:true,force:false});
  // Copy the pinned, script-free dependency tree produced by npm ci. Do not install on hook invocation.
  await cp(path.join(sourceRoot,'node_modules'),path.join(root,'node_modules'),{recursive:true,dereference:true});
  const descriptor=host==='codex'?codexPackage(version):claudePackage(version);
  for(const [name,value]of Object.entries(descriptor.files)){const dest=path.join(root,name);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,JSON.stringify(value,null,2)+'\n');}
  result[host+'Root']=root;result.hashes[host]=await packageHash(root);
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sourceRoot=fileURLToPath(new URL('..',import.meta.url)),version=JSON.parse(await readFile(path.join(sourceRoot,'package.json'),'utf8')).version;
 console.log(JSON.stringify(await buildPackages({sourceRoot,outputRoot:path.join(sourceRoot,'dist',version),version}),null,2));
}
