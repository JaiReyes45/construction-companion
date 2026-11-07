import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../src/core/store.mjs';
import {createQuestionBroker} from '../src/questions.mjs';
import {createSkillChoices} from '../src/skills/choices.mjs';
import {scope} from './helpers.mjs';
const tick=()=>new Promise(setImmediate);
function fixture(t){
 const store=openStore(':memory:'),broker=createQuestionBroker({store}),origin={...scope,turnId:'t',requestId:'r'};
 const skills=[{id:'ux',name:'Designer',purpose:'Website design',roles:['architect'],source:'local:fixture',revision:'r1',license:'MIT',availability:'installed',reloadRequired:false},{id:'catalog',name:'Other',source:'https://example.test',revision:'r2',availability:'catalog',reloadRequired:false}];
 const choices=createSkillChoices({store,broker,inventory:async()=>skills});
 t.after(()=>{broker.close();store.close()});
 const offer={taskId:'website',role:'architect',candidates:[{taskId:'website',role:'architect',skillId:'ux',reason:'Design the website'}]};
 const reply=optionId=>{const q=broker.get(scope);broker.reply({...origin,id:q.id,version:q.version,answer:{optionId}})};
 return {store,broker,origin,skills,choices,offer,reply};
}
test('accept selects installed revision; catalog selection creates no binding',async t=>{
 const f=fixture(t);let p=f.choices.offer(f.origin,f.offer,{});await tick();f.reply('skill:ux');
 assert.equal((await p).choice.action,'use');assert.equal(f.choices.bindings(scope,'website')[0].state,'selected');assert.equal(f.store.list(scope,{}).length,0);
 const offer={...f.offer,role:'designer',candidates:[{taskId:'website',role:'designer',skillId:'catalog',reason:'Alternative'}]};
 p=f.choices.offer(f.origin,offer,{});await tick();f.reply('skill:catalog');assert.equal((await p).choice.action,'request-install');assert.equal(f.choices.bindings(scope,'website').length,1);
});
test('decline suppresses repeat prompts until explicit reopen; alternate and cancellation are normal',async t=>{
 const f=fixture(t);let p=f.choices.offer(f.origin,f.offer,{});await tick();f.reply('decline');assert.equal((await p).choice.action,'decline');
 const old=f.broker.get(scope);assert.equal((await f.choices.offer(f.origin,f.offer,{})).choice.action,'decline');assert.equal(f.broker.get(scope).id,old.id);
 f.choices.reopen(scope,f.offer);p=f.choices.offer(f.origin,f.offer,{});await tick();f.reply('choose-another');assert.equal((await p).choice.action,'choose-another');
 p=f.choices.offer(f.origin,f.offer,{});await tick();f.broker.cancel(f.origin);assert.equal((await p).status,'cancelled');assert.deepEqual(f.choices.bindings(scope,'website'),[]);
});
test('unknown candidates, missing reasons, excess choices and changed revisions reject',async t=>{
 const f=fixture(t);
 for(const candidates of [[{...f.offer.candidates[0],skillId:'missing'}],[{...f.offer.candidates[0],reason:''}],Array(4).fill(f.offer.candidates[0])])await assert.rejects(()=>f.choices.offer(f.origin,{...f.offer,candidates},{}));
 const p=f.choices.offer(f.origin,f.offer,{});await tick();f.skills[0].revision='changed';f.reply('skill:ux');await assert.rejects(()=>p,{code:'CONFLICT'});assert.deepEqual(f.choices.bindings(scope,'website'),[]);
});
