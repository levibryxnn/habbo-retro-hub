import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPlayerPerformances } from '../src/player-engine.js';
import { historicalHonours, honoursWithCareer } from '../src/club-honours.js';
import data from '../src/data/serie-a-2026.json' with { type:'json' };

test('every Serie A club has a historical trophy gallery',function(){
  assert.equal(data.clubs.length,20);
  for(const club of data.clubs){
    const honours=historicalHonours(club.id);
    assert.ok(honours.length>0,club.name+' has no historical honours');
    assert.ok(honours.every(item=>Number.isInteger(item.count)&&item.count>0));
  }
});

test('career titles are added on top of the historical trophy count',function(){
  const before=historicalHonours('874').find(item=>item.id==='brasileirao').count;
  const after=honoursWithCareer('874',{trophies:[{id:'brasileirao',season:2026}]}).find(item=>item.id==='brasileirao');
  assert.equal(after.count,before+1);
  assert.equal(after.careerCount,1);
});

test('match rating is always within 0.0 and 10.0 even for an extraordinary performance',function(){
  const scorer={id:'9',name:'Artilheiro',position:'Forward',countryCode:'BRA',age:26};
  const mate={id:'10',name:'Meia',position:'Midfielder',countryCode:'BRA',age:25};
  const club={id:'1',name:'Clube',players:[scorer,mate]};
  const events=Array.from({length:8},(_,i)=>({id:'g'+i,side:'home',type:'goal',second:(i+1)*300,playerId:'9',player:'Artilheiro',clubId:'1'}));
  const result={homeId:'1',awayId:'2',homeLineup:['9','10'],awayLineup:[],substitutions:[],events,durationSecond:5400,homeGoals:8,awayGoals:0};
  const performance=matchPlayerPerformances(club,result,'home',5400).find(item=>item.playerId==='9');
  assert.ok(performance);
  assert.ok(performance.rating>=0);
  assert.ok(performance.rating<=10);
  assert.equal(Number(performance.rating.toFixed(1)),performance.rating);
});
