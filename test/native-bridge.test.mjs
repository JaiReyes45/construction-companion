import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {temporaryDirectory,scope,event} from './helpers.mjs';
import {projectIdentity} from '../src/lifecycle.mjs';
import {resolvePrivatePaths} from '../src/private-paths.mjs';
import {verifyContext,signContext} from '../src/host/context.mjs';
import {drainSpool} from '../src/host/spool.mjs';
import {openStore} from '../src/core/store.mjs';
import {createService} from '../src/core/service.mjs';
import {dispatchRpc} from '../src/host/rpc.mjs';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {registerTools} from '../src/mcp/tools.mjs';

test('installed hook entrypoint injects the signed native turn only for its enabled host',async t=>{
 const root=temporaryDirectory(t),projectRoot=path.join(root,'project'),base=path.join(root,'state');await mkdir(projectRoot);
 const env={...process.env,LOCALAPPDATA:base,XDG_STATE_HOME:base},identity=await projectIdentity(projectRoot),paths=resolvePrivatePaths({env,projectRoot:identity.root});await mkdir(paths.dataRoot,{recursive:true});
 await writeFile(path.join(paths.dataRoot,'project.json'),JSON.stringify({projectId:identity.id,hosts:['codex']}));
 const secret='s'.repeat(64);await writeFile(path.join(paths.dataRoot,'launch.json'),JSON.stringify({projectId:identity.id,contextSecret:secret,capabilities:{codex:{questionMode:'verified-short'},claude:{questionMode:'native-chat'}}}));
 const call=host=>new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/hook.mjs',import.meta.url)),'--host',host],{cwd:projectRoot,env,windowsHide:true,stdio:['pipe','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(Error('hook exit '+code)));child.stdin.end(JSON.stringify({cwd:projectRoot,hook_event_name:'UserPromptSubmit',session_id:'native-session',turn_id:'native-turn',prompt:'never-store-this-prompt'}));});
 const raw=await call('codex');assert.ok(raw,'Supported enabled native prompt must receive context');
 const context=JSON.parse(raw).hookSpecificOutput.additionalContext.split('context: ')[1];
 const verified=verifyContext(context,secret);assert.equal(verified.scope.projectId,identity.id);assert.equal(verified.scope.sessionId,'native-session');assert.equal(verified.turnId,'native-turn');
 const events=[];await drainSpool({directory:path.join(paths.dataRoot,'spool'),send:e=>events.push(e)});assert.equal(events[0].turnId,'native-turn');assert.ok(!JSON.stringify(events).includes('never-store-this-prompt'));
 assert.equal(await call('claude'),'');
});

test('daemon question capability is scoped by host and does not enable unverified Claude',async()=>{
 const secret='s'.repeat(64),service=createService({store:openStore(':memory:')});
 try{
  const claude={...scope,host:'claude'};service.ingest(event({...claude,type:'turn.start',turnId:'t',payload:{}}));
  const context=signContext({scope:claude,turnId:'t',expiresAt:Date.now()+5000},secret);
  const result=await dispatchRpc({service,contextSecret:secret,capability:{hosts:{codex:{questionMode:'verified-short'}}},data:{method:'ask',context,requestId:'r',input:{id:'q',text:'Question?',options:[],allowFreeText:true,timeoutMs:1}},signal:AbortSignal.timeout(50)});
  assert.deepEqual(result,{status:'fallback',reason:'unsupported'});
 }finally{service.close();}
});

test('MCP status and question routing follow a runner that becomes available after host startup',async t=>{
 let available=false;const server=new McpServer({name:'dynamic',version:'1'}),calls=[];
 registerTools(server,{capability:async()=>({questionMode:available?'verified-short':'native-chat',connected:available}),client:{call:async(method)=>{calls.push(method);return {status:'answered'}}}});
 const [a,b]=InMemoryTransport.createLinkedPair(),client=new Client({name:'dynamic-client',version:'1'});await server.connect(a);await client.connect(b);t.after(async()=>{await client.close();await server.close()});
 const args={context:'signed',id:'q',text:'Question?',options:[],allowFreeText:true};
 assert.equal((await client.callTool({name:'companion_ask',arguments:args})).structuredContent.status,'fallback');assert.deepEqual(calls,[]);
 available=true;assert.equal((await client.callTool({name:'companion_status',arguments:{}})).structuredContent.capability.connected,true);
 assert.equal((await client.callTool({name:'companion_ask',arguments:args})).structuredContent.status,'answered');assert.deepEqual(calls,['ask']);
});
