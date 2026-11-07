import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {writePrivateJson} from './lifecycle.mjs';

export function nodeSupported(version){
 const match=String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);if(!match)return false;
 const [,major,minor]=match.map(Number);return major>22||major===22&&minor>=13;
}
export async function configureSkillRoots({dataRoot,roots}){
 const file=path.join(dataRoot,'project.json');let config;
 try{config=JSON.parse(await readFile(file,'utf8'))}catch(error){if(error.code==='ENOENT')throw Error('Install this project companion before configuring skill roots.');throw error;}
 if(!config.hosts?.length)throw Error('Install this project companion before configuring skill roots.');
 if(!Array.isArray(roots)||!roots.length||roots.length>10)throw Error('Provide one to ten skill collection folders.');
 const resolved=[];for(const root of roots){const directory=await realpath(root);if(!(await stat(directory)).isDirectory())throw Error('A skill root must be a folder.');if(!resolved.includes(directory))resolved.push(directory);}
 await writePrivateJson(file,{...config,skillRoots:resolved});return {skillRoots:resolved,restartRequired:true};
}
