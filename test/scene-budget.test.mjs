import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSite} from '../public/site.mjs';
import {emptyScene} from '../public/projection.mjs';
const canvas=()=>({width:800,height:420,getContext:()=>new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})});
test('scene tears down its frame and reduced motion schedules none',()=>{
 const cancelled=[];const site=mountSite({canvas:canvas(),scene:emptyScene(),reducedMotion:false,requestFrame:()=>7,cancelFrame:id=>cancelled.push(id)});site.destroy();assert.deepEqual(cancelled,[7]);
 let calls=0;const quiet=mountSite({canvas:canvas(),scene:emptyScene(),reducedMotion:true,requestFrame:()=>{calls++;return 1},cancelFrame:()=>{}});quiet.update(emptyScene());quiet.destroy();assert.equal(calls,0);
});
test('paused scene stops scheduling and drawing makes no network/model calls',()=>{
 let frames=0;const site=mountSite({canvas:canvas(),scene:emptyScene(),reducedMotion:false,requestFrame:()=>++frames,cancelFrame:()=>{}});
 site.setPaused(true);site.update({...emptyScene(),tasks:{a:{status:'working',evidence:'observed'}}});assert.equal(frames,1);site.destroy();
});
