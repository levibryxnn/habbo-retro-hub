import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageDevelopmentCurve,
  moraleAfterEvent,
  playerDevelopmentScore,
  playerMarketValue,
  playerTransferInterest,
  positionPerformanceMetrics,
  starterProbability,
} from '../src/player-career-intelligence.js';

test('age curves grow young outfield players and decline older players with keeper delay',function(){
  assert.ok(ageDevelopmentCurve(18,'ATA','p1')>0);
  assert.ok(ageDevelopmentCurve(36,'ATA','p1')<0);
  assert.ok(ageDevelopmentCurve(36,'GOL','p1')>ageDevelopmentCurve(36,'ATA','p1'));
});

test('development score rewards potential minutes performance morale and regularity',function(){
  const low=playerDevelopmentScore({age:19,current:68,potential:82,trainingFactor:.8,minutesFactor:.15,performance:6.0,morale:50,competitionLevel:60,regularity:.3,seed:'dev',period:1});
  const high=playerDevelopmentScore({age:19,current:68,potential:88,trainingFactor:1.2,minutesFactor:.9,performance:7.6,morale:88,competitionLevel:75,regularity:.9,seed:'dev',period:1});
  assert.ok(high.score>low.score);
  assert.equal(high.randomFactor,playerDevelopmentScore({age:19,current:68,potential:88,trainingFactor:1.2,minutesFactor:.9,performance:7.6,morale:88,competitionLevel:75,regularity:.9,seed:'dev',period:1}).randomFactor);
});

test('starter probability responds to quality form fitness trust and performance without permanent status',function(){
  const bench=starterProbability({quality:62,form:-1,fitness:60,tacticalCompatibility:55,managerTrust:35,recentPerformance:5.8,competition:72,roleCompetition:74});
  const starter=starterProbability({quality:78,form:1.2,fitness:94,tacticalCompatibility:84,managerTrust:83,recentPerformance:7.7,competition:72,roleCompetition:74});
  assert.ok(starter.probability>bench.probability);
  assert.ok(bench.probability>=.03&&starter.probability<=.96);
});

test('morale smoothing prevents one event from causing absurd jumps',function(){
  const next=moraleAfterEvent(80,20,.25);
  assert.equal(next,65);
  assert.ok(next>20&&next<80);
});

test('market value is bounded and reacts to ability potential age contract league and reputation',function(){
  const prospect=playerMarketValue({position:'ATA',overall:80,potential:91,age:21,form:1,leagueLevel:82,contractYears:4,reputation:75});
  const veteran=playerMarketValue({position:'ATA',overall:70,potential:72,age:35,form:-1,leagueLevel:58,contractYears:1,reputation:35});
  assert.ok(prospect>veteran);
  assert.ok(prospect<=250000000&&veteran>=150000);
});

test('club interest requires more than simple availability',function(){
  const poorFit=playerTransferInterest({playerQuality:66,potential:72,clubLevel:88,clubNeed:20,affordability:25,reputation:15,tacticalFit:25,age:29,marketValue:30000000,scoutingVariance:0});
  const goodFit=playerTransferInterest({playerQuality:76,potential:84,clubLevel:78,clubNeed:88,affordability:90,reputation:65,tacticalFit:90,age:23,marketValue:18000000,scoutingVariance:0});
  assert.ok(goodFit>poorFit);
});

test('position performance models different football actions for every role',function(){
  const base={attributes:{goalkeeping:78,defending:76,physical:78,passing:80,technique:82,finishing:79,pace:80},minutes:90,teamXg:1.4,opponentXg:1.1,goalsFor:2,goalsAgainst:1,goals:1,assists:1,condition:88,opponentDifficulty:72,seed:'match'};
  const gk=positionPerformanceMetrics({...base,position:'GOL'}),def=positionPerformanceMetrics({...base,position:'DEF'}),mid=positionPerformanceMetrics({...base,position:'MEI'}),att=positionPerformanceMetrics({...base,position:'ATA'});
  assert.ok('saves' in gk.metrics&&!('shots' in gk.metrics));
  assert.ok('tackles' in def.metrics&&!('passesCompleted' in def.metrics));
  assert.ok('passesCompleted' in mid.metrics&&'chancesCreated' in mid.metrics);
  assert.ok('shots' in att.metrics&&'xg' in att.metrics);
  for(const item of [gk,def,mid,att])assert.ok(item.rating>=4&&item.rating<=10);
});
