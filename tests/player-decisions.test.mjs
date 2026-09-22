import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCareer,
  finishPendingRound,
  makeUserSubstitution,
  resolveUserPenalty,
  simulateMatch,
  startRound,
  updateUserLineup,
} from '../src/career-engine.js';
import {
  autoLineup,
  currentBench,
  currentLineup,
  lineupProfile,
  playerGameStats,
  statusKey,
} from '../src/player-engine.js';

const clubs=Array.from({length:20},function(_,i){
  return {
    id:String(i+1),
    name:'Clube '+(i+1),
    abbreviation:'C'+(i+1),
    players:Array.from({length:28},function(__,j){
      return {
        id:i+'-'+j,
        name:'Jogador '+i+' '+j,
        age:20+(j%15),
        position:j<2?'Goalkeeper':j<10?'Defender':j<19?'Midfielder':'Forward',
      };
    }),
  };
});

test('player game attributes are deterministic and position-aware',function(){
  const forward=clubs[0].players.find(p=>p.position==='Forward');
  const keeper=clubs[0].players.find(p=>p.position==='Goalkeeper');
  const a=playerGameStats(forward),b=playerGameStats(forward),gk=playerGameStats(keeper);
  assert.deepEqual(a,b);
  assert.ok(a.shooting>gk.shooting);
  assert.ok(gk.goalkeeping>a.goalkeeping);
});

test('a valid custom lineup is persisted and changes the lineup profile',function(){
  let career=createCareer(clubs,clubs[0].id);
  const club=clubs[0];
  const auto=autoLineup(club,career,1);
  const goalkeeper=club.players.filter(p=>p.position==='Goalkeeper').sort((a,b)=>playerGameStats(a).overall-playerGameStats(b).overall)[0];
  const others=club.players.filter(p=>p.position!=='Goalkeeper').sort((a,b)=>playerGameStats(a).overall-playerGameStats(b).overall).slice(0,10);
  const weaker=[String(goalkeeper.id),...others.map(p=>String(p.id))];
  const autoProfile=lineupProfile(club,auto,career);
  career=updateUserLineup(career,club,weaker);
  const weakProfile=lineupProfile(club,career.lineup,career);
  assert.equal(career.lineup.length,11);
  assert.notEqual(Math.round(autoProfile.overall*100),Math.round(weakProfile.overall*100));
});

test('user can make a legal substitution and the incoming player joins the live lineup',function(){
  let career=createCareer(clubs,clubs[0].id);
  career=startRound(career,clubs,'normal');
  const match=career.pendingRound.matches.find(m=>m.homeId===career.userClubId||m.awayId===career.userClubId);
  const side=match.homeId===career.userClubId?'home':'away';
  const onField=currentLineup(match,side,70*60);
  const bench=currentBench(match,side,70*60);
  assert.ok(onField.length>=10);
  assert.ok(bench.length>0);
  const result=makeUserSubstitution(career,clubs,onField[onField.length-1],bench[0],70*60,{halftime:false});
  assert.equal(result.error,null);
  const changed=result.career.pendingRound.matches.find(m=>m.id===match.id);
  const live=currentLineup(changed,side,71*60);
  assert.ok(live.includes(String(bench[0])));
  assert.ok(!live.includes(String(onField[onField.length-1])));
});

test('third accumulated yellow creates an automatic one-match suspension',function(){
  let career=createCareer(clubs,clubs[0].id);
  const player=clubs[0].players[2];
  const key=statusKey(clubs[0].id,player.id);
  career.playerStatus[key]={yellowCount:2,injuryThroughRound:0,suspensionThroughRound:0};
  career=startRound(career,clubs,'instant');
  const userIndex=career.pendingRound.matches.findIndex(m=>m.homeId===career.userClubId||m.awayId===career.userClubId);
  const userMatch=career.pendingRound.matches[userIndex];
  const side=userMatch.homeId===career.userClubId?'home':'away';
  userMatch.events.push({
    id:'forced-third-yellow',type:'yellow',side,second:1000,minute:16,
    playerId:String(player.id),player:player.name,clubId:clubs[0].id,text:player.name+' recebe cartão amarelo'
  });
  career=finishPendingRound(career,clubs);
  assert.equal(career.playerStatus[key].yellowCount,0);
  assert.equal(career.playerStatus[key].suspensionThroughRound,2);
});

test('interactive penalty allows choosing an on-field taker and resolves the kick',function(){
  const home=clubs[0],away=clubs[1];
  let found=null;
  for(let i=0;i<250&&!found;i++){
    const match=simulateMatch(home,away,'penalty-seed-'+i,{
      career:createCareer(clubs,home.id),season:2026,roundNumber:1,
      homeLineup:autoLineup(home,createCareer(clubs,home.id),1),
      awayLineup:autoLineup(away,createCareer(clubs,home.id),1),
      interactiveClubId:home.id,mode:'normal',results:[]
    });
    const event=match.events.find(e=>e.type==='penalty'&&e.requiresDecision&&!e.resolved&&e.side==='home');
    if(event)found={match,event};
  }
  assert.ok(found,'expected at least one deterministic interactive penalty seed');
  let career=createCareer(clubs,home.id);
  career.pendingRound={id:'penalty-round',season:2026,roundNumber:1,mode:'normal',matches:[found.match],userMatchId:found.match.id};
  const lineup=currentLineup(found.match,'home',found.event.second);
  const takers=lineup.map(id=>home.players.find(p=>String(p.id)===String(id))).filter(Boolean).sort((a,b)=>playerGameStats(b).penalties-playerGameStats(a).penalties);
  const result=resolveUserPenalty(career,clubs,found.event.id,takers[0].id);
  assert.equal(result.error,null);
  assert.ok(result.outcome);
  const resolved=result.career.pendingRound.matches[0].events.find(e=>e.id===found.event.id);
  assert.equal(resolved.resolved,true);
  assert.equal(resolved.takerId,String(takers[0].id));
  assert.ok(Array.isArray(resolved.narrative)&&resolved.narrative.length===4);
});

test('red-carded players are removed from the current lineup and cannot be replaced by currentLineup',function(){
  const career=createCareer(clubs,clubs[0].id);
  const lineup=autoLineup(clubs[0],career,1);
  const victim=lineup[2];
  const match={
    homeLineup:lineup,awayLineup:autoLineup(clubs[1],career,1),substitutions:[],
    events:[{type:'red',side:'home',second:1200,playerId:String(victim)}]
  };
  assert.ok(currentLineup(match,'home',1100).includes(String(victim)));
  assert.ok(!currentLineup(match,'home',1300).includes(String(victim)));
  assert.equal(currentLineup(match,'home',1300).length,10);
});
