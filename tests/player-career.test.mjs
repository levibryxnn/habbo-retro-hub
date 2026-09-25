import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TRIAL_DRILLS,
  answerTrialDrill,
  completeTrial,
  createPlayerCareer,
  parsePlayerCareer,
  playerCareerOverall,
  sanitizePlayerCareer,
  serializePlayerCareer,
  setPlayerMatchApproach,
  simulatePlayerWeek,
  trialScore,
} from '../src/player-career-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

function finishTrial(career){
  let next=career;
  for(const drill of TRIAL_DRILLS)next=answerTrialDrill(next,drill.id,drill.choices[0].id);
  return completeTrial(next,clubs);
}

test('player career always starts at 16 with no selected club',function(){
  const career=createPlayerCareer({name:'Teste',position:'MEI',archetype:'technical',dreamClubId:clubs[0].id},2026);
  assert.equal(career.mode,'player');
  assert.equal(career.age,16);
  assert.equal(career.stage,'trial');
  assert.equal(career.clubId,null);
  assert.equal(career.dreamClubId,clubs[0].id);
  assert.ok(playerCareerOverall(career)>=40);
});

test('trial score is seeded and club entry comes only after all five drills',function(){
  const base=createPlayerCareer({name:'Teste Peneira',position:'ATA',archetype:'fast',dreamClubId:clubs[1].id},2026);
  let answered=base;
  for(const drill of TRIAL_DRILLS)answered=answerTrialDrill(answered,drill.id,drill.choices[0].id);
  const first=trialScore(answered),second=trialScore(answered);
  assert.equal(first,second);
  assert.ok(first>=0&&first<=100);
  const signed=completeTrial(answered,clubs);
  assert.equal(signed.stage,'academy');
  assert.ok(signed.clubId);
  assert.equal(signed.trial.completed,true);
  assert.equal(signed.trial.score,first);
});

test('weekly player simulation keeps all sensitive values bounded across seasons',function(){
  let career=finishTrial(createPlayerCareer({name:'Longo Prazo',position:'DEF',archetype:'strong',dreamClubId:clubs[2].id},2026));
  for(let i=0;i<80;i++)career=simulatePlayerWeek(career,clubs);
  assert.ok(career.age>=17);
  assert.ok(career.season>=2027);
  assert.ok(career.player.condition>=35&&career.player.condition<=100);
  assert.ok(career.player.morale>=0&&career.player.morale<=100);
  assert.ok(career.player.coachTrust>=0&&career.player.coachTrust<=100);
  assert.ok(playerCareerOverall(career)>=40&&playerCareerOverall(career)<=95);
  assert.ok(career.careerStats.matches>=0);
});

test('portable player save round-trips without touching manager save format',function(){
  const original=finishTrial(createPlayerCareer({name:'Portátil',position:'GOL',archetype:'technical',dreamClubId:clubs[3].id},2026));
  const raw=serializePlayerCareer(original),restored=parsePlayerCareer(raw,clubs);
  assert.equal(restored.mode,'player');
  assert.equal(restored.player.name,'Portátil');
  assert.equal(restored.clubId,original.clubId);
  assert.equal(restored.version,1);
  assert.ok(sanitizePlayerCareer(restored,clubs));
});


test('trial creates a bounded youth contract without letting the user choose the initial club directly',function(){
  const signed=finishTrial(createPlayerCareer({name:'Contrato Base',position:'MEI',archetype:'creator',dreamClubId:clubs[0].id},2026));
  assert.ok(signed.clubId);
  assert.ok(signed.contract);
  assert.equal(signed.contract.kind,'youth');
  assert.equal(signed.contract.clubId,signed.clubId);
  assert.ok(signed.contract.salaryMonthly>=2500);
  assert.ok(signed.contract.expirySeason>signed.season);
});

test('player match approach is a persistent bounded decision independent from training focus',function(){
  let career=finishTrial(createPlayerCareer({name:'Postura',position:'ATA',archetype:'finisher',dreamClubId:clubs[3].id},2026));
  career=setPlayerMatchApproach(career,'aggressive');
  assert.equal(career.matchApproach,'aggressive');
  assert.equal(career.trainingFocus,'balanced');
  const advanced=simulatePlayerWeek(career,clubs);
  assert.equal(advanced.matchApproach,'aggressive');
  assert.ok(advanced.player.condition>=35&&advanced.player.condition<=100);
});

test('player save sanitizer clamps extended career and contract fields',function(){
  const signed=finishTrial(createPlayerCareer({name:'Sanitize',position:'DEF',archetype:'strong',dreamClubId:clubs[4].id},2026));
  const bad={...signed,matchApproach:'hack',nationalTeamStatus:'god',contract:{...signed.contract,salaryMonthly:Infinity,expirySeason:9999},player:{...signed.player,morale:999,condition:-20,coachTrust:999,reputation:-5},awards:Array.from({length:100},(_,i)=>({id:'a'+i}))};
  const clean=sanitizePlayerCareer(bad,clubs);
  assert.equal(clean.matchApproach,'balanced');
  assert.equal(clean.nationalTeamStatus,'none');
  assert.equal(clean.player.morale,100);
  assert.equal(clean.player.condition,35);
  assert.equal(clean.player.coachTrust,100);
  assert.equal(clean.player.reputation,1);
  assert.ok(clean.contract.expirySeason<=2110);
  assert.equal(clean.awards.length,60);
});