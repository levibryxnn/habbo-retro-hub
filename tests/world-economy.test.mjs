import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, finishPendingRound, startRound } from '../src/career-engine.js';
import { getClubWorld, matchdayProjection } from '../src/club-world.js';

const clubs=[
  {id:'874',name:'Corinthians',abbreviation:'COR',players:Array.from({length:28},(_,j)=>({id:'c'+j,name:'C'+j,age:22+j%10,position:j<2?'Goalkeeper':j<10?'Defender':j<19?'Midfielder':'Forward'}))},
  {id:'2029',name:'Palmeiras',abbreviation:'PAL',players:Array.from({length:28},(_,j)=>({id:'p'+j,name:'P'+j,age:22+j%10,position:j<2?'Goalkeeper':j<10?'Defender':j<19?'Midfielder':'Forward'}))},
  ...Array.from({length:18},(_,i)=>({id:String(5000+i),name:'Clube '+i,abbreviation:'X'+i,players:Array.from({length:28},(__,j)=>({id:i+'-'+j,name:'J'+i+'-'+j,age:22+j%10,position:j<2?'Goalkeeper':j<10?'Defender':j<19?'Midfielder':'Forward'}))}))
];

test('matchday projection uses the home stadium and respects capacity',function(){
  const matchday=matchdayProjection('874','2029',30,'derby-test');
  const home=getClubWorld('874');
  assert.equal(matchday.stadium,home.stadium);
  assert.ok(matchday.attendance<=home.capacity);
  assert.ok(matchday.attendance>0);
  assert.ok(matchday.clubShare>0);
});

test('home matchday revenue enters club cash after the round closes',function(){
  let career=createCareer(clubs,'874',2026);
  const before=career.cash;
  career=startRound(career,clubs,'instant');
  const user=career.pendingRound.matches.find(m=>m.homeId==='874'||m.awayId==='874');
  const expected=user.homeId==='874'?user.matchday.clubShare:0;
  career=finishPendingRound(career,clubs);
  const matchdayIncome=(career.transactions||[]).filter(t=>t.kind==='matchday').reduce((sum,t)=>sum+t.amount,0);
  assert.equal(matchdayIncome,expected);
  if(expected>0)assert.ok(career.cash>=before+expected-100000000);
});
