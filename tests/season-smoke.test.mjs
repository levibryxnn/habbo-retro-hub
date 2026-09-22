import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer, simulateRound, standingsFromResults, topScorers } from '../src/career-engine.js';

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
});

test('the actual simulated champion receives the Brasileirao trophy automatically', function(){
  const reference=completeSeason(clubs[0].id);
  const championId=standingsFromResults(reference.results,clubs)[0].clubId;
  const championCareer=completeSeason(championId);
  assert.ok(championCareer.trophies.some(function(trophy){return trophy.id==='brasileirao'&&trophy.season===2026;}));
  assert.ok(championCareer.messages.some(function(message){return message.id==='brasileirao-2026';}));
});
