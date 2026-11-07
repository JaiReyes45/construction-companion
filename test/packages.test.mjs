import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {temporaryDirectory} from './helpers.mjs';
import {buildPackages,hostManifest} from '../scripts/build-packages.mjs';
test('copied host packages are portable, contain distinct manifests and run standalone MCP status',async t=>{
 const root=temporaryDirectory(t),out=path.join(root,'packages with spaces');
 const a=await buildPackages({sourceRoot:process.cwd(),outputRoot:out,version:'0.1.0-preview.1'});
 for(const host of ['codex','claude']){
  const from=a[host+'Root'],dest=path.join(root,'copy '+host);await cp(from,dest,{recursive:true});
  const manifest=JSON.parse(await readFile(path.join(dest,host==='codex'?'.codex-plugin/plugin.json':'.claude-plugin/plugin.json'),'utf8'));
  assert.equal(manifest.name,'construction-companion');assert.equal(manifest.skills,'./skills/');
  const hooks=JSON.parse(await readFile(path.join(dest,'hooks/hooks.json'),'utf8'));assert.ok(hooks.hooks.UserPromptSubmit);
  assert.equal((await readdir(dest)).some(f=>['.scratch','.env','launch.json','.superpowers'].includes(f)),false);
  const client=new Client({name:'standalone-package-test',version:'1.0'}),transport=new StdioClientTransport({command:process.execPath,args:[path.join(dest,'bin/mcp.mjs'),'--host',host],cwd:root,stderr:'pipe'});
  await client.connect(transport);try{const tools=await client.listTools();assert.ok(tools.tools.some(x=>x.name==='companion_status'));const result=await client.callTool({name:'companion_status',arguments:{}});assert.ok(JSON.stringify(result).includes('native-chat'));}finally{await client.close();}
 }
 assert.equal(hostManifest('codex').installVerb,'add');assert.equal(hostManifest('claude').installVerb,'install');
 const b=await buildPackages({sourceRoot:process.cwd(),outputRoot:path.join(root,'second'),version:'0.1.0-preview.1'});assert.deepEqual(a.hashes,b.hashes);
});
