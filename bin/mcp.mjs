#!/usr/bin/env node
import {startMcp} from '../src/mcp/server.mjs';
import {createHostClient} from '../src/mcp/client.mjs';
import {privatePaths,readLaunch} from '../src/lifecycle.mjs';
const host=process.argv[process.argv.indexOf('--host')+1];
const paths=await privatePaths(process.cwd()),launch=await readLaunch(paths);
const capability={host,questionMode:'native-chat',hooks:'unverified',connected:Boolean(launch)};
const client={async call(method,input,options){const current=await readLaunch(paths);if(!current)throw Object.assign(Error('Start the local companion for this project.'),{code:'UNSUPPORTED'});return createHostClient({endpoint:current.origin,token:current.tokens.ingest}).call(method,input,options);}};
await startMcp({client,capability});
