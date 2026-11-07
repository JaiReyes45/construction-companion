import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runProbe} from '../src/compat.mjs';
const args=process.argv.slice(2);
if(!args.includes('--isolated')) throw new Error('Pass --isolated; this probe never uses your active configuration');
const host=args[args.indexOf('--host')+1];
const fixtureRoot=await mkdtemp(path.join(tmpdir(),'companion-probe-'));
try { console.log(JSON.stringify(await runProbe({host,fixtureRoot}),null,2)); }
finally { await rm(fixtureRoot,{recursive:true,force:true}); }
