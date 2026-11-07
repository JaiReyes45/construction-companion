import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {inspectHost,runProbe} from '../src/compat.mjs';
test('missing and malformed hosts never claim native compatibility',async()=>{
  for(const run of [async()=>{throw Error('missing')},async()=>({stdout:'not a version'})]) {
    const c=await inspectHost({host:'claude',executable:'claude',run,platform:'win32'});
    assert.equal(c.hooks,'unverified'); assert.equal(c.questionMode,'native-chat');
    assert.equal(c.packageInstall,'unverified'); assert.equal(c.hostVersion,'unknown');
  }
});
test('version discovery alone does not establish hook compatibility',async()=>{
  const c=await inspectHost({host:'codex',executable:'codex',run:async()=>({stdout:'codex-cli 0.155.1'}),platform:'win32'});
  assert.equal(c.hostVersion,'0.155.1'); assert.equal(c.hooks,'unverified');
});
test('probe uses an isolated home and argument arrays with spaced paths',async t=>{
  const root=mkdtempSync(path.join(tmpdir(),'companion & probe '));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const calls=[];
  const r=await runProbe({host:'codex',executable:'codex',fixtureRoot:root,run:async(...args)=>{calls.push(args);return {stdout:'codex-cli 0.155.1'};}});
  assert.equal(r.hostVersion,'0.155.1');
  assert.ok(calls.every(([,args,opt])=>Array.isArray(args)&&opt.shell===false&&opt.env.CODEX_HOME.startsWith(root)));
  assert.ok(calls.every(([,args])=>!args.includes('add')));
});
