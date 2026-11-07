import {readdir,readFile,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
const inside=(root,target)=>{const rel=path.relative(root,target);return !rel.startsWith('..')&&!path.isAbsolute(rel);};
const bounded=async(file,max=65536)=>{if((await stat(file)).size>max)throw Error('Metadata too large');return readFile(file,'utf8');};
const clean=s=>typeof s==='string'?s.slice(0,4000).replace(/[\u0000-\u001f]/g,' ').trim():'';
function metadata(text){
 const front=text.replace(/\r\n/g,'\n').match(/^---\n([\s\S]*?)\n---/);if(!front)return null;
 const result={};for(const line of front[1].split('\n')){const m=line.match(/^([a-zA-Z_-]+):\s*(.*)$/);if(m)result[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}return result;
}
export async function readInventory({roots=[],catalogPath}={}){
 let catalog=[];if(catalogPath){const raw=JSON.parse(await bounded(catalogPath,262144));if(!Array.isArray(raw))throw Error('Catalog must be an array');catalog=raw.slice(0,100).filter(s=>typeof s.id==='string'&&typeof s.name==='string'&&/^https:\/\//.test(s.source)&&Array.isArray(s.roles)).map(s=>({...s,availability:'catalog',provenance:'verified-catalog',reloadRequired:false}));}
 const installed=[];
 for(const configured of roots.slice(0,10)){
  let root,entries;try{root=await realpath(configured);entries=await readdir(root,{withFileTypes:true});}catch{continue;}
  for(const entry of entries.slice(0,256)){
   try{
    const directory=await realpath(path.join(root,entry.name));if(!inside(root,directory))continue;
    const file=await realpath(path.join(directory,'SKILL.md'));if(!inside(root,file))continue;
    const text=await bounded(file),front=metadata(text);if(!front?.name||!front.description)continue;
    let manifest={};try{const mf=await realpath(path.join(directory,'skill.json'));if(inside(root,mf))manifest=JSON.parse(await bounded(mf));}catch{}
    const name=clean(front.name),purpose=clean(front.description),candidate=manifest.repository??front.source;
    const source=typeof candidate==='string'&&/^https:\/\//.test(candidate)?candidate:'local:'+hash(directory);
    const known=catalog.find(s=>s.source===source&&s.name===name);
    installed.push({id:known?.id??hash(source+'\0'+name),name,purpose,source,revision:hash(text),version:clean(manifest.version)||'unknown',license:clean(manifest.license??front.license)||'unknown',roles:Array.isArray(manifest.roles)?manifest.roles.filter(x=>typeof x==='string').slice(0,6):[/design|ui.?ux|architect/i.test(name+' '+purpose)?'architect':'builder'],prerequisites:[],availability:'installed',reloadRequired:false,provenance:'local'});
   }catch{/* One malformed or escaped entry must not hide other installed skills. */}
  }
 }
 const ids=new Set(installed.map(s=>s.id));return [...installed,...catalog.filter(s=>!ids.has(s.id))];
}
export function skillContext({skills,goal='',role='',limit=20}){
 const words=String(goal).toLowerCase().match(/[a-z0-9]{3,}/g)??[];
 const score=s=>(s.roles?.includes(role)?10:0)+words.reduce((n,w)=>n+(String(s.name+' '+s.purpose).toLowerCase().includes(w)?1:0),0);
 return skills.filter(s=>score(s)>0).sort((a,b)=>(b.availability==='installed')-(a.availability==='installed')||score(b)-score(a)||a.id.localeCompare(b.id)).slice(0,Math.max(0,Math.min(20,limit)));
}
