import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSavePayload, parseCareerSave, parseSafeJson } from '../src/save-format.js';
import { parsePlayerCareer } from '../src/player-career-engine.js';

test('safe JSON parser blocks prototype-pollution keys',function(){
  assert.throws(()=>parseSafeJson('{"__proto__":{"polluted":true}}'),/permitida|segurança/i);
  assert.equal({}.polluted,undefined);
});

test('manager save parser rejects oversized collections before they enter state',function(){
  const payload={signature:'linha-de-frente-save',fileVersion:1,career:{userClubId:'1',results:Array.from({length:2501},(_,i)=>({id:i}))}};
  assert.throws(()=>parseCareerSave(JSON.stringify(payload)),/não é um save válido/i);
});

test('save parser enforces a hard file-size limit',function(){
  const huge='{"x":"'+('a'.repeat(5_000_100))+'"}';
  assert.throws(()=>parseSafeJson(huge),/limite de segurança/i);
});

test('player save uses the same hardened parser',function(){
  const attack='{"signature":"linha-de-frente-player-save","fileVersion":1,"career":{"mode":"player","player":{"name":"X"},"__proto__":{"polluted":true}}}';
  assert.throws(()=>parsePlayerCareer(attack,[]),/permitida|segurança/i);
  assert.equal({}.polluted,undefined);
});
