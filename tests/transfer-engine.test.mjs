import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCareer } from '../src/career-engine.js';
import { initialCashForClub } from '../src/finance-model.js';
import { rivalryLevel } from '../src/club-world.js';
import { applyCareerRoster, evaluateTransferOffer, executeTransfer, negotiationPreset, playerKey, playerMarketValueEUR } from '../src/transfer-engine.js';

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

test('accepted purchase changes player ownership and subtracts transfer fee from user cash',function(){
  const buyer=club('2026');
  const seller=club('9318');
  const player=seller.players[0];
  let career=createCareer(clubs,buyer.id);
  career={...career,cash:500000000};
  const key=playerKey(seller.id,player.id);
  const preset=negotiationPreset(player,seller,buyer);
  const offer={type:'buy',playerKey:key,fromClubId:seller.id,toClubId:buyer.id,amount:Math.max(preset.market*3,150000000)};
  const evaluation=evaluateTransferOffer(career,clubs,offer);
  assert.equal(evaluation.status,'accepted');
  const before=career.cash;
  const done=executeTransfer(career,clubs,offer,evaluation);
  assert.equal(done.error,null);
  assert.equal(done.career.ownership[key],buyer.id);
  assert.ok(done.career.cash<before);
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
