import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,symlinkSync,existsSync} from 'node:fs';
import path from 'node:path';
import {temporaryDirectory} from './helpers.mjs';
import {openVault} from '../src/memory/vault.mjs';
test('memory starts disabled, writes idempotently and preserves user sections',async t=>{
 const root=path.join(temporaryDirectory(t),'vault'),vault=await openVault({root,projectId:'p',captureEnabled:false});
 const input={page:'decisions',expectedHash:null,operationId:'op1',content:'Use an architect'};
 assert.deepEqual(await vault.write(input),{status:'disabled'});assert.equal(existsSync(root),false);
 vault.setCapture(true);const first=await vault.write(input);assert.equal(first.status,'written');
 assert.deepEqual(await vault.write(input),first);
 const file=path.join(root,'Decisions.md');writeFileSync(file,readFileSync(file,'utf8')+'\nMy personal comment.\n');
 const conflict=await vault.write({...input,operationId:'op2',expectedHash:first.hash,content:'New decision'});assert.equal(conflict.status,'conflict');
 const edited=await vault.read('decisions');await vault.write({...input,operationId:'op2',expectedHash:edited.hash,content:'New decision'});assert.ok(readFileSync(file,'utf8').includes('My personal comment.'));
 vault.setCapture(false);assert.equal((await vault.write({...input,operationId:'op3'})).status,'disabled');
});
test('path escapes, junctions and unowned files cannot be overwritten',async t=>{
 const root=temporaryDirectory(t),vault=await openVault({root,projectId:'p',captureEnabled:true});
 await assert.rejects(()=>vault.write({page:'../escape',expectedHash:null,operationId:'o',content:'x'}));
 writeFileSync(path.join(root,'Decisions.md'),'User-owned existing note');
 await assert.rejects(()=>vault.write({page:'decisions',expectedHash:null,operationId:'o',content:'x'}));
 const outside=path.join(temporaryDirectory(t),'outside');mkdirSync(outside);
 symlinkSync(outside,path.join(root,'Workers'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(()=>vault.write({page:'workers/architect',expectedHash:null,operationId:'o',content:'x'}));
 assert.equal(existsSync(path.join(outside,'Architect.md')),false);
});
test('concurrent writes cannot both consume the same hash',async t=>{
 const root=temporaryDirectory(t),a=await openVault({root,projectId:'p',captureEnabled:true}),b=await openVault({root,projectId:'p',captureEnabled:true});
 const first=await a.write({page:'decisions',expectedHash:null,operationId:'initial',content:'Initial'});
 const results=await Promise.allSettled([a,b].map((vault,i)=>vault.write({page:'decisions',expectedHash:first.hash,operationId:'op'+i,content:'Choice '+i})));
 assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.status==='written').length,1);
});

test('CRLF editor saves remain owned and prior backup files are never overwritten',async t=>{
 const root=temporaryDirectory(t),vault=await openVault({root,projectId:'p',captureEnabled:true});
 await vault.write({page:'decisions',expectedHash:null,operationId:'1',content:'Initial'});
 const file=path.join(root,'Decisions.md');writeFileSync(file,readFileSync(file,'utf8').replaceAll('\n','\r\n'));
 const old=await vault.read('decisions'),backup=path.join(root,'.companion-backups');mkdirSync(backup);
 writeFileSync(path.join(backup,old.hash+'.md'),'Existing backup must survive');
 await assert.rejects(()=>vault.write({page:'decisions',expectedHash:old.hash,operationId:'2',content:'Changed'}),/backup/i);
 assert.equal(readFileSync(path.join(backup,old.hash+'.md'),'utf8'),'Existing backup must survive');
 assert.equal((await vault.read('decisions')).hash,old.hash);
});
