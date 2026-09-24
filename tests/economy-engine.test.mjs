import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer } from '../src/career-engine.js';
import { canFundDeal, creditTransferSale, initialTransferBudget, transferBudgetSnapshot } from '../src/economy-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

test('transfer budget is intentionally lower than operating cash for rich clubs',function(){
  const club=clubs.find(c=>c.id==='819');
  const career=createCareer(clubs,club.id);
  assert.ok(initialTransferBudget(club.id)<career.cash);
  assert.ok(initialTransferBudget(club.id)<=90000000);
});

test('having huge cash does not bypass transfer budget or wage room',function(){
  let career=createCareer(clubs,'9318');
  career={...career,cash:900000000,transferBudget:12000000};
  const blocked=canFundDeal(career,{fee:30000000,wageMonthly:100000});
  assert.equal(blocked.ok,false);
  assert.match(blocked.reason,/orçamento de transferências/i);
});

test('only part of a sale returns to transfer budget',function(){
  let career=createCareer(clubs,'874');
  career={...career,transferBudget:20000000,managerConfidence:{...career.managerConfidence,board:70}};
  const next=creditTransferSale(career,50000000),credited=next.transferBudget-career.transferBudget;
  assert.ok(credited>25000000&&credited<50000000);
  assert.equal(next.lastReinvestment.credited,credited);
});

test('wage room is separate from transfer fee budget',function(){
  const career=createCareer(clubs,'4936'),view=transferBudgetSnapshot(career);
  const result=canFundDeal({...career,transferBudget:100000000},{fee:1000000,wageMonthly:view.wageRoom+100000});
  assert.equal(result.ok,false);
  assert.match(result.reason,/folha/i);
});
