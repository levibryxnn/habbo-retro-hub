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
