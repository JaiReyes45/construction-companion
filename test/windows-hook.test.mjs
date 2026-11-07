import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {temporaryDirectory} from './helpers.mjs';
import {codexPackage} from '../packaging/codex.mjs';

test('Codex Windows hooks resolve their root in PowerShell and cmd with spaces', {skip:process.platform!=='win32'}, async t=>{
 const root=path.join(temporaryDirectory(t),'plugin with spaces');await mkdir(path.join(root,'bin'),{recursive:true});
 await writeFile(path.join(root,'bin/hook.mjs'),"process.stdout.write(JSON.stringify({host:process.argv[process.argv.indexOf('--host')+1],cwd:process.cwd()}));");
 const command=codexPackage('test').files['hooks/hooks.json'].hooks.SessionStart[0].hooks[0].command_windows;
 for(const shell of ['powershell.exe',process.env.COMSPEC??'cmd.exe']){
  const isCmd=shell.toLowerCase().endsWith('cmd.exe');
  const child=spawn(shell,isCmd?['/d','/s','/c','"'+command+'"']:['-NoProfile','-NonInteractive','-Command',command],{cwd:root,env:{...process.env,PLUGIN_ROOT:root},windowsHide:true,windowsVerbatimArguments:isCmd});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.stdin.end('{}');
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
  assert.equal(code,0,shell+': '+stderr);assert.equal(JSON.parse(stdout).host,'codex');
 }
});
