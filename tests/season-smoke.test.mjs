import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer, simulateRound, standingsFromResults, startNextSeason, topScorers } from '../src/career-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

function completeSeason(userClubId){
  let career=createCareer(clubs,userClubId,2026);
  for(let round=0;round<38;round++) career=simulateRound(career,clubs);
  return career;
}

test('a complete Serie A season produces 380 matches and 38 games for every club', function(){
  const career=completeSeason(clubs[0].id);
  assert.equal(career.round,38);
  assert.equal(career.results.length,380);
  const table=standingsFromResults(career.results,clubs);
  assert.equal(table.length,20);
  assert.ok(table.every(function(row){return row.played===38;}));
  assert.equal(table.reduce(function(sum,row){return sum+row.wins+row.draws+row.losses;},0),760);
  assert.ok(topScorers(career.scorers,1).length===1);
  assert.ok(career.seasons.some(function(season){return season.season===2026;}));
  assert.equal(career.seasonReview.pending,true);
  assert.equal(career.seasonReview.position,table.find(row=>row.clubId===career.userClubId).position);
  assert.ok(career.seasonReview.topScorer===null||career.seasonReview.topScorer.goals>=0);
  assert.ok(career.managerConfidence.fans>=0&&career.managerConfidence.fans<=100);
  assert.ok(career.managerConfidence.board>=0&&career.managerConfidence.board<=100);
});

test('the actual simulated champion receives the Brasileirao trophy automatically', function(){
  const favoriteId=clubs[0].id,boosted=clubs.map(club=>club.id===favoriteId?{...club,players:(club.players||[]).map(player=>({...player,_generatedOverall:94}))}:club);
  let championCareer=createCareer(boosted,favoriteId,2026);
  for(let round=0;round<38;round++)championCareer=simulateRound(championCareer,boosted);
  const table=standingsFromResults(championCareer.results,boosted);
  assert.equal(table[0].clubId,favoriteId,'the boosted test club must win the deterministic season used by this trophy regression test');
  assert.ok(championCareer.trophies.some(function(trophy){return trophy.id==='brasileirao'&&trophy.season===2026;}));
  assert.ok(championCareer.messages.some(function(message){return message.id==='brasileirao-2026';}));
  assert.equal(championCareer.pendingCelebration?.type,'trophy');
  assert.equal(championCareer.pendingCelebration?.trophy?.id,'brasileirao');
  assert.ok(championCareer.seasonReview.titles.some(function(trophy){return trophy.id==='brasileirao';}));
});


test('serialized save stays compact after a full season', function(){
  const career=completeSeason(clubs[0].id);
  const bytes=Buffer.byteLength(JSON.stringify(career),'utf8');
  assert.ok(bytes<900000,'expected compact save below 900 KB, got '+bytes+' bytes');
  assert.ok(career.results.every(result=>!('events' in result)&&!('stats' in result)&&!('homeLineup' in result)));
  assert.ok(career.seasonReview.bestPlayer===null||career.seasonReview.bestPlayer.averageRating>0);
  const next=startNextSeason(career,clubs);
  assert.equal(next.season,2027);
  assert.equal(next.round,0);
  assert.equal(next.seasonReview,null);
  assert.ok(next.youthAcademy?.prospects?.length>=4);
  assert.equal(next.youthAcademy.lastIntakeSeason,2027);
  assert.ok(next.transferBudget>0);
  assert.ok(next.careerRecord.matches>=38);
  assert.ok(next.newsFeed.some(item=>item.id==='news-preseason-2027'));
});
