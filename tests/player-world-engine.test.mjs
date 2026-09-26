import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COACH_PROFILES,INTERNATIONAL_PLAYER_CLUBS,PLAYER_PERSONALITIES,PLAYER_WORLD_MARKETS,
  createCoachState,createPositionRivals,ensurePlayerWorld,maybeChangePlayerCoach,
  playerCareerClubPool,playerPreMatchBriefing,playerSelectionContext,processPlayerWorldEvent,
  sanitizePlayerWorld
} from '../src/player-world-engine.js';
import { TRIAL_DRILLS,answerTrialDrill,completeTrial,createPlayerCareer } from '../src/player-career-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;
function signedCareer(){
  let career=createPlayerCareer({name:'World Engine',position:'MEI',archetype:'creator',personalityId:'professional',dreamClubId:clubs[0].id},2026);
  for(const drill of TRIAL_DRILLS)career=answerTrialDrill(career,drill.id,drill.choices[0].id);
  return completeTrial(career,clubs);
}

test('RC7 player club pool adds international markets exactly once',function(){
  const pool=playerCareerClubPool(clubs),again=playerCareerClubPool(pool);
  assert.equal(pool.length,clubs.length+INTERNATIONAL_PLAYER_CLUBS.length);
  assert.equal(new Set(pool.map(item=>String(item.id))).size,pool.length);
  assert.equal(new Set(again.map(item=>String(item.id))).size,again.length);
  for(const market of ['BRA','ARG','POR','ESP'])assert.ok(pool.some(item=>(item.country||'BRA')===market));
});

test('coach and rivalry generation are seeded and bounded',function(){
  const club=clubs[0],coachA=createCoachState('seed',club.id,2026),coachB=createCoachState('seed',club.id,2026);
  assert.deepEqual(coachA,coachB);
  assert.ok(COACH_PROFILES.some(item=>item.id===coachA.profileId));
  const rivals=createPositionRivals({seed:'seed',club,position:'ATA',season:2026,playerOverall:70});
  assert.equal(rivals.length,3);
  assert.ok(rivals.every(item=>item.overall>=48&&item.overall<=92&&item.fitness>=82&&item.fitness<=100));
});

test('selection context includes dynamic coach personality rivalry tactical fit and discipline',function(){
  const career=signedCareer(),club=clubs.find(item=>String(item.id)===String(career.clubId)),context=playerSelectionContext(career,club);
  assert.ok(context.world.coach);
  assert.equal(context.rivals.length,3);
  assert.ok(context.bestRival);
  assert.ok(context.tacticalCompatibility>=35&&context.tacticalCompatibility<=98);
  assert.ok(context.discipline>=20&&context.discipline<=100);
  assert.ok(PLAYER_PERSONALITIES.some(item=>item.id===context.personality.id));
});

test('pre-match briefing is deterministic and football-specific',function(){
  const career=signedCareer(),club=clubs.find(item=>String(item.id)===String(career.clubId)),opponent=clubs.find(item=>item.id!==club.id);
  const a=playerPreMatchBriefing(career,club,opponent,.55),b=playerPreMatchBriefing(career,club,opponent,.55);
  assert.deepEqual(a,b);
  assert.equal(a.opponentName,opponent.name);
  assert.ok(a.expectation.length>10);
  assert.ok(a.objective.length>10);
  assert.ok(a.selectionChance>=0&&a.selectionChance<=100);
});

test('world event ledger prevents duplicate causal side effects',function(){
  const career=signedCareer(),event={type:'MATCH_REVIEW',id:'same-event',payload:{rating:8,goals:1,assists:0,country:'BRA'}};
  const once=processPlayerWorldEvent(career,event),twice=processPlayerWorldEvent(once,event);
  assert.equal(twice.player.reputation,once.player.reputation);
  assert.equal(twice.worldEventLedger.length,once.worldEventLedger.length);
});

test('persisted player world is sanitized before entering runtime',function(){
  const career=signedCareer(),club=clubs.find(item=>String(item.id)===String(career.clubId));
  const hostile={coach:{id:'x',name:'X'.repeat(200),profileId:'hack',security:999},rivals:[{id:'r',name:'R'.repeat(200),position:'hack',age:999,overall:999,form:99,fitness:-2,matches:99999,lastRating:99}],events:Array.from({length:200},(_,i)=>({id:'e'+i,title:'t'}))};
  const clean=sanitizePlayerWorld(hostile,career,club);
  assert.ok(clean.coach.name.length<=80);
  assert.ok(COACH_PROFILES.some(item=>item.id===clean.coach.profileId));
  assert.ok(clean.rivals[0].age<=42);
  assert.ok(clean.rivals[0].overall<=96);
  assert.ok(clean.rivals[0].fitness>=35);
  assert.ok(clean.events.length<=80);
});

test('coach change can reset hierarchy without corrupting player values',function(){
  let career=signedCareer(),club=clubs.find(item=>String(item.id)===String(career.clubId));
  career={...career,stage:'professional',dayOfSeason:210,week:30,teamSeason:{matches:30,wins:2,draws:3,losses:25,goalsFor:15,goalsAgainst:70,points:9},world:{...ensurePlayerWorld(career,club),lastCoachChangeDay:0}};
  let changed=false;
  for(let seed=0;seed<20&&!changed;seed++){
    const candidate=maybeChangePlayerCoach({...career,seed:String(seed)},club);
    if(candidate.world.coach.id!==career.world.coach.id){changed=true;assert.ok(candidate.player.coachTrust>=30&&candidate.player.coachTrust<=72);assert.ok(candidate.news.some(item=>item.title.startsWith('Novo treinador')));}
  }
  assert.equal(changed,true);
});

test('world markets expose meaningful salary exposure and difficulty differences',function(){
  const brazil=PLAYER_WORLD_MARKETS.find(item=>item.id==='BRA'),spain=PLAYER_WORLD_MARKETS.find(item=>item.id==='ESP');
  assert.ok(spain.salary>brazil.salary);
  assert.ok(spain.exposure>brazil.exposure);
  assert.ok(spain.difficulty>brazil.difficulty);
});
