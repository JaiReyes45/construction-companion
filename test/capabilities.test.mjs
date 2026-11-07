import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHostCapability} from '../src/host/capabilities.mjs';

test('game routing requires an exact supported host, version and platform',()=>{
 assert.equal(resolveHostCapability({host:'codex',hostVersion:'0.155.1',platform:'win32'}).questionMode,'verified-short');
 for(const input of [
  {host:'claude',hostVersion:'0.155.1',platform:'win32'},
  {host:'codex',hostVersion:'0.155.10',platform:'win32'},
  {host:'codex',hostVersion:'0.155.1',platform:'linux'},
  {host:'codex',hostVersion:'unknown',platform:'win32'},
  {host:'codex',hostVersion:'0.156.0',platform:'win32'}
 ])assert.equal(resolveHostCapability(input).questionMode,'native-chat');
});
