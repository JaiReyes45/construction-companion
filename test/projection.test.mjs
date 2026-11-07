import test from 'node:test';
import assert from 'node:assert/strict';
import {event} from './helpers.mjs';
import {emptyScene,applyEvent,projectScene} from '../public/projection.mjs';
test('replay is deterministic; unknown and declared work cannot complete construction',()=>{
 const events=[{...event(),cursor:1},{...event({type:'skill.declare',skillId:'ux',evidence:'declared'}),cursor:2},{...event({type:'task.complete',evidence:'unknown',payload:{success:true}}),cursor:3}];
 const scene=projectScene(events);assert.deepEqual(events.reduce(applyEvent,emptyScene()),scene);assert.deepEqual(applyEvent(scene,events[2]),scene);
 assert.notEqual(scene.tasks['task-a'].status,'completed');assert.equal(scene.skills.ux.state,'declared');
});
test('terminal tasks resist late starts; native actors and permission waits stay distinct',()=>{
 const events=[{...event({type:'task.fail'}),cursor:1},{...event(),cursor:2},{...event({type:'actor.start',actorId:'native-a'}),cursor:3},{...event({type:'permission.wait'}),cursor:4},{...event({type:'history.gap'}),cursor:5}];
 const s=projectScene(events);assert.equal(s.tasks['task-a'].status,'failed');assert.equal(s.actors['native-a'].status,'working');assert.equal(s.permissions['task-a'].status,'waiting');assert.equal(s.historyGap,true);
 const complete=applyEvent(s,{...event({taskId:'new-task',type:'task.complete',payload:{success:true}}),cursor:6});assert.equal(complete.tasks['new-task'].status,'completed');
});
test('prototype-like identifiers remain data rather than object properties',()=>{
 const s=projectScene([{...event({taskId:'__proto__'}),cursor:1}]);assert.equal(Object.hasOwn(s.tasks,'__proto__'),true);assert.equal(s.tasks['__proto__'].status,'working');
});
