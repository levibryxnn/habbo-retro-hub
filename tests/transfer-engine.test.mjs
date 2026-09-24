import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer } from '../src/career-engine.js';
import { initialCashForClub } from '../src/finance-model.js';
import { rivalryLevel } from '../src/club-world.js';
import { applyCareerRoster, evaluateTransferOffer, executeTransfer, incomingMarketOffers, negotiationPreset, playerKey, playerMarketValueBRL, playerMarketValueEUR, rejectIncomingOffer } from '../src/transfer-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

function club(id){return clubs.find(c=>c.id===id);}

test('real clubs start with differentiated gameplay budgets',function(){
  assert.ok(initialCashForClub('819')>initialCashForClub('9318'));
  assert.ok(initialCashForClub('2029')>initialCashForClub('4936'));
});

test('Sao Paulo and Corinthians are treated as historical rivals by negotiation AI',function(){
  assert.equal(rivalryLevel('2026','874'),2);
  assert.equal(rivalryLevel('6273','1936'),2);
  assert.equal(rivalryLevel('9967','3457'),2);
});

test('market values use the configured real-world squad reference scale',function(){
  const corinthians=club('874');
  const hugo=corinthians.players.find(p=>p.name==='Hugo Souza');
  if(hugo){
    const value=playerMarketValueEUR(hugo,corinthians);
    assert.equal(value.value,11000000);
  }
  const any=corinthians.players[0];
  assert.ok(playerMarketValueEUR(any,corinthians).value>0);
});

test('accepted purchase changes ownership and spends both cash and transfer budget',function(){
  const buyer=club('819');
  const seller=club('9318');
  const player=seller.players.slice().sort((a,b)=>playerMarketValueEUR(a,seller).value-playerMarketValueEUR(b,seller).value)[0];
  let career=createCareer(clubs,buyer.id);
  career={...career,cash:500000000,transferBudget:300000000,managerReputation:100};
  const key=playerKey(seller.id,player.id);
  const preset=negotiationPreset(player,seller,buyer);
  const offer={type:'buy',playerKey:key,fromClubId:seller.id,toClubId:buyer.id,amount:Math.round(preset.market*1.6/100000)*100000};
  const evaluation=evaluateTransferOffer(career,clubs,offer);
  assert.equal(evaluation.status,'accepted');
  const beforeCash=career.cash,beforeBudget=career.transferBudget;
  const done=executeTransfer(career,clubs,offer,evaluation);
  assert.equal(done.error,null);
  assert.equal(done.career.ownership[key],buyer.id);
  assert.ok(done.career.cash<beforeCash);
  assert.ok(done.career.transferBudget<beforeBudget);
  const dynamic=applyCareerRoster(clubs,done.career);
  assert.ok(dynamic.find(c=>c.id===buyer.id).players.some(p=>p._playerKey===key));
  assert.ok(!dynamic.find(c=>c.id===seller.id).players.some(p=>p._playerKey===key));
});

test('star transfers between rivals demand an exceptional package',function(){
  const seller=club('874');
  const buyer=club('2026');
  const star=seller.players.slice().sort((a,b)=>playerMarketValueEUR(b,seller).value-playerMarketValueEUR(a,seller).value)[0];
  const career={...createCareer(clubs,buyer.id),cash:1000000000};
  const key=playerKey(seller.id,star.id);
  const market=playerMarketValueEUR(star,seller).value*6.25;
  const response=evaluateTransferOffer(career,clubs,{type:'buy',playerKey:key,fromClubId:seller.id,toClubId:buyer.id,amount:market});
  assert.notEqual(response.status,'accepted');
});


test('selling well below market value reduces board confidence',function(){
  const seller=club('874');
  const buyer=club('9318');
  const player=seller.players[0];
  let career=createCareer(clubs,seller.id);
  career={...career,managerConfidence:{...career.managerConfidence,board:82}};
  const key=playerKey(seller.id,player.id);
  const market=playerMarketValueBRL(player,seller).valueBRL;
  const offer={type:'sell',playerKey:key,fromClubId:seller.id,toClubId:buyer.id};
  const done=executeTransfer(career,clubs,offer,{status:'accepted',agreedAmount:Math.round(market*.55)});
  assert.equal(done.error,null);
  assert.ok(done.career.managerConfidence.board<82);
  assert.equal(done.career.transferHistory.at(-1).marketValue,market);
  assert.ok(done.career.transferHistory.at(-1).valueRatio<.7);
});


test('strong season performance creates deterministic incoming offers that can be dismissed',function(){
  const user=club('874'),player=user.players[0];
  let career=createCareer(clubs,user.id);
  career={...career,round:18,seasonPerformance:{[String(player.id)]:{playerId:String(player.id),name:player.name,appearances:15,totalRating:112,goals:9,assists:4,minutes:1200}}};
  const first=incomingMarketOffers(career,clubs),second=incomingMarketOffers(career,clubs);
  assert.deepEqual(first,second);
  assert.ok(first.length>=1);
  const rejected=rejectIncomingOffer(career,first[0].id);
  assert.ok(!incomingMarketOffers(rejected,clubs).some(item=>item.id===first[0].id));
});
