import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TRIAL_DRILLS, answerTrialDrill, completeTrial, createPlayerCareer, playerCareerOverall, simulatePlayerWeek } from '../src/player-career-engine.js';
import {
  PLAYER_AGENTS,PLAYER_BOOTS,PLAYER_HOMES,PLAYER_PHYSIOS,
  acceptPlayerSponsor,effectivePlayerAttributes,playerFinancialSnapshot,playerLifeBonuses,
  purchasePlayerLifeItem,sanitizePlayerFinance,settlePlayerMonth
} from '../src/player-life-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;
function signedCareer(){
  let career=createPlayerCareer({name:'Financeiro',position:'ATA',archetype:'finisher',dreamClubId:clubs[0].id},2026);
  for(const drill of TRIAL_DRILLS)career=answerTrialDrill(career,drill.id,drill.choices[0].id);
  return completeTrial(career,clubs);
}

test('personal finance is isolated from club finances and settles salary deterministically',function(){
  let career=signedCareer();
  assert.equal(career.finance.cash,0);
  career={...career,dayOfSeason:28,finance:{...career.finance,cash:10000}};
  const settled=settlePlayerMonth(career),snapshot=playerFinancialSnapshot(settled);
  assert.ok(snapshot.cash>10000);
  assert.ok(snapshot.careerIncome>=career.contract.salaryMonthly);
  assert.ok(snapshot.transactions.some(item=>item.type==='salary'));
  assert.equal(career.cash,undefined);
});

test('better agents trade commission for salary sponsor and market multipliers',function(){
  let career=signedCareer();career={...career,finance:{...career.finance,cash:1_000_000}};
  const before=playerLifeBonuses(career),result=purchasePlayerLifeItem(career,'agent','elite');
  assert.equal(result.error,undefined);
  const after=playerLifeBonuses(result.career);
  assert.ok(after.salaryMultiplier>before.salaryMultiplier);
  assert.ok(after.sponsorMultiplier>before.sponsorMultiplier);
  assert.ok(after.marketMultiplier>before.marketMultiplier);
  assert.ok(after.agent.commission>before.agent.commission);
  assert.ok(result.career.finance.cash<career.finance.cash);
});

test('boots alter effective skills without mutating base attributes',function(){
  let career=signedCareer();career={...career,finance:{...career.finance,cash:200000}};
  const baseFinishing=career.player.attributes.finishing,baseOverall=playerCareerOverall(career);
  const result=purchasePlayerLifeItem(career,'boots','precision');
  const attrs=effectivePlayerAttributes(result.career),overall=playerCareerOverall(result.career);
  assert.equal(result.career.player.attributes.finishing,baseFinishing);
  assert.equal(attrs.finishing,baseFinishing+2);
  assert.ok(overall>=baseOverall);
});

test('physio and home create explicit recovery morale and monthly-cost tradeoffs',function(){
  let career=signedCareer();career={...career,finance:{...career.finance,cash:2_000_000}};
  career=purchasePlayerLifeItem(career,'physio','performance').career;
  career=purchasePlayerLifeItem(career,'home','house').career;
  const life=playerLifeBonuses(career),snapshot=playerFinancialSnapshot(career);
  assert.ok(life.injuryMultiplier<1);
  assert.ok(life.injuryRecoveryMultiplier<1);
  assert.ok(life.dailyRecovery>1);
  assert.ok(life.moraleBaseline>0);
  assert.ok(snapshot.projectedExpenses>0);
  assert.ok(career.finance.ownedHomes.includes('house'));
});

test('sponsor contracts pay signing money base monthly value and performance bonus',function(){
  let career=signedCareer();
  career={...career,stage:'professional',seasonStats:{matches:10,starts:10,minutes:900,goals:8,assists:2,totalRating:76},finance:{...career.finance,cash:0,sponsorOffers:[{id:'offer-test',brandId:'atlas',name:'Atlas Wear',monthly:40000,signing:100000,months:6,description:'Teste',targetAverage:7,performanceBonus:9000}]}};
  const signed=acceptPlayerSponsor(career,'offer-test').career;
  assert.equal(signed.finance.cash,100000);
  const paid=settlePlayerMonth({...signed,dayOfSeason:28}),transactions=paid.finance.transactions;
  assert.ok(transactions.some(item=>item.type==='sponsor'));
  assert.ok(transactions.some(item=>item.type==='sponsor-bonus'));
  assert.ok(paid.finance.cash>signed.finance.cash);
});

test('finance sanitizer clamps hostile money and unknown lifestyle identifiers',function(){
  const clean=sanitizePlayerFinance({cash:Infinity,careerIncome:-99,careerSpending:Infinity,agentId:'hack',bootsId:'hack',physioId:'hack',homeId:'hack',transactions:Array.from({length:300},(_,i)=>({id:i}))});
  assert.equal(clean.cash,0);
  assert.equal(clean.careerIncome,0);
  assert.equal(clean.careerSpending,0);
  assert.equal(clean.agentId,PLAYER_AGENTS[0].id);
  assert.equal(clean.bootsId,PLAYER_BOOTS[0].id);
  assert.equal(clean.physioId,PLAYER_PHYSIOS[0].id);
  assert.equal(clean.homeId,PLAYER_HOMES[0].id);
  assert.equal(clean.transactions.length,120);
});


test('overspending has a causal morale consequence',function(){
  let career=signedCareer();
  career={...career,contract:{...career.contract,salaryMonthly:0},player:{...career.player,morale:80},finance:{...career.finance,cash:0,physioId:'performance',homeId:'luxury'}};
  const next=settlePlayerMonth({...career,dayOfSeason:28});
  assert.ok(next.finance.cash<0);
  assert.ok(next.player.morale<80);
  assert.ok(next.news.some(item=>item.title==='Finanças pessoais exigem atenção'));
});
