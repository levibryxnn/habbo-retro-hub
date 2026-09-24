import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer } from '../src/career-engine.js';
import { applyMatchDynamics, careerNews, clubDNAFor, difficultyProfile, managerMatchModifier, managerProfile, observePlayer, promoteAcademyProspect, resolvePressConference, scoutRange } from '../src/career-dynamics.js';
import { careerPlayerOverall, statusKey } from '../src/player-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs,club=clubs[0];

test('manager personality changes a small match modifier without dominating squad strength',function(){
  const base=createCareer(clubs,club.id);
  const strategist={...base,managerProfile:'strategist',dressingRoom:{...base.dressingRoom,morale:82,unity:78}};
  const manager={...base,managerProfile:'manager',dressingRoom:{...base.dressingRoom,morale:82,unity:78}};
  assert.ok(managerMatchModifier(strategist)>managerMatchModifier(manager));
  assert.ok(Math.abs(managerMatchModifier(strategist))<=.10);
});

test('match dynamics connect result dressing room reputation rivalry and news',function(){
  let career=createCareer(clubs,club.id);
  const opponent=clubs[1],result={id:'integration-1',homeId:club.id,awayId:opponent.id,homeGoals:3,awayGoals:0,homeLineup:club.players.slice(0,11).map(p=>String(p.id)),awayLineup:opponent.players.slice(0,11).map(p=>String(p.id)),events:[]};
  const before=career.dressingRoom.morale;
  career=applyMatchDynamics(career,club,clubs,result,{competition:'Brasileirão Série A',stage:'Rodada 1'});
  assert.ok(career.dressingRoom.morale>before);
  assert.ok(career.managerReputation>50);
  assert.ok(career.careerMemory.rivalries[opponent.id]);
  assert.ok(careerNews(career).some(item=>item.id==='news-match-integration-1'));
});

test('press conference choice changes confidence and dressing room',function(){
  let career=createCareer(clubs,club.id);
  career={...career,pressConference:{id:'press-test',reason:'sequência ruim',choices:[]}};
  const before=career.dressingRoom.morale;
  const next=resolvePressConference(career,'protect');
  assert.equal(next.pressConference,null);
  assert.ok(next.dressingRoom.morale>before);
  assert.ok(next.pressHistory.length===1);
});

test('scouting becomes more precise after repeated observation',function(){
  let career=createCareer(clubs,club.id),player=clubs[1].players[0],key=clubs[1].id+':'+player.id;
  const first=scoutRange(career,player,key);
  career=observePlayer(career,key,player);
  const second=scoutRange(career,player,key);
  assert.ok(second.certainty>first.certainty);
  career=observePlayer(career,key,player);
  career=observePlayer(career,key,player);
  const final=scoutRange(career,player,key);
  assert.ok(final.max-final.min<=first.max-first.min);
});

test('academy prospects can be promoted into the professional career roster state',function(){
  let career=createCareer(clubs,club.id);
  const prospect=career.youthAcademy.prospects[0];
  career=promoteAcademyProspect(career,club,prospect.id);
  assert.ok(career.regens.some(p=>p.name===prospect.name&&p._originClubId===club.id));
  assert.equal(career.youthAcademy.prospects.find(p=>p.id===prospect.id).status,'promoted');
});

test('injury severity reduces the visible and effective overall during recovery',function(){
  let career=createCareer(clubs,club.id),player=club.players[0],key=statusKey(club.id,player.id);
  const healthy=careerPlayerOverall(player,career,club.id,1);
  career={...career,playerStatus:{...career.playerStatus,[key]:{injuryThroughRound:4,injuryLabel:'Lesão muscular importante'}}};
  const injured=careerPlayerOverall(player,career,club.id,1);
  assert.ok(injured<healthy);
  assert.ok(healthy-injured<=7);
});

test('club DNA and organic difficulty are deterministic for the same project',function(){
  assert.deepEqual(clubDNAFor(club.id),clubDNAFor(club.id));
  const career=createCareer(clubs,club.id);
  assert.deepEqual(difficultyProfile(career,club),difficultyProfile(career,club));
  assert.ok(managerProfile('developer').youth>1);
});
