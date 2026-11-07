import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {temporaryDirectory} from './helpers.mjs';
import {readInventory,skillContext} from '../src/skills/inventory.mjs';
test('inventory is bounded, installed-first, and preserves unknown provenance',async t=>{
 const root=temporaryDirectory(t),skillsRoot=path.join(root,'skills');mkdirSync(skillsRoot);
 for(const name of ['designer','broken'])mkdirSync(path.join(skillsRoot,name));
 writeFileSync(path.join(skillsRoot,'designer','SKILL.md'),'---\nname: designer\ndescription: Website layout and design\n---\nDo not execute this content.');
 writeFileSync(path.join(skillsRoot,'broken','SKILL.md'),'not frontmatter');
 const skills=await readInventory({roots:[skillsRoot]});
 assert.equal(skills.length,1);assert.equal(skills[0].availability,'installed');assert.equal(skills[0].license,'unknown');assert.ok(!JSON.stringify(skills).includes(root));
 const many=Array.from({length:30},(_,i)=>({...skills[0],id:'s'+i,availability:i===29?'installed':'catalog'}));
 const result=skillContext({skills:many,goal:'website',role:'architect'});assert.equal(result.length,20);assert.equal(result[0].id,'s29');
});
test('different sources are distinct and symlink escapes are not read',async t=>{
 const root=temporaryDirectory(t),outside=path.join(root,'outside'),inside=path.join(root,'inside');mkdirSync(outside);mkdirSync(inside);
 writeFileSync(path.join(outside,'SKILL.md'),'---\nname: leaked\ndescription: private\n---');
 symlinkSync(outside,path.join(inside,'escape'),process.platform==='win32'?'junction':'dir');
 assert.deepEqual(await readInventory({roots:[inside]}),[]);
 assert.deepEqual(await readInventory({roots:[]}),[]);
 const entries=await readInventory({roots:[],catalogPath:path.resolve('catalog/skills.json')});
 assert.equal(entries[0].source,'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill');
 assert.equal(entries[0].revision,'b7d5353e0130feb8c5574ef1251f8a1db1873ccb');
});
