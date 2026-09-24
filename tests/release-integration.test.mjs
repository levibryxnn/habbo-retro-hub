import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer, simulateRound } from '../src/career-engine.js';
import { careerNews, difficultyProfile, managerCareerSummary } from '../src/career-dynamics.js';
import { financeHealth, initialTransferBudget } from '../src/economy-engine.js';
import { parseCareerSave, serializeCareerSave } from '../src/save-format.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs,club=clubs.find(item=>item.id==='874')||clubs[0];

test('release systems coexist in one career state after real calendar progression',function(){
  let career=createCareer(clubs,club.id,2026);
  career={...career,managerName:'Levi',managerProfile:'motivator'};
  career=simulateRound(career,clubs);

  assert.equal(career.systemsVersion>=1,true);
  assert.equal(career.round,1);
  assert.ok(career.world&&career.world.competitions);
  assert.ok(career.dressingRoom&&career.dressingRoom.morale>=20&&career.dressingRoom.morale<=100);
  assert.ok(career.careerMemory&&Array.isArray(career.careerMemory.milestones));
  assert.ok(career.youthAcademy?.prospects?.length>=4);
  assert.ok(career.scouting&&career.scouting.reports);
  assert.ok(Number.isFinite(career.transferBudget));
  assert.ok(career.transferBudget<=Math.max(career.cash,initialTransferBudget(club.id)*2));
  assert.ok(careerNews(career).length>=1);
  assert.ok(managerCareerSummary(career).matches>=1);
  assert.ok(['Projeto difícil','Desafio equilibrado','Estrutura forte'].includes(difficultyProfile(career,club).label));
  assert.ok(['Crítico','Apertado','Confortável','Controlado'].includes(financeHealth(career).label));

  const payload=parseCareerSave(serializeCareerSave(career,club));
  assert.equal(payload.career.userClubId,career.userClubId);
  assert.equal(payload.career.managerProfile,'motivator');
  assert.equal(payload.career.careerRecord.matches,career.careerRecord.matches);

  const bytes=Buffer.byteLength(JSON.stringify(career),'utf8');
  assert.ok(bytes<1_200_000,'release career state grew beyond 1.2 MB after initial progression: '+bytes);
});
