import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {temporaryDirectory} from './helpers.mjs';
import {startProject,stopProject,readLaunch,probeProject} from '../src/lifecycle.mjs';
test('concurrent project starts share one authenticated service; stop and restart are bounded',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project with spaces'),paths={dataRoot:path.join(root,'private'),memoryRoot:path.join(root,'private','memory')};await mkdir(projectRoot);
 // Register cleanup after the temporary directory helper; explicitly stop before test return.
 try{
  const results=await Promise.all([startProject({projectRoot,paths}),startProject({projectRoot,paths})]);
  assert.equal(results[0].origin,results[1].origin);assert.equal(results.filter(r=>r.alreadyRunning).length,1);
  const launch=await readLaunch(paths);assert.notEqual(launch.tokens.ui,launch.tokens.ingest);assert.ok(!JSON.stringify(results).includes(launch.tokens.ui));
  assert.equal((await probeProject({projectRoot,paths})).status,'running');
  assert.equal((await fetch(launch.origin+'/host/control')).status,401);
  await stopProject({projectRoot,paths});assert.equal((await probeProject({projectRoot,paths})).status,'stopped');
  await startProject({projectRoot,paths});assert.notEqual((await readLaunch(paths)).tokens.ui,launch.tokens.ui);
 }finally{await stopProject({projectRoot,paths});}
});
test('a lock owned by a live unrelated process is never killed or recovered by PID alone',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),paths={dataRoot:path.join(root,'private')};await mkdir(projectRoot);await mkdir(paths.dataRoot);
 await writeFile(path.join(paths.dataRoot,'runtime-lock.json'),JSON.stringify({pid:process.pid,nonce:'unrelated'}));
 await assert.rejects(()=>startProject({projectRoot,paths,waitMs:150}),/lock|starting/i);
 assert.equal(JSON.parse(await readFile(path.join(paths.dataRoot,'runtime-lock.json'))).nonce,'unrelated');
});
