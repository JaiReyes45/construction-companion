import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startProject,stopProject,probeProject,privatePaths,readLaunch} from './lifecycle.mjs';
import {planInstall,applyInstall,uninstall} from './install.mjs';
import {inspectHost} from './compat.mjs';
import {readInventory} from './skills/inventory.mjs';
import {configureSkillRoots,nodeSupported} from './configuration.mjs';
import {resolveHostCapability} from './host/capabilities.mjs';
const execute=promisify(execFile);
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const help=`Construction Companion — local coding companion\n\nUse node bin/construction-companion.mjs <command> --project <folder>\n\ninstall --host codex|claude [--package <built package>] [--apply]\nconfigure --skill-root <folder> Add skill collections (repeat for multiple roots)\nstart                         Start the private local runner\nconnect [--copy-token]         Show local URL; explicitly copy token\ndoctor --host codex|claude     Check dependencies and compatibility\nstop                          Stop without deleting project data\nuninstall --host codex|claude Remove owned project activation\n\nBuild packages first: node scripts/build-packages.mjs\nReview native hook trust in your host. Unsupported host versions use native chat.\n`;
export async function copyToken(value){
 const command=process.platform==='win32'?'powershell.exe':process.platform==='darwin'?'pbcopy':'xclip';
 const args=process.platform==='win32'?['-NoProfile','-NonInteractive','-Command','$input | Set-Clipboard']:process.platform==='darwin'?[]:['-selection','clipboard'];
 await new Promise((resolve,reject)=>{const child=spawn(command,args,{windowsHide:true,stdio:['pipe','ignore','pipe']});child.on('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Clipboard unavailable. Install a supported local clipboard utility.')));child.stdin.on('error',reject);child.stdin.end(value);});
}
async function readJson(file){try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function doctor({projectRoot,host,run=execute}){
 const paths=await privatePaths(projectRoot),config=await readJson(path.join(paths.dataRoot,'project.json')),capability=await inspectHost({host,run});
 let storage={status:'not-created'};
 try{const metadata=await stat(paths.dataRoot);storage={status:process.platform==='win32'?'check-required':(metadata.mode&0o077)?'unsafe':'private'};
  if(process.platform==='win32'){
   const script='$a=Get-Acl -LiteralPath $env:CC_DATA_ROOT; $u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $bad=@($a.Access | Where-Object {$_.AccessControlType -eq "Allow" -and $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($u,"S-1-5-18","S-1-5-32-544")}); if($bad.Count -eq 0){"private"}else{"unsafe"}';
   try{const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:5000,env:{...process.env,CC_DATA_ROOT:paths.dataRoot}});storage.status=stdout.trim()==='private'?'private':'unsafe'}catch{storage.status='check-required'}
  }
 }catch(e){if(e.code!=='ENOENT')storage={status:'inaccessible'};}
 const inventory=await readInventory({roots:config?.skillRoots??[],catalogPath:path.join(sourceRoot,'catalog/skills.json')});
 const supported=resolveHostCapability(capability),service=await probeProject({projectRoot,paths});
 const connected=service.status==='running'&&config?.hosts?.includes(host);
 return {node:{version:process.versions.node,status:nodeSupported(process.versions.node)?'available':'upgrade-required'},host:{...capability,compatibility:supported},service,storage,superpowers:{status:inventory.some(s=>s.availability==='installed'&&/superpowers|brainstorming|using-superpowers/i.test(s.name+' '+s.id))?'discovered':'not-configured',action:'Install genuine Superpowers in your host; use configure --skill-root with its skills collection folder.'},questions:{status:supported.questionMode==='native-chat'?'unverified':connected?'compatible':'not-connected',mode:connected?supported.questionMode:'native-chat',reason:supported.questionMode==='native-chat'?'This host version and platform have no matching native acceptance receipt.':'Review hook trust and project trust in Codex, restart the host, and connect the local page. Version compatibility alone does not prove trust is enabled.'},checkedAt:new Date().toISOString()};
}
export async function runCli(argv,{run=execute,stdout=process.stdout,stderr=process.stderr,clipboard=copyToken}={}){
 try{
  const [command='help',...rest]=argv,options={};
  for(let i=0;i<rest.length;i++){const flag=rest[i];if(['--apply','--copy-token'].includes(flag))options[flag.slice(2)]=true;else if(['--host','--project','--package','--skill-root'].includes(flag)){if(!rest[i+1]||rest[i+1].startsWith('--'))throw Error('Missing value for '+flag);const value=rest[++i];if(flag==='--skill-root')(options.skillRoots??=[]).push(value);else options[flag.slice(2)]=value;}else throw Error('Unknown option '+flag);}
  const print=value=>stdout.write(typeof value==='string'?value+'\n':JSON.stringify(value,null,2)+'\n');
  if(['help','--help','-h'].includes(command)){stdout.write(help);return 0;}
  const projectRoot=path.resolve(options.project??process.cwd()),host=options.host??'codex';
  if(!['codex','claude'].includes(host))throw Error('Host must be codex or claude');
  if(command==='start'){print(await startProject({projectRoot}));return 0;}
  if(command==='stop'){await stopProject({projectRoot});print('Local runner stopped. Project history and notes retained.');return 0;}
  if(command==='doctor'){print(await doctor({projectRoot,host,run}));return 0;}
  if(command==='configure'){
   const paths=await privatePaths(projectRoot);print(await configureSkillRoots({dataRoot:paths.dataRoot,roots:options.skillRoots}));print('Skill collections saved. Stop and start the local runner to reload them.');return 0;
  }
  if(command==='connect'){
   const paths=await privatePaths(projectRoot),status=await probeProject({projectRoot,paths});if(status.status!=='running')throw Error('Start the local runner first.');
   print(status.origin);if(options['copy-token']){await clipboard((await readLaunch(paths)).tokens.ui);print('Connection token copied to your clipboard. Paste it in the local page.');}else print('Run connect with --copy-token to copy the connection token.');return 0;
  }
  if(command==='install'){
   const version=JSON.parse(await readFile(path.join(sourceRoot,'package.json'),'utf8')).version;
   const packageRoot=options.package??path.join(sourceRoot,'dist',version,host,'construction-companion');
   const plan=await planInstall({host,projectRoot,packageRoot});
   print({host,packageStorage:plan.packageStorage,activationScope:plan.activationScope,changedFiles:Object.values(plan.paths),commands:plan.commands,notice:plan.notice});
   if(options.apply){const capability=await inspectHost({host,run});if(capability.hostVersion==='unknown')throw Error('Install the selected coding host before applying setup.');await applyInstall(plan,{run});print('Project companion installed. Review native hooks, then restart your host.');}else print('Preview only. Repeat with --apply to install this project companion.');return 0;
  }
  if(command==='uninstall'){
   await stopProject({projectRoot});const paths=await privatePaths(projectRoot),receipt=await readJson(path.join(paths.dataRoot,'install-'+host+'.json'));if(!receipt)throw Error('No owned installation receipt exists for this host.');print(await uninstall({receipt,run}));return 0;
  }
  throw Error('Unknown command. Run help.');
 }catch(error){stderr.write((error.code==='ENOENT'?'Required package or file is missing. Build the host packages first.':error.message)+'\n');return 1;}
}
