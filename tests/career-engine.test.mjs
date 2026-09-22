import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSchedule,
  canStartRound,
  createCareer,
  finishPendingRound,
  liveRoundMatches,
  roundDuration,
  simulateMatch,
  simulateRound,
  standingsFromResults,
  startRound,
  teamRating,
  topScorers,
  userMatchHistory,
} from '../src/career-engine.js';
import { INITIAL_CASH, offers, requirementStatus, signSponsor, sponsorContext } from '../src/finance-model.js';

const clubs=Array.from({length:20},function(_,i){
  return {
    id:String(i+1),
    name:'Clube '+(i+1),
    abbreviation:'C'+(i+1),
    players:Array.from({length:28},function(__,j){
      return {
        id:i+'-'+j,
        name:'Jogador '+i+' '+j,
        age:22+(j%10),
        position:j<2?'Goalkeeper':j<10?'Defender':j<19?'Midfielder':'Forward',
      };
    }),
  };
});

test('Serie A schedule has 38 rounds, 10 matches each and every pair twice',function(){
  const schedule=buildSchedule(clubs);
  assert.equal(schedule.length,38);
  assert.ok(schedule.every(function(round){return round.length===10;}));
  const pairs={};
  for(const round of schedule){
    for(const match of round){
      const key=[match.homeId,match.awayId].sort().join('-');
      pairs[key]=(pairs[key]||0)+1;
    }
  }
  assert.equal(Object.keys(pairs).length,190);
  assert.ok(Object.values(pairs).every(function(value){return value===2;}));
});

test('improved match AI remains deterministic for the same season seed and context',function(){
  const context={results:[],season:2026,roundNumber:1};
  const a=simulateMatch(clubs[0],clubs[1],'2026-1-1',context);
  const b=simulateMatch(clubs[0],clubs[1],'2026-1-1',context);
  assert.deepEqual(a,b);
  assert.ok(teamRating(clubs[0])>=50);
  assert.ok(a.durationSecond>=90*60);
  assert.ok(a.intelligence.homeOverall>0);
});

test('starting a round creates all ten simultaneous games but does not award points early',function(){
  const career=createCareer(clubs,clubs[0].id);
  const started=startRound(career,clubs,'normal');
  assert.equal(started.round,0);
  assert.equal(started.results.length,0);
  assert.equal(started.pendingRound.roundNumber,1);
  assert.equal(started.pendingRound.matches.length,10);
  assert.equal(canStartRound(started),false);
  const table=standingsFromResults(started.results,clubs);
  assert.ok(table.every(function(row){return row.played===0&&row.points===0;}));
});

test('a second round cannot start while the current round is still active',function(){
  const career=createCareer(clubs,clubs[0].id);
  const started=startRound(career,clubs,'fast');
  const blocked=startRound(started,clubs,'normal');
  assert.deepEqual(blocked,started);
  assert.equal(blocked.pendingRound.mode,'fast');
});

test('all live games use the same clock while keeping independent scores and stoppage times',function(){
  const started=startRound(createCareer(clubs,clubs[0].id),clubs,'normal');
  const halfway=liveRoundMatches(started.pendingRound,45*60);
  assert.equal(halfway.length,10);
  assert.ok(halfway.every(function(match){return match.minute===45;}));
  const end=roundDuration(started.pendingRound);
  const finished=liveRoundMatches(started.pendingRound,end);
  assert.ok(finished.every(function(match){return match.finished;}));
  assert.ok(finished.every(function(match){return match.liveHomeGoals===match.homeGoals&&match.liveAwayGoals===match.awayGoals;}));
});

test('finishing the active round commits standings, goalscorers and user history together',function(){
  const career=createCareer(clubs,clubs[0].id);
  const started=startRound(career,clubs,'normal');
  const finished=finishPendingRound(started,clubs);
  assert.equal(finished.pendingRound,null);
  assert.equal(finished.round,1);
  assert.equal(finished.results.length,10);
  assert.equal(standingsFromResults(finished.results,clubs).reduce(function(sum,row){return sum+row.played;},0),20);
  assert.equal(userMatchHistory(finished).length,1);
  assert.equal(userMatchHistory(finished)[0].roundNumber,1);
  assert.ok([0,1,3].includes(userMatchHistory(finished)[0].points));
  assert.ok(topScorers(finished.scorers).every(function(player,index,array){return index===0||array[index-1].goals>=player.goals;}));
});

test('instant simulation resolves and commits an entire round in one operation',function(){
  const career=createCareer(clubs,clubs[0].id);
  const finished=simulateRound(career,clubs);
  assert.equal(finished.round,1);
  assert.equal(finished.pendingRound,null);
  assert.equal(finished.results.length,10);
  assert.equal(finished.lastRoundResults.length,10);
  assert.equal(userMatchHistory(finished).length,1);
});

test('sponsors enforce requirements and can add immediate cash',function(){
  const career=createCareer(clubs,clubs[0].id);
  const context=sponsorContext(career,clubs[0],standingsFromResults([],clubs));
  const vertice=offers.find(function(offer){return offer.id==='vertice';});
  assert.equal(requirementStatus(vertice,context).ok,true);
  const signed=signSponsor(career,'vertice',clubs[0],[]);
  assert.equal(signed.error,null);
  assert.ok(signed.career.cash>INITIAL_CASH);
});
