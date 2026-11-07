import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {temporaryDirectory} from './helpers.mjs';
import {planInstall,applyInstall as applyActualInstall,uninstall} from '../src/install.mjs';
const applyInstall=(plan,options={})=>applyActualInstall(plan,{registerCodex:async()=>{},...options});

test('Codex setup registers the native package before enabling project activation',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),packageRoot=path.join(root,'package');await mkdir(projectRoot);await mkdir(packageRoot);
 const plan=await planInstall({host:'codex',projectRoot,packageRoot,receiptRoot:path.join(root,'private')});let called=false;
 await applyInstall(plan,{registerCodex:async actual=>{called=true;assert.equal(actual.selector,plan.selector);assert.ok((await readFile(actual.paths.market,'utf8')).includes('construction-companion'));await assert.rejects(()=>readFile(actual.paths.config),{code:'ENOENT'});}});
 assert.equal(called,true,'Native registration must run, not only project config edits');
});
test('Codex setup is project scoped, previews without writes, and removal preserves unrelated settings',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project with spaces'),packageRoot=path.join(root,'package'),receiptRoot=path.join(root,'private');
 await mkdir(path.join(projectRoot,'.codex'),{recursive:true});await mkdir(path.join(packageRoot,'.codex-plugin'),{recursive:true});await writeFile(path.join(packageRoot,'.codex-plugin/plugin.json'),JSON.stringify({name:'construction-companion',version:'0.1.0-preview.1'}));
 const original='model = "example"\n';await writeFile(path.join(projectRoot,'.codex/config.toml'),original);
 const plan=await planInstall({host:'codex',projectRoot,packageRoot,receiptRoot});assert.equal(plan.activationScope,'project');assert.equal(await readFile(path.join(projectRoot,'.codex/config.toml'),'utf8'),original);
 const receipt=await applyInstall(plan);assert.equal(receipt.host,'codex');assert.ok((await readFile(path.join(projectRoot,'.codex/config.toml'),'utf8')).startsWith(original));
 await writeFile(path.join(projectRoot,'.codex/config.toml'),await readFile(path.join(projectRoot,'.codex/config.toml'),'utf8')+'\n# User added a comment\n');
 const removed=await uninstall({receipt});assert.deepEqual(removed.conflicts,[]);assert.equal(await readFile(path.join(projectRoot,'.codex/config.toml'),'utf8'),original+'\n# User added a comment\n');
 await access(packageRoot);
});
test('setup refuses drift and uninstall retains externally edited owned entries',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),packageRoot=path.join(root,'package'),receiptRoot=path.join(root,'private');await mkdir(projectRoot);await mkdir(path.join(packageRoot,'.codex-plugin'),{recursive:true});await writeFile(path.join(packageRoot,'.codex-plugin/plugin.json'),'{}');
 const plan=await planInstall({host:'codex',projectRoot,packageRoot,receiptRoot});await mkdir(path.join(projectRoot,'.codex'));await writeFile(path.join(projectRoot,'.codex/config.toml'),'changed');
 await assert.rejects(()=>applyInstall(plan),/changed/i);
 const current=await planInstall({host:'codex',projectRoot,packageRoot,receiptRoot});const receipt=await applyInstall(current);
 const cfg=path.join(projectRoot,'.codex/config.toml');await writeFile(cfg,(await readFile(cfg,'utf8')).replace('enabled = true','enabled = false'));
 const result=await uninstall({receipt});assert.ok(result.conflicts.length);assert.ok((await readFile(cfg,'utf8')).includes('enabled = false'));
});
test('Claude preview uses its native command array and concrete local activation',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),packageRoot=path.join(root,'package');await mkdir(projectRoot);await mkdir(packageRoot);
 const plan=await planInstall({host:'claude',projectRoot,packageRoot,receiptRoot:path.join(root,'private')});
 assert.equal(plan.activationScope,'local');assert.ok(plan.commands.some(c=>c.args.includes('install')&&c.args.includes('local')));assert.ok(plan.commands.every(c=>Array.isArray(c.args)));
});

test('both hosts can coexist and each uninstall preserves the other host ignore entry',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),packageRoot=path.join(root,'package'),receiptRoot=path.join(root,'private');await mkdir(projectRoot);await mkdir(packageRoot);
 const codex=await applyInstall(await planInstall({host:'codex',projectRoot,packageRoot,receiptRoot}));
 const claude=await applyInstall(await planInstall({host:'claude',projectRoot,packageRoot,receiptRoot}),{run:async()=>({stdout:''})});
 await uninstall({receipt:codex});const ignore=await readFile(path.join(projectRoot,'.gitignore'),'utf8');assert.ok(ignore.includes('construction-companion claude'));assert.ok(!ignore.includes('construction-companion codex'));
 await uninstall({receipt:claude,run:async()=>({stdout:''})});assert.ok(!(await readFile(path.join(projectRoot,'.gitignore'),'utf8')).includes('/.construction-companion/'));
});
