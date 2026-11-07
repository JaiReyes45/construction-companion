import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../src/core/store.mjs';
import {createIntent,requestIntent,verifyIntent,recordReview,failIntent} from '../src/skills/intents.mjs';
import {scope} from './helpers.mjs';
import {createService} from '../src/core/service.mjs';
import {handleInstallation} from '../src/skills/installation-service.mjs';
function fixture(t){const store=openStore(':memory:');t.after(()=>store.close());return {store,origin:{...scope,turnId:'t',requestId:'r'},taskId:'task',role:'architect',skill:{id:'fixture',source:'https://example.test/fixture',revision:'abc',availability:'catalog'},recipe:{source:'https://example.test/fixture',revision:'abc',destination:process.cwd(),scope:'project-local',expectedFiles:['SKILL.md'],prerequisites:[],command:{executable:'node',args:['fixture-installer.mjs']}},now:0};}
function reviewed(f,intent){recordReview({store:f.store,intentId:intent.id,origin:f.origin,question:{...f.origin,id:'review',version:1,status:'answered',answer:{optionId:'request-install'}},digest:intent.digest});}
test('review is mandatory, expires at ten minutes and is bound to exact fields',t=>{
 const f=fixture(t),a=createIntent(f);
 assert.equal(Date.parse(a.expiresAt),600000);
 const request={store:f.store,intentId:a.id,version:a.version,digest:a.digest,origin:{...f.origin,requestId:'next'},now:1};
 assert.throws(()=>requestIntent(request),{code:'CONFLICT'});reviewed(f,a);
 assert.equal(requestIntent(request).status,'requested');
 assert.throws(()=>requestIntent({...request,origin:{...f.origin,sessionId:'other'}}));
 const b=createIntent({...f,recipe:{...f.recipe,scope:'user'}});
 assert.notEqual(a.digest,b.digest);assert.throws(()=>requestIntent(request),{code:'CONFLICT'});
 reviewed(f,b);assert.throws(()=>requestIntent({...request,intentId:b.id,digest:b.digest,now:600000}),{code:'EXPIRED'});
});
test('download success is insufficient; identity and reload evidence are required',t=>{
 const f=fixture(t),a=createIntent(f);reviewed(f,a);requestIntent({store:f.store,intentId:a.id,origin:f.origin,version:1,digest:a.digest,now:1});
 const v={store:f.store,intentId:a.id,origin:f.origin,inventory:[{...f.skill,availability:'installed',reloadRequired:true}],now:2};
 assert.equal(verifyIntent({...v,hostReloaded:false}).status,'awaiting-reload');
 assert.equal(verifyIntent({...v,inventory:[{...v.inventory[0],revision:'wrong'}],hostReloaded:true}).status,'failed');
 assert.equal(failIntent({store:f.store,intentId:a.id,origin:f.origin,reason:'fixture failure'}).status,'failed');
 const b=createIntent(f);reviewed(f,b);requestIntent({store:f.store,intentId:b.id,origin:f.origin,version:1,digest:b.digest,now:1});
 assert.equal(verifyIntent({...v,intentId:b.id,hostReloaded:true}).status,'verified');
 assert.equal(f.store.scan('choice:').length,0);
});
test('missing recipe and pre-existing version do not silently install or overwrite',t=>{
 const f=fixture(t);assert.throws(()=>createIntent({...f,recipe:null}),{code:'UNSUPPORTED'});
 assert.throws(()=>createIntent({...f,skill:{...f.skill,availability:'installed'}}),{code:'CONFLICT'});
 assert.throws(()=>createIntent({...f,recipe:{...f.recipe,expectedFiles:['../escape']}}),{code:'INVALID'});
});
test('installation preparation waits for a real broker review before request',async t=>{
 const f=fixture(t),service=createService({store:f.store,installRecipes:{fixture:f.recipe}});
 service.inventory=async()=>[f.skill];const key=service.registerSession(scope);
 const pending=handleInstallation(service,'install_prepare',{taskId:f.taskId,role:f.role,skillId:f.skill.id},f.origin,{});
 for(let i=0;i<10&&!service.question(key);i++)await new Promise(setImmediate);
 const q=service.question(key);assert.ok(q.text.includes('project-local'));
 service.answer(key,{id:q.id,version:q.version,answer:{optionId:'request-install'}});
 const prepared=await pending;assert.equal(prepared.review.status,'answered');
 const requested=await handleInstallation(service,'install_request',{intentId:prepared.intent.id,version:1,digest:prepared.intent.digest}, {...f.origin,requestId:'next'},{});
 assert.equal(requested.status,'requested');service.broker.close();
});
