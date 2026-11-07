import path from 'node:path';
import {runDaemon,writePrivateJson} from '../src/lifecycle.mjs';
const [projectRoot,dataRoot,instance]=process.argv.slice(2);
try{await runDaemon({projectRoot,paths:{dataRoot},instance});}
catch(error){await writePrivateJson(path.join(dataRoot,'startup-error.json'),{instance,message:error.code==='SQLITE_CANTOPEN'?'Cannot open local project database.':'Runner startup failed; check Node version and private storage permissions.'}).catch(()=>{});process.exitCode=1;}
