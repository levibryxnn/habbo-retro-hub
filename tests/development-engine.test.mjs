import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advancePlayerLifecycle, applyDevelopmentProfile } from '../src/development-engine.js';

function club(id,player){return{id:String(id),name:'Clube '+id,abbreviation:'C'+id,players:[player]};}

test('a player retires when reaching 45 and a first-generation Jr enters the same club at 16',function(){
  const player={id:'p1',name:'João Silva',age:44,position:'Forward',countryCode:'BRA',nationality:'Brazil'};
  const clubs=[club('1',player)];
  const career={season:2026,userClubId:'1',playerDevelopment:{'1:p1':{age:44,baseAge:22,baseOverall:72,delta:1,potential:80,generation:0,rootName:'João Silva',position:'Forward'}},retiredPlayers:{},regens:[],pendingRetirements:[],seasonPerformance:{}};
  const next=advancePlayerLifecycle(career,clubs,2027);
  assert.ok(next.retiredPlayers['1:p1']);
  assert.equal(next.regens.length,1);
  assert.equal(next.regens[0].age,16);
  assert.equal(next.regens[0]._originClubId,'1');
  assert.match(next.regens[0].name,/Jr$/);
  assert.equal(next.pendingRetirements[0].age,45);
});

test('the Jr does not create an endless surname chain when he retires',function(){
  const player={id:'jr1',name:'João Silva Jr',age:44,position:'Forward',countryCode:'BRA',nationality:'Brazil',_playerKey:'1:jr1',_generation:1,_rootName:'João Silva'};
  const clubs=[club('1',player)];
  const career={season:2071,userClubId:'2',playerDevelopment:{'1:jr1':{age:44,baseAge:16,baseOverall:60,delta:4,potential:84,generation:1,rootName:'João Silva',position:'Forward'}},retiredPlayers:{},regens:[],pendingRetirements:[],seasonPerformance:{}};
  const next=advancePlayerLifecycle(career,clubs,2072);
  assert.equal(next.regens.length,1);
  assert.doesNotMatch(next.regens[0].name,/João Silva Jr Jr/);
  assert.equal(next.regens[0]._generation,2);
});

test('development can continue through age 35 and decline is guaranteed after the peak window',function(){
  const young={id:'y',name:'Talento',age:34,position:'Midfielder'};
  const old={id:'o',name:'Veterano',age:36,position:'Midfielder'};
  const clubs=[{id:'1',name:'Clube',abbreviation:'CLU',players:[young,old]}];
  const career={season:2026,userClubId:'2',playerDevelopment:{
    '1:y':{age:34,baseAge:20,baseOverall:70,delta:3,potential:88,generation:0,rootName:'Talento',position:'Midfielder'},
    '1:o':{age:36,baseAge:25,baseOverall:76,delta:5,potential:84,generation:0,rootName:'Veterano',position:'Midfielder'}
  },retiredPlayers:{},regens:[],pendingRetirements:[],seasonPerformance:{}};
  const next=advancePlayerLifecycle(career,clubs,2027);
  assert.equal(next.playerDevelopment['1:y'].age,35);
  assert.ok(next.playerDevelopment['1:y'].delta>=3);
  assert.equal(next.playerDevelopment['1:o'].age,37);
  assert.ok(next.playerDevelopment['1:o'].delta<5);
  const profiled=applyDevelopmentProfile(young,'1:y',next);
  assert.equal(profiled._careerAge,35);
});
