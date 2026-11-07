import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {temporaryDirectory} from './helpers.mjs';
import {runCli} from '../src/cli.mjs';
test('help, invalid flags and doctor are explicit and do not reveal connection credentials',async t=>{
 const root=temporaryDirectory(t),output=[],errors=[],stdout={write:x=>output.push(x)},stderr={write:x=>errors.push(x)};
 assert.equal(await runCli(['help'],{stdout,stderr}),0);assert.ok(output.join('').includes('copy-token'));
 assert.equal(await runCli(['start','--bogus'],{stdout,stderr}),1);
 output.length=0;
 const run=async()=>{throw Error('missing')};
 assert.equal(await runCli(['doctor','--project',root,'--host','claude'],{stdout,stderr,run}),0);
 const report=JSON.parse(output.join(''));assert.equal(report.host.hostVersion,'unknown');assert.equal(report.questions.status,'unverified');assert.ok(!output.join('').includes('Bearer'));
});
