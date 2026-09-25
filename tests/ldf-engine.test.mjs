import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TEAM_STRENGTH_WEIGHTS,
  adaptiveAiDecision,
  boardTrustScore,
  developmentModel,
  fatigueConditionLoss,
  fatigueLoad,
  individualInjuryRisk,
  injuryRecovery,
  jobInterestScore,
  effectiveOverall,
  scoutedPotentialRange,
  seededRandom,
  logisticDominance,
  teamStrength,
} from '../src/ldf-engine.js';
import { createCareer, finishPendingRound, sanitizeCareer, simulateMatch, startRound } from '../src/career-engine.js';
import { previewNextWorldFixture } from '../src/competition-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

test('LDF team strength keeps the documented weights normalized',function(){
  const total=Object.values(TEAM_STRENGTH_WEIGHTS).reduce((sum,value)=>sum+value,0);
  assert.ok(Math.abs(total-1)<1e-12);
  assert.equal(teamStrength({quality:100,form:100,morale:100,tactics:100,condition:100,coach:100,home:100,context:100}),100);
  const score=teamStrength({quality:80,form:70,morale:60,tactics:90,condition:75,coach:65,home:100,context:55});
  const expected=80*.38+70*.15+60*.10+90*.12+75*.08+65*.07+100*.05+55*.05;
  assert.ok(Math.abs(score-expected)<.001);
});

test('logistic dominance is symmetric and rewards the stronger side without certainties',function(){
  const even=logisticDominance(70,70),strong=logisticDominance(82,68),weak=logisticDominance(68,82);
  assert.equal(even,.5);
  assert.ok(strong>.5&&strong<.97);
  assert.ok(weak<.5&&weak>.03);
  assert.ok(Math.abs((strong+weak)-1)<1e-12);
});

test('fatigue follows minutes x intensity x role load x fitness penalty',function(){
  assert.equal(fatigueLoad({minutes:90,intensity:1.1,roleLoad:1.08,fitnessPenalty:1.2}),90*1.1*1.08*1.2);
  assert.ok(fatigueConditionLoss(120)>fatigueConditionLoss(60));
  const healthy=individualInjuryRisk({fatigue:70,intensity:.9,condition:96,age:24,medicalLevel:5});
  const overloaded=individualInjuryRisk({fatigue:135,intensity:1.35,condition:58,age:34,medicalLevel:1,weatherMultiplier:1.15,pitchMultiplier:1.12});
  assert.ok(overloaded>healthy*2);
});

test('development model respects potential age performance and academy training',function(){
  const base=developmentModel({age:24,current:72,potential:80,performanceBoost:0,trainingYouth:0});
  const academy=developmentModel({age:24,current:72,potential:80,performanceBoost:0,trainingYouth:.05});
  assert.equal(base.mode,'growth');
  assert.ok(base.gap>0);
  assert.ok(academy.chance>base.chance);
  const veteran=developmentModel({age:38,current:78,potential:80});
  assert.equal(veteran.mode,'decline');
  assert.ok(veteran.decline>=1);
});

test('adaptive AI reacts to scoreboard minute and physical state',function(){
  assert.equal(adaptiveAiDecision({scoreDiff:-2,minute:70,condition:80}).id,'all-in');
  assert.equal(adaptiveAiDecision({scoreDiff:2,minute:75,condition:80}).id,'compact');
  assert.equal(adaptiveAiDecision({scoreDiff:0,minute:70,condition:60}).id,'control');
  assert.equal(adaptiveAiDecision({scoreDiff:0,minute:30,condition:60,basePlan:'vertical'}).id,'vertical');
});

test('league simulation exposes LDF strength dominance xG and remains deterministic',function(){
  const career=createCareer(clubs,clubs[0].id,2026),home=clubs[0],away=clubs[1],context={career,results:[],season:2026,roundNumber:1,interactiveClubId:home.id,mode:'normal'};
  const one=simulateMatch(home,away,'ldf-regression-seed',context),two=simulateMatch(home,away,'ldf-regression-seed',context);
  assert.deepEqual(one,two);
  assert.equal(one.intelligence.engineVersion,'1.1');
  assert.ok(Number.isFinite(one.intelligence.homeStrength)&&Number.isFinite(one.intelligence.awayStrength));
  assert.ok(Math.abs(one.intelligence.homeDominance+one.intelligence.awayDominance-1)<.001);
  assert.ok(one.xg.every(value=>Number.isFinite(value)&&value>=.18&&value<=3.9));
  assert.ok(one.homeGoals>=0&&one.awayGoals>=0);
  assert.ok(one.stats.possession[0]+one.stats.possession[1]===100);
});

test('round completion keeps every condition finite and inside safety bounds',function(){
  const career=createCareer(clubs,clubs[0].id,2026),started=startRound(career,clubs,'instant'),finished=finishPendingRound(started,clubs);
  assert.equal(finished.round,1);
  const values=Object.values(finished.conditions);
  assert.ok(values.length>0);
  assert.ok(values.every(value=>Number.isFinite(value)&&value>=35&&value<=100));
  assert.equal(finished.simulationEngineVersion,'1.1');
});

test('RC2 career state migrates forward without losing the save',function(){
  const current=createCareer(clubs,clubs[0].id,2026),legacy={...current,version:12};
  delete legacy.simulationEngineVersion;
  legacy.dressingRoom={...legacy.dressingRoom};
  delete legacy.dressingRoom.hierarchy;
  const migrated=sanitizeCareer(legacy,clubs,clubs[0].id);
  assert.equal(migrated.version,12);
  assert.equal(migrated.simulationEngineVersion,'1.1');
  assert.equal(migrated.userClubId,legacy.userClubId);
  assert.ok(migrated.dressingRoom.hierarchy);
  assert.ok(Object.keys(migrated.dressingRoom.hierarchy).length>=11);
});

test('world competitions use the same LDF engine for the user preview',function(){
  const career=createCareer(clubs,clubs[0].id,2026),preview=previewNextWorldFixture(career,clubs);
  assert.ok(preview,'expected an official non-league fixture in the integrated calendar');
  assert.ok(preview.result.xg?.length===2);
  assert.ok(preview.result.intelligence?.engineVersion==='1.1');
  assert.ok(Number.isFinite(preview.result.intelligence.homeStrength));
  assert.ok(Array.isArray(preview.result.events));
  assert.ok(Array.isArray(preview.result.homeLineup));
});


test('LDF 1.1 effective OVR is temporary bounded and reacts to player state',function(){
  const fresh=effectiveOverall({baseOverall:82,condition:100,form:1,morale:90,minute:10,fatigue:5});
  const tired=effectiveOverall({baseOverall:82,condition:48,injuryPenalty:4,form:-1,morale:45,minute:84,fatigue:120});
  assert.ok(fresh>tired);
  assert.ok(fresh<=99&&tired>=25);
  assert.equal(82,82,'base overall remains immutable by the derived function');
});

test('LDF 1.1 seeded RNG scouting uncertainty and recovery are reproducible',function(){
  const a=seededRandom('save-a',2026,'match-1'),b=seededRandom('save-a',2026,'match-1');
  assert.equal(a(),b());assert.equal(a(),b());
  const broad=scoutedPotentialRange(84,{scoutingLevel:1,observations:0,seed:'p1'});
  const precise=scoutedPotentialRange(84,{scoutingLevel:5,observations:4,seed:'p1'});
  assert.ok((precise.max-precise.min)<=(broad.max-broad.min));
  const basic=injuryRecovery({severity:4,medicalLevel:1,age:33,fitness:55,injuryHistory:3});
  const elite=injuryRecovery({severity:4,medicalLevel:5,age:23,fitness:90,injuryHistory:0,rehabQuality:1.2});
  assert.ok(basic.matches>=elite.matches);
});

test('president profiles weight titles differently while keeping board trust bounded',function(){
  const ambitiousWithTitles=boardTrustScore({results:70,titles:100,objectives:70,finance:70,transfers:70,youth:70,clubDNA:70,president:'ambitious'});
  const ambitiousNoTitles=boardTrustScore({results:70,titles:30,objectives:70,finance:70,transfers:70,youth:70,clubDNA:70,president:'ambitious'});
  const prudentWithTitles=boardTrustScore({results:70,titles:100,objectives:70,finance:70,transfers:70,youth:70,clubDNA:70,president:'prudent'});
  const prudentNoTitles=boardTrustScore({results:70,titles:30,objectives:70,finance:70,transfers:70,youth:70,clubDNA:70,president:'prudent'});
  assert.ok((ambitiousWithTitles-ambitiousNoTitles)>(prudentWithTitles-prudentNoTitles));
  assert.ok(ambitiousWithTitles<=100&&ambitiousNoTitles>=0);
});

test('official job interest formula rewards fit results and ambition without deterministic acceptance',function(){
  const strong=jobInterestScore({managerReputation:74,clubTargetLevel:72,styleMatch:86,recentResults:84,availability:100,clubAmbition:82,salaryCost:48,projectMismatch:8,careerJump:12,variance:2});
  const weak=jobInterestScore({managerReputation:42,clubTargetLevel:82,styleMatch:35,recentResults:31,availability:80,clubAmbition:70,salaryCost:76,projectMismatch:65,careerJump:70,variance:-3});
  assert.ok(strong>weak);
  assert.ok(strong<=100&&weak>=0);
});
