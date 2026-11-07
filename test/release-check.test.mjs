import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {temporaryDirectory} from './helpers.mjs';
import {checkRelease} from '../scripts/release-check.mjs';
test('only matching native receipts can establish a ready capability',async t=>{
 const root=temporaryDirectory(t),claim={host:'claude',hostVersion:'1',platform:'win32',packageHash:'a'.repeat(64),capability:'questions',ready:true};
 const fixture={...claim,kind:'fixture',passed:true};assert.equal((await checkRelease({root,claims:[claim],evidence:[fixture]})).ready,false);
 const native={...fixture,kind:'native',testedAt:new Date().toISOString()};assert.equal((await checkRelease({root,claims:[claim],evidence:[native]})).ready,true);
 assert.equal((await checkRelease({root,claims:[{...claim,hostVersion:'2'}],evidence:[native]})).ready,false);
 assert.equal((await checkRelease({root,claims:[{...claim,ready:false}],evidence:[]})).ready,true);
});
test('runtime files and credential patterns block publication',async t=>{
 const root=temporaryDirectory(t);await writeFile(path.join(root,'launch.json'),JSON.stringify({tokens:{ui:'synthetic'}}));
 const result=await checkRelease({root,claims:[],evidence:[]});assert.equal(result.ready,false);assert.ok(result.blockers.some(s=>s.includes('launch.json')));
});
