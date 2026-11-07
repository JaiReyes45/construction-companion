#!/usr/bin/env node
import {startMcp} from '../src/mcp/server.mjs';
import {createHostClient} from '../src/mcp/client.mjs';
import {privatePaths,readLaunch,projectIdentity,probeProject} from '../src/lifecycle.mjs';
import {inspectHost} from '../src/compat.mjs';
import {resolveHostCapability} from '../src/host/capabilities.mjs';
const host=process.argv[process.argv.indexOf('--host')+1];
const identity=await projectIdentity(process.cwd()),paths=await privatePaths(identity.root),native=resolveHostCapability(await inspectHost({host}));
const capability=async()=>{
 const launch=await readLaunch(paths),live=await probeProject({projectRoot:identity.root,paths});
 const connected=live.status==='running'&&live.instance===launch?.instance&&launch?.projectId===identity.id;
 const enabled=connected&&launch.capabilities?.[host]?.hostVersion===native.hostVersion;
 return {...native,questionMode:enabled?native.questionMode:'native-chat',connected,enabled:Boolean(enabled)};
};
const client={async call(method,input,options){const current=await readLaunch(paths);if(!current)throw Object.assign(Error('Start the local companion for this project.'),{code:'UNSUPPORTED'});return createHostClient({endpoint:current.origin,token:current.tokens.ingest}).call(method,input,options);}};
await startMcp({client,capability});
