import test from 'node:test';
import assert from 'node:assert/strict';
import {makeViewModel} from '../public/view-model.mjs';
import {emptyScene} from '../public/projection.mjs';
import {createApi} from '../public/api.mjs';
const base={scene:emptyScene(),question:null,recommendations:null,installation:null,memory:{enabled:false,conflicts:0},connected:true};
test('native permissions expose a return instruction and no browser approval',()=>{
 const vm=makeViewModel({...base,scene:{...base.scene,permissions:{p:{status:'waiting'}}}});
 assert.ok(vm.statusText.includes('native'));assert.ok(!vm.actions.some(a=>['approve','execute-command'].includes(a.id)));
});
test('question state disables stale/offline actions and preserves text as data',()=>{
 const question={id:'q',version:1,status:'open',text:'Audience?',options:[{id:'x',label:'<script>alert(1)</script>'}],allowFreeText:true};
 const vm=makeViewModel({...base,question});assert.equal(vm.actions[0].label,question.options[0].label);assert.equal(vm.actions[0].enabled,true);
 assert.ok(makeViewModel({...base,question,connected:false}).actions.every(a=>!a.enabled));
 assert.equal(makeViewModel({...base,question:{...question,status:'answered'}}).actions.length,0);
 assert.equal(makeViewModel({...base,installation:{status:'awaiting-reload'}}).installationText,'Reload your coding host to finish setup.');
});
test('API authenticates, carries shown version and surfaces stale response without retry',async()=>{
 const calls=[],api=createApi({origin:'http://127.0.0.1:1234',token:'token',fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:false,status:409,json:async()=>({error:{code:'CONFLICT',message:'Stale question'}})}}});
 await assert.rejects(()=>api.answer('s',{id:'q',version:2,answer:{optionId:'a'}}),{code:'CONFLICT'});
 assert.equal(calls.length,1);assert.equal(calls[0].options.headers.authorization,'Bearer token');assert.equal(JSON.parse(calls[0].options.body).version,2);
 api.dispose();await assert.rejects(()=>api.sessions(),{code:'UNAUTHORIZED'});
});
