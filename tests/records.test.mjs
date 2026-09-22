import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, addWorldTitle } from '../src/career-engine.js';

const clubs=[{id:'sp',name:'São Paulo',abbreviation:'SAO',players:[]}];

test('Sao Paulo surpasses the world reference after seven managed world titles', function(){
  let career=createCareer(clubs,'sp',2026);
  for(let i=0;i<7;i++) career=addWorldTitle(career,'São Paulo');
  const record=career.messages.find(function(message){ return message.type==='record'; });
  assert.ok(record);
  assert.match(record.text,/10 títulos mundiais/);
  assert.match(record.text,/Real Madrid/);
});
