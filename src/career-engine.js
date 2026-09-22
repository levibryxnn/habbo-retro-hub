import { applySponsorPayments, expireSeasonSponsors, INITIAL_CASH } from './finance-model.js';
import { worldRecordMessage } from './records-data.js';

export const CAREER_KEY = 'ldf.career.v2';
export const FULL_TIME_SECOND = 90 * 60;
export const SIMULATION_MODES = {
  normal:{ id:'normal', label:'Normal', tickMs:500, gameSecondsPerTick:30, description:'Acompanhe a rodada lance a lance.' },
  fast:{ id:'fast', label:'Rápido', tickMs:350, gameSecondsPerTick:120, description:'Acompanhe os principais acontecimentos em ritmo acelerado.' },
  instant:{ id:'instant', label:'Instantânea', tickMs:0, gameSecondsPerTick:FULL_TIME_SECOND, description:'Resolva os 10 jogos e veja os resultados imediatamente.' },
};

function hashString(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(value) {
  let a = hashString(value) || 1;
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function poisson(lambda,rng) {
  const limit=Math.exp(-lambda);
  let p=1;
  let k=0;
  do { k++; p*=rng(); } while(p>limit && k<9);
  return Math.max(0,k-1);
}

const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));

export function buildSchedule(clubs) {
  const ids=clubs.map(function(club){return club.id;});
  const list=ids.length%2?ids.concat(null):ids.slice();
  const n=list.length;
  const first=[];
  let rotation=list.slice();
  for(let round=0;round<n-1;round++){
    const matches=[];
    for(let i=0;i<n/2;i++){
      const a=rotation[i];
      const b=rotation[n-1-i];
      if(a&&b){
        const flip=(round+i)%2===1;
        matches.push({homeId:flip?b:a,awayId:flip?a:b});
      }
    }
    first.push(matches);
    rotation=[rotation[0],rotation[n-1]].concat(rotation.slice(1,n-1));
  }
  return first.concat(first.map(function(matches){
    return matches.map(function(match){return {homeId:match.awayId,awayId:match.homeId};});
  }));
}

function playerAgeScore(player) {
  const age=player.age??27;
  if(age>=24&&age<=29) return 1;
  if(age>=21&&age<=32) return .92;
  if(age<=20) return .84;
  if(age<=35) return .82;
  return .72;
}

function positionalPlayers(club,positions) {
  return (club?.players||[]).filter(function(player){return positions.includes(player.position);});
}

function unitScore(players,target) {
  if(!players.length) return 46;
  const depth=Math.min(1.18,players.length/target);
  const prime=players.reduce(function(sum,player){return sum+playerAgeScore(player);},0)/players.length;
  return clamp(48,88,52+depth*21+prime*14);
}

export function teamProfile(club) {
  const players=club?.players||[];
  const goalkeepers=positionalPlayers(club,['Goalkeeper']);
  const defenders=positionalPlayers(club,['Defender']);
  const midfielders=positionalPlayers(club,['Midfielder']);
  const attackers=positionalPlayers(club,['Forward','Attacker']);
  const goalkeeper=unitScore(goalkeepers,2);
  const defense=(unitScore(defenders,8)*.82)+(goalkeeper*.18);
  const midfield=unitScore(midfielders,8);
  const attack=(unitScore(attackers,6)*.86)+(midfield*.14);
  const depth=clamp(0,6,(players.length-20)*.45);
  const overall=clamp(50,88,(goalkeeper+defense+midfield+attack)/4+depth*.25);
  return {goalkeeper,defense,midfield,attack,overall,depth};
}

export function teamRating(club) {
  return teamProfile(club).overall;
}

function resultPoints(result,clubId) {
  if(!result) return 0;
  const home=result.homeId===clubId;
  const gf=home?result.homeGoals:result.awayGoals;
  const ga=home?result.awayGoals:result.homeGoals;
  return gf>ga?3:gf===ga?1:0;
}

function recentForm(results,clubId) {
  const recent=(results||[]).filter(function(result){
    return result.homeId===clubId||result.awayId===clubId;
  }).slice(-5);
  if(!recent.length) return 0;
  const points=recent.reduce(function(sum,result){return sum+resultPoints(result,clubId);},0);
  return ((points/(recent.length*3))-.5)*6;
}

function weightedPlayer(club,rng) {
  const players=(club?.players||[]).filter(function(player){return player.name;});
  if(!players.length) return {id:'fallback-'+(club?.id||'club'),name:'Jogador do '+(club?.abbreviation||'clube')};
  const weights=players.map(function(player){
    if(player.position==='Forward'||player.position==='Attacker') return 5.8;
    if(player.position==='Midfielder') return 2.8;
    if(player.position==='Defender') return .65;
    return .05;
  });
  const total=weights.reduce(function(a,b){return a+b;},0);
  let roll=rng()*total;
  for(let i=0;i<players.length;i++){
    roll-=weights[i];
    if(roll<=0) return players[i];
  }
  return players[0];
}

function makeEvent(side,type,second,club,player,index) {
  const minute=Math.max(1,Math.floor(second/60));
  let text;
  if(type==='goal') text='GOL! '+player.name+' marca para o '+club.name;
  else if(type==='yellow') text=player.name+' recebe cartão amarelo';
  else if(type==='corner') text='Escanteio para o '+club.name;
  else if(type==='foul') text=player.name+' comete falta';
  else if(type==='big-chance') text=player.name+' perde uma grande oportunidade';
  else text=player.name+' finaliza; a defesa responde';
  return {
    id:side+'-'+type+'-'+second+'-'+index,
    side,
    type,
    minute,
    second,
    playerId:String(player.id||player.name),
    player:player.name,
    clubId:club.id,
    text,
  };
}

function uniqueEventSecond(rng,used,durationSecond) {
  let second=180+Math.floor(rng()*Math.max(1,durationSecond-360));
  let guard=0;
  while(used.has(second)&&guard<30){
    second=180+Math.floor(rng()*Math.max(1,durationSecond-360));
    guard++;
  }
  used.add(second);
  return second;
}

export function simulateMatch(home,away,seed,context) {
  const ctx=context||{};
  const rng=rngFrom(seed);
  const hp=teamProfile(home);
  const ap=teamProfile(away);
  const homeForm=recentForm(ctx.results||[],home.id);
  const awayForm=recentForm(ctx.results||[],away.id);
  const midfieldEdge=(hp.midfield-ap.midfield)/18;
  const homeAttackEdge=(hp.attack-ap.defense)/15;
  const awayAttackEdge=(ap.attack-hp.defense)/15;
  const homeMomentum=(homeForm-awayForm)/7;

  const homeLambda=clamp(.35,3.45,1.2+homeAttackEdge+midfieldEdge*.25+homeMomentum*.18+.20);
  const awayLambda=clamp(.30,3.2,1.0+awayAttackEdge-midfieldEdge*.2-homeMomentum*.12);
  const homeGoals=clamp(0,7,poisson(homeLambda,rng));
  const awayGoals=clamp(0,7,poisson(awayLambda,rng));
  const durationSecond=FULL_TIME_SECOND+(1+Math.floor(rng()*5))*60;

  const events=[];
  const used=new Set();
  let eventIndex=0;
  for(let i=0;i<homeGoals;i++) events.push(makeEvent('home','goal',uniqueEventSecond(rng,used,durationSecond),home,weightedPlayer(home,rng),eventIndex++));
  for(let i=0;i<awayGoals;i++) events.push(makeEvent('away','goal',uniqueEventSecond(rng,used,durationSecond),away,weightedPlayer(away,rng),eventIndex++));

  const tempoFactor=9+Math.floor(rng()*5);
  const types=['shot','shot','big-chance','foul','yellow','corner'];
  for(let i=0;i<tempoFactor;i++){
    const homeChance=.5+clamp(-.13,.13,(hp.midfield+hp.attack-ap.midfield-ap.attack)/120);
    const side=rng()<homeChance?'home':'away';
    const club=side==='home'?home:away;
    const type=types[Math.floor(rng()*types.length)];
    events.push(makeEvent(side,type,uniqueEventSecond(rng,used,durationSecond),club,weightedPlayer(club,rng),eventIndex++));
  }
  events.sort(function(a,b){return a.second-b.second;});

  const baseHomeShots=5+Math.floor(rng()*6)+homeGoals+Math.max(0,Math.round((hp.attack-ap.defense)/8));
  const baseAwayShots=4+Math.floor(rng()*6)+awayGoals+Math.max(0,Math.round((ap.attack-hp.defense)/8));
  const homeShots=Math.max(homeGoals,baseHomeShots);
  const awayShots=Math.max(awayGoals,baseAwayShots);
  const possession=clamp(38,65,Math.round(50+(hp.midfield-ap.midfield)*.55+(rng()-.5)*6));

  return {
    id:String(seed),
    season:ctx.season||2026,
    roundNumber:ctx.roundNumber||1,
    competition:'Brasileirão Série A',
    homeId:home.id,
    awayId:away.id,
    homeGoals,
    awayGoals,
    durationSecond,
    events,
    stats:{
      possession:[possession,100-possession],
      shots:[homeShots,awayShots],
      onTarget:[
        Math.max(homeGoals,Math.round(homeShots*(.34+rng()*.17))),
        Math.max(awayGoals,Math.round(awayShots*(.34+rng()*.17))),
      ],
      corners:[Math.floor(rng()*7),Math.floor(rng()*7)],
      fouls:[7+Math.floor(rng()*10),7+Math.floor(rng()*10)],
    },
    intelligence:{
      homeOverall:Math.round(hp.overall),
      awayOverall:Math.round(ap.overall),
      homeForm:Number(homeForm.toFixed(2)),
      awayForm:Number(awayForm.toFixed(2)),
    },
  };
}

export function scoreAtSecond(result,second) {
  if(!result) return {home:0,away:0};
  if(second>=result.durationSecond) return {home:result.homeGoals,away:result.awayGoals};
  return (result.events||[]).filter(function(event){
    return event.type==='goal'&&event.second<=second;
  }).reduce(function(score,event){
    score[event.side]+=1;
    return score;
  },{home:0,away:0});
}

export function roundDuration(pendingRound) {
  if(!pendingRound?.matches?.length) return FULL_TIME_SECOND;
  return Math.max.apply(null,pendingRound.matches.map(function(match){return match.durationSecond||FULL_TIME_SECOND;}));
}

export function liveRoundMatches(pendingRound,second) {
  if(!pendingRound) return [];
  return pendingRound.matches.map(function(result){
    const score=scoreAtSecond(result,second);
    return {
      ...result,
      liveHomeGoals:score.home,
      liveAwayGoals:score.away,
      finished:second>=(result.durationSecond||FULL_TIME_SECOND),
      minute:Math.min(Math.floor(second/60),Math.floor((result.durationSecond||FULL_TIME_SECOND)/60)),
    };
  });
}

function normalizeResults(results,season) {
  return (Array.isArray(results)?results:[]).map(function(result,index){
    return {
      ...result,
      season:result.season||season,
      roundNumber:result.roundNumber||Math.floor(index/10)+1,
      competition:result.competition||'Brasileirão Série A',
      durationSecond:result.durationSecond||FULL_TIME_SECOND,
    };
  });
}

export function standingsFromResults(results,clubs) {
  const rows=Object.fromEntries(clubs.map(function(club){
    return [club.id,{clubId:club.id,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0}];
  }));
  for(const result of results||[]){
    const home=rows[result.homeId];
    const away=rows[result.awayId];
    if(!home||!away) continue;
    home.played++;
    away.played++;
    home.goalsFor+=result.homeGoals;
    home.goalsAgainst+=result.awayGoals;
    away.goalsFor+=result.awayGoals;
    away.goalsAgainst+=result.homeGoals;
    if(result.homeGoals>result.awayGoals){
      home.wins++;away.losses++;home.points+=3;
    }else if(result.homeGoals<result.awayGoals){
      away.wins++;home.losses++;away.points+=3;
    }else{
      home.draws++;away.draws++;home.points++;away.points++;
    }
  }
  return Object.values(rows).map(function(row){
    return {...row,goalDifference:row.goalsFor-row.goalsAgainst};
  }).sort(function(a,b){
    return b.points-a.points||b.wins-a.wins||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||String(a.clubId).localeCompare(String(b.clubId));
  }).map(function(row,index){
    return {...row,position:index+1,efficiency:row.played?Math.round(row.points/(row.played*3)*100):0};
  });
}

function addScorers(map,result) {
  const next={...(map||{})};
  for(const event of (result.events||[]).filter(function(item){return item.type==='goal';})){
    const key=event.clubId+':'+event.playerId;
    next[key]={
      playerId:event.playerId,
      name:event.player,
      clubId:event.clubId,
      goals:(next[key]?.goals||0)+1,
    };
  }
  return next;
}

export function topScorers(map,limit) {
  const size=limit??20;
  return Object.values(map||{}).sort(function(a,b){
    return b.goals-a.goals||a.name.localeCompare(b.name,'pt-BR');
  }).slice(0,size);
}

function historyEntry(result,userClubId) {
  const isHome=result.homeId===userClubId;
  const goalsFor=isHome?result.homeGoals:result.awayGoals;
  const goalsAgainst=isHome?result.awayGoals:result.homeGoals;
  const points=goalsFor>goalsAgainst?3:goalsFor===goalsAgainst?1:0;
  return {
    id:'history-'+result.season+'-'+result.roundNumber+'-'+result.id,
    season:result.season,
    roundNumber:result.roundNumber,
    competition:result.competition||'Brasileirão Série A',
    homeId:result.homeId,
    awayId:result.awayId,
    homeGoals:result.homeGoals,
    awayGoals:result.awayGoals,
    points,
    result:points===3?'Vitória':points===1?'Empate':'Derrota',
  };
}

function deriveHistory(results,userClubId) {
  return (results||[]).filter(function(result){
    return result.homeId===userClubId||result.awayId===userClubId;
  }).map(function(result){return historyEntry(result,userClubId);});
}

export function userMatchHistory(career) {
  return (career.history||[]).slice().sort(function(a,b){
    return b.season-a.season||b.roundNumber-a.roundNumber;
  });
}

export function createCareer(clubs,userClubId,season) {
  return {
    version:3,
    userClubId,
    season:season||2026,
    round:0,
    schedule:buildSchedule(clubs),
    results:[],
    scorers:{},
    allTimeScorers:{},
    cash:INITIAL_CASH,
    transactions:[],
    sponsors:[],
    trophies:[],
    messages:[],
    seasons:[],
    history:[],
    pendingRound:null,
    lastRoundResults:[],
    lastUserMatch:null,
    preferredSimulationMode:'normal',
  };
}

export function sanitizeCareer(raw,clubs,userClubId) {
  if(!raw||typeof raw!=='object'||raw.userClubId!==userClubId) return createCareer(clubs,userClubId);
  const season=Number(raw.season)||2026;
  const results=normalizeResults(raw.results,season);
  const base=createCareer(clubs,userClubId,season);
  const history=Array.isArray(raw.history)&&raw.history.length?raw.history:deriveHistory(results,userClubId);
  const pending=raw.pendingRound&&Array.isArray(raw.pendingRound.matches)?{
    ...raw.pendingRound,
    matches:normalizeResults(raw.pendingRound.matches,season),
  }:null;
  return {
    ...base,
    ...raw,
    version:3,
    schedule:Array.isArray(raw.schedule)&&raw.schedule.length===38?raw.schedule:buildSchedule(clubs),
    results,
    scorers:raw.scorers&&typeof raw.scorers==='object'?raw.scorers:{},
    allTimeScorers:raw.allTimeScorers&&typeof raw.allTimeScorers==='object'?raw.allTimeScorers:{},
    sponsors:Array.isArray(raw.sponsors)?raw.sponsors:[],
    trophies:Array.isArray(raw.trophies)?raw.trophies:[],
    transactions:Array.isArray(raw.transactions)?raw.transactions:[],
    messages:Array.isArray(raw.messages)?raw.messages:[],
    seasons:Array.isArray(raw.seasons)?raw.seasons:[],
    history,
    pendingRound:pending,
    lastRoundResults:Array.isArray(raw.lastRoundResults)?normalizeResults(raw.lastRoundResults,season):[],
    preferredSimulationMode:SIMULATION_MODES[raw.preferredSimulationMode]?raw.preferredSimulationMode:'normal',
  };
}

export function fixtureForUser(career) {
  if(career.pendingRound){
    return career.pendingRound.matches.find(function(match){
      return match.homeId===career.userClubId||match.awayId===career.userClubId;
    })||null;
  }
  if(career.round>=career.schedule.length) return null;
  return career.schedule[career.round].find(function(match){
    return match.homeId===career.userClubId||match.awayId===career.userClubId;
  })||null;
}

function userOutcome(result,userClubId) {
  const home=result.homeId===userClubId;
  const gf=home?result.homeGoals:result.awayGoals;
  const ga=home?result.awayGoals:result.homeGoals;
  return {winner:gf>ga?'user':gf<ga?'opponent':'draw',goalsFor:gf,goalsAgainst:ga};
}

function finalizeSeason(career,clubs) {
  const table=standingsFromResults(career.results,clubs);
  const champion=table[0];
  const leaders=topScorers(career.scorers,1);
  let next={
    ...career,
    seasons:[...(career.seasons||[]),{season:career.season,championId:champion?.clubId,topScorer:leaders[0]||null}],
  };
  if(champion?.clubId===career.userClubId){
    const club=clubs.find(function(item){return item.id===career.userClubId;});
    next={
      ...next,
      trophies:[...(next.trophies||[]),{id:'brasileirao',season:career.season,earnedAtRound:38}],
      messages:[{
        id:'brasileirao-'+career.season,
        type:'title',
        title:'Campeão brasileiro!',
        text:(club?.name||'Seu clube')+' conquistou o Brasileirão '+career.season+'. A taça foi adicionada automaticamente à galeria.',
      },...(next.messages||[])],
    };
  }
  return expireSeasonSponsors(next);
}

export function canStartRound(career) {
  return !career.pendingRound&&career.round<career.schedule.length;
}

export function startRound(career,clubs,mode) {
  if(!canStartRound(career)) return career;
  const selectedMode=SIMULATION_MODES[mode]?mode:'normal';
  const roundNumber=career.round+1;
  const fixtures=career.schedule[career.round];
  const matches=fixtures.map(function(fixture,index){
    const home=clubs.find(function(club){return club.id===fixture.homeId;});
    const away=clubs.find(function(club){return club.id===fixture.awayId;});
    const seed=career.season+'-'+roundNumber+'-'+index+'-'+home.id+'-'+away.id;
    return simulateMatch(home,away,seed,{
      results:career.results,
      season:career.season,
      roundNumber,
    });
  });
  const userMatch=matches.find(function(result){
    return result.homeId===career.userClubId||result.awayId===career.userClubId;
  });
  return {
    ...career,
    preferredSimulationMode:selectedMode,
    pendingRound:{
      id:'round-'+career.season+'-'+roundNumber,
      season:career.season,
      roundNumber,
      mode:selectedMode,
      matches,
      userMatchId:userMatch?.id||null,
      started:true,
    },
  };
}

export function finishPendingRound(career,clubs) {
  if(!career.pendingRound) return career;
  const roundNumber=career.pendingRound.roundNumber;
  const roundResults=career.pendingRound.matches;
  let scorers={...career.scorers};
  let allTime={...career.allTimeScorers};
  for(const result of roundResults){
    scorers=addScorers(scorers,result);
    allTime=addScorers(allTime,result);
  }
  const userResult=roundResults.find(function(result){
    return result.homeId===career.userClubId||result.awayId===career.userClubId;
  });
  const entry=userResult?historyEntry(userResult,career.userClubId):null;
  let next={
    ...career,
    round:roundNumber,
    results:[...career.results,...roundResults],
    scorers,
    allTimeScorers:allTime,
    history:entry?[...(career.history||[]),entry]:(career.history||[]),
    lastRoundResults:roundResults,
    lastUserMatch:userResult||career.lastUserMatch,
    pendingRound:null,
  };
  if(userResult) next=applySponsorPayments(next,roundNumber,userOutcome(userResult,career.userClubId));
  if(roundNumber===career.schedule.length) next=finalizeSeason(next,clubs);
  return next;
}

export function simulateRound(career,clubs) {
  const started=startRound(career,clubs,'instant');
  if(started===career) return career;
  return finishPendingRound(started,clubs);
}

export function startNextSeason(career,clubs) {
  if(career.pendingRound||career.round<career.schedule.length) return career;
  return {
    ...career,
    season:career.season+1,
    round:0,
    schedule:buildSchedule(clubs),
    results:[],
    scorers:{},
    lastRoundResults:[],
    lastUserMatch:null,
    pendingRound:null,
    sponsors:(career.sponsors||[]).map(function(contract){return {...contract,active:false};}),
  };
}

export function addWorldTitle(career,clubName) {
  const count=(career.trophies||[]).filter(function(trophy){return trophy.id==='world';}).length+1;
  let next={
    ...career,
    trophies:[...(career.trophies||[]),{id:'world',season:career.season,earnedAtRound:career.round}],
  };
  const message=worldRecordMessage(clubName,count);
  if(message&&!(next.messages||[]).some(function(item){return item.id===message.id;})){
    next={...next,messages:[message,...(next.messages||[])]};
  }
  return next;
}
