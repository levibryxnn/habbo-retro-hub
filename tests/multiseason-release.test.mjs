import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer, simulateRound, startNextSeason } from '../src/career-engine.js';
import { careerNews } from '../src/career-dynamics.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

function finishSeason(career){
  let next=career;
  for(let guard=0;guard<38&&next.round<38;guard++)next=simulateRound(next,clubs);
  return next;
}

test('three consecutive seasons remain coherent compact and playable',function(){
  let career=createCareer(clubs,'874',2026);
  for(let seasonIndex=0;seasonIndex<3;seasonIndex++){
    career=finishSeason(career);
    assert.equal(career.round,38);
    assert.ok(career.seasonReview);
    assert.ok(career.careerRecord.matches>=(seasonIndex+1)*38);
    assert.ok((career.newsFeed||[]).length<=80);
    assert.ok((career.universeNotes||[]).length<=70);
    assert.ok((career.transferHistory||[]).length<=240);
    assert.ok((career.world?.history||[]).length<=180);
    assert.ok(Buffer.byteLength(JSON.stringify(career),'utf8')<1_800_000);
    if(seasonIndex<2){
      const previous=career.season;
      career=startNextSeason(career,clubs);
      assert.equal(career.season,previous+1);
      assert.equal(career.round,0);
      assert.ok(career.youthAcademy?.prospects?.length>=4);
      assert.ok(career.transferBudget>0);
    }
  }
  assert.equal(career.season,2028);
  assert.ok(careerNews(career).length>=3);
  assert.ok(career.managerReputation>=1&&career.managerReputation<=100);
  assert.ok(career.managerConfidence.fans>=0&&career.managerConfidence.fans<=100);
  assert.ok(career.managerConfidence.board>=0&&career.managerConfidence.board<=100);
});
