import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer } from '../src/career-engine.js';
import { deleteManualSaveSlot, listManualSaveSlots, parseCareerSave, saveFileName, serializeCareerSave, writeManualSaveSlot } from '../src/save-format.js';

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


test('manual local save slots can be written loaded and deleted without touching the autosave',function(){
  const store=new Map(),storage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  const career={...createCareer(clubs,club.id),managerName:'Levi'};
  writeManualSaveSlot(1,career,club,storage);
  let slots=listManualSaveSlots(storage);
  assert.equal(slots.length,2);
  assert.equal(slots[0].empty,false);
  assert.equal(slots[0].payload.career.managerName,'Levi');
  assert.equal(slots[1].empty,true);
  deleteManualSaveSlot(1,storage);
  slots=listManualSaveSlots(storage);
  assert.equal(slots[0].empty,true);
});
