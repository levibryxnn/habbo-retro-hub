import { playerGameStats } from './player-engine.js';
import { applyConfidenceEvent } from './manager-confidence.js';
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
function simulateScore(world,career,serieAClubs,game){
  const hp=powerFor(world,serieAClubs,game.homeId,career),ap=powerFor(world,serieAClubs,game.awayId,career),edge=(hp-ap)/16,homeAdv=game.neutral?0:.18;
  const hg=poisson(clamp(.2,3.7,1.28+edge+homeAdv),game.id+'|h'),ag=poisson(clamp(.2,3.4,1.08-edge),game.id+'|a');
  return{homeGoals:hg,awayGoals:ag,homePower:Number(hp.toFixed(1)),awayPower:Number(ap.toFixed(1))};
}
function updateRatings(world,result){
  const hp=Number(world.ratings?.[result.homeId]||0),ap=Number(world.ratings?.[result.awayId]||0),expected=1/(1+Math.pow(10,(ap-hp)/14)),actual=result.homeGoals>result.awayGoals?1:result.homeGoals===result.awayGoals?.5:0,k=1.5,delta=k*(actual-expected);
  return{...world,ratings:{...world.ratings,[result.homeId]:clamp(-8,8,hp+delta),[result.awayId]:clamp(-8,8,ap-delta)}};
}
function playFixture(world,career,serieAClubs,compKey,fixtureId){
  let comp=world.competitions[compKey],game=comp?.fixtures.find(item=>item.id===fixtureId);if(!comp||!game||game.played)return world;
  const score=simulateScore(world,career,serieAClubs,game),result={id:'wr-'+game.id,fixtureId:game.id,competitionId:comp.id,competitionName:comp.name,stage:game.stage,date:game.date,homeId:game.homeId,awayId:game.awayId,homeGoals:score.homeGoals,awayGoals:score.awayGoals,homePower:score.homePower,awayPower:score.awayPower};
  comp={...comp,fixtures:comp.fixtures.map(item=>item.id===game.id?{...item,played:true}:item),results:[...comp.results,result]};
  let next={...world,competitions:{...world.competitions,[compKey]:comp},history:[result,...(world.history||[])].slice(0,180)};
  next=updateRatings(next,result);return ensureCompetitionProgress(next);
}
export function syncWorldToDate(career,serieAClubs,date){
  let world=sanitizeWorldState(career.world,career,serieAClubs),guard=0;
  while(guard++<1500){
    const due=Object.entries(world.competitions).flatMap(([key,comp])=>comp.fixtures.filter(game=>!game.played&&dateValue(game.date)<=dateValue(date)&&game.homeId!==String(career.userClubId)&&game.awayId!==String(career.userClubId)).map(game=>({key,game}))).sort((a,b)=>dateValue(a.game.date)-dateValue(b.game.date))[0];
    if(!due)break;world=playFixture(world,career,serieAClubs,due.key,due.game.id);
  }
  return{...career,world};
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
function trophyFor(comp){return{id:comp.id==='copa-do-brasil'?'copa':comp.id,name:comp.name,kind:comp.type==='state'?'Estadual':comp.type==='continental'?'Continental':comp.type==='world'?'Mundial':'Nacional',shape:comp.id==='libertadores'?'libertadores':comp.id==='sudamericana'?'sulamericana':comp.id==='mundial'?'world':comp.id==='copa-do-brasil'?'cup':'league',season:comp.edition,earnedAtRound:null};}
export function playNextWorldFixture(career,serieAClubs){
  const initialWorld=sanitizeWorldState(career.world,career,serieAClubs),initialEvent=activeUserFixture(initialWorld,career.userClubId);
  if(!initialEvent)return{...career,world:initialWorld};
  let next=syncWorldToDate({...career,world:initialWorld},serieAClubs,initialEvent.game.date),world=next.world,event=activeUserFixture(world,next.userClubId);
  if(!event)return next;
  const before=event.comp,game=event.game;
  world=playFixture(world,next,serieAClubs,event.key,game.id);
  const comp=world.competitions[event.key],result=comp.results.find(item=>item.fixtureId===game.id),home=result.homeId===String(next.userClubId),gf=home?result.homeGoals:result.awayGoals,ga=home?result.awayGoals:result.homeGoals,won=gf>ga,draw=gf===ga,importance=competitionImportance(comp.id);
  next={...next,world:{...world,lastUserMatch:result}};
  next=applyConfidenceEvent(next,{fans:(won?2.8:draw?.2:-3.4)*importance,board:(won?.9:draw?.1:-1.1)*importance,kind:'competition',reason:comp.name+' · '+game.stage+': '+(won?'vitória':draw?'empate':'derrota')+' por '+gf+' a '+ga+'.'});
  const userNowChampion=comp.championId===String(next.userClubId),already=(next.trophies||[]).some(t=>t.id===trophyFor(comp).id&&Number(t.season)===Number(comp.edition));
  if(userNowChampion&&!already){
    const trophy=trophyFor(comp);
    next={...next,trophies:[...(next.trophies||[]),trophy],pendingCelebration:{id:'celebration-'+comp.key,type:'trophy',trophy},messages:[{id:'title-'+comp.key,type:'title',title:'Campeão: '+comp.name,text:'Seu trabalho terminou com taça. '+comp.name+' foi adicionada à galeria.'},...(next.messages||[])]};
    next=applyConfidenceEvent(next,{fans:10*importance,board:8*importance,kind:'title',reason:'Título conquistado: '+comp.name+'.'});
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
