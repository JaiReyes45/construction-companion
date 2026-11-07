import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {temporaryDirectory} from './helpers.mjs';
import {configureSkillRoots,nodeSupported} from '../src/configuration.mjs';

test('skill roots require installed project and existing folders; configuration preserves unrelated options',async t=>{
 const root=temporaryDirectory(t),dataRoot=path.join(root,'private'),skills=path.join(root,'skills');await mkdir(dataRoot);await mkdir(skills);
 await assert.rejects(()=>configureSkillRoots({dataRoot,roots:[skills]}),/install/i);
 const file=path.join(dataRoot,'project.json');await writeFile(file,JSON.stringify({hosts:['codex'],projectId:'project',memory:false,skillRoots:[]}));
 await assert.rejects(()=>configureSkillRoots({dataRoot,roots:[path.join(root,'missing')]}));
 await configureSkillRoots({dataRoot,roots:[skills,skills]});
 const config=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(config.skillRoots,[await realpath(skills)]);assert.equal(config.memory,false);assert.deepEqual(config.hosts,['codex']);
});
test('Node support enforces the documented SQLite floor',()=>{
 for(const version of ['20.20.0','22.0.0','22.12.9','invalid'])assert.equal(nodeSupported(version),false);
 for(const version of ['22.13.0','22.16.0','24.0.0'])assert.equal(nodeSupported(version),true);
});
