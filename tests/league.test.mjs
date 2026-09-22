import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoStandings,compareStandings,zoneForPosition} from '../src/league-model.js';

test('classification zones follow the 2026 base layout',()=>{
  assert.equal(zoneForPosition(1).id,'champion');
  assert.equal(zoneForPosition(4).id,'libertadores');
  assert.equal(zoneForPosition(5).id,'prelib');
  assert.equal(zoneForPosition(6).id,'sudamericana');
  assert.equal(zoneForPosition(11).id,'sudamericana');
  assert.equal(zoneForPosition(12).id,'neutral');
  assert.equal(zoneForPosition(16).id,'neutral');
  assert.equal(zoneForPosition(17).id,'relegation');
  assert.equal(zoneForPosition(20).id,'relegation');
});

test('standings use points, wins, goal difference and goals scored as first tiebreakers',()=>{
  const a={points:20,wins:6,goalDifference:5,goalsFor:18,club:{name:'A'}};
  const b={points:20,wins:5,goalDifference:10,goalsFor:25,club:{name:'B'}};
  assert.ok(compareStandings(a,b)<0);
  const c={...a,wins:6,goalDifference:4,club:{name:'C'}};
  assert.ok(compareStandings(a,c)<0);
});

test('demo snapshot builds exactly one ranked row per club',()=>{
  const clubs=Array.from({length:20},(_,i)=>({id:String(i+1),name:`Clube ${String(i+1).padStart(2,'0')}`}));
  const rows=buildDemoStandings(clubs);
  assert.equal(rows.length,20);
  assert.deepEqual(rows.map(r=>r.position),Array.from({length:20},(_,i)=>i+1));
  assert.equal(new Set(rows.map(r=>r.club.id)).size,20);
  assert.ok(rows.every(r=>r.played===12));
});
