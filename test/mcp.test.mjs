import test from 'node:test';
import assert from 'node:assert/strict';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {registerTools} from '../src/mcp/tools.mjs';
import {createHostClient} from '../src/mcp/client.mjs';
test('MCP unsupported questions fall back once without invoking a broker',async t=>{
 const server=new McpServer({name:'test',version:'1'});let calls=0;
 registerTools(server,{capability:{questionMode:'native-chat'},client:{call:async()=>{calls++;throw Error('must not call')}}});
 const [a,b]=InMemoryTransport.createLinkedPair(),client=new Client({name:'fixture',version:'1'});
 await server.connect(a);await client.connect(b);t.after(async()=>{await client.close();await server.close()});
 const r=await client.callTool({name:'companion_ask',arguments:{context:'fixture',id:'q',text:'Audience?',options:[],allowFreeText:true}});
 assert.deepEqual(r.structuredContent,{status:'fallback',reason:'unsupported'});assert.equal(calls,0);
});
test('MCP forwards actual request identity and enforces report metadata schema',async t=>{
 const server=new McpServer({name:'test',version:'1'}),calls=[];
 registerTools(server,{capability:{questionMode:'verified-short'},client:{call:async(method,input,meta)=>{calls.push({method,input,meta});return {status:'answered'}}}});
 const [a,b]=InMemoryTransport.createLinkedPair(),client=new Client({name:'fixture',version:'1'});
 await server.connect(a);await client.connect(b);t.after(async()=>{await client.close();await server.close()});
 await client.callTool({name:'companion_ask',arguments:{context:'signed',id:'q',text:'Audience?',options:[],allowFreeText:true}});
 assert.equal(calls[0].input.timeoutMs,45000);assert.ok(calls[0].meta.requestId);assert.equal(calls[0].meta.context,'signed');
 const bad=await client.callTool({name:'companion_report',arguments:{context:'signed',event:{prompt:'secret'}}});assert.equal(bad.isError,true);
});
test('host RPC client preserves abort signal and refuses non-loopback endpoints',async()=>{
 assert.throws(()=>createHostClient({endpoint:'https://evil.test',token:'x'}));
 const signal=new AbortController().signal;let called;
 const client=createHostClient({endpoint:'http://127.0.0.1:1234',token:'i',fetchImpl:async(url,options)=>{called={url,options};return {ok:true,json:async()=>({ok:true})}}});
 assert.deepEqual(await client.call('status',{}, {context:'ctx',requestId:'r',signal}),{ok:true});
 assert.equal(called.options.signal,signal);assert.equal(JSON.parse(called.options.body).context,'ctx');
 assert.equal(called.options.headers.authorization,'Bearer i');
});
