import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer, simulateRound } from '../src/career-engine.js';
import { applyConfidenceEvent, confidenceStructure, reconcileStructuralBoardTrust } from '../src/manager-confidence.js';
import { dispatchCareerEvent } from '../src/event-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

test('event bus records once and executes reducers in order',function(){
  let career=createCareer(clubs,clubs[0].id,2026),order=[];
  career=dispatchCareerEvent(career,{type:'TEST_EVENT',importance:2,payload:{ok:true}},[
    state=>{order.push('a');return{...state,testValue:1};},
    state=>{order.push('b');return{...state,testValue:state.testValue+1};},
  ]);
  assert.deepEqual(order,['a','b']);
  assert.equal(career.testValue,2);
  assert.equal(career.eventLedger.filter(e=>e.type==='TEST_EVENT').length,1);
});

test('fan legacy credit softens negative events but never amplifies them',function(){
  const base=createCareer(clubs,clubs[0].id,2026);
  const noCredit=applyConfidenceEvent({...base,managerConfidence:{...base.managerConfidence,fans:70}},{fans:-10,kind:'loss'});
  const withCredit=applyConfidenceEvent({...base,fanCredit:20,managerConfidence:{...base.managerConfidence,fans:70}},{fans:-10,kind:'loss'});
  assert.ok(withCredit.managerConfidence.fans>noCredit.managerConfidence.fans);
  assert.ok(withCredit.managerConfidence.fans<=70);
});

test('structural board trust is finite weighted and reconciles gradually',function(){
  let career=createCareer(clubs,clubs[0].id,2026);
  career={...career,managerConfidence:{...career.managerConfidence,board:55},cash:career.openingCash*.9};
  const structure=confidenceStructure(career);
  assert.ok(structure.target>=0&&structure.target<=100);
  assert.ok(Object.values(structure.inputs).every(Number.isFinite));
  const next=reconcileStructuralBoardTrust(career,{weight:.1});
  assert.ok(next.managerConfidence.board>=0&&next.managerConfidence.board<=100);
  assert.notEqual(next.managerConfidence.board,55);
});

test('real calendar dispatches each MATCH_FINISHED once and keeps league confidence bounded',function(){
  const career=simulateRound(createCareer(clubs,clubs[0].id,2026),clubs);
  const matches=career.eventLedger.filter(e=>e.type==='MATCH_FINISHED');
  const ids=new Set(matches.map(e=>e.id));
  const league=matches.filter(e=>e.payload?.competition==='Brasileirão Série A'&&e.payload?.stage==='Rodada 1');
  assert.equal(ids.size,matches.length,'MATCH_FINISHED events must never duplicate the same event id');
  assert.equal(league.length,1,'the first Brasileirao round must dispatch exactly once');
  assert.ok(career.managerConfidence.fans>=0&&career.managerConfidence.fans<=100);
  assert.ok(career.managerConfidence.board>=0&&career.managerConfidence.board<=100);
  assert.ok(Number.isFinite(career.managerConfidence.structuralBoardTarget));
});
