import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
const execute=promisify(execFile);
export async function inspectHost({host,executable=host,run=execute,platform=process.platform,options={}}) {
  if(!['codex','claude'].includes(host)) throw new Error('Unsupported host');
  const result={host,hostVersion:'unknown',platform,hooks:'unverified',questionMode:'native-chat',packageInstall:'unverified'};
  try {
    const {stdout}=await run(executable,['--version'],{timeout:10000,maxBuffer:65536,windowsHide:true,...options,shell:false});
    const version=String(stdout).trim().match(/^(?:codex-cli\s+)?(\d+\.\d+\.\d+)(?:\s+\(Claude Code\))?$/);
    if(version) result.hostVersion=version[1];
  } catch { /* A missing or inaccessible host is a capability result. */ }
  return result;
}
export async function runProbe({host,executable=host,fixtureRoot,run=execute}) {
  if(!fixtureRoot) throw new Error('An isolated fixture root is required');
  await mkdir(fixtureRoot,{recursive:true});
  const root=await realpath(fixtureRoot);
  const isolated=path.join(root,'host-home');await mkdir(isolated,{recursive:true});
  return inspectHost({host,executable,run,platform:process.platform,options:{cwd:root,env:{...process.env,CODEX_HOME:isolated,CLAUDE_CONFIG_DIR:isolated}}});
}
