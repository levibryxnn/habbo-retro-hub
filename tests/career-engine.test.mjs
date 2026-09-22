import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, createCareer, simulateMatch, simulateRound, standingsFromResults, teamRating, topScorers } from '../src/career-engine.js';
import { INITIAL_CASH, offers, requirementStatus, signSponsor, sponsorContext } from '../src/finance-model.js';

const clubs = Array.from({ length:20 }, function(_,i){
  return {
    id:String(i+1),
    name:'Clube ' + (i+1),
    abbreviation:'C' + (i+1),
    players:Array.from({ length:28 }, function(__,j){
      return {
        id:i + '-' + j,
        name:'Jogador ' + i + ' ' + j,
        age:22 + (j % 10),
        position:j < 2 ? 'Goalkeeper' : j < 10 ? 'Defender' : j < 19 ? 'Midfielder' : 'Forward',
      };
    }),
  };
});

test('Serie A schedule has 38 rounds, 10 matches each and every pair twice', function(){
  const schedule = buildSchedule(clubs);
  assert.equal(schedule.length,38);
  assert.ok(schedule.every(function(round){ return round.length === 10; }));
  const pairs = {};
  for (const round of schedule) {
    for (const match of round) {
      const key = [match.homeId,match.awayId].sort().join('-');
      pairs[key] = (pairs[key] || 0) + 1;
    }
  }
  assert.equal(Object.keys(pairs).length,190);
  assert.ok(Object.values(pairs).every(function(value){ return value === 2; }));
});

test('match AI is deterministic for the same season seed', function(){
  const a = simulateMatch(clubs[0],clubs[1],'2026-1-1');
  const b = simulateMatch(clubs[0],clubs[1],'2026-1-1');
  assert.deepEqual(a,b);
  assert.ok(teamRating(clubs[0]) >= 52);
});

test('a simulated round updates table and goalscorers', function(){
  let career = createCareer(clubs,clubs[0].id);
  career = simulateRound(career,clubs);
  assert.equal(career.round,1);
  assert.equal(career.results.length,10);
  const table = standingsFromResults(career.results,clubs);
  assert.equal(table.reduce(function(sum,row){ return sum+row.played; },0),20);
  const scorers = topScorers(career.scorers);
  assert.ok(scorers.every(function(player,index,array){ return index === 0 || array[index-1].goals >= player.goals; }));
});

test('sponsors enforce requirements and can add immediate cash', function(){
  const career = createCareer(clubs,clubs[0].id);
  const context = sponsorContext(career,clubs[0],standingsFromResults([],clubs));
  const vertice = offers.find(function(offer){ return offer.id === 'vertice'; });
  assert.equal(requirementStatus(vertice,context).ok,true);
  const signed = signSponsor(career,'vertice',clubs[0],[]);
  assert.equal(signed.error,null);
  assert.ok(signed.career.cash > INITIAL_CASH);
});
