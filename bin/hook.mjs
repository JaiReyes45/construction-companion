#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {privatePaths,readLaunch,projectIdentity} from '../src/lifecycle.mjs';
import {runHook} from '../src/host/hook.mjs';
try{
 let input='',bytes=0;for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>262144)process.exit(0);input+=chunk;}
 const raw=JSON.parse(input),host=process.argv[process.argv.indexOf('--host')+1];
 const identity=await projectIdentity(raw.cwd),paths=await privatePaths(identity.root);
 const config=JSON.parse(await readFile(path.join(paths.dataRoot,'project.json'),'utf8'));
 if(config.projectId!==identity.id||!config.hosts?.includes(host))process.exit(0);
 const launch=await readLaunch(paths);
 const questionSupportVerified=launch?.projectId===identity.id&&['verified-short','verified-long'].includes(launch.capabilities?.[host]?.questionMode);
 const result=runHook({host,input:raw,spoolDirectory:path.join(paths.dataRoot,'spool'),context:{projectId:identity.id,sequence:Date.now(),secret:launch?.contextSecret,questionSupportVerified}});
 if(result.additionalContext)process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:raw.hook_event_name,additionalContext:result.additionalContext}}));
}catch{/* Unconfigured and offline hooks never interrupt the user's coding session. */}
