import { autoLineup, playerCondition, playerGameStats, sanitizeLineup, statusKey } from './player-engine.js';
import { applyConfidenceEvent } from './manager-confidence.js';
import { applyMatchDynamics, applyTitleDynamics, managerMatchModifier } from './career-dynamics.js';
import { applyWeeklyTraining, matchWeather, sanitizeTacticalState, setPieceAttackModifier, setTacticalPreset, tacticalMatchup } from './tactical-engine.js';
import { advanceWorldManagers, processPlayerPromises, refreshJobOffers } from './career-life-engine.js';
import { emitCareerEvent } from './event-engine.js';
import { LDF_ENGINE_VERSION, adaptiveAiDecision, combinedInjuryChance, contextScore, expectedGoals, fatigueConditionLoss, fatigueLoad, fitnessPenalty, formScore, individualInjuryRisk, logisticDominance, roleLoad, tacticalExecutionScore, teamStrength } from './ldf-engine.js';
import { positionGroup } from './position-labels.js';
import {
  COPA_DO_BRASIL_QUALIFIERS,
  LIBERTADORES_GROUPS_2026,
  REGIONAL_GROUPS_2026,
  SERIE_A_STATE,
  STATE_CONFIGS,
  SUDAMERICANA_GROUPS_2026,
  UCL_2025_26_CHAMPION,
  UCL_POTS_2026,
  WORLD_CLUBS,
  stateConfigForClub,
  worldClubById,
} from './competition-data.js';

const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const pad=n=>String(n).padStart(2,'0');
const hashString=value=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const roll=seed=>(hashString(seed)%1000000)/1000000;
const clubId=item=>String(typeof item==='string'?item:item?.id||'');
const iso=(season,month,day)=>season+'-'+pad(month)+'-'+pad(day);
const dateValue=value=>new Date(value+'T12:00:00Z').getTime();

function addDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function spreadDates(season,startMD,endMD,count){
  const [sm,sd]=startMD.split('-').map(Number),[em,ed]=endMD.split('-').map(Number);
  const a=Date.UTC(season,sm-1,sd),b=Date.UTC(season,em-1,ed),step=count<=1?0:(b-a)/(count-1);
  return Array.from({length:count},(_,i)=>new Date(a+step*i).toISOString().slice(0,10));
}
function circleRounds(ids){
  const teams=ids.slice();if(teams.length%2)teams.push(null);
  const n=teams.length,rounds=[];
  for(let r=0;r<n-1;r++){
    const games=[];
    for(let i=0;i<n/2;i++){const a=teams[i],b=teams[n-1-i];if(a&&b)games.push(r%2?[b,a]:[a,b]);}
    rounds.push(games);
    teams.splice(1,0,teams.pop());
  }
  return rounds;
}
function crossRounds(a,b){
  const rounds=[];for(let r=0;r<b.length;r++){const games=[];for(let i=0;i<a.length;i++){const j=(i+r)%b.length;games.push((r+i)%2?[b[j],a[i]]:[a[i],b[j]]);}rounds.push(games);}return rounds;
}
function tripartiteRounds(groups){
  const ids=groups.flat().map(clubId),groupBy=Object.fromEntries(groups.flatMap((g,gi)=>g.map(item=>[clubId(item),gi])));
  const edges=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(groupBy[ids[i]]!==groupBy[ids[j]])edges.push([ids[i],ids[j]]);
  const rounds=Array.from({length:8},()=>[]),used=Array.from({length:8},()=>new Set());
  function place(index){
    if(index>=edges.length)return true;
    const [a,b]=edges[index];
    const order=Array.from({length:8},(_,i)=>(i+hashString(a+'|'+b))%8);
    for(const r of order){
      if(rounds[r].length>=6||used[r].has(a)||used[r].has(b))continue;
      rounds[r].push([a,b]);used[r].add(a);used[r].add(b);
      if(place(index+1))return true;
      rounds[r].pop();used[r].delete(a);used[r].delete(b);
    }
    return false;
  }
  if(!place(0))return circleRounds(ids).slice(0,8);
  return rounds;
}
function resolveEntry(item,serieAClubs){
  if(typeof item==='object')return item;
  const id=String(item);
  const real=serieAClubs.find(club=>String(club.id)===id);
  return real?{id:real.id,name:real.name,abbreviation:real.abbreviation,country:'BRA',power:null,logo:real.logo,external:false}:worldClubById(id)||{id,name:id,abbreviation:id.slice(0,3),country:'BRA',power:62,external:true};
}
function allEntryMap(serieAClubs){
  const map=new Map();
  for(const club of serieAClubs)map.set(String(club.id),resolveEntry(club.id,serieAClubs));
  for(const club of WORLD_CLUBS)map.set(String(club.id),club);
  return map;
}
function registrySnapshot(serieAClubs){
  return Object.fromEntries([...allEntryMap(serieAClubs)].map(([id,club])=>[id,{id:club.id,name:club.name,abbreviation:club.abbreviation,country:club.country,power:club.power,wikiQuery:club.wikiQuery,logo:club.logo||null,external:Boolean(club.external)}]));
}
function roundDatesForState(config,season,count){
  const endLeague=addDays(iso(season,...config.end.split('-').map(Number)),-Math.max(21,(config.knockout||[]).reduce((sum,item)=>sum+item.legs*5,0)));
  return spreadDates(season,config.start,endLeague.slice(5),count);
}
function knockoutDates(endDate,plan){
  const total=plan.reduce((sum,item)=>sum+item.legs,0),dates=[],start=addDays(endDate,-Math.max(0,(total-1)*7));
  let cursor=start;for(const stage of plan){const stageDates=[];for(let i=0;i<stage.legs;i++){stageDates.push(cursor);cursor=addDays(cursor,7);}dates.push(stageDates);}return dates;
}
function fixture(id,competitionId,stage,date,homeId,awayId,extra={}){
  return{id,competitionId,stage,date,homeId:String(homeId),awayId:String(awayId),played:false,...extra};
}
function firstPhaseForState(config,season){
  const groups=(config.groups||[]).map(g=>g.map(clubId)),ids=(config.teams||config.groups?.flat()||[]).map(clubId);
  let rounds;
  if(config.format==='cross6')rounds=crossRounds(groups[0],groups[1]);
  else if(config.format==='cross3')rounds=tripartiteRounds(groups);
  else if(config.format==='round-robin')rounds=circleRounds(ids).slice(0,config.leagueRounds||ids.length-1);
  else{
    const all=circleRounds(ids),offset=hashString(config.id+'|'+season)%all.length;
    rounds=Array.from({length:config.leagueRounds||8},(_,i)=>all[(offset+i)%all.length]);
  }
  const dates=roundDatesForState(config,season,rounds.length);
  return rounds.flatMap((games,r)=>games.map((pair,i)=>fixture(config.id+'-'+season+'-L'+(r+1)+'-'+i,config.id,'Primeira fase',dates[r],pair[0],pair[1],{phase:'league',round:r+1})));
}
function stateCompetition(config,season,serieAClubs){
  const ids=(config.teams||config.groups?.flat()||[]).map(clubId),groups=(config.groups||[]).map(g=>g.map(clubId));
  return{
    id:config.id,edition:season,key:config.id+':'+season,name:config.name,type:'state',season,
    format:config.format,teams:ids,groups,stage:'league',stageIndex:-1,fixtures:firstPhaseForState(config,season),results:[],
    knockoutPlan:config.knockout||[],knockoutDates:knockoutDates(iso(season,...config.end.split('-').map(Number)),config.knockout||[]),
    qualify:config.qualify||null,qualifyPerGroup:config.qualifyPerGroup||null,qualifyOverall:config.qualifyOverall||null,qualifyMode:config.qualifyMode||null,knockoutPairing:config.knockoutPairing||null,
    championId:null,runnerUpId:null,eliminated:[],metadata:{region:config.region},
  };
}
function regionalCompetition(config,season){
  const groups=Object.fromEntries(Object.entries(config.groups).map(([key,list])=>[key,list.map(clubId)])),fixtures=[];
  let rounds=[];
  if(config.format==='cross6'){
    const keys=Object.keys(groups);rounds=crossRounds(groups[keys[0]],groups[keys[1]]);
  }else{
    const perGroup=Object.entries(groups).map(([g,ids])=>({g,rounds:circleRounds(ids)}));
    const max=Math.max(...perGroup.map(item=>item.rounds.length));
    rounds=Array.from({length:max},()=>[]);
    for(const item of perGroup)item.rounds.forEach((games,r)=>games.forEach(pair=>rounds[r].push([...pair,item.g])));
  }
  const leagueDates=spreadDates(season,config.start,addDays(iso(season,...config.end.split('-').map(Number)),-21).slice(5),rounds.length);
  rounds.forEach((games,r)=>games.forEach((pair,i)=>{
    const g=pair[2]||null;fixtures.push(fixture(config.id+'-'+season+'-L'+(r+1)+'-'+i,config.id,g?'Grupo '+g:'Primeira fase',leagueDates[r],pair[0],pair[1],{phase:'group',group:g,round:r+1}));
  }));
  const plan=config.knockout||[],koDates=knockoutDates(iso(season,...config.end.split('-').map(Number)),plan);
  return{id:config.id,edition:season,key:config.id+':'+season,name:config.name,type:'regional',season,format:config.format==='cross6'?'regional-cross':'regional-groups',teams:Object.values(groups).flat(),groups,stage:'group',stageIndex:-1,fixtures,results:[],knockoutPlan:plan,knockoutDates:koDates,qualifyPerGroup:config.qualifyPerGroup||2,championId:null,runnerUpId:null,eliminated:[],metadata:{regional:true}};
}

function groupCompetition({id,name,season,groups,type,knockoutPlan,knockoutDates:koDates}){
  const normalized=Object.fromEntries(Object.entries(groups).map(([key,list])=>[key,list.map(clubId)])),fixtures=[];
  const dates=id==='libertadores'
    ?[iso(season,4,8),iso(season,4,15),iso(season,4,29),iso(season,5,6),iso(season,5,20),iso(season,5,27)]
    :[iso(season,4,8),iso(season,4,15),iso(season,4,29),iso(season,5,6),iso(season,5,20),iso(season,5,27)];
  for(const [g,ids] of Object.entries(normalized)){
    const base=circleRounds(ids),rounds=[...base,...base.map(round=>round.map(([a,b])=>[b,a]))];
    rounds.forEach((games,r)=>games.forEach((pair,i)=>fixtures.push(fixture(id+'-'+season+'-'+g+'-'+(r+1)+'-'+i,id,'Grupo '+g,dates[r],pair[0],pair[1],{phase:'group',group:g,round:r+1}))));
  }
  return{id,edition:season,key:id+':'+season,name,type,season,format:'groups',teams:Object.values(normalized).flat(),groups:normalized,stage:'group',stageIndex:-1,fixtures,results:[],knockoutPlan,knockoutDates:koDates,championId:null,runnerUpId:null,eliminated:[],metadata:{}};
}
function supercopaCompetition(season,career){
  let teams;
  if(season===2026)teams=['819','874'];
  else{
    const previous=season-1,br=career.lastSeasonTable?.[0]?.clubId||null,runner=career.lastSeasonTable?.[1]?.clubId||null,cdb=career.world?.competitions?.['copa-do-brasil:'+previous]?.championId||null;
    if(!br||!cdb)return null;
    teams=br===cdb?[br,runner]:[br,cdb];
  }
  if(!teams?.[0]||!teams?.[1])return null;
  const comp={id:'supercopa',edition:season,key:'supercopa:'+season,name:'Supercopa Rei',type:'cup',season,format:'knockout',teams:teams.map(String),groups:[],stage:'Final',stageIndex:0,fixtures:[],results:[],knockoutPlan:[{name:'Final',legs:1}],knockoutDates:[[iso(season,2,1)]],championId:null,runnerUpId:null,eliminated:[],metadata:{neutralVenue:true}};
  comp.fixtures=makeTieFixtures(comp,comp.teams,0);return comp;
}
function copaDoBrasil(season,serieAClubs){
  const teams=[...serieAClubs.map(c=>String(c.id)),...COPA_DO_BRASIL_QUALIFIERS.map(c=>String(c.id))].slice(0,32);
  const shuffled=teams.slice().sort((a,b)=>hashString(a+'|cdb|'+season)-hashString(b+'|cdb|'+season));
  const dates=[[iso(season,5,20),iso(season,5,27)],[iso(season,8,5),iso(season,8,12)],[iso(season,9,2),iso(season,9,9)],[iso(season,11,1),iso(season,11,8)],[iso(season,12,6)]];
  const plan=[{name:'5ª fase',legs:2},{name:'Oitavas de final',legs:2},{name:'Quartas de final',legs:2},{name:'Semifinal',legs:2},{name:'Final',legs:1}];
  const comp={id:'copa-do-brasil',edition:season,key:'copa-do-brasil:'+season,name:'Copa do Brasil',type:'cup',season,format:'knockout',teams,groups:[],stage:'5ª fase',stageIndex:0,fixtures:[],results:[],knockoutPlan:plan,knockoutDates:dates,championId:null,runnerUpId:null,eliminated:[],metadata:{entry:'Série A na 5ª fase'}};
  comp.fixtures=makeTieFixtures(comp,shuffled,0);
  return comp;
}
function uclCompetition(season){
  const teams=UCL_POTS_2026.flat().map(clubId),rounds=circleRounds(teams);
  const offset=hashString('ucl|'+season)%rounds.length,selected=Array.from({length:8},(_,i)=>rounds[(offset+i*4)%rounds.length]);
  const dates=[iso(season,9,9),iso(season,10,14),iso(season,10,21),iso(season,11,4),iso(season,11,25),iso(season,12,9),iso(season+1,1,20),iso(season+1,1,27)];
  const fixtures=selected.flatMap((games,r)=>games.map((pair,i)=>fixture('ucl-'+season+'-L'+(r+1)+'-'+i,'champions-league','Fase de liga',dates[r],pair[0],pair[1],{phase:'league',round:r+1})));
  return{id:'champions-league',edition:season,key:'champions-league:'+season,name:'UEFA Champions League',type:'europe',season,format:'ucl-league',teams,groups:[],stage:'league',stageIndex:-1,fixtures,results:[],knockoutPlan:[{name:'Play-off',legs:2},{name:'Oitavas de final',legs:2},{name:'Quartas de final',legs:2},{name:'Semifinal',legs:2},{name:'Final',legs:1}],knockoutDates:[
    [iso(season+1,2,17),iso(season+1,2,24)],[iso(season+1,3,10),iso(season+1,3,17)],[iso(season+1,4,7),iso(season+1,4,14)],[iso(season+1,4,28),iso(season+1,5,5)],[iso(season+1,6,5)]
  ],championId:null,runnerUpId:null,eliminated:[],metadata:{pots:UCL_POTS_2026.map(p=>p.map(clubId)),directR16:[]}};
}

export function brasileiraoDateForRound(round,season){
  const first=spreadDates(season,'01-28','05-31',18),second=spreadDates(season,'07-22','12-02',20);
  return [...first,...second][clamp(0,37,Number(round||1)-1)];
}

function tableFrom(comp,teamIds){
  const ids=teamIds||comp.teams,rows=Object.fromEntries(ids.map(id=>[String(id),{clubId:String(id),played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0}]));
  for(const result of comp.results||[]){
    if(!rows[result.homeId]||!rows[result.awayId])continue;
    const h=rows[result.homeId],a=rows[result.awayId];h.played++;a.played++;h.goalsFor+=result.homeGoals;h.goalsAgainst+=result.awayGoals;a.goalsFor+=result.awayGoals;a.goalsAgainst+=result.homeGoals;
    if(result.homeGoals>result.awayGoals){h.wins++;a.losses++;h.points+=3;}else if(result.homeGoals<result.awayGoals){a.wins++;h.losses++;a.points+=3;}else{h.draws++;a.draws++;h.points++;a.points++;}
  }
  return Object.values(rows).map(row=>({...row,goalDifference:row.goalsFor-row.goalsAgainst})).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||hashString(a.clubId)-hashString(b.clubId)).map((row,i)=>({...row,position:i+1}));
}
export function competitionTable(comp,group=null){
  if(group&&comp.groups?.[group])return tableFrom(comp,comp.groups[group]);
  return tableFrom(comp,comp.teams);
}
function currentStageFixtures(comp){return comp.fixtures.filter(item=>item.stageIndex===comp.stageIndex||(comp.stageIndex<0&&['league','group'].includes(item.phase)));}
function stageComplete(comp){
  const current=currentStageFixtures(comp);return current.length>0&&current.every(item=>item.played);
}
function aggregateTie(comp,tieId){
  const games=comp.fixtures.filter(item=>item.tieId===tieId&&item.played).sort((a,b)=>a.leg-b.leg);if(!games.length)return null;
  const a=games[0].homeId,b=games[0].awayId;let ga=0,gb=0;
  for(const game of games){const r=comp.results.find(x=>x.fixtureId===game.id);if(!r)continue;if(r.homeId===a){ga+=r.homeGoals;gb+=r.awayGoals;}else{ga+=r.awayGoals;gb+=r.homeGoals;}}
  if(ga!==gb)return ga>gb?a:b;
  return roll(comp.key+'|'+tieId+'|pens')>.5?a:b;
}
function makeTieFixtures(comp,teams,stageIndex){
  const stage=comp.knockoutPlan[stageIndex],dates=comp.knockoutDates[stageIndex]||[addDays(iso(comp.season,12,1),stageIndex*7)],list=[],pairs=[];
  for(let i=0;i<teams.length/2;i++)pairs.push([String(teams[i]),String(teams[teams.length-1-i])]);
  pairs.forEach(([a,b],i)=>{
    const tieId=comp.key+'-S'+stageIndex+'-T'+i;
    if(stage.legs===1)list.push(fixture(tieId+'-L1',comp.id,stage.name,dates[0],a,b,{phase:'knockout',stageIndex,tieId,leg:1,legs:1,neutral:stage.name==='Final'}));
    else{
      list.push(fixture(tieId+'-L1',comp.id,stage.name,dates[0],b,a,{phase:'knockout',stageIndex,tieId,leg:1,legs:2}));
      list.push(fixture(tieId+'-L2',comp.id,stage.name,dates[1],a,b,{phase:'knockout',stageIndex,tieId,leg:2,legs:2}));
    }
  });
  return list;
}
function stateQualifiers(comp){
  if(comp.qualifyMode==='group-winners-best-runner'){
    const tables=comp.groups.map((ids,i)=>tableFrom(comp,ids).map(row=>({...row,group:i}))),winners=tables.map(t=>t[0]),runners=tables.map(t=>t[1]).sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference);
    return [...winners,runners[0]].sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference).map(row=>row.clubId);
  }
  if(comp.qualifyPerGroup){
    return comp.groups.flatMap(ids=>tableFrom(comp,ids).slice(0,comp.qualifyPerGroup).map(row=>row.clubId));
  }
  return tableFrom(comp).slice(0,comp.qualifyOverall||comp.qualify||8).map(row=>row.clubId);
}
function orderedStateKnockout(comp,qualifiers){
  if(comp.knockoutPairing!=='within-group')return qualifiers;
  const ordered=[];
  for(const ids of comp.groups){
    const q=tableFrom(comp,ids).filter(row=>qualifiers.includes(row.clubId)).map(row=>row.clubId);
    if(q.length>=4)ordered.push(q[0],q[1],q[2],q[3]);
  }
  // makeTieFixtures pairs ends, so reorder to obtain 1x4 and 2x3 for each group.
  if(ordered.length===8)return[ordered[0],ordered[1],ordered[4],ordered[5],ordered[6],ordered[7],ordered[2],ordered[3]];
  return qualifiers;
}
function progressStandard(comp){
  if(comp.championId||(comp.id==='sudamericana'&&comp.stageIndex===-2)||!stageComplete(comp))return comp;
  if(comp.stageIndex<0){
    let qualifiers;
    if(comp.type==='state')qualifiers=orderedStateKnockout(comp,stateQualifiers(comp));
    else if(comp.id==='libertadores'){
      qualifiers=Object.keys(comp.groups).flatMap(g=>competitionTable(comp,g).slice(0,2).map(r=>r.clubId));
      comp={...comp,metadata:{...comp.metadata,thirdPlaces:Object.keys(comp.groups).map(g=>competitionTable(comp,g)[2]?.clubId).filter(Boolean)}};
    }else if(comp.id==='sudamericana'){
      const direct=Object.keys(comp.groups).map(g=>competitionTable(comp,g)[0]?.clubId).filter(Boolean),runners=Object.keys(comp.groups).map(g=>competitionTable(comp,g)[1]?.clubId).filter(Boolean);
      return{...comp,stage:'Aguardando playoffs',metadata:{...comp.metadata,directR16:direct,runnersUp:runners},stageIndex:-2};
    }else if(comp.type==='regional'){
      qualifiers=Object.keys(comp.groups).flatMap(g=>competitionTable(comp,g).slice(0,comp.qualifyPerGroup||2).map(r=>r.clubId));
    }else if(comp.id==='champions-league'){
      const table=competitionTable(comp),direct=table.slice(0,8).map(r=>r.clubId),playoff=table.slice(8,24).map(r=>r.clubId),eliminated=table.slice(24).map(r=>r.clubId);
      const next={...comp,metadata:{...comp.metadata,directR16:direct},eliminated:[...comp.eliminated,...eliminated],stageIndex:0,stage:'Play-off'};
      return{...next,fixtures:[...next.fixtures,...makeTieFixtures(next,playoff,0)]};
    }else qualifiers=[];
    if(!qualifiers?.length)return comp;
    const next={...comp,stageIndex:0,stage:comp.knockoutPlan[0]?.name||'Mata-mata'};
    return{...next,fixtures:[...next.fixtures,...makeTieFixtures(next,qualifiers,0)]};
  }
  const current=comp.fixtures.filter(item=>item.stageIndex===comp.stageIndex),tieIds=[...new Set(current.map(item=>item.tieId))],winners=tieIds.map(id=>aggregateTie(comp,id)).filter(Boolean);
  const losers=tieIds.flatMap(id=>{const games=current.filter(x=>x.tieId===id);const ids=[...new Set(games.flatMap(x=>[x.homeId,x.awayId]))],winner=aggregateTie(comp,id);return ids.filter(x=>x!==winner);});
  if(comp.id==='champions-league'&&comp.stageIndex===0){
    const teams=[...(comp.metadata.directR16||[]),...winners],next={...comp,eliminated:[...comp.eliminated,...losers],stageIndex:1,stage:'Oitavas de final'};
    return{...next,fixtures:[...next.fixtures,...makeTieFixtures(next,teams,1)]};
  }
  const nextIndex=comp.stageIndex+1;
  if(nextIndex>=comp.knockoutPlan.length){
    return{...comp,championId:winners[0]||null,runnerUpId:losers[0]||null,stage:'Encerrada',eliminated:[...comp.eliminated,...losers]};
  }
  const next={...comp,eliminated:[...comp.eliminated,...losers],stageIndex:nextIndex,stage:comp.knockoutPlan[nextIndex].name};
  return{...next,fixtures:[...next.fixtures,...makeTieFixtures(next,winners,nextIndex)]};
}
function buildSudamericanaPlayoff(sud,lib){
  if(sud.stageIndex!==-2||!lib?.metadata?.thirdPlaces?.length||!sud.metadata?.runnersUp?.length)return sud;
  const teams=[],runners=sud.metadata.runnersUp.slice().sort((a,b)=>hashString(a+sud.key)-hashString(b+sud.key)),thirds=lib.metadata.thirdPlaces.slice().sort((a,b)=>hashString(b+lib.key)-hashString(a+lib.key));
  for(let i=0;i<8;i++){teams.push(runners[i],thirds[i]);}
  const plan=[{name:'Playoffs',legs:2},{name:'Oitavas de final',legs:2},{name:'Quartas de final',legs:2},{name:'Semifinal',legs:2},{name:'Final',legs:1}],dates=[
    [iso(sud.season,7,22),iso(sud.season,7,29)],[iso(sud.season,8,12),iso(sud.season,8,19)],[iso(sud.season,9,9),iso(sud.season,9,16)],[iso(sud.season,10,14),iso(sud.season,10,21)],[iso(sud.season,11,21)]
  ];
  const next={...sud,knockoutPlan:plan,knockoutDates:dates,stageIndex:0,stage:'Playoffs'};
  // Preserve intended runner-up vs Libertadores-third pairing rather than seeding all 16 together.
  const fixtures=[];for(let i=0;i<8;i++){const a=runners[i],b=thirds[i],tieId=next.key+'-PO-'+i;fixtures.push(fixture(tieId+'-L1',next.id,'Playoffs',dates[0][0],b,a,{phase:'knockout',stageIndex:0,tieId,leg:1,legs:2}),fixture(tieId+'-L2',next.id,'Playoffs',dates[0][1],a,b,{phase:'knockout',stageIndex:0,tieId,leg:2,legs:2}));}
  return{...next,fixtures:[...next.fixtures,...fixtures]};
}
function progressSudamericanaAfterPlayoff(sud){
  if(sud.id!=='sudamericana'||sud.stageIndex!==0||!stageComplete(sud))return sud;
  const current=sud.fixtures.filter(item=>item.stageIndex===0),ties=[...new Set(current.map(x=>x.tieId))],winners=ties.map(id=>aggregateTie(sud,id)).filter(Boolean),losers=ties.flatMap(id=>{const ids=[...new Set(current.filter(x=>x.tieId===id).flatMap(x=>[x.homeId,x.awayId]))],w=aggregateTie(sud,id);return ids.filter(x=>x!==w);});
  const teams=[...(sud.metadata.directR16||[]),...winners],next={...sud,eliminated:[...sud.eliminated,...losers],stageIndex:1,stage:'Oitavas de final'};
  return{...next,fixtures:[...next.fixtures,...makeTieFixtures(next,teams,1)]};
}
function ensureCompetitionProgress(world){
  let changed=true,next={...world,competitions:{...world.competitions}};
  while(changed){
    changed=false;
    for(const [key,comp] of Object.entries(next.competitions)){
      let updated=comp;
      if(comp.id==='sudamericana'){
        const lib=Object.values(next.competitions).find(c=>c.id==='libertadores'&&c.edition===comp.edition);
        updated=buildSudamericanaPlayoff(comp,lib);
        updated=progressSudamericanaAfterPlayoff(updated);
        if(updated===comp)updated=progressStandard(comp);
      }else updated=progressStandard(comp);
      if(updated!==comp){next.competitions[key]=updated;changed=true;}
    }
    const uclDone=Object.values(next.competitions).filter(c=>c.id==='champions-league'&&c.championId);
    for(const comp of uclDone){
      const year=comp.season+1;if(!next.europeChampions?.[year]){next.europeChampions={...(next.europeChampions||{}),[year]:comp.championId};changed=true;}
    }
    for(const lib of Object.values(next.competitions).filter(c=>c.id==='libertadores'&&c.championId)){
      const year=lib.season,euro=next.europeChampions?.[year];if(!euro)continue;
      const key='mundial:'+year;if(next.competitions[key])continue;
      const plan=[{name:'Final',legs:1}],comp={id:'mundial',edition:year,key,name:'Mundial',type:'world',season:year,format:'knockout',teams:[lib.championId,euro],groups:[],stage:'Final',stageIndex:0,fixtures:[],results:[],knockoutPlan:plan,knockoutDates:[[iso(year,12,20)]],championId:null,runnerUpId:null,eliminated:[],metadata:{libertadoresChampion:lib.championId,europeChampion:euro}};
      comp.fixtures=makeTieFixtures(comp,comp.teams,0);next.competitions[key]=comp;changed=true;
    }
  }
  return next;
}
function dynamicGroupsFromPool(pool,brIds,seed){
  const foreigners=pool.flatMap(list=>list).filter(item=>typeof item==='object'&&!String(item.id).match(/^\d+$/));
  const teams=[...foreigners,...brIds].slice(0,32),sorted=teams.slice().sort((a,b)=>hashString(clubId(a)+'|'+seed)-hashString(clubId(b)+'|'+seed));
  const groups={A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[]},keys=Object.keys(groups);
  sorted.forEach((item,i)=>groups[keys[i%8]].push(item));return groups;
}
function qualifiersFromPrevious(career,count,start=0){
  const snapshot=career.seasonReview?.finalTable||career.lastSeasonTable||[];
  return snapshot.slice(start,start+count).map(row=>row.clubId);
}
export function createWorldState(career,serieAClubs,season=career.season){
  const stateConfig=stateConfigForClub(career.userClubId),competitions={};
  if(stateConfig){const c=stateCompetition(stateConfig,season,serieAClubs);competitions[c.key]=c;}
  for(const config of Object.values(REGIONAL_GROUPS_2026)){
    if((config.userClubs||[]).includes(String(career.userClubId))){const regional=regionalCompetition(config,season);competitions[regional.key]=regional;}
  }
  const supercopa=supercopaCompetition(season,career);if(supercopa)competitions[supercopa.key]=supercopa;
  const cdb=copaDoBrasil(season,serieAClubs);competitions[cdb.key]=cdb;
  const libGroups=season===2026?LIBERTADORES_GROUPS_2026:dynamicGroupsFromPool(Object.values(LIBERTADORES_GROUPS_2026),qualifiersFromPrevious(career,6,0),'lib|'+season);
  const sudGroups=season===2026?SUDAMERICANA_GROUPS_2026:dynamicGroupsFromPool(Object.values(SUDAMERICANA_GROUPS_2026),qualifiersFromPrevious(career,7,6),'sud|'+season);
  const lib=groupCompetition({id:'libertadores',name:'CONMEBOL Libertadores',season,groups:libGroups,type:'continental',knockoutPlan:[{name:'Oitavas de final',legs:2},{name:'Quartas de final',legs:2},{name:'Semifinal',legs:2},{name:'Final',legs:1}],knockoutDates:[
    [iso(season,8,12),iso(season,8,19)],[iso(season,9,9),iso(season,9,16)],[iso(season,10,15),iso(season,10,22)],[iso(season,11,28)]
  ]});competitions[lib.key]=lib;
  const sud=groupCompetition({id:'sudamericana',name:'CONMEBOL Sudamericana',season,groups:sudGroups,type:'continental',knockoutPlan:[],knockoutDates:[]});competitions[sud.key]=sud;
  const ucl=uclCompetition(season);competitions[ucl.key]=ucl;
  const base={version:1,season,competitions,ratings:{},history:[],lastUserMatch:null,europeChampions:{2026:UCL_2025_26_CHAMPION},clubRegistry:registrySnapshot(serieAClubs)};
  return ensureCompetitionProgress(base);
}
export function sanitizeWorldState(raw,career,serieAClubs){
  if(!raw||typeof raw!=='object'||!raw.competitions)return createWorldState(career,serieAClubs,career.season);
  return ensureCompetitionProgress({...raw,version:1,ratings:raw.ratings||{},history:Array.isArray(raw.history)?raw.history:[],europeChampions:{2026:UCL_2025_26_CHAMPION,...(raw.europeChampions||{})},clubRegistry:{...registrySnapshot(serieAClubs),...(raw.clubRegistry||{})}});
}
function rosterPower(club){
  if(!club?.players?.length)return 65;
  const values=club.players.map(p=>playerGameStats(p).overall).sort((a,b)=>b-a).slice(0,14);
  return values.reduce((a,b)=>a+b,0)/Math.max(1,values.length)+5;
}
function powerFor(world,serieAClubs,id,career){
  const real=serieAClubs.find(c=>String(c.id)===String(id)),base=real?rosterPower(real):(world.clubRegistry?.[id]?.power??worldClubById(id)?.power??68),rating=Number(world.ratings?.[id]||0);
  let morale=0;if(String(id)===String(career.userClubId))morale=((career.managerConfidence?.fans??70)-70)/18;
  return clamp(50,101,base+rating+morale);
}
function poisson(lambda,seed){
  const L=Math.exp(-lambda);let p=1,k=0;while(p>L&&k<8){k++;p*=Math.max(.001,roll(seed+'|'+k));}return Math.max(0,k-1);
}
function worldAiPlan(power,opponentPower){
  const edge=Number(power||0)-Number(opponentPower||0);
  if(edge>=7)return{id:'vertical',label:'Vertical',attackBoost:.10,defenseBoost:-.02,possession:-1,tempo:1.13,fatigueMultiplier:1.12,injuryMultiplier:1.06};
  if(edge<=-7)return{id:'compact',label:'Compacto',attackBoost:-.05,defenseBoost:.10,possession:-2,tempo:.91,fatigueMultiplier:.90,injuryMultiplier:.94};
  return{id:'balanced',label:'Equilibrado',attackBoost:0,defenseBoost:0,possession:0,tempo:1,fatigueMultiplier:1,injuryMultiplier:1};
}
function averageLineupCondition(career,club,lineup){
  if(!club||!(lineup||[]).length)return 88;
  return(lineup||[]).reduce((sum,id)=>sum+playerCondition(career,club.id,id),0)/Math.max(1,lineup.length);
}
function simulateScore(world,career,serieAClubs,game){
  const hp=powerFor(world,serieAClubs,game.homeId,career),ap=powerFor(world,serieAClubs,game.awayId,career),homeUser=String(game.homeId)===String(career.userClubId),awayUser=String(game.awayId)===String(career.userClubId),homeClub=serieAClubs.find(c=>String(c.id)===String(game.homeId)),awayClub=serieAClubs.find(c=>String(c.id)===String(game.awayId)),round=Math.max(1,(career.round||0)+1);
  const homeLineup=homeClub?(homeUser?sanitizeLineup(homeClub,career,round,career.lineup):autoLineup(homeClub,career,round)):[],awayLineup=awayClub?(awayUser?sanitizeLineup(awayClub,career,round,career.lineup):autoLineup(awayClub,career,round)):[];
  const homeCondition=averageLineupCondition(career,homeClub,homeLineup),awayCondition=averageLineupCondition(career,awayClub,awayLineup),managerEdge=managerMatchModifier(career),homeManager=homeUser?managerEdge:0,awayManager=awayUser?managerEdge:0;
  const homeCpu=worldAiPlan(hp,ap),awayCpu=worldAiPlan(ap,hp),homeTactic=homeUser?tacticalMatchup(career,awayCpu,{isHome:!game.neutral}):homeCpu,awayTactic=awayUser?tacticalMatchup(career,homeCpu,{isHome:false}):awayCpu,weather=matchWeather(game.id),homeSet=homeUser?setPieceAttackModifier(career):0,awaySet=awayUser?setPieceAttackModifier(career):0;
  const homeForm=Number(world.ratings?.[String(game.homeId)]||0)/2.5,awayForm=Number(world.ratings?.[String(game.awayId)]||0)/2.5,userMorale=clamp(20,100,Number(career.dressingRoom?.morale??78)),importance=/Final/i.test(String(game.stage||''))?1.28:/Semi/i.test(String(game.stage||''))?1.15:1;
  const homeTacticalScore=tacticalExecutionScore(homeTactic),awayTacticalScore=tacticalExecutionScore(awayTactic),homeContext=contextScore(weather,{importance}),awayContext=contextScore(weather,{importance});
  const homeStrength=teamStrength({quality:clamp(35,100,hp),form:formScore(homeForm),morale:homeUser?userMorale:76, tactics:homeTacticalScore,condition:homeCondition,coach:clamp(45,90,68+homeManager*180),home:game.neutral?50:100,context:homeContext});
  const awayStrength=teamStrength({quality:clamp(35,100,ap),form:formScore(awayForm),morale:awayUser?userMorale:76,tactics:awayTacticalScore,condition:awayCondition,coach:clamp(45,90,68+awayManager*180),home:game.neutral?50:45,context:awayContext});
  const dominance=logisticDominance(homeStrength,awayStrength),homeXg=expectedGoals({dominance,base:game.neutral?1.10:1.18,attackVsDefense:(hp-ap)*.5,tacticalEdge:(homeTactic.attackBoost||0)-(awayTactic.defenseBoost||0),setPiece:homeSet,weatherPassing:weather.passing,tempoEdge:(homeTactic.tempo||1)-(awayTactic.tempo||1),min:.18,max:3.9}),awayXg=expectedGoals({dominance:1-dominance,base:1.07,attackVsDefense:(ap-hp)*.5,tacticalEdge:(awayTactic.attackBoost||0)-(homeTactic.defenseBoost||0),setPiece:awaySet,weatherPassing:weather.passing,tempoEdge:(awayTactic.tempo||1)-(homeTactic.tempo||1),min:.18,max:3.7});
  const earlyShare=.72;
  let hg=poisson(homeXg*earlyShare,game.id+'|h-early'),ag=poisson(awayXg*earlyShare,game.id+'|a-early');
  const homeAdaptive=homeUser?{id:String(career.tacticalState?.preset||'balanced'),aggression:0,reason:'decisão do usuário'}:adaptiveAiDecision({scoreDiff:hg-ag,minute:65,condition:homeCondition,basePlan:homeCpu.id});
  const awayAdaptive=awayUser?{id:String(career.tacticalState?.preset||'balanced'),aggression:0,reason:'decisão do usuário'}:adaptiveAiDecision({scoreDiff:ag-hg,minute:65,condition:awayCondition,basePlan:awayCpu.id});
  const homeAgg=Number(homeAdaptive.aggression||0),awayAgg=Number(awayAdaptive.aggression||0);
  const homeLateMultiplier=clamp(.68,1.58,1+Math.max(0,homeAgg)*.28-Math.max(0,-homeAgg)*.08+Math.max(0,awayAgg)*.14-Math.max(0,-awayAgg)*.14);
  const awayLateMultiplier=clamp(.68,1.58,1+Math.max(0,awayAgg)*.28-Math.max(0,-awayAgg)*.08+Math.max(0,homeAgg)*.14-Math.max(0,-homeAgg)*.14);
  const adjustedHomeXg=homeXg*earlyShare+homeXg*(1-earlyShare)*homeLateMultiplier,adjustedAwayXg=awayXg*earlyShare+awayXg*(1-earlyShare)*awayLateMultiplier;
  hg=clamp(0,8,hg+poisson(homeXg*(1-earlyShare)*homeLateMultiplier,game.id+'|h-late'));ag=clamp(0,8,ag+poisson(awayXg*(1-earlyShare)*awayLateMultiplier,game.id+'|a-late'));
  const events=[],userClub=homeUser?homeClub:awayUser?awayClub:null,userLineup=homeUser?homeLineup:awayLineup,userTactic=homeUser?homeTactic:awayUser?awayTactic:null;
  if(userClub&&userLineup.length){
    const pitchMultiplier=/pesado/i.test(String(weather.pitch||''))?1.12:/irregular/i.test(String(weather.pitch||''))?1.08:1,medical=Number(career.facilities?.medical||1),intensity=Number(userTactic?.fatigueMultiplier)||1,risks=[];
    for(const playerId of userLineup){
      const player=userClub.players.find(p=>String(p.id)===String(playerId));if(!player)continue;
      const condition=playerCondition(career,userClub.id,player.id),stats=playerGameStats(player),age=Number(player._careerAge??player.age??27),load=fatigueLoad({minutes:90,intensity,roleLoad:roleLoad(positionGroup(player.position)),fitnessPenalty:fitnessPenalty({stamina:stats.stamina,condition,age})}),risk=individualInjuryRisk({baseRisk:.0085,fatigue:load,intensity,condition,age,weatherMultiplier:weather.injury,pitchMultiplier,trainingMultiplier:Number(userTactic?.injuryMultiplier)||1,medicalLevel:medical});
      risks.push({player,risk,load,condition});
    }
    if(risks.length&&roll(game.id+'|injury')<combinedInjuryChance(risks.map(item=>item.risk))){
      const total=risks.reduce((sum,item)=>sum+item.risk,0);let cursor=roll(game.id+'|injury-player')*total,chosen=risks[0];for(const item of risks){cursor-=item.risk;if(cursor<=0){chosen=item;break;}}
      const {player,load,condition}=chosen,severityRoll=roll(game.id+'|injury-severity')+Math.max(0,Number(player._careerAge??player.age??27)-31)*.008+Math.max(0,74-condition)*.004+Math.max(0,load-92)*.0012-medical*.025,severity=severityRoll<.55?1:severityRoll<.82?2:severityRoll<.95?3:4,duration=severity===1?1:severity===2?2:severity===3?3:5+Math.floor(roll(game.id+'|injury-duration')*3),label=severity===1?'Pancada / desconforto':severity===2?'Lesão muscular leve':severity===3?'Entorse moderada':'Lesão muscular importante';
      events.push({id:'world-injury-'+game.id+'-'+player.id,type:'injury',side:homeUser?'home':'away',clubId:String(userClub.id),playerId:String(player.id),player:player.name,minute:25+Math.floor(roll(game.id+'|injury-minute')*55),second:1500+Math.floor(roll(game.id+'|injury-second')*3300),severityMatches:duration,injurySeverity:severity,injuryLabel:label,injuryRisk:Number(chosen.risk.toFixed(4)),fatigueLoad:Number(load.toFixed(1))});
    }
  }
  return{homeGoals:hg,awayGoals:ag,homePower:Number(hp.toFixed(1)),awayPower:Number(ap.toFixed(1)),homeLineup,awayLineup,substitutions:[],events,xg:[Number(adjustedHomeXg.toFixed(2)),Number(adjustedAwayXg.toFixed(2))],environment:{weather},intelligence:{engineVersion:LDF_ENGINE_VERSION,homeStrength:Number(homeStrength.toFixed(2)),awayStrength:Number(awayStrength.toFixed(2)),homeDominance:Number(dominance.toFixed(4)),awayDominance:Number((1-dominance).toFixed(4)),homeCondition:Math.round(homeCondition),awayCondition:Math.round(awayCondition),homePlan:homeTactic.label||homeCpu.label,awayPlan:awayTactic.label||awayCpu.label,homeAdaptivePlan:homeAdaptive.id,awayAdaptivePlan:awayAdaptive.id,homeAdaptiveReason:homeAdaptive.reason,awayAdaptiveReason:awayAdaptive.reason,homeIntensity:Number(homeTactic.fatigueMultiplier)||1,awayIntensity:Number(awayTactic.fatigueMultiplier)||1,weather:weather.label}};
}
function updateRatings(world,result){
  const hp=Number(world.ratings?.[result.homeId]||0),ap=Number(world.ratings?.[result.awayId]||0),expected=1/(1+Math.pow(10,(ap-hp)/14)),actual=result.homeGoals>result.awayGoals?1:result.homeGoals===result.awayGoals?.5:0,k=1.5,delta=k*(actual-expected);
  return{...world,ratings:{...world.ratings,[result.homeId]:clamp(-8,8,hp+delta),[result.awayId]:clamp(-8,8,ap-delta)}};
}
function commitFixtureResult(world,compKey,fixtureId,result){
  let comp=world.competitions[compKey],game=comp?.fixtures.find(item=>item.id===fixtureId);if(!comp||!game||game.played)return world;
  const official={...result,id:'wr-'+game.id,fixtureId:game.id,competitionId:comp.id,competitionName:comp.name,stage:game.stage,date:game.date,homeId:game.homeId,awayId:game.awayId,durationSecond:90*60};
  comp={...comp,fixtures:comp.fixtures.map(item=>item.id===game.id?{...item,played:true}:item),results:[...comp.results,official]};
  let next={...world,competitions:{...world.competitions,[compKey]:comp},history:[official,...(world.history||[])].slice(0,180)};
  next=updateRatings(next,official);return ensureCompetitionProgress(next);
}
function playFixture(world,career,serieAClubs,compKey,fixtureId){
  const comp=world.competitions[compKey],game=comp?.fixtures.find(item=>item.id===fixtureId);if(!comp||!game||game.played)return world;
  const score=simulateScore(world,career,serieAClubs,game),result={fixtureId:game.id,competitionId:comp.id,competitionName:comp.name,stage:game.stage,date:game.date,homeId:game.homeId,awayId:game.awayId,homeGoals:score.homeGoals,awayGoals:score.awayGoals,homePower:score.homePower,awayPower:score.awayPower};
  return commitFixtureResult(world,compKey,fixtureId,result);
}
export function syncWorldToDate(career,serieAClubs,date){
  let world=sanitizeWorldState(career.world,career,serieAClubs),guard=0,notes=[...(career.universeNotes||[])];
  while(guard++<1500){
    const due=Object.entries(world.competitions).flatMap(([key,comp])=>comp.fixtures.filter(game=>!game.played&&dateValue(game.date)<=dateValue(date)&&game.homeId!==String(career.userClubId)&&game.awayId!==String(career.userClubId)).map(game=>({key,game}))).sort((a,b)=>dateValue(a.game.date)-dateValue(b.game.date))[0];
    if(!due)break;
    const before=world.competitions[due.key],previousChampion=before?.championId||null;
    world=playFixture(world,career,serieAClubs,due.key,due.game.id);
    const after=world.competitions[due.key],championId=after?.championId||null,result=after?.results?.find(item=>String(item.fixtureId)===String(due.game.id));
    if(result){
      const home=world.clubRegistry?.[result.homeId]||worldClubById(result.homeId),away=world.clubRegistry?.[result.awayId]||worldClubById(result.awayId),homeWon=result.homeGoals>result.awayGoals,awayWon=result.awayGoals>result.homeGoals,powerGap=Math.abs(Number(result.homePower||0)-Number(result.awayPower||0)),underdogWon=(homeWon&&Number(result.homePower)<Number(result.awayPower))||(awayWon&&Number(result.awayPower)<Number(result.homePower));
      if(underdogWon&&powerGap>=10){
        const winner=homeWon?home:away,loser=homeWon?away:home,id='universe-upset-'+result.id;
        if(!notes.some(item=>item.id===id))notes=[{id,season:after.edition,type:'universe',importance:3,title:(winner?.name||'Um azarão')+' surpreende em '+after.name,text:(winner?.name||'O vencedor')+' superou '+(loser?.name||'um favorito')+' por '+result.homeGoals+' a '+result.awayGoals+' e alterou o rumo da competição.',competition:after.name,clubId:homeWon?result.homeId:result.awayId,date:due.game.date},...notes].slice(0,70);
      }
      if(/Semifinal/i.test(due.game.stage)){
        const winner=homeWon?home:awayWon?away:null,id='universe-semi-'+result.id;
        if(winner&&!notes.some(item=>item.id===id))notes=[{id,season:after.edition,type:'universe',importance:3,title:(winner.name||'Um clube')+' chega à decisão',text:'A semifinal de '+after.name+' terminou '+result.homeGoals+' a '+result.awayGoals+'. O universo do save já conhece mais um finalista.',competition:after.name,clubId:homeWon?result.homeId:result.awayId,date:due.game.date},...notes].slice(0,70);
      }
    }
    if(championId&&!previousChampion){
      const champion=world.clubRegistry?.[championId]||worldClubById(championId),id='universe-title-'+after.key;
      if(!notes.some(item=>item.id===id))notes=[{id,season:after.edition,type:'world',importance:5,title:(champion?.name||'Um clube')+' conquista '+after.name,text:'A competição foi encerrada no universo do save.',competition:after.name,clubId:championId,date:due.game.date},...notes].slice(0,70);
    }
  }
  return{...career,world,universeNotes:notes};
}
function activeUserFixture(world,userClubId){
  return Object.entries(world.competitions).flatMap(([key,comp])=>comp.fixtures.filter(game=>!game.played&&(game.homeId===String(userClubId)||game.awayId===String(userClubId))).map(game=>({key,comp,game}))).sort((a,b)=>dateValue(a.game.date)-dateValue(b.game.date))[0]||null;
}
export function nextCareerEvent(career,serieAClubs){
  const world=sanitizeWorldState(career.world,career,serieAClubs),worldEvent=activeUserFixture(world,career.userClubId),brRound=career.round<38?career.round+1:null,brDate=brRound?brasileiraoDateForRound(brRound,career.season):null;
  if(worldEvent&&(!brDate||dateValue(worldEvent.game.date)<dateValue(brDate)))return{type:'world',date:worldEvent.game.date,competitionKey:worldEvent.key,competitionId:worldEvent.comp.id,competitionName:worldEvent.comp.name,stage:worldEvent.game.stage,fixture:worldEvent.game};
  if(brDate){const game=career.schedule?.[brRound-1]?.find(item=>item.homeId===career.userClubId||item.awayId===career.userClubId)||null;return{type:'brasileirao',date:brDate,competitionName:'Brasileirão Série A',stage:'Rodada '+brRound,roundNumber:brRound,fixture:game};}
  return worldEvent?{type:'world',date:worldEvent.game.date,competitionKey:worldEvent.key,competitionId:worldEvent.comp.id,competitionName:worldEvent.comp.name,stage:worldEvent.game.stage,fixture:worldEvent.game}:null;
}
function competitionImportance(id){return id==='mundial'?1.5:id==='libertadores'?1.35:id==='copa-do-brasil'?1.15:id==='supercopa'?1.05:id==='sudamericana'?1.05:id==='champions-league'?1.2:(id==='copa-nordeste'||id==='copa-verde'||id==='copa-sul-sudeste')?0.9:0.75;}
function trophyFor(comp){
  const id=comp.id==='copa-do-brasil'?'copa':comp.id;
  const kind=comp.type==='state'?'Estadual':comp.type==='continental'?'Continental':comp.type==='world'?'Mundial':comp.type==='regional'?'Regional':'Nacional';
  const shape=comp.id==='libertadores'?'libertadores':comp.id==='sudamericana'?'sulamericana':comp.id==='mundial'?'world':comp.id==='copa-do-brasil'?'cup':comp.id==='champions-league'?'champions':comp.id==='supercopa'?'supercup':comp.type==='state'?'state':comp.type==='regional'?'regional':'league';
  return{id,name:comp.name,kind,shape,season:comp.edition,earnedAtRound:null};
}
function applyWorldMatchFatigue(career,userClub,result){
  if(!userClub||!result)return career;
  const side=String(result.homeId)===String(userClub.id)?'home':'away',lineup=(side==='home'?result.homeLineup:result.awayLineup)||[],conditions={...(career.conditions||{})},intensity=Number(side==='home'?result.intelligence?.homeIntensity:result.intelligence?.awayIntensity)||1;
  for(const player of userClub.players||[]){
    const key=statusKey(userClub.id,player.id),base=Number.isFinite(conditions[key])?conditions[key]:100;conditions[key]=clamp(40,100,base+5);
  }
  for(const id of lineup){
    const player=userClub.players.find(item=>String(item.id)===String(id));if(!player)continue;
    const key=statusKey(userClub.id,id),condition=conditions[key]??100,stats=playerGameStats(player),age=Number(player._careerAge??player.age??27),load=fatigueLoad({minutes:90,intensity,roleLoad:roleLoad(positionGroup(player.position)),fitnessPenalty:fitnessPenalty({stamina:stats.stamina,condition,age})});
    conditions[key]=clamp(35,100,condition-fatigueConditionLoss(load));
  }
  for(const injury of(result.events||[]).filter(event=>String(event.clubId)===String(userClub.id)&&event.type==='injury')){
    const key=statusKey(userClub.id,injury.playerId);conditions[key]=clamp(35,100,(conditions[key]??100)-10);
  }
  return{...career,conditions};
}
function applyUserWorldOutcome(next,before,game,comp,result,serieAClubs){
  const home=result.homeId===String(next.userClubId),gf=home?result.homeGoals:result.awayGoals,ga=home?result.awayGoals:result.homeGoals,won=gf>ga,draw=gf===ga,importance=competitionImportance(comp.id);
  next={...next,world:{...next.world,lastUserMatch:result}};
  next=applyConfidenceEvent(next,{fans:(won?2.8:draw?.2:-3.4)*importance,board:(won?.9:draw?.1:-1.1)*importance,kind:'competition',reason:comp.name+' · '+game.stage+': '+(won?'vitória':draw?'empate':'derrota')+' por '+gf+' a '+ga+'.'});
  const userClub=serieAClubs.find(c=>String(c.id)===String(next.userClubId));if(userClub){
    next=applyWorldMatchFatigue(next,userClub,result);
    for(const injury of(result.events||[]).filter(e=>e.type==='injury'&&String(e.clubId)===String(next.userClubId))){
      const key=statusKey(next.userClubId,injury.playerId),status={...(next.playerStatus||{})},current={yellowCount:0,injuryThroughRound:0,suspensionThroughRound:0,...(status[key]||{})};current.injuryThroughRound=Math.max(current.injuryThroughRound||0,(next.round||0)+(injury.severityMatches||1));current.injuryLabel=injury.injuryLabel||'Lesão';status[key]=current;next={...next,playerStatus:status};
    }
    next=applyMatchDynamics(next,userClub,serieAClubs,result,{competition:comp.name,stage:game.stage});
    next=processPlayerPromises(next,userClub,result);
    next=applyWeeklyTraining(next,userClub);
    next=refreshJobOffers(next,serieAClubs);
    next=emitCareerEvent(next,{type:'MATCH_FINISHED',importance:competitionImportance(comp.id)>=1.2?4:3,payload:{competition:comp.name,stage:game.stage,homeId:result.homeId,awayId:result.awayId,homeGoals:result.homeGoals,awayGoals:result.awayGoals,xg:result.xg||null}});
    for(const injury of(result.events||[]).filter(event=>event.type==='injury'&&String(event.clubId)===String(next.userClubId)))next=emitCareerEvent(next,{type:'PLAYER_INJURED',playerId:injury.playerId,importance:Number(injury.injurySeverity||1)>=4?4:2,payload:{name:injury.player,label:injury.injuryLabel,duration:injury.severityMatches,severity:injury.injurySeverity||1}});
  }
  next=advanceWorldManagers(next,serieAClubs);
  const trophy=trophyFor(comp),userNowChampion=comp.championId===String(next.userClubId),already=(next.trophies||[]).some(t=>t.id===trophy.id&&Number(t.season)===Number(comp.edition));
  if(userNowChampion&&!already){
    next={...next,trophies:[...(next.trophies||[]),trophy],pendingCelebration:{id:'celebration-'+comp.key,type:'trophy',trophy},messages:[{id:'title-'+comp.key,type:'title',title:'Campeão: '+comp.name,text:'Seu trabalho terminou com taça. '+comp.name+' foi adicionada à galeria.'},...(next.messages||[])]};
    next=applyConfidenceEvent(next,{fans:10*importance,board:8*importance,kind:'title',reason:'Título conquistado: '+comp.name+'.'});
    next=applyTitleDynamics(next,trophy);
  }else{
    const wasAlive=before.teams.includes(String(next.userClubId))&&!before.eliminated.includes(String(next.userClubId))&&!before.championId,nowOut=comp.eliminated.includes(String(next.userClubId));
    if(wasAlive&&nowOut)next=applyConfidenceEvent(next,{fans:-2.4*importance,board:-1.4*importance,kind:'elimination',reason:'Eliminação na '+comp.name+' ('+game.stage+').'});
  }
  if(next.round>=38&&next.seasonReview&&!pendingSeasonFixtures(next,serieAClubs).length){
    const confidence=next.managerConfidence||{};
    next={...next,seasonReview:{...next.seasonReview,pending:true,waiting:false,titles:(next.trophies||[]).filter(item=>Number(item.season)===Number(next.season)),fanConfidence:confidence.fans??next.seasonReview.fanConfidence,boardConfidence:confidence.board??next.seasonReview.boardConfidence,cash:next.cash}};
  }
  return next;
}
export function previewNextWorldFixture(career,serieAClubs){
  const initialWorld=sanitizeWorldState(career.world,career,serieAClubs),initialEvent=activeUserFixture(initialWorld,career.userClubId);
  if(!initialEvent)return null;
  const synced=syncWorldToDate({...career,world:initialWorld},serieAClubs,initialEvent.game.date),world=synced.world,event=activeUserFixture(world,career.userClubId);
  if(!event)return null;
  const score=simulateScore(world,career,serieAClubs,event.game);
  return{
    event:{type:'world',date:event.game.date,competitionKey:event.key,competitionId:event.comp.id,competitionName:event.comp.name,stage:event.game.stage,fixture:event.game},
    result:{id:'preview-'+event.game.id,fixtureId:event.game.id,competitionId:event.comp.id,competitionName:event.comp.name,stage:event.game.stage,date:event.game.date,homeId:event.game.homeId,awayId:event.game.awayId,durationSecond:90*60,...score},
  };
}
export function startWorldFixture(career,serieAClubs,mode='normal'){
  if(career.pendingWorldMatch)return career;
  const calendarEvent=nextCareerEvent(career,serieAClubs);
  if(!calendarEvent||calendarEvent.type!=='world')return career;
  const preview=previewNextWorldFixture(career,serieAClubs);
  if(!preview)return career;
  const selected=['normal','fast','instant'].includes(mode)?mode:'normal';
  return{...career,preferredSimulationMode:selected,pendingWorldMatch:{id:'world-'+preview.result.fixtureId,fixtureId:preview.result.fixtureId,competitionKey:preview.event.competitionKey,competitionId:preview.event.competitionId,competitionName:preview.event.competitionName,stage:preview.event.stage,date:preview.event.date,mode:selected,result:preview.result}};
}
export function changePendingWorldTactic(career,presetId,second=0){
  if(!career.pendingWorldMatch)return setTacticalPreset(career,presetId);
  const oldTactic=sanitizeTacticalState(career.tacticalState),base=setTacticalPreset(career,presetId),newTactic=sanitizeTacticalState(base.tacticalState),pending=career.pendingWorldMatch,result={...(pending.result||{})},userHome=String(result.homeId)===String(career.userClubId),aggression=((newTactic.mentality-oldTactic.mentality)+(newTactic.risk-oldTactic.risk)+(newTactic.pressing-oldTactic.pressing))/300,progress=clamp(0,1,Number(second||0)/(90*60)),seed=pending.fixtureId+'|tactic|'+Math.floor(second)+'|'+presetId;
  let homeGoals=Number(result.homeGoals||0),awayGoals=Number(result.awayGoals||0);
  if(progress<.96){
    if(aggression>.05){
      const push=clamp(.03,.28,.07+aggression*.42)*(1-progress*.45),counter=clamp(.02,.24,.04+aggression*.34)*(1-progress*.35);
      if(roll(seed+'|push')<push){if(userHome)homeGoals++;else awayGoals++;}
      if(roll(seed+'|counter')<counter){if(userHome)awayGoals++;else homeGoals++;}
    }else if(aggression<-.05){
      const block=clamp(.02,.22,.06+Math.abs(aggression)*.32)*(1-progress*.25);
      if(roll(seed+'|block')<block){if(userHome&&awayGoals>0)awayGoals--;else if(!userHome&&homeGoals>0)homeGoals--;}
    }
  }
  const updated={...result,homeGoals:clamp(0,8,homeGoals),awayGoals:clamp(0,8,awayGoals),tacticalChanges:[...(result.tacticalChanges||[]),{second:Math.max(0,Number(second)||0),preset:presetId,aggression:Number(aggression.toFixed(3))}]};
  let next={...base,pendingWorldMatch:{...pending,result:updated}};
  return emitCareerEvent(next,{type:'TACTIC_CHANGED',importance:2,payload:{competition:pending.competitionName,preset:presetId,second:Math.floor(second),aggression:Number(aggression.toFixed(2))}});
}

export function finishPendingWorldFixture(career,serieAClubs){
  if(!career.pendingWorldMatch)return career;
  const pending=career.pendingWorldMatch,base={...career,pendingWorldMatch:null};
  let next=syncWorldToDate(base,serieAClubs,pending.date),world=next.world;
  const before=world.competitions[pending.competitionKey],game=before?.fixtures.find(item=>String(item.id)===String(pending.fixtureId));
  if(!before||!game||game.played)return next;
  const detailed={...pending.result,id:'wr-'+game.id,fixtureId:game.id,competitionId:before.id,competitionName:before.name,stage:game.stage,date:game.date,homeId:game.homeId,awayId:game.awayId,durationSecond:90*60};
  const compact={homeGoals:Number(detailed.homeGoals)||0,awayGoals:Number(detailed.awayGoals)||0,homePower:detailed.homePower,awayPower:detailed.awayPower,xg:detailed.xg||null};
  world=commitFixtureResult(world,pending.competitionKey,pending.fixtureId,compact);
  const comp=world.competitions[pending.competitionKey],official=comp.results.find(item=>String(item.fixtureId)===String(pending.fixtureId));
  next={...next,world};
  return official?applyUserWorldOutcome(next,before,game,comp,detailed,serieAClubs):next;
}
export function playNextWorldFixture(career,serieAClubs){
  const cleanCareer=career.pendingWorldMatch?{...career,pendingWorldMatch:null}:career;
  const initialWorld=sanitizeWorldState(cleanCareer.world,cleanCareer,serieAClubs),initialEvent=activeUserFixture(initialWorld,cleanCareer.userClubId);
  if(!initialEvent)return{...cleanCareer,world:initialWorld};
  let next=syncWorldToDate({...cleanCareer,world:initialWorld},serieAClubs,initialEvent.game.date),world=next.world,event=activeUserFixture(world,next.userClubId);
  if(!event)return next;
  const before=event.comp,game=event.game;
  world=playFixture(world,next,serieAClubs,event.key,game.id);
  const comp=world.competitions[event.key],result=comp.results.find(item=>item.fixtureId===game.id);
  next={...next,world};
  return result?applyUserWorldOutcome(next,before,game,comp,result,serieAClubs):next;
}
export function unifiedUserMatchHistory(career){
  const userId=String(career.userClubId),league=(career.history||[]).map(item=>({
    ...item,
    id:'br-'+item.id,
    competitionId:'brasileirao',
    competition:item.competition||'Brasileirão Série A',
    stage:'Rodada '+item.roundNumber,
    date:item.date||brasileiraoDateForRound(item.roundNumber,item.season),
    season:item.season||career.season,
    source:'league',
  }));
  const world=(career.world?.history||[]).filter(item=>String(item.homeId)===userId||String(item.awayId)===userId).map(item=>{
    const home=String(item.homeId)===userId,gf=home?item.homeGoals:item.awayGoals,ga=home?item.awayGoals:item.homeGoals,points=gf>ga?3:gf===ga?1:0;
    return{
      id:'world-'+item.id,
      season:Number(String(item.date||career.season).slice(0,4))||career.season,
      roundNumber:null,
      competitionId:item.competitionId,
      competition:item.competitionName||item.competitionId||'Competição',
      stage:item.stage||'Partida',
      date:item.date||'',
      homeId:item.homeId,awayId:item.awayId,homeGoals:item.homeGoals,awayGoals:item.awayGoals,
      simulationMode:item.simulationMode||null,points,result:points===3?'Vitória':points===1?'Empate':'Derrota',source:'world',
    };
  });
  return[...league,...world].sort((a,b)=>{
    const ad=a.date||'',bd=b.date||'';if(ad!==bd)return bd.localeCompare(ad);
    return Number(b.season||0)-Number(a.season||0)||Number(b.roundNumber||0)-Number(a.roundNumber||0);
  });
}
export function worldCompetitionList(career,serieAClubs){
  const world=sanitizeWorldState(career.world,career,serieAClubs);
  return Object.values(world.competitions).sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
}
export function worldClub(career,serieAClubs,id){
  const real=serieAClubs.find(c=>String(c.id)===String(id));if(real)return resolveEntry(real.id,serieAClubs);
  const world=sanitizeWorldState(career.world,career,serieAClubs);return world.clubRegistry?.[id]||worldClubById(id)||{id,name:id,abbreviation:String(id).slice(0,3).toUpperCase(),country:'',power:65};
}
export function pendingSeasonFixtures(career,serieAClubs){
  const world=sanitizeWorldState(career.world,career,serieAClubs);
  return Object.values(world.competitions).flatMap(comp=>comp.fixtures.filter(game=>!game.played&&(game.homeId===String(career.userClubId)||game.awayId===String(career.userClubId))&&game.date.startsWith(String(career.season))).map(game=>({competition:comp,fixture:game}))).sort((a,b)=>dateValue(a.fixture.date)-dateValue(b.fixture.date));
}
export function rollWorldToNextSeason(career,serieAClubs,newSeason){
  let world=sanitizeWorldState(career.world,career,serieAClubs);
  // Finish all CPU fixtures through 31 December of the closing season while preserving any unresolved user fixture.
  const synced=syncWorldToDate({...career,world},serieAClubs,iso(career.season,12,31));world=synced.world;
  const fresh=createWorldState({...career,season:newSeason},serieAClubs,newSeason);
  const keep=Object.fromEntries(Object.entries(world.competitions).filter(([,comp])=>comp.id==='champions-league'&&!comp.championId));
  return{...fresh,competitions:{...keep,...fresh.competitions},ratings:{...world.ratings,...fresh.ratings},history:world.history,europeChampions:{...world.europeChampions,...fresh.europeChampions},clubRegistry:{...world.clubRegistry,...fresh.clubRegistry}};
}
