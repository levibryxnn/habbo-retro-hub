import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer, simulateRound } from '../src/career-engine.js';
import { competitionTable, finishPendingWorldFixture, nextCareerEvent, startWorldFixture, unifiedUserMatchHistory, worldCompetitionList } from '../src/competition-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

test('a new Brazilian career starts with its state championship before Brasileirao',function(){
  const career=createCareer(clubs,'874',2026);
  const next=nextCareerEvent(career,clubs);
  assert.equal(next.type,'world');
  assert.equal(next.competitionId,'paulista');
  assert.ok(next.date<'2026-01-28');
});

test('Corinthians 2026 calendar includes Paulista Supercopa Libertadores Copa do Brasil and world competitions',function(){
  const career=createCareer(clubs,'874',2026);
  const comps=worldCompetitionList(career,clubs);
  const byId=Object.fromEntries(comps.map(c=>[c.id,c]));
  assert.ok(byId.paulista.teams.includes('874'));
  assert.ok(byId.supercopa.teams.includes('874'));
  assert.ok(byId.libertadores.teams.includes('874'));
  assert.ok(byId['copa-do-brasil'].teams.includes('874'));
  assert.equal(byId['champions-league'].teams.length,36);
  assert.equal(byId['champions-league'].fixtures.filter(f=>f.phase==='league').length,144);
  assert.equal(byId['copa-do-brasil'].teams.length,32);
});

test('continental assignments reflect the 2026 Brazilian participants',function(){
  const saoPaulo=createCareer(clubs,'2026',2026);
  const comps=worldCompetitionList(saoPaulo,clubs);
  const lib=comps.find(c=>c.id==='libertadores'),sud=comps.find(c=>c.id==='sudamericana');
  assert.ok(!lib.teams.includes('2026'));
  assert.ok(sud.teams.includes('2026'));
});

test('regional competitions are only added to Serie A clubs that actually play them in 2026',function(){
  const chape=worldCompetitionList(createCareer(clubs,'9318',2026),clubs);
  const remo=worldCompetitionList(createCareer(clubs,'4936',2026),clubs);
  const vitoria=worldCompetitionList(createCareer(clubs,'3457',2026),clubs);
  assert.ok(chape.some(c=>c.id==='copa-sul-sudeste'));
  assert.ok(remo.some(c=>c.id==='copa-verde'));
  assert.ok(vitoria.some(c=>c.id==='copa-nordeste'));
});

test('full-season helper integrates early competitions instead of skipping directly to Serie A',function(){
  let career=createCareer(clubs,'874',2026);
  career=simulateRound(career,clubs);
  assert.equal(career.round,1);
  assert.ok((career.world?.history||[]).length>0);
  const paulista=worldCompetitionList(career,clubs).find(c=>c.id==='paulista');
  assert.ok(competitionTable(paulista).some(row=>row.played>0));
});


test('non-league matches support all three simulation modes with a resumable pending state',function(){
  for(const mode of ['normal','fast','instant']){
    const career=createCareer(clubs,'874',2026);
    const started=startWorldFixture(career,clubs,mode);
    assert.ok(started.pendingWorldMatch);
    assert.equal(started.pendingWorldMatch.mode,mode);
    assert.equal(started.pendingWorldMatch.competitionId,'paulista');
    assert.ok(started.pendingWorldMatch.result);
    const finished=finishPendingWorldFixture(started,clubs);
    assert.equal(finished.pendingWorldMatch,null);
    assert.equal(finished.world.lastUserMatch.competitionId,'paulista');
  }
});

test('pending world match keeps the exact fixture and deterministic result across sanitizable state',function(){
  const career=createCareer(clubs,'874',2026);
  const started=startWorldFixture(career,clubs,'fast');
  const snapshot=JSON.parse(JSON.stringify(started.pendingWorldMatch));
  assert.equal(snapshot.fixtureId,started.pendingWorldMatch.fixtureId);
  assert.deepEqual(snapshot.result,started.pendingWorldMatch.result);
});


test('pending world result remains authoritative even if career state changes while the match is open',function(){
  const career=createCareer(clubs,'874',2026);
  const started=startWorldFixture(career,clubs,'fast');
  const expected=started.pendingWorldMatch.result;
  const modified={...started,managerConfidence:{...started.managerConfidence,fans:25,board:33}};
  const finished=finishPendingWorldFixture(modified,clubs);
  assert.equal(finished.world.lastUserMatch.homeGoals,expected.homeGoals);
  assert.equal(finished.world.lastUserMatch.awayGoals,expected.awayGoals);
  assert.equal(finished.world.lastUserMatch.fixtureId,expected.fixtureId);
});

test('world-match start cannot skip an earlier Brasileirao commitment',function(){
  let career=createCareer(clubs,'874',2026);
  for(let guard=0;guard<50;guard++){
    const next=nextCareerEvent(career,clubs);
    if(next?.type==='brasileirao')break;
    career=finishPendingWorldFixture(startWorldFixture(career,clubs,'instant'),clubs);
  }
  const next=nextCareerEvent(career,clubs);
  assert.equal(next?.type,'brasileirao');
  assert.deepEqual(startWorldFixture(career,clubs,'normal'),career);
});


test('unified history includes cup matches with competition and stage metadata',function(){
  let career=createCareer(clubs,'874',2026);
  career=finishPendingWorldFixture(startWorldFixture(career,clubs,'instant'),clubs);
  const history=unifiedUserMatchHistory(career);
  assert.ok(history.length>=1);
  assert.equal(history[0].competition,'Paulistão');
  assert.ok(history[0].stage);
  assert.ok(history[0].date);
  assert.ok(['Vitória','Empate','Derrota'].includes(history[0].result));
});
