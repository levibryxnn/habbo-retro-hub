import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clockAt,createMatchEvents,INITIAL_MATCH_SECOND,nextEventAfter,periodAt,scoreAt,statsAt} from '../src/match-model.js';

const club=(id,name)=>({id,name,abbreviation:name.slice(0,3).toUpperCase(),players:[
  {name:`${name} Atacante`,position:'Forward'},
  {name:`${name} Meia`,position:'Midfielder'},
  {name:`${name} Reserva`,position:'Defender'},
]});

test('prototype starts at 28:15 with one home goal and no away goal',()=>{
  const home=club('1','Aurora'), away=club('2','Uniao');
  const events=createMatchEvents(home,away);
  assert.deepEqual(scoreAt(events,INITIAL_MATCH_SECOND),{home:1,away:0});
  assert.equal(clockAt(INITIAL_MATCH_SECOND),'28:15');
  assert.equal(periodAt(INITIAL_MATCH_SECOND),'1º TEMPO');
});

test('next event is strictly after the current simulated second',()=>{
  const events=createMatchEvents(club('1','Aurora'),club('2','Uniao'));
  const next=nextEventAfter(events,INITIAL_MATCH_SECOND);
  assert.ok(next.second>INITIAL_MATCH_SECOND);
  assert.equal(next.type,'corner');
});

test('match statistics remain internally valid as time advances',()=>{
  const events=createMatchEvents(club('1','Aurora'),club('2','Uniao'));
  const early=statsAt(events,10*60);
  const late=statsAt(events,80*60);
  assert.equal(early.possession[0]+early.possession[1],100);
  assert.equal(late.possession[0]+late.possession[1],100);
  assert.ok(late.shots[0]>=early.shots[0]);
  assert.ok(late.shots[1]>=early.shots[1]);
});
