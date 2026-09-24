import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer } from '../src/career-engine.js';
import { parseCareerSave, saveFileName, serializeCareerSave } from '../src/save-format.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs,club=clubs[0];

test('portable LDF save round-trips the full career state',function(){
  const career={...createCareer(clubs,club.id),managerName:'Levi',managerProfile:'negotiator'};
  const text=serializeCareerSave(career,club),payload=parseCareerSave(text);
  assert.equal(payload.signature,'linha-de-frente-save');
  assert.equal(payload.career.managerName,'Levi');
  assert.equal(payload.career.managerProfile,'negotiator');
  assert.equal(payload.career.userClubId,club.id);
});

test('portable save uses a small dedicated file instead of embedding the game HTML',function(){
  const career=createCareer(clubs,club.id),text=serializeCareerSave(career,club);
  assert.ok(text.length<500000);
  assert.ok(!text.includes('<script'));
  assert.match(saveFileName(career,club),/\.ldf$/);
});

test('invalid files are rejected explicitly',function(){
  assert.throws(()=>parseCareerSave('not-json'),/inválido/i);
  assert.throws(()=>parseCareerSave(JSON.stringify({hello:'world'})),/não é um save válido/i);
});
