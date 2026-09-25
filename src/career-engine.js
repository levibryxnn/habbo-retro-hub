import { applyMatchdayIncome, applySponsorPayments, expireSeasonSponsors, initialCashForClub } from './finance-model.js';
import { worldRecordMessage } from './records-data.js';
import { getClubWorld, matchdayProjection } from './club-world.js';
import { applyTransferPayroll } from './transfer-engine.js';
import { positionGroup } from './position-labels.js';
import {
  autoLineup,
  currentBench,
  currentLineup,
  effectivePlayerRating,
  lineupProfile,
  lineupValidation,
  matchBench,
  playerCondition,
  playerGameStats,
  matchPlayerPerformances,
  sanitizeLineup,
  statusKey,
} from './player-engine.js';
import { applyConfidenceEvent, createManagerConfidence, reconcileStructuralBoardTrust, sanitizeManagerConfidence } from './manager-confidence.js';
import { advancePlayerLifecycle } from './development-engine.js';
import { brasileiraoDateForRound, createWorldState, finishPendingWorldFixture, nextCareerEvent, pendingSeasonFixtures, playNextWorldFixture, rollWorldToNextSeason, sanitizeWorldState, syncWorldToDate } from './competition-engine.js';
import { applyMatchDynamics, applySeasonDynamics, applyTitleDynamics, initializeCareerSystems, managerMatchModifier } from './career-dynamics.js';
import { applyWeeklyTraining, matchWeather, sanitizeTacticalState, setPieceAttackModifier, setTacticalPreset, tacticalMatchup, trainingMatchModifier, updateTacticalState } from './tactical-engine.js';
import { advanceWorldManagers, evaluateProjectObjectives, expirePlayerContracts, initializeCareerLife, processPlayerPromises, refreshJobOffers } from './career-life-engine.js';
import { dispatchCareerEvent, emitCareerEvent } from './event-engine.js';
import { LDF_ENGINE_VERSION, adaptiveAiDecision, combinedInjuryChance, contextScore, expectedGoals, fatigueConditionLoss, fatigueLoad, fitnessPenalty, formScore, individualInjuryRisk, injuryRecovery, logisticDominance, roleLoad, tacticalExecutionScore, teamStrength } from './ldf-engine.js';
import { challengeSeasonResult } from './challenge-engine.js';

export const CAREER_KEY='ldf.career.v2';
export const FULL_TIME_SECOND=90*60;
export const HALF_TIME_SECOND=45*60;
export const MAX_SUBSTITUTIONS=5;
export const MAX_SUB_WINDOWS=3;
export const SIMULATION_MODES={
  normal:{id:'normal',label:'Normal',tickMs:1000,realDurationSeconds:60,description:'60 segundos em tempo real.'},
  fast:{id:'fast',label:'Rápido',tickMs:1000,realDurationSeconds:30,description:'30 segundos em tempo real.'},
  instant:{id:'instant',label:'Instantânea',tickMs:0,realDurationSeconds:0,description:'Resultado imediato da rodada.'},
};

function hashString(value){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function rngFrom(value){
  let a=hashString(value)||1;
  return function(){
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
function deterministicRoll(value){return rngFrom(value)();}
function poisson(lambda,rng){
  const limit=Math.exp(-lambda);let p=1,k=0;
  do{k++;p*=rng();}while(p>limit&&k<9);
  return Math.max(0,k-1);
}
const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
function playerById(club,id){return club?.players?.find(p=>String(p.id)===String(id));}
function lineupPlayers(club,ids){return(ids||[]).map(id=>playerById(club,id)).filter(Boolean);}
function weightedPlayer(club,lineupIds,rng){
  const players=lineupPlayers(club,lineupIds).filter(p=>p.name);
  if(!players.length)return{id:'fallback-'+(club?.id||'club'),name:'Jogador do '+(club?.abbreviation||'clube'),position:'Midfielder'};
  const weights=players.map(function(player){
    const stats=playerGameStats(player);
    if(positionGroup(player.position)==='ATA')return 4.8+stats.shooting/30;
    if(positionGroup(player.position)==='MEI')return 2.5+stats.passing/45;
    if(positionGroup(player.position)==='DEF')return .65;
    return .04;
  });
  const total=weights.reduce((a,b)=>a+b,0);
  let roll=rng()*total;
  for(let i=0;i<players.length;i++){roll-=weights[i];if(roll<=0)return players[i];}
  return players[0];
}
function weightedAssist(club,lineupIds,scorer,rng){
  if(rng()<.18)return null;
  const players=lineupPlayers(club,lineupIds).filter(p=>p.name&&String(p.id)!==String(scorer?.id)&&positionGroup(p.position)!=='GOL');
  if(!players.length)return null;
  const weights=players.map(function(player){
    const stats=playerGameStats(player),group=positionGroup(player.position);
    const role=group==='MEI'?2.5:group==='ATA'?1.75:group==='DEF'?.72:.25;
    return role+stats.passing/35+stats.composure/65;
  });
  const total=weights.reduce((a,b)=>a+b,0);let roll=rng()*total;
  for(let i=0;i<players.length;i++){roll-=weights[i];if(roll<=0)return players[i];}
  return players[0];
}
function bestPenaltyTaker(club,lineupIds){
  return lineupPlayers(club,lineupIds).sort(function(a,b){
    const sa=playerGameStats(a),sb=playerGameStats(b);
    return(sb.penalties*0.68+sb.composure*0.32)-(sa.penalties*0.68+sa.composure*0.32);
  })[0]||null;
}
function assignedSetPiecePlayer(career,club,lineupIds,key){
  if(String(club?.id)!==String(career?.userClubId))return null;
  const id=career?.tacticalState?.setPieces?.[key];
  return id&&lineupPlayers(club,lineupIds).find(p=>String(p.id)===String(id))||null;
}
function setPiecePersonnelBonus(career,club,lineupIds){
  if(String(club?.id)!==String(career?.userClubId))return 0;
  const corner=assignedSetPiecePlayer(career,club,lineupIds,'cornerTakerId'),target=assignedSetPiecePlayer(career,club,lineupIds,'aerialTargetId');
  const cStats=corner?playerGameStats(corner):null,tStats=target?playerGameStats(target):null;
  const delivery=cStats?(cStats.passing*.62+cStats.composure*.38-65)/700:0,aerial=tStats?(tStats.physical*.55+tStats.composure*.25+tStats.defending*.20-65)/800:0;
  return clamp(-.025,.055,delivery+aerial);
}
function goalkeeperOnField(club,lineupIds){
  return lineupPlayers(club,lineupIds).find(p=>positionGroup(p.position)==='GOL')||lineupPlayers(club,lineupIds)[0]||null;
}
function makeEvent(side,type,second,club,player,index,extra){
  const minute=Math.max(1,Math.floor(second/60));
  let text;
  if(type==='goal')text='GOL! '+player.name+' marca para o '+club.name;
  else if(type==='yellow')text=player.name+' recebe cartão amarelo';
  else if(type==='red')text=player.name+' é expulso';
  else if(type==='injury')text=player.name+' sente uma lesão e pede atendimento';
  else if(type==='penalty')text='PÊNALTI para o '+club.name;
  else if(type==='penalty-miss')text=player.name+' desperdiça o pênalti';
  else if(type==='substitution')text=player.name+' entra em campo';
  else if(type==='corner')text='Escanteio para o '+club.name;
  else if(type==='foul')text=player.name+' comete falta';
  else if(type==='big-chance')text=player.name+' perde uma grande oportunidade';
  else text=player.name+' finaliza; a defesa responde';
  return{id:side+'-'+type+'-'+second+'-'+index,side,type,minute,second,playerId:String(player.id||player.name),player:player.name,clubId:club.id,text,...(extra||{})};
}
function makeGoalEvent(side,second,club,lineupIds,scorer,index,rng,extra){
  const details={...(extra||{})};
  if(!details.fromPenalty){
    const assist=weightedAssist(club,lineupIds,scorer,rng);
    if(assist){details.assistPlayerId=String(assist.id);details.assist=assist.name;}
  }
  return makeEvent(side,'goal',second,club,scorer,index,details);
}
function uniqueEventSecond(rng,used,durationSecond,minSecond=180){
  let second=minSecond+Math.floor(rng()*Math.max(1,durationSecond-minSecond-90));
  let guard=0;
  while(used.has(second)&&guard<40){second=minSecond+Math.floor(rng()*Math.max(1,durationSecond-minSecond-90));guard++;}
  used.add(second);return second;
}
function recalcScore(result){
  const goals=(result.events||[]).filter(e=>e.type==='goal');
  return{
    ...result,
    homeGoals:goals.filter(e=>e.side==='home').length,
    awayGoals:goals.filter(e=>e.side==='away').length,
    events:(result.events||[]).slice().sort((a,b)=>a.second-b.second||String(a.id).localeCompare(String(b.id))),
  };
}
function penaltyProbability(taker,keeper){
  const ts=playerGameStats(taker),ks=playerGameStats(keeper);
  return clamp(.43,.93,.67+(ts.penalties-70)*.007+(ts.composure-70)*.004-(ks.goalkeeping-72)*.005);
}
function penaltyOutcomeFromRoll(probability,roll){
  if(roll<probability)return'goal';
  const miss=(roll-probability)/Math.max(.001,1-probability);
  if(miss<.48)return'saved';
  if(miss<.72)return'post';
  if(miss<.88)return'wide';
  return'over';
}
function resolvePenaltyOnResult(result,event,taker,keeper,seed){
  const probability=penaltyProbability(taker,keeper);
  const roll=deterministicRoll(seed);
  const outcome=penaltyOutcomeFromRoll(probability,roll);
  const scored=outcome==='goal';
  const narrative=scored
    ?['ajeita a bola com cuidado','olha para o goleiro e respira fundo','toma distância','bate firme... GOL!']
    : outcome==='saved'
      ?['ajeita a bola no ponto da cal','encara o goleiro','parte para a cobrança','bate... DEFENDE O GOLEIRO!']
      : outcome==='post'
        ?['posiciona a bola','respira fundo','corre para a cobrança','bate colocado... NA TRAVE!']
        : outcome==='wide'
          ?['ajeita a bola','olha com confiança para a torcida','toma distância','bate... PARA FORA!']
          :['coloca a bola no ponto da cal','parte com força','toma distância','bate... ISOLA A BOLA!'];
  const events=result.events.map(function(item){
    if(item.id!==event.id)return item;
    return{...item,resolved:true,takerId:String(taker.id),taker:taker.name,keeperId:String(keeper?.id||''),keeper:keeper?.name||'Goleiro',outcome,scored,narrative,probability:Number(probability.toFixed(3))};
  });
  if(scored){
    events.push(makeEvent(event.side,'goal',event.second+2,event.side==='home'?result.homeClubStub:result.awayClubStub,taker,'pen-'+event.id,{fromPenalty:true,penaltyEventId:event.id}));
  }else{
    events.push(makeEvent(event.side,'penalty-miss',event.second+2,event.side==='home'?result.homeClubStub:result.awayClubStub,taker,'pen-miss-'+event.id,{penaltyEventId:event.id,outcome}));
  }
  return recalcScore({...result,events});
}
function stripClubStubs(result){
  const next={...result};
  delete next.homeClubStub;delete next.awayClubStub;
  return next;
}
export function buildSchedule(clubs){
  const ids=clubs.map(c=>c.id),list=ids.length%2?ids.concat(null):ids.slice(),n=list.length,first=[];let rotation=list.slice();
  for(let round=0;round<n-1;round++){
    const matches=[];
    for(let i=0;i<n/2;i++){const a=rotation[i],b=rotation[n-1-i];if(a&&b){const flip=(round+i)%2===1;matches.push({homeId:flip?b:a,awayId:flip?a:b});}}
    first.push(matches);rotation=[rotation[0],rotation[n-1]].concat(rotation.slice(1,n-1));
  }
  return first.concat(first.map(matches=>matches.map(match=>({homeId:match.awayId,awayId:match.homeId}))));
}
export function teamProfile(club,lineup,career){return lineupProfile(club,lineup||autoLineup(club,career||{},1),career||{});}
export function teamRating(club,lineup,career){return teamProfile(club,lineup,career).overall;}
function resultPoints(result,clubId){
  if(!result)return 0;const home=result.homeId===clubId,gf=home?result.homeGoals:result.awayGoals,ga=home?result.awayGoals:result.homeGoals;
  return gf>ga?3:gf===ga?1:0;
}
function recentForm(results,clubId){
  const recent=(results||[]).filter(r=>r.homeId===clubId||r.awayId===clubId).slice(-5);
  if(!recent.length)return 0;
  const points=recent.reduce((s,r)=>s+resultPoints(r,clubId),0);
  return((points/(recent.length*3))-.5)*6;
}
function autoResolvePenaltyEvent(result,event,home,away){
  const side=event.side;
  const club=side==='home'?home:away,opponent=side==='home'?away:home;
  const lineup=currentLineup(result,side,event.second);
  const oppLineup=currentLineup(result,side==='home'?'away':'home',event.second);
  const taker=playerById(club,event.playerId)||bestPenaltyTaker(club,lineup);
  const keeper=goalkeeperOnField(opponent,oppLineup);
  if(!taker||!keeper)return result;
  return resolvePenaltyOnResult(result,event,taker,keeper,result.id+'|penalty|'+event.id+'|'+taker.id);
}
function generateDisciplineAndInjuries(result,home,away,rng,used,career,interactiveClubId){
  let events=[...(result.events||[])],eventIndex=events.length;
  const localYellow={};
  const cardCount=1+poisson(2.6,rng);
  for(let i=0;i<cardCount;i++){
    const side=rng()<.5?'home':'away',club=side==='home'?home:away,lineup=side==='home'?result.homeLineup:result.awayLineup;
    const candidates=lineupPlayers(club,lineup).filter(p=>p.position!=='Goalkeeper'||rng()<.2);
    if(!candidates.length)continue;
    const player=candidates[Math.floor(rng()*candidates.length)];
    const second=uniqueEventSecond(rng,used,result.durationSecond,8*60);
    const key=side+':'+player.id;
    localYellow[key]=(localYellow[key]||0)+1;
    events.push(makeEvent(side,'yellow',second,club,player,eventIndex++));
    if(localYellow[key]>=2){
      events.push(makeEvent(side,'red',second+1,club,player,eventIndex++,{reason:'second-yellow'}));
    }
  }
  if(rng()<.13){
    const side=rng()<.5?'home':'away',club=side==='home'?home:away,lineup=side==='home'?result.homeLineup:result.awayLineup;
    const players=lineupPlayers(club,lineup);
    if(players.length){
      const player=players[Math.floor(rng()*players.length)],second=uniqueEventSecond(rng,used,result.durationSecond,15*60);
      events.push(makeEvent(side,'red',second,club,player,eventIndex++,{reason:'direct'}));
    }
  }
  const weather=result.environment?.weather||{},pitchMultiplier=/pesado/i.test(String(weather.pitch||''))?1.12:/irregular/i.test(String(weather.pitch||''))?1.08:1;
  const injuryPool=[];
  for(const side of['home','away']){
    const club=side==='home'?home:away,lineup=side==='home'?result.homeLineup:result.awayLineup;
    const intensity=Number(side==='home'?result.intelligence?.homeIntensity:result.intelligence?.awayIntensity)||1;
    const tacticalInjury=Number(side==='home'?result.intelligence?.homeTacticalInjury:result.intelligence?.awayTacticalInjury)||1;
    const medical=String(club.id)===String(career.userClubId)?Number(career.facilities?.medical||1):2;
    for(const player of lineupPlayers(club,lineup)){
      const condition=playerCondition(career,club.id,player.id),stats=playerGameStats(player),age=Number(player._careerAge??player.age??27);
      const load=fatigueLoad({minutes:90,intensity,roleLoad:roleLoad(positionGroup(player.position)),fitnessPenalty:fitnessPenalty({stamina:stats.stamina,condition,age})});
      const risk=individualInjuryRisk({baseRisk:.0085,fatigue:load,intensity,condition,age,weatherMultiplier:Number(weather.injury)||1,pitchMultiplier,trainingMultiplier:tacticalInjury,medicalLevel:medical});
      injuryPool.push({side,club,player,risk,load,condition,medical});
    }
  }
  const injuryChance=combinedInjuryChance(injuryPool.map(item=>item.risk));
  if(injuryPool.length&&rng()<injuryChance){
    const totalRisk=injuryPool.reduce((sum,item)=>sum+item.risk,0);let pick=rng()*totalRisk,chosen=injuryPool[0];
    for(const item of injuryPool){pick-=item.risk;if(pick<=0){chosen=item;break;}}
    const {side,club,player,load,condition,medical}=chosen,second=uniqueEventSecond(rng,used,result.durationSecond,10*60),age=Number(player._careerAge??player.age??27);
    const severityRoll=rng()+Math.max(0,age-31)*.008+Math.max(0,74-condition)*.004+Math.max(0,load-92)*.0012-medical*.025;
    const severity=severityRoll<.48?1:severityRoll<.74?2:severityRoll<.90?3:severityRoll<.975?4:5;
    const duration=severity===1?1:severity===2?2:severity===3?3+Math.floor(rng()*2):severity===4?5+Math.floor(rng()*3):8+Math.floor(rng()*5);
    const label=severity===1?'Pancada / desconforto':severity===2?'Lesão muscular leve':severity===3?'Entorse moderada':severity===4?'Lesão muscular importante':'Lesão ligamentar grave';
    events.push(makeEvent(side,'injury',second,club,player,eventIndex++,{severityMatches:duration,injurySeverity:severity,injuryLabel:label,requiresAttention:club.id===interactiveClubId,injuryRisk:Number(chosen.risk.toFixed(4)),fatigueLoad:Number(load.toFixed(1)),playerAge:age}));
  }
  return{...result,events:events.sort((a,b)=>a.second-b.second)};
}
function applyDismissalConsequences(result,home,away,rng){
  let next={...result,events:[...(result.events||[])]};
  const reds=next.events.filter(e=>e.type==='red').sort((a,b)=>a.second-b.second);
  for(const red of reds){
    next.events=next.events.filter(function(event){
      if(event.id===red.id||event.second<=red.second)return true;
      if(String(event.playerId)!==String(red.playerId))return true;
      return !['goal','yellow','injury','shot','big-chance','foul','corner'].includes(event.type);
    });
    const punishedSide=red.side,opponentSide=punishedSide==='home'?'away':'home',opponentClub=opponentSide==='home'?home:away;
    const opponentLineup=opponentSide==='home'?next.homeLineup:next.awayLineup;
    if(red.second<78*60&&rng()<.31){
      const future=Math.min(next.durationSecond-20,red.second+240+Math.floor(rng()*720));
      if(future>red.second+30){
        {const scorer=weightedPlayer(opponentClub,opponentLineup,rng);next.events.push(makeGoalEvent(opponentSide,future,opponentClub,opponentLineup,scorer,'red-impact-'+red.id,rng,{dismissalImpact:true}));}
      }
    }
  }
  return recalcScore(next);
}
function aiTeamPlan(profile,form){
  const attackEdge=profile.attack-profile.defense,midEdge=profile.midfield-profile.defense;
  if(attackEdge>=6||form>1.7)return{id:'vertical',label:'Vertical',attackBoost:.14,defenseBoost:-.04,possession:-2,tempo:1.15};
  if(profile.midfield>=profile.attack+4)return{id:'control',label:'Controle',attackBoost:.03,defenseBoost:.03,possession:4,tempo:.96};
  if(profile.defense>=profile.attack+5)return{id:'compact',label:'Compacto',attackBoost:-.06,defenseBoost:.10,possession:-1,tempo:.9};
  if(midEdge>=3)return{id:'pressing',label:'Pressão alta',attackBoost:.08,defenseBoost:.02,possession:2,tempo:1.08};
  return{id:'balanced',label:'Equilibrado',attackBoost:0,defenseBoost:0,possession:0,tempo:1};
}
function applyAiManagement(result,home,away,career,interactiveClubId,rng){
  let next={...result,events:[...(result.events||[])],substitutions:[...(result.substitutions||[])]};
  for(const side of['home','away']){
    const club=side==='home'?home:away;
    if(club.id===interactiveClubId)continue;
    const initial=side==='home'?next.homeLineup:next.awayLineup;
    const benchIds=side==='home'?next.homeBench:next.awayBench;
    const usedIn=new Set(),usedOut=new Set();
    const yellowIds=new Set(next.events.filter(e=>e.side===side&&e.type==='yellow').map(e=>String(e.playerId)));
    const redIds=new Set(next.events.filter(e=>e.side===side&&e.type==='red').map(e=>String(e.playerId)));
    const injuries=next.events.filter(e=>e.side===side&&e.type==='injury').sort((a,b)=>a.second-b.second);
    const scoreAt65=scoreAtSecond(next,65*60),probeGf=side==='home'?scoreAt65.home:scoreAt65.away,probeGa=side==='home'?scoreAt65.away:scoreAt65.home;
    const targetCount=probeGf<probeGa?(rng()<.55?5:4):probeGf>probeGa?(rng()<.35?3:2):3+(rng()<.35?1:0);
    const candidates=initial.map(id=>playerById(club,id)).filter(p=>p&&!redIds.has(String(p.id))).sort(function(a,b){
      const ai=injuries.some(e=>String(e.playerId)===String(a.id))?120:0,bi=injuries.some(e=>String(e.playerId)===String(b.id))?120:0;
      const ay=yellowIds.has(String(a.id))?22:0,by=yellowIds.has(String(b.id))?22:0;
      const ac=100-playerCondition(career,club.id,a.id),bc=100-playerCondition(career,club.id,b.id);
      const ar=playerGameStats(a).overall,br=playerGameStats(b).overall;
      return(bi+by+bc-br*.05)-(ai+ay+ac-ar*.05);
    });
    for(const outgoing of candidates){
      if(next.substitutions.filter(s=>s.side===side).length>=targetCount||next.substitutions.filter(s=>s.side===side).length>=MAX_SUBSTITUTIONS)break;
      if(usedOut.has(String(outgoing.id)))continue;
      const injury=injuries.find(e=>String(e.playerId)===String(outgoing.id));
      const yellow=yellowIds.has(String(outgoing.id)),condition=playerCondition(career,club.id,outgoing.id);
      let minute;
      if(injury)minute=Math.max(12,Math.floor(injury.second/60)+1);
      else{
        const probe=scoreAtSecond(next,62*60),gf=side==='home'?probe.home:probe.away,ga=side==='home'?probe.away:probe.home;
        if(gf<ga)minute=52+Math.floor(rng()*17);
        else if(gf>ga)minute=67+Math.floor(rng()*15);
        else minute=59+Math.floor(rng()*18);
        if(yellow)minute=Math.min(minute,55+Math.floor(rng()*12));
        if(condition<68)minute=Math.min(minute,57+Math.floor(rng()*10));
      }
      const second=Math.min(next.durationSecond-90,minute*60);
      if(second<=0)continue;
      const liveScore=scoreAtSecond(next,second),gf=side==='home'?liveScore.home:liveScore.away,ga=side==='home'?liveScore.away:liveScore.home,trailing=gf<ga,leading=gf>ga;
      const available=benchIds.map(id=>playerById(club,id)).filter(p=>p&&!usedIn.has(String(p.id))).sort(function(a,b){
        const score=function(player){
          const stats=playerGameStats(player),group=positionGroup(player.position),same=player.position===outgoing.position?9:0;
          const tactical=trailing?(group==='ATA'?20:group==='MEI'?10:-4):leading?(group==='DEF'?18:group==='MEI'?8:group==='ATA'?-5:0):(group===positionGroup(outgoing.position)?8:0);
          const skill=trailing?stats.shooting*.12+stats.passing*.06:leading?stats.defending*.11+stats.stamina*.07:stats.overall*.12;
          return stats.overall+same+tactical+skill+playerCondition(career,club.id,player.id)*.08;
        };
        return score(b)-score(a);
      });
      const incoming=available[0];if(!incoming)continue;
      const sub={id:'ai-sub-'+next.id+'-'+side+'-'+next.substitutions.length,side,second,minute,outPlayerId:String(outgoing.id),outPlayer:outgoing.name,inPlayerId:String(incoming.id),inPlayer:incoming.name,halftime:false,windowId:'AI'+next.substitutions.length};
      next.substitutions.push(sub);usedIn.add(String(incoming.id));usedOut.add(String(outgoing.id));
      next.events=next.events.filter(e=>!(e.second>second&&String(e.playerId)===String(outgoing.id)&&['goal','yellow','red','injury','shot','big-chance','foul','corner'].includes(e.type)));
      next.events.push(makeEvent(side,'substitution',second+1,club,incoming,'ai-'+sub.id,{outPlayerId:String(outgoing.id),outPlayer:outgoing.name,tacticalReason:injury?'injury':trailing?'chasing':leading?'protecting':'fresh-legs'}));
      const stats=playerGameStats(incoming),attacking=['ATA','MEI'].includes(positionGroup(incoming.position));
      const impact=clamp(.02,.29,.035+Math.max(0,stats.shooting-66)*.0045+(minute>=70?.045:0)+(trailing?.055:0)+(condition<65?.02:0));
      if(attacking&&rng()<impact){
        const future=Math.min(next.durationSecond-20,second+150+Math.floor(rng()*450));
        if(future>second+20)next.events.push(makeGoalEvent(side,future,club,currentLineup(next,side,second),incoming,'ai-impact-'+sub.id,rng,{substitutionImpact:true,assistNarrative:'A mudança tática da CPU alterou o ritmo da partida.'}));
      }
    }
  }
  return recalcScore(next);
}

function applyAdaptiveAiTactics(result,home,away,career,interactiveClubId,rng){
  let next={...result,events:[...(result.events||[])],tacticalChanges:[...(result.tacticalChanges||[])],stats:{...(result.stats||{}),shots:[...(result.stats?.shots||[0,0])],onTarget:[...(result.stats?.onTarget||[0,0])]}};
  const checkpoint=Math.min(next.durationSecond-8*60,65*60);
  if(checkpoint<48*60)return next;
  for(const side of['home','away']){
    const club=side==='home'?home:away;
    if(String(club.id)===String(interactiveClubId))continue;
    const score=scoreAtSecond(next,checkpoint),gf=side==='home'?score.home:score.away,ga=side==='home'?score.away:score.home;
    const condition=Number(side==='home'?next.intelligence?.homeCondition:next.intelligence?.awayCondition)||78;
    const basePlan=String(side==='home'?next.intelligence?.homePlanId:next.intelligence?.awayPlanId)||'balanced';
    const decision=adaptiveAiDecision({scoreDiff:gf-ga,minute:Math.floor(checkpoint/60),condition,basePlan});
    if(Math.abs(decision.aggression)<.01)continue;
    next.tacticalChanges.push({side,second:checkpoint,preset:decision.id,aggression:Number(decision.aggression.toFixed(3)),adaptiveAi:true,reason:decision.reason});
    const planLabel={compact:'Compacto',balanced:'Equilibrado',control:'Controle',vertical:'Vertical',pressing:'Pressão alta','all-in':'Tudo ou nada'}[decision.id]||decision.id;
    next.intelligence={...(next.intelligence||{}),[side+'Plan']:planLabel,[side+'PlanId']:decision.id,[side+'AdaptiveReason']:decision.reason};
    const opportunityChance=decision.aggression>0?clamp(.10,.42,.14+decision.aggression*.24):clamp(.04,.20,.06+Math.abs(decision.aggression)*.10);
    if(rng()<opportunityChance){
      const at=Math.min(next.durationSecond-20,checkpoint+120+Math.floor(rng()*Math.max(180,next.durationSecond-checkpoint-180)));
      const lineup=currentLineup(next,side,at),player=weightedPlayer(club,lineup,rng),index=side==='home'?0:1;
      const goalChance=decision.aggression>0?clamp(.08,.27,.10+decision.aggression*.14):.075;
      next.stats.shots[index]=(next.stats.shots[index]||0)+1;
      if(rng()<goalChance){
        next.events.push(makeGoalEvent(side,at,club,lineup,player,'adaptive-'+side+'-'+Math.floor(checkpoint),rng,{adaptiveAi:true,tacticalReason:decision.reason}));
        next.stats.onTarget[index]=(next.stats.onTarget[index]||0)+1;
      }else{
        next.events.push(makeEvent(side,'big-chance',at,club,player,'adaptive-'+side+'-'+Math.floor(checkpoint),{adaptiveAi:true,tacticalReason:decision.reason}));
      }
    }
  }
  return recalcScore({...next,events:next.events.sort((a,b)=>a.second-b.second)});
}

export function simulateMatch(home,away,seed,context){
  const ctx=context||{},rng=rngFrom(seed),career=ctx.career||{};
  const homeLineup=(ctx.homeLineup||autoLineup(home,career,ctx.roundNumber||1)).map(String);
  const awayLineup=(ctx.awayLineup||autoLineup(away,career,ctx.roundNumber||1)).map(String);
  const homeBench=(ctx.homeBench||matchBench(home,career,ctx.roundNumber||1,homeLineup)).map(String);
  const awayBench=(ctx.awayBench||matchBench(away,career,ctx.roundNumber||1,awayLineup)).map(String);
  const hp=lineupProfile(home,homeLineup,career),ap=lineupProfile(away,awayLineup,career);
  const homeForm=recentForm(ctx.results||[],home.id),awayForm=recentForm(ctx.results||[],away.id),homePlan=aiTeamPlan(hp,homeForm),awayPlan=aiTeamPlan(ap,awayForm);
  const homeAttackEdge=hp.attack-ap.defense,awayAttackEdge=ap.attack-hp.defense;
  const managerEdge=managerMatchModifier(career),homeUser=String(home.id)===String(career.userClubId),awayUser=String(away.id)===String(career.userClubId),homeManager=homeUser?managerEdge:0,awayManager=awayUser?managerEdge:0;
  const neutralTactic={attackBoost:0,defenseBoost:0,possession:0,tempo:1,fatigueMultiplier:1,injuryMultiplier:1,counterRisk:0,setPiece:0,label:'CPU'};
  const homeTactic=homeUser?tacticalMatchup(career,awayPlan,{isHome:true}):neutralTactic,awayTactic=awayUser?tacticalMatchup(career,homePlan,{isHome:false}):neutralTactic;
  const weather=matchWeather(seed),homeSetPiece=homeUser?setPieceAttackModifier(career)+setPiecePersonnelBonus(career,home,homeLineup):0,awaySetPiece=awayUser?setPieceAttackModifier(career)+setPiecePersonnelBonus(career,away,awayLineup):0;
  const homeTacticalSource=homeUser?homeTactic:homePlan,awayTacticalSource=awayUser?awayTactic:awayPlan;
  const homeTacticalScore=tacticalExecutionScore(homeTacticalSource),awayTacticalScore=tacticalExecutionScore(awayTacticalSource);
  const userMorale=clamp(20,100,Number(career.dressingRoom?.morale??78));
  const homeMorale=homeUser?userMorale:clamp(48,86,76+homeForm*1.4),awayMorale=awayUser?userMorale:clamp(48,86,76+awayForm*1.4);
  const homeCoach=clamp(45,90,68+homeManager*180+homeForm*.8),awayCoach=clamp(45,90,68+awayManager*180+awayForm*.8);
  const boardPressure=Math.max(0,45-Number(career.managerConfidence?.board??55))*.12;
  const homeContext=contextScore(weather,{importance:1,pressure:homeUser?boardPressure:0}),awayContext=contextScore(weather,{importance:1,pressure:awayUser?boardPressure:0});
  const homeStrength=teamStrength({quality:hp.overall,form:formScore(homeForm),morale:homeMorale,tactics:homeTacticalScore,condition:hp.condition,coach:homeCoach,home:100,context:homeContext});
  const awayStrength=teamStrength({quality:ap.overall,form:formScore(awayForm),morale:awayMorale,tactics:awayTacticalScore,condition:ap.condition,coach:awayCoach,home:45,context:awayContext});
  const homeDominance=logisticDominance(homeStrength,awayStrength),awayDominance=1-homeDominance;
  const homeTacticalEdge=(homeTacticalSource.attackBoost||0)-(awayTacticalSource.defenseBoost||0),awayTacticalEdge=(awayTacticalSource.attackBoost||0)-(homeTacticalSource.defenseBoost||0);
  const homeXg=expectedGoals({dominance:homeDominance,base:1.20,attackVsDefense:homeAttackEdge,tacticalEdge:homeTacticalEdge,setPiece:homeSetPiece,weatherPassing:weather.passing,tempoEdge:(homeTacticalSource.tempo||1)-(awayTacticalSource.tempo||1),min:.22,max:3.85});
  const awayXg=expectedGoals({dominance:awayDominance,base:1.06,attackVsDefense:awayAttackEdge,tacticalEdge:awayTacticalEdge,setPiece:awaySetPiece,weatherPassing:weather.passing,tempoEdge:(awayTacticalSource.tempo||1)-(homeTacticalSource.tempo||1),min:.20,max:3.65});
  const homeGoals=clamp(0,7,poisson(homeXg,rng)),awayGoals=clamp(0,7,poisson(awayXg,rng));
  const durationSecond=FULL_TIME_SECOND+(1+Math.floor(rng()*5))*60,events=[],used=new Set();let eventIndex=0;
  for(let i=0;i<homeGoals;i++){const scorer=weightedPlayer(home,homeLineup,rng);events.push(makeGoalEvent('home',uniqueEventSecond(rng,used,durationSecond),home,homeLineup,scorer,eventIndex++,rng,{xg:Number((homeXg/Math.max(1,homeGoals)).toFixed(2))}));}
  for(let i=0;i<awayGoals;i++){const scorer=weightedPlayer(away,awayLineup,rng);events.push(makeGoalEvent('away',uniqueEventSecond(rng,used,durationSecond),away,awayLineup,scorer,eventIndex++,rng,{xg:Number((awayXg/Math.max(1,awayGoals)).toFixed(2))}));}
  const tempoFactor=Math.round((8+Math.floor(rng()*5))*((homePlan.tempo*homeTactic.tempo+awayPlan.tempo*awayTactic.tempo)/2)*Math.max(.82,1+weather.tempo)),types=['shot','shot','big-chance','foul','corner'];
  for(let i=0;i<tempoFactor;i++){
    const tacticalPossession=(homeTactic.possession-awayTactic.possession)/100,homeChance=clamp(.24,.76,homeDominance+tacticalPossession*.22),side=rng()<homeChance?'home':'away',club=side==='home'?home:away,lineup=side==='home'?homeLineup:awayLineup;
    events.push(makeEvent(side,types[Math.floor(rng()*types.length)],uniqueEventSecond(rng,used,durationSecond),club,weightedPlayer(club,lineup,rng),eventIndex++));
  }
  const baseHomeShots=5+Math.floor(rng()*6)+homeGoals+Math.max(0,Math.round((hp.attack-ap.defense)/8))+Math.round(homeTactic.attackBoost*8);
  const baseAwayShots=4+Math.floor(rng()*6)+awayGoals+Math.max(0,Math.round((ap.attack-hp.defense)/8))+Math.round(awayTactic.attackBoost*8);
  let result={
    id:String(seed),season:ctx.season||2026,roundNumber:ctx.roundNumber||1,competition:'Brasileirão Série A',
    matchday:matchdayProjection(home.id,away.id,ctx.roundNumber||1,seed),
    homeId:home.id,awayId:away.id,homeLineup,awayLineup,homeBench,awayBench,substitutions:[],durationSecond,simulationMode:ctx.mode||'normal',events:events.sort((a,b)=>a.second-b.second),
    homeGoals,awayGoals,xg:[Number(homeXg.toFixed(2)),Number(awayXg.toFixed(2))],environment:{weather},
    stats:{possession:[clamp(31,72,Math.round(50+(homeDominance-.5)*34+homePlan.possession-awayPlan.possession+homeTactic.possession-awayTactic.possession+(rng()-.5)*5)),0],shots:[Math.max(homeGoals,baseHomeShots+Math.round((homePlan.tempo*homeTactic.tempo-1)*5)),Math.max(awayGoals,baseAwayShots+Math.round((awayPlan.tempo*awayTactic.tempo-1)*5))],onTarget:[0,0],corners:[Math.max(0,Math.floor(rng()*7)+Math.round(homeSetPiece*12)),Math.max(0,Math.floor(rng()*7)+Math.round(awaySetPiece*12))],fouls:[7+Math.floor(rng()*10),7+Math.floor(rng()*10)]},
    intelligence:{engineVersion:LDF_ENGINE_VERSION,homeOverall:Math.round(hp.overall),awayOverall:Math.round(ap.overall),homeStrength:Number(homeStrength.toFixed(2)),awayStrength:Number(awayStrength.toFixed(2)),homeDominance:Number(homeDominance.toFixed(4)),awayDominance:Number(awayDominance.toFixed(4)),homeCondition:Math.round(hp.condition),awayCondition:Math.round(ap.condition),homeForm:Number(homeForm.toFixed(2)),awayForm:Number(awayForm.toFixed(2)),homePlan:homeUser?homeTactic.label:homePlan.label,awayPlan:awayUser?awayTactic.label:awayPlan.label,homePlanId:homeUser?String(career.tacticalState?.preset||'balanced'):homePlan.id,awayPlanId:awayUser?String(career.tacticalState?.preset||'balanced'):awayPlan.id,homeTacticalScore:Number(homeTacticalScore.toFixed(1)),awayTacticalScore:Number(awayTacticalScore.toFixed(1)),homeFatigue:homeTactic.fatigueMultiplier,awayFatigue:awayTactic.fatigueMultiplier,homeIntensity:homeUser?homeTactic.fatigueMultiplier:clamp(.78,1.32,.86+homePlan.tempo*.15),awayIntensity:awayUser?awayTactic.fatigueMultiplier:clamp(.78,1.32,.86+awayPlan.tempo*.15),homeTacticalInjury:homeTactic.injuryMultiplier,awayTacticalInjury:awayTactic.injuryMultiplier,homeInjuryMultiplier:homeTactic.injuryMultiplier*weather.injury,awayInjuryMultiplier:awayTactic.injuryMultiplier*weather.injury,weather:weather.label,temperature:weather.temperature,training:trainingMatchModifier(career).label},
    homeClubStub:{id:home.id,name:home.name,abbreviation:home.abbreviation},awayClubStub:{id:away.id,name:away.name,abbreviation:away.abbreviation},
  };
  result.stats.possession[1]=100-result.stats.possession[0];
  result.stats.onTarget=[Math.max(homeGoals,Math.round(result.stats.shots[0]*(.34+rng()*.17))),Math.max(awayGoals,Math.round(result.stats.shots[1]*(.34+rng()*.17)))];
  result=applyAdaptiveAiTactics(result,home,away,career,ctx.interactiveClubId,rng);
  result=generateDisciplineAndInjuries(result,home,away,rng,used,career,ctx.interactiveClubId);
  result=applyDismissalConsequences(result,home,away,rng);
  result=applyAiManagement(result,home,away,career,ctx.interactiveClubId,rng);
  const penaltyBase=.30+(homeSetPiece+awaySetPiece)*.18;
  if(rng()<penaltyBase){
    const side=rng()<.5?'home':'away',club=side==='home'?home:away,lineup=side==='home'?homeLineup:awayLineup;
    const assignedPenalty=assignedSetPiecePlayer(career,club,lineup,'penaltyTakerId'),penalty=makeEvent(side,'penalty',uniqueEventSecond(rng,used,durationSecond,12*60),club,assignedPenalty||bestPenaltyTaker(club,lineup)||weightedPlayer(club,lineup,rng),eventIndex++,{
      requiresDecision:club.id===ctx.interactiveClubId&&ctx.mode!=='instant',
      resolved:false,
    });
    result.events.push(penalty);result.events.sort((a,b)=>a.second-b.second);
    if(!penalty.requiresDecision)result=autoResolvePenaltyEvent(result,penalty,home,away);
  }
  return stripClubStubs(recalcScore(result));
}
export function scoreAtSecond(result,second){
  if(!result)return{home:0,away:0};
  return(result.events||[]).filter(e=>e.type==='goal'&&e.second<=second).reduce((score,event)=>{score[event.side]++;return score;},{home:0,away:0});
}
export function roundDuration(pendingRound){
  if(!pendingRound?.matches?.length)return FULL_TIME_SECOND;
  return Math.max(...pendingRound.matches.map(match=>match.durationSecond||FULL_TIME_SECOND));
}
export function liveRoundMatches(pendingRound,second){
  if(!pendingRound)return[];
  return pendingRound.matches.map(result=>{const score=scoreAtSecond(result,second);return{...result,liveHomeGoals:score.home,liveAwayGoals:score.away,finished:second>=(result.durationSecond||FULL_TIME_SECOND),minute:Math.min(Math.floor(second/60),Math.floor((result.durationSecond||FULL_TIME_SECOND)/60))};});
}
function normalizeResults(results,season){
  return(Array.isArray(results)?results:[]).map(function(result,index){
    return{...result,season:result.season||season,roundNumber:result.roundNumber||Math.floor(index/10)+1,competition:result.competition||'Brasileirão Série A',durationSecond:result.durationSecond||FULL_TIME_SECOND,simulationMode:result.simulationMode||'normal',substitutions:Array.isArray(result.substitutions)?result.substitutions:[]};
  });
}
function compactStoredResult(result){
  return{
    id:String(result.id||''),
    season:Number(result.season)||2026,
    roundNumber:Number(result.roundNumber)||1,
    competition:result.competition||'Brasileirão Série A',
    homeId:String(result.homeId),
    awayId:String(result.awayId),
    homeGoals:Number(result.homeGoals)||0,
    awayGoals:Number(result.awayGoals)||0,
    durationSecond:Number(result.durationSecond)||FULL_TIME_SECOND,
    simulationMode:SIMULATION_MODES[result.simulationMode]?result.simulationMode:'normal',
  };
}
export function standingsFromResults(results,clubs){
  const rows=Object.fromEntries(clubs.map(club=>[club.id,{clubId:club.id,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0}]));
  for(const result of results||[]){
    const home=rows[result.homeId],away=rows[result.awayId];if(!home||!away)continue;
    home.played++;away.played++;home.goalsFor+=result.homeGoals;home.goalsAgainst+=result.awayGoals;away.goalsFor+=result.awayGoals;away.goalsAgainst+=result.homeGoals;
    if(result.homeGoals>result.awayGoals){home.wins++;away.losses++;home.points+=3;}else if(result.homeGoals<result.awayGoals){away.wins++;home.losses++;away.points+=3;}else{home.draws++;away.draws++;home.points++;away.points++;}
  }
  return Object.values(rows).map(row=>({...row,goalDifference:row.goalsFor-row.goalsAgainst})).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||String(a.clubId).localeCompare(String(b.clubId))).map((row,index)=>({...row,position:index+1,efficiency:row.played?Math.round(row.points/(row.played*3)*100):0}));
}
function addScorers(map,result){
  const next={...(map||{})};
  for(const event of(result.events||[]).filter(item=>item.type==='goal')){
    const key=event.clubId+':'+event.playerId;next[key]={playerId:event.playerId,name:event.player,clubId:event.clubId,goals:(next[key]?.goals||0)+1};
  }
  return next;
}
export function topScorers(map,limit){const size=limit??20;return Object.values(map||{}).sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,'pt-BR')).slice(0,size);}
function historyEntry(result,userClubId){
  const isHome=result.homeId===userClubId,goalsFor=isHome?result.homeGoals:result.awayGoals,goalsAgainst=isHome?result.awayGoals:result.homeGoals,points=goalsFor>goalsAgainst?3:goalsFor===goalsAgainst?1:0;
  return{id:'history-'+result.season+'-'+result.roundNumber+'-'+result.id,season:result.season,roundNumber:result.roundNumber,competition:result.competition||'Brasileirão Série A',homeId:result.homeId,awayId:result.awayId,homeGoals:result.homeGoals,awayGoals:result.awayGoals,simulationMode:result.simulationMode||'normal',points,result:points===3?'Vitória':points===1?'Empate':'Derrota'};
}
function deriveHistory(results,userClubId){return(results||[]).filter(r=>r.homeId===userClubId||r.awayId===userClubId).map(r=>historyEntry(r,userClubId));}
export function userMatchHistory(career){return(career.history||[]).slice().sort((a,b)=>b.season-a.season||b.roundNumber-a.roundNumber);}
function defaultConditions(clubs){
  const conditions={};for(const club of clubs)for(const p of club.players||[])conditions[statusKey(club.id,p.id)]=100;return conditions;
}
function objectiveMaxPosition(clubId){
  const budget=getClubWorld(clubId).gameBudgetM||0;
  if(budget>=100)return 2;
  if(budget>=55)return 6;
  if(budget>=25)return 10;
  return 16;
}
function applyRoundConfidence(career,clubs,userResult,roundNumber){
  if(!userResult)return career;
  const table=standingsFromResults(career.results,clubs),row=table.find(item=>item.clubId===career.userClubId);
  const outcome=userOutcome(userResult,career.userClubId),margin=outcome.goalsFor-outcome.goalsAgainst;
  const objective=objectiveMaxPosition(career.userClubId),position=row?.position||20;
  let fans=outcome.winner==='user'?3:outcome.winner==='draw'?.35:-4.2;
  if(margin>=3)fans+=1.2;
  if(margin<=-3)fans-=1.4;
  if(position===1)fans+=1.6;
  else if(position<=4)fans+=.9;
  else if(position<=objective)fans+=.2;
  else if(position>=17)fans-=2.4;
  else if(position>objective+3)fans-=1.1;
  const recent=(career.history||[]).slice(-3);
  if(recent.length===3&&recent.every(item=>item.points===3))fans+=1.2;
  if(recent.length===3&&recent.every(item=>item.points===0))fans-=2;
  let board=position<=objective?.8:-Math.min(3,(position-objective)*.42);
  if(roundNumber<=5)board*=.45;
  const opening=Math.max(1,Number(career.openingCash)||initialCashForClub(career.userClubId));
  const cashRatio=(Number(career.cash)||0)/opening;
  if(cashRatio>=1.18)board+=.8;
  else if(cashRatio<.35)board-=2.4;
  else if(cashRatio<.65)board-=1.15;
  const resultText=outcome.winner==='user'?'vitória':outcome.winner==='draw'?'empate':'derrota';
  let next=applyConfidenceEvent(career,{
    fans,
    board,
    kind:'round',
    reason:'Rodada '+roundNumber+': '+resultText+' e '+position+'º lugar na tabela.',
  });
  next=reconcileStructuralBoardTrust(next,{weight:roundNumber<=5?.045:.075});
  const confidence=sanitizeManagerConfidence(next.managerConfidence);
  let pressure=Number(next.boardPressureStreak)||0;
  if(confidence.board<20)pressure+=1;
  else if(confidence.board>=30)pressure=0;
  const warning=confidence.board<30?{
    level:confidence.board<15?'critical':'warning',
    round:roundNumber,
    text:confidence.board<15?'A diretoria exige reação imediata. O cargo está em risco.':'A diretoria aumentou a cobrança sobre o trabalho.',
  }:null;
  let managerStatus=next.managerStatus||'active',dismissal=next.dismissal||null;
  if(managerStatus==='active'&&roundNumber>=10&&confidence.board<=12&&pressure>=3){
    managerStatus='dismissed';
    dismissal={season:next.season,round:roundNumber,boardConfidence:confidence.board,reason:'A diretoria decidiu encerrar o trabalho após uma sequência prolongada de baixa confiança.'};
    next={...next,messages:[{id:'dismissal-'+next.season+'-'+roundNumber,type:'board',title:'Decisão da diretoria',text:dismissal.reason},...(next.messages||[])]};
  }
  return{...next,boardPressureStreak:pressure,boardWarning:warning,managerStatus,dismissal};
}
function clubTopScorer(career){
  return topScorers(career.scorers,100).find(item=>String(item.clubId)===String(career.userClubId))||null;
}
function addSeasonPerformance(map,club,result,userClubId){
  const next={...(map||{})};
  if(!club||!result||(result.homeId!==userClubId&&result.awayId!==userClubId))return next;
  const side=result.homeId===userClubId?'home':'away';
  for(const row of matchPlayerPerformances(club,result,side,result.durationSecond||FULL_TIME_SECOND)){
    const key=String(row.playerId),current=next[key]||{playerId:key,name:row.name,appearances:0,totalRating:0,goals:0,assists:0,minutes:0};
    next[key]={...current,name:row.name,appearances:current.appearances+1,totalRating:current.totalRating+(Number(row.rating)||0),goals:current.goals+(row.goals||0),assists:current.assists+(row.assists||0),minutes:current.minutes+(row.minutes||0)};
  }
  return next;
}
function deriveSeasonPerformance(results,club,userClubId){
  let aggregate={};
  for(const result of results||[])aggregate=addSeasonPerformance(aggregate,club,result,userClubId);
  return aggregate;
}
function seasonBestPerformer(career){
  return Object.values(career.seasonPerformance||{}).map(item=>({...item,averageRating:item.appearances?Number((item.totalRating/item.appearances).toFixed(2)):0}))
    .sort((a,b)=>b.averageRating-a.averageRating||b.goals-a.goals||b.assists-a.assists||b.minutes-a.minutes)[0]||null;
}
export function createCareer(clubs,userClubId,season){
  const userClub=clubs.find(c=>c.id===userClubId);
  const initialCash=initialCashForClub(userClubId);
  let base={version:12,simulationEngineVersion:LDF_ENGINE_VERSION,userClubId,managerName:'',season:season||2026,round:0,schedule:buildSchedule(clubs),results:[],scorers:{},allTimeScorers:{},cash:initialCash,openingCash:initialCash,transactions:[],sponsors:[],trophies:[],messages:[],seasons:[],history:[],pendingRound:null,pendingWorldMatch:null,lastRoundResults:[],lastUserMatch:null,preferredSimulationMode:'normal',playerStatus:{},conditions:defaultConditions(clubs),lineup:[],ownership:{},loans:[],transferHistory:[],transferContracts:[],seasonPerformance:{},playerDevelopment:{},retiredPlayers:{},regens:[],pendingRetirements:[],managerConfidence:createManagerConfidence(),seasonReview:null,pendingCelebration:null,pendingCinematic:null,boardPressureStreak:0,boardWarning:null,managerStatus:'active',dismissal:null,world:null,eventLedger:[],tacticalState:sanitizeTacticalState(null),trainingState:{focus:'balanced',sessions:0},careerChallenge:'normal',challengeStartSeason:season||2026,challengeHistory:[]};
  base=initializeCareerSystems(base,userClub||{id:userClubId,name:'Clube',players:[]},clubs);
  base=initializeCareerLife(base,userClub||{id:userClubId,name:'Clube',players:[]},clubs);
  base.lineup=userClub?autoLineup(userClub,base,1):[];
  base.world=createWorldState(base,clubs,base.season);
  return base;
}
export function sanitizeCareer(raw,clubs,userClubId){
  if(!raw||typeof raw!=='object'||raw.userClubId!==userClubId)return createCareer(clubs,userClubId);
  const season=Number(raw.season)||2026,club=clubs.find(c=>c.id===userClubId),fullResults=normalizeResults(raw.results,season),results=fullResults.map(compactStoredResult),base=createCareer(clubs,userClubId,season),history=Array.isArray(raw.history)&&raw.history.length?raw.history:deriveHistory(results,userClubId);
  const pending=raw.pendingRound&&Array.isArray(raw.pendingRound.matches)?{...raw.pendingRound,matches:normalizeResults(raw.pendingRound.matches,season)}:null;
  const roundNumber=(raw.round||0)+1,seasonPerformance=raw.seasonPerformance&&typeof raw.seasonPerformance==='object'?raw.seasonPerformance:deriveSeasonPerformance(fullResults,club,userClubId);
  const migratedCash=Number(raw.version||0)<5&&(raw.round||0)===0&&!(raw.transactions||[]).length&&Number(raw.cash||0)===20000000?base.cash:raw.cash;
  const merged={...base,...raw,cash:Number.isFinite(migratedCash)?migratedCash:base.cash,openingCash:Number.isFinite(Number(raw.openingCash))?Number(raw.openingCash):base.cash,version:12,simulationEngineVersion:LDF_ENGINE_VERSION,managerName:String(raw.managerName||''),schedule:Array.isArray(raw.schedule)&&raw.schedule.length===38?raw.schedule:buildSchedule(clubs),results,scorers:raw.scorers&&typeof raw.scorers==='object'?raw.scorers:{},allTimeScorers:raw.allTimeScorers&&typeof raw.allTimeScorers==='object'?raw.allTimeScorers:{},sponsors:Array.isArray(raw.sponsors)?raw.sponsors:[],trophies:Array.isArray(raw.trophies)?raw.trophies:[],transactions:Array.isArray(raw.transactions)?raw.transactions:[],messages:Array.isArray(raw.messages)?raw.messages:[],seasons:Array.isArray(raw.seasons)?raw.seasons:[],history,pendingRound:pending,pendingWorldMatch:raw.pendingWorldMatch&&typeof raw.pendingWorldMatch==='object'?raw.pendingWorldMatch:null,lastRoundResults:Array.isArray(raw.lastRoundResults)?normalizeResults(raw.lastRoundResults,season):[],preferredSimulationMode:SIMULATION_MODES[raw.preferredSimulationMode]?raw.preferredSimulationMode:'normal',playerStatus:raw.playerStatus&&typeof raw.playerStatus==='object'?raw.playerStatus:{},conditions:{...base.conditions,...(raw.conditions||{})},ownership:raw.ownership&&typeof raw.ownership==='object'?raw.ownership:{},loans:Array.isArray(raw.loans)?raw.loans:[],transferHistory:Array.isArray(raw.transferHistory)?raw.transferHistory:[],transferContracts:Array.isArray(raw.transferContracts)?raw.transferContracts:[],seasonPerformance,playerDevelopment:raw.playerDevelopment&&typeof raw.playerDevelopment==='object'?raw.playerDevelopment:{},retiredPlayers:raw.retiredPlayers&&typeof raw.retiredPlayers==='object'?raw.retiredPlayers:{},regens:Array.isArray(raw.regens)?raw.regens:[],pendingRetirements:Array.isArray(raw.pendingRetirements)?raw.pendingRetirements:[],managerConfidence:sanitizeManagerConfidence(raw.managerConfidence),seasonReview:raw.seasonReview&&typeof raw.seasonReview==='object'?raw.seasonReview:null,pendingCelebration:raw.pendingCelebration&&typeof raw.pendingCelebration==='object'?raw.pendingCelebration:null,pendingCinematic:raw.pendingCinematic&&typeof raw.pendingCinematic==='object'?raw.pendingCinematic:null,boardPressureStreak:Number(raw.boardPressureStreak)||0,boardWarning:raw.boardWarning&&typeof raw.boardWarning==='object'?raw.boardWarning:null,managerStatus:raw.managerStatus==='dismissed'?'dismissed':'active',dismissal:raw.dismissal&&typeof raw.dismissal==='object'?raw.dismissal:null,eventLedger:Array.isArray(raw.eventLedger)?raw.eventLedger:[],tacticalState:sanitizeTacticalState(raw.tacticalState),trainingState:raw.trainingState&&typeof raw.trainingState==='object'?raw.trainingState:{focus:'balanced',sessions:0},careerChallenge:String(raw.careerChallenge||'normal'),challengeStartSeason:Number(raw.challengeStartSeason||season),challengeHistory:Array.isArray(raw.challengeHistory)?raw.challengeHistory:[]};
  merged.world=sanitizeWorldState(raw.world,merged,clubs);
  let integrated=initializeCareerSystems(merged,club||{id:userClubId,name:'Clube',players:[]},clubs);
  integrated=initializeCareerLife(integrated,club||{id:userClubId,name:'Clube',players:[]},clubs);
  integrated.lineup=club?sanitizeLineup(club,integrated,roundNumber,raw.lineup):[];
  return integrated;
}
export function fixtureForUser(career){
  if(career.pendingRound)return career.pendingRound.matches.find(match=>match.homeId===career.userClubId||match.awayId===career.userClubId)||null;
  if(career.round>=career.schedule.length)return null;
  return career.schedule[career.round].find(match=>match.homeId===career.userClubId||match.awayId===career.userClubId)||null;
}
export function updateCareerTactics(career,patch){return updateTacticalState(career,patch);}
export function setCareerTacticalPreset(career,presetId){return setTacticalPreset(career,presetId);}
function applyUserTacticalStateChange(career,clubs,base,changeId,second=0){

  if(!career.pendingRound)return base;
  const matches=career.pendingRound.matches.slice(),index=matches.findIndex(match=>match.homeId===career.userClubId||match.awayId===career.userClubId);if(index<0)return base;
  let match={...matches[index],events:[...(matches[index].events||[])],tacticalChanges:[...(matches[index].tacticalChanges||[])]};
  const oldTactic=sanitizeTacticalState(career.tacticalState),newTactic=sanitizeTacticalState(base.tacticalState),aggression=((newTactic.mentality-oldTactic.mentality)+(newTactic.risk-oldTactic.risk)+(newTactic.pressing-oldTactic.pressing))/300;
  const userSide=String(match.homeId)===String(career.userClubId)?'home':'away',oppSide=userSide==='home'?'away':'home',userClub=clubs.find(c=>String(c.id)===String(career.userClubId)),oppClub=clubs.find(c=>String(c.id)===String(userSide==='home'?match.awayId:match.homeId)),seed=match.id+'|tactic|'+Math.floor(second)+'|'+changeId,rng=rngFrom(seed),used=new Set(match.events.map(e=>e.second));
  if(userClub&&oppClub&&second<match.durationSecond-180){
    if(aggression>.05){
      const attackChance=clamp(.05,.34,.09+aggression*.48),counterChance=clamp(.03,.28,.05+aggression*.36);
      if(rng()<attackChance){
        const at=Math.min(match.durationSecond-30,uniqueEventSecond(rng,used,match.durationSecond,Math.max(180,second+90))),lineup=currentLineup(match,userSide,at),player=weightedPlayer(userClub,lineup,rng);
        if(rng()<clamp(.12,.42,.16+aggression*.38))match.events.push(makeGoalEvent(userSide,at,userClub,lineup,player,'tactical-push-'+Math.floor(second),rng,{tacticalImpact:true,assistNarrative:'A mudança de postura aumentou a presença ofensiva.'}));
        else match.events.push(makeEvent(userSide,'big-chance',at,userClub,player,'tactical-push-'+Math.floor(second),{tacticalImpact:true}));
      }
      if(rng()<counterChance){
        const at=Math.min(match.durationSecond-25,uniqueEventSecond(rng,used,match.durationSecond,Math.max(180,second+120))),lineup=currentLineup(match,oppSide,at),player=weightedPlayer(oppClub,lineup,rng);
        if(rng()<clamp(.10,.36,.13+aggression*.34))match.events.push(makeGoalEvent(oppSide,at,oppClub,lineup,player,'tactical-counter-'+Math.floor(second),rng,{tacticalImpact:true,assistNarrative:'O espaço deixado pela pressão virou contra-ataque.'}));
        else match.events.push(makeEvent(oppSide,'big-chance',at,oppClub,player,'tactical-counter-'+Math.floor(second),{tacticalImpact:true}));
      }
    }else if(aggression<-.05){
      const futureGoals=match.events.filter(e=>e.type==='goal'&&e.side===oppSide&&e.second>second+120).sort((a,b)=>a.second-b.second);
      if(futureGoals.length&&rng()<clamp(.08,.32,.10+Math.abs(aggression)*.42)){
        const blocked=futureGoals[0];match.events=match.events.filter(e=>e.id!==blocked.id);
        match.events.push({...blocked,id:blocked.id+'-blocked',type:'big-chance',text:(blocked.player||'O adversário')+' para na reorganização defensiva',tacticalImpact:true});
      }
    }
  }
  match.tacticalChanges.push({second:Math.max(0,Number(second)||0),preset:newTactic.preset,changeId,aggression:Number(aggression.toFixed(3)),state:{mentality:newTactic.mentality,pressing:newTactic.pressing,defensiveLine:newTactic.defensiveLine,tempo:newTactic.tempo,width:newTactic.width,directness:newTactic.directness,risk:newTactic.risk,counterAttack:newTactic.counterAttack,attackingFocus:newTactic.attackingFocus}});
  match=recalcScore({...match,events:match.events.sort((a,b)=>a.second-b.second)});
  matches[index]=match;
  let next={...base,pendingRound:{...career.pendingRound,matches}};
  return emitCareerEvent(next,{type:'TACTIC_CHANGED',importance:2,payload:{preset:newTactic.preset,changeId,second:Math.floor(second),aggression:Number(aggression.toFixed(2))}});
}
export function changeUserMatchTactic(career,clubs,presetId,second=0){
  return applyUserTacticalStateChange(career,clubs,setTacticalPreset(career,presetId),'preset:'+presetId,second);
}
export function changeUserMatchTacticalState(career,clubs,patch,second=0){
  const base=updateTacticalState(career,patch||{}),keys=Object.keys(patch||{}).sort().join(',');
  return applyUserTacticalStateChange(career,clubs,base,'advanced:'+keys,second);
}
export function userLineupForNextMatch(career,club){
  const roundNumber=career.round+1;
  return sanitizeLineup(club,career,roundNumber,career.lineup);
}
export function updateUserLineup(career,club,lineup){
  if(career.pendingRound)return career;
  const validation=lineupValidation(club,career,career.round+1,lineup);
  if(!validation.valid)return career;
  return{...career,lineup:validation.lineup};
}
function userOutcome(result,userClubId){
  const home=result.homeId===userClubId,gf=home?result.homeGoals:result.awayGoals,ga=home?result.awayGoals:result.homeGoals;
  return{winner:gf>ga?'user':gf<ga?'opponent':'draw',goalsFor:gf,goalsAgainst:ga};
}
function applyDisciplineAndInjuries(career,roundResults,roundNumber){
  const status={...(career.playerStatus||{})};
  for(const result of roundResults){
    for(const event of result.events||[]){
      if(!['yellow','red','injury'].includes(event.type))continue;
      const key=statusKey(event.clubId,event.playerId),current={yellowCount:0,injuryThroughRound:0,suspensionThroughRound:0,...(status[key]||{})};
      if(event.type==='yellow'){
        current.yellowCount=(current.yellowCount||0)+1;
        if(current.yellowCount>=3){current.yellowCount=0;current.suspensionThroughRound=Math.max(current.suspensionThroughRound||0,roundNumber+1);current.suspensionReason='3 cartões amarelos';}
      }
      if(event.type==='red'){
        current.suspensionThroughRound=Math.max(current.suspensionThroughRound||0,roundNumber+1);
        current.suspensionReason=event.reason==='second-yellow'?'Expulsão por segundo amarelo':'Cartão vermelho';
      }
      if(event.type==='injury'){
        const clubId=String(event.clubId),club=roundResults.length?null:null,medical=String(clubId)===String(career.userClubId)?Number(career.facilities?.medical||1):2,condition=Number(career.conditions?.[key]??78),age=Number(event.playerAge||27),history=Number(current.injuryHistory||0),recovery=injuryRecovery({severity:Number(event.injurySeverity||1),medicalLevel:medical,age,fitness:condition,rehabQuality:medical>=4?1.12:1,injuryHistory:history});
        const duration=Math.max(Number(event.severityMatches||1),recovery.matches);
        current.injuryThroughRound=Math.max(current.injuryThroughRound||0,roundNumber+duration);
        current.injuryLabel=event.injuryLabel||'Lesão';
        current.injurySeverity=Number(event.injurySeverity||1);
        current.injuryHistory=history+1;
        current.lastInjurySeason=career.season;
        current.lastInjuryRound=roundNumber;
        current.permanentLossRisk=Number(recovery.permanentLossRisk.toFixed(4));
        current.recoveryMatches=duration;
      }
      status[key]=current;
    }
  }
  return{...career,playerStatus:status};
}
function minutesPlayed(result,side,playerId){
  const id=String(playerId),starters=(side==='home'?result.homeLineup:result.awayLineup)||[],subs=(result.substitutions||[]).filter(item=>item.side===side);
  const entered=subs.find(item=>String(item.inPlayerId)===id),started=starters.map(String).includes(id);
  if(!started&&!entered)return 0;
  const start=started?0:Number(entered.second||0);
  const left=subs.find(item=>String(item.outPlayerId)===id),red=(result.events||[]).find(event=>event.side===side&&event.type==='red'&&String(event.playerId)===id);
  const end=Math.min(Number(result.durationSecond)||FULL_TIME_SECOND,left?Number(left.second):Infinity,red?Number(red.second):Infinity);
  return Math.max(0,(end-start)/60);
}
function updateConditions(career,roundResults,clubs){
  const conditions={...(career.conditions||{})};
  for(const club of clubs){
    for(const player of club.players||[]){
      const key=statusKey(club.id,player.id),base=Number.isFinite(conditions[key])?conditions[key]:100;
      conditions[key]=clamp(40,100,base+7);
    }
  }
  for(const result of roundResults){
    for(const side of['home','away']){
      const clubId=side==='home'?result.homeId:result.awayId,club=clubs.find(item=>String(item.id)===String(clubId));if(!club)continue;
      const starters=side==='home'?result.homeLineup:result.awayLineup,subs=(result.substitutions||[]).filter(item=>item.side===side),ids=new Set([...(starters||[]).map(String),...subs.map(item=>String(item.inPlayerId))]);
      const intensity=Number(side==='home'?result.intelligence?.homeIntensity:result.intelligence?.awayIntensity)||Number(side==='home'?result.intelligence?.homeFatigue:result.intelligence?.awayFatigue)||1;
      for(const id of ids){
        const player=playerById(club,id);if(!player)continue;
        const key=statusKey(clubId,id),condition=conditions[key]??100,stats=playerGameStats(player),age=Number(player._careerAge??player.age??27),minutes=minutesPlayed(result,side,id);
        const load=fatigueLoad({minutes,intensity,roleLoad:roleLoad(positionGroup(player.position)),fitnessPenalty:fitnessPenalty({stamina:stats.stamina,condition,age})});
        conditions[key]=clamp(35,100,condition-fatigueConditionLoss(load));
      }
      for(const injury of(result.events||[]).filter(event=>event.side===side&&event.type==='injury')){
        const key=statusKey(clubId,injury.playerId);conditions[key]=clamp(35,100,(conditions[key]??100)-10);
      }
    }
  }
  return{...career,conditions};
}
function autoResolveOutstandingUserPenalties(career,clubs){
  if(!career.pendingRound)return career;
  let next=career;
  const userMatch=next.pendingRound.matches.find(m=>m.homeId===next.userClubId||m.awayId===next.userClubId);
  if(!userMatch)return next;
  const pending=(userMatch.events||[]).filter(e=>e.type==='penalty'&&e.requiresDecision&&!e.resolved);
  for(const event of pending){
    const side=event.side,club=clubs.find(c=>c.id===(side==='home'?userMatch.homeId:userMatch.awayId));
    const lineup=currentLineup(userMatch,side,event.second),taker=bestPenaltyTaker(club,lineup);
    if(taker)next=resolveUserPenalty(next,clubs,event.id,taker.id).career;
  }
  return next;
}
function finalizeSeason(career,clubs){
  const table=standingsFromResults(career.results,clubs),champion=table[0],leaders=topScorers(career.scorers,1),userRow=table.find(item=>item.clubId===career.userClubId);
  const best=seasonBestPerformer(career),snapshot={season:career.season,championId:champion?.clubId,topScorer:leaders[0]||null,userClubId:String(career.userClubId),position:userRow?.position||20,points:userRow?.points||0,wins:userRow?.wins||0,draws:userRow?.draws||0,losses:userRow?.losses||0,goalsFor:userRow?.goalsFor||0,goalsAgainst:userRow?.goalsAgainst||0,goalDifference:userRow?.goalDifference||0,clubTopScorer:clubTopScorer(career),bestPlayer:best,cash:Number(career.cash||0),fanConfidence:Math.round(career.managerConfidence?.fans||0),boardConfidence:Math.round(career.managerConfidence?.board||0)};
  const previousSeasons=(career.seasons||[]).filter(item=>Number(item.season)!==Number(career.season));
  let next={...career,seasons:[...previousSeasons,snapshot]};
  let newTitle=null;
  if(champion?.clubId===career.userClubId){
    const club=clubs.find(c=>c.id===career.userClubId);
    newTitle={id:'brasileirao',name:'Campeonato Brasileiro',kind:'Nacional',shape:'league',season:career.season,earnedAtRound:38};
    next={...next,trophies:[...(next.trophies||[]),newTitle],messages:[{id:'brasileirao-'+career.season,type:'title',title:'Campeão brasileiro!',text:(club?.name||'Seu clube')+' conquistou o Brasileirão '+career.season+'. A taça foi adicionada automaticamente à galeria.'},...(next.messages||[])]};
    next=applyConfidenceEvent(next,{fans:12,board:10,kind:'title',reason:'Título brasileiro conquistado na temporada '+career.season+'.'});
    next=applyTitleDynamics(next,newTitle);
  }
  const titles=(next.trophies||[]).filter(item=>Number(item.season)===Number(next.season));
  const confidence=sanitizeManagerConfidence(next.managerConfidence);
  const seasonStillActive=pendingSeasonFixtures(next,clubs).length>0;
  next={...next,seasonReview:{
    pending:!seasonStillActive,waiting:seasonStillActive,season:next.season,position:userRow?.position||20,points:userRow?.points||0,wins:userRow?.wins||0,draws:userRow?.draws||0,losses:userRow?.losses||0,
    goalsFor:userRow?.goalsFor||0,goalsAgainst:userRow?.goalsAgainst||0,goalDifference:userRow?.goalDifference||0,
    topScorer:clubTopScorer(next),bestPlayer:seasonBestPerformer(next),titles,
    fanConfidence:confidence.fans,boardConfidence:confidence.board,cash:next.cash,openingCash:next.openingCash,finalTable:table.map(row=>({...row})),
  },pendingCelebration:newTitle?{id:'celebration-'+next.season+'-'+newTitle.id,type:'trophy',trophy:newTitle}:next.pendingCelebration,lastSeasonTable:table.map(row=>({...row}))};
  return expireSeasonSponsors(next);
}
export function canStartRound(career){return career.managerStatus!=='dismissed'&&!career.pendingRound&&!career.pendingWorldMatch&&career.round<career.schedule.length;}
export function startRound(career,clubs,mode){
  if(!canStartRound(career))return career;
  const selectedMode=SIMULATION_MODES[mode]?mode:'normal',roundNumber=career.round+1,fixtures=career.schedule[career.round];
  const userClub=clubs.find(c=>c.id===career.userClubId);
  const userLineup=userClub?sanitizeLineup(userClub,career,roundNumber,career.lineup):[];
  if(userClub&&!lineupValidation(userClub,career,roundNumber,userLineup).valid)return career;
  const matches=fixtures.map(function(fixture,index){
    const home=clubs.find(c=>c.id===fixture.homeId),away=clubs.find(c=>c.id===fixture.awayId);
    const homeLineup=home.id===career.userClubId&&selectedMode!=='instant'?userLineup:autoLineup(home,career,roundNumber);
    const awayLineup=away.id===career.userClubId&&selectedMode!=='instant'?userLineup:autoLineup(away,career,roundNumber);
    const seed=career.season+'-'+roundNumber+'-'+index+'-'+home.id+'-'+away.id;
    return simulateMatch(home,away,seed,{results:career.results,season:career.season,roundNumber,career,homeLineup,awayLineup,homeBench:matchBench(home,career,roundNumber,homeLineup),awayBench:matchBench(away,career,roundNumber,awayLineup),interactiveClubId:selectedMode==='instant'?null:career.userClubId,mode:selectedMode});
  });
  const userMatch=matches.find(result=>result.homeId===career.userClubId||result.awayId===career.userClubId);
  return{...career,lineup:userLineup,preferredSimulationMode:selectedMode,pendingRound:{id:'round-'+career.season+'-'+roundNumber,season:career.season,roundNumber,mode:selectedMode,matches,userMatchId:userMatch?.id||null,started:true}};
}
export function resolveUserPenalty(career,clubs,eventId,takerId){
  if(!career.pendingRound)return{career,error:'Não há rodada em andamento.'};
  const matches=career.pendingRound.matches.slice();
  const index=matches.findIndex(m=>(m.events||[]).some(e=>e.id===eventId));
  if(index<0)return{career,error:'Cobrança não encontrada.'};
  const match=matches[index],event=match.events.find(e=>e.id===eventId);
  if(!event||event.type!=='penalty'||event.resolved)return{career,error:'Esta cobrança já foi resolvida.'};
  const side=event.side,club=clubs.find(c=>c.id===(side==='home'?match.homeId:match.awayId)),opponent=clubs.find(c=>c.id===(side==='home'?match.awayId:match.homeId));
  if(club.id!==career.userClubId)return{career,error:'A cobrança pertence ao adversário.'};
  const lineup=currentLineup(match,side,event.second);
  if(!lineup.includes(String(takerId)))return{career,error:'O cobrador precisa estar em campo.'};
  const taker=playerById(club,takerId),oppLineup=currentLineup(match,side==='home'?'away':'home',event.second),keeper=goalkeeperOnField(opponent,oppLineup);
  if(!taker||!keeper)return{career,error:'Não foi possível definir cobrador ou goleiro.'};
  const probability=penaltyProbability(taker,keeper),roll=deterministicRoll(match.id+'|user-penalty|'+event.id+'|'+taker.id),outcome=penaltyOutcomeFromRoll(probability,roll),scored=outcome==='goal';
  const narrative=scored?['está ajeitando a bola com cuidado','olha com confiança para a torcida','toma distância','corre para a bola e... GOL!']:outcome==='saved'?['posiciona a bola no ponto da cal','encara o goleiro','toma distância','bate e... DEFENDE O GOLEIRO!']:outcome==='post'?['ajeita a bola','respira fundo','parte para a cobrança','bate colocado e... NA TRAVE!']:outcome==='wide'?['olha para o canto','toma distância','bate cruzado e... PARA FORA!']:['ajeita a bola','olha com confiança para a torcida','toma distância','bate com força e... ISOLA A BOLA!'];
  let events=match.events.map(item=>item.id===eventId?{...item,resolved:true,takerId:String(taker.id),taker:taker.name,keeperId:String(keeper.id),keeper:keeper.name,outcome,scored,narrative,probability:Number(probability.toFixed(3))}:item);
  if(scored)events.push(makeEvent(side,'goal',event.second+2,club,taker,'user-pen-'+event.id,{fromPenalty:true,penaltyEventId:event.id}));
  else events.push(makeEvent(side,'penalty-miss',event.second+2,club,taker,'user-pen-miss-'+event.id,{penaltyEventId:event.id,outcome}));
  matches[index]=recalcScore({...match,events});
  return{career:{...career,pendingRound:{...career.pendingRound,matches}},error:null,outcome:{scored,outcome,narrative,probability,taker:taker.name,keeper:keeper.name}};
}
export function makeUserSubstitution(career,clubs,outPlayerId,inPlayerId,second,options){
  if(!career.pendingRound)return{career,error:'Não há partida em andamento.'};
  const opts=options||{},matches=career.pendingRound.matches.slice(),index=matches.findIndex(m=>m.homeId===career.userClubId||m.awayId===career.userClubId);
  if(index<0)return{career,error:'Partida do usuário não encontrada.'};
  let match=matches[index],side=match.homeId===career.userClubId?'home':'away',club=clubs.find(c=>c.id===career.userClubId),lineup=currentLineup(match,side,second),bench=currentBench(match,side,second);
  if(!lineup.includes(String(outPlayerId)))return{career,error:'O jogador que vai sair não está em campo.'};
  if(!bench.includes(String(inPlayerId)))return{career,error:'O jogador que vai entrar não está disponível no banco.'};
  const substitutions=match.substitutions||[];
  if(substitutions.filter(s=>s.side===side).length>=MAX_SUBSTITUTIONS)return{career,error:'As cinco substituições já foram utilizadas.'};
  const halftime=Boolean(opts.halftime);
  const windows=new Set(substitutions.filter(s=>s.side===side&&!s.halftime).map(s=>s.windowId));
  if(!halftime&&windows.size>=MAX_SUB_WINDOWS)return{career,error:'As três janelas de substituição já foram utilizadas.'};
  const out=playerById(club,outPlayerId),incoming=playerById(club,inPlayerId);if(!out||!incoming)return{career,error:'Jogador inválido.'};
  const windowId=halftime?'HT':('W'+(windows.size+1)+'-'+Math.floor(second/60));
  const sub={id:'sub-'+match.id+'-'+substitutions.length,side,second,minute:Math.floor(second/60),outPlayerId:String(out.id),outPlayer:out.name,inPlayerId:String(incoming.id),inPlayer:incoming.name,halftime,windowId};
  let events=(match.events||[]).filter(function(event){
    if(event.second<=second)return true;
    if(String(event.playerId)!==String(out.id))return true;
    return !['goal','yellow','red','injury','shot','big-chance','foul','corner'].includes(event.type);
  });
  events.push(makeEvent(side,'substitution',second+1,club,incoming,'sub-'+substitutions.length,{outPlayerId:String(out.id),outPlayer:out.name,halftime}));
  const minute=Math.floor(second/60),inStats=playerGameStats(incoming),outRating=effectivePlayerRating(out,career,club.id,minute,false),inRating=effectivePlayerRating(incoming,career,club.id,minute,true);
  const score=scoreAtSecond({...match,events},second),userHome=side==='home',gf=userHome?score.home:score.away,ga=userHome?score.away:score.home;
  const attacking=['ATA','MEI'].includes(positionGroup(incoming.position));
  const freshEdge=inRating-outRating;
  const impactChance=clamp(.02,.34,.055+Math.max(0,freshEdge)*.009+Math.max(0,inStats.shooting-67)*.004+(minute>=70?.045:0)+(gf<=ga?.035:0));
  const roll=deterministicRoll(match.id+'|sub-impact|'+sub.id);
  if(attacking&&minute>=55&&roll<impactChance){
    const futureSecond=Math.min(match.durationSecond-20,second+180+Math.floor(deterministicRoll(sub.id+'|time')*540));
    if(futureSecond>second+20)events.push(makeGoalEvent(side,futureSecond,club,currentLineup({...match,events},side,second),incoming,'impact-'+sub.id,()=>deterministicRoll(sub.id+'|assist'),{substitutionImpact:true,assistNarrative:'O jogador descansado mudou o ritmo da partida.'}));
  }
  match=recalcScore({...match,events,substitutions:[...substitutions,sub]});
  matches[index]=match;
  return{career:{...career,pendingRound:{...career.pendingRound,matches}},error:null,substitution:sub,impactChance:Number(impactChance.toFixed(3))};
}
export function finishPendingRound(career,clubs){
  if(!career.pendingRound)return career;
  let prepared=autoResolveOutstandingUserPenalties(career,clubs);
  const roundNumber=prepared.pendingRound.roundNumber,roundResults=prepared.pendingRound.matches.map(recalcScore);
  let scorers={...prepared.scorers},allTime={...prepared.allTimeScorers};
  for(const result of roundResults){scorers=addScorers(scorers,result);allTime=addScorers(allTime,result);}
  const userResult=roundResults.find(r=>r.homeId===prepared.userClubId||r.awayId===prepared.userClubId),entry=userResult?historyEntry(userResult,prepared.userClubId):null,userClub=clubs.find(c=>c.id===prepared.userClubId);
  const seasonPerformance=userResult&&userClub?addSeasonPerformance(prepared.seasonPerformance,userClub,userResult,prepared.userClubId):(prepared.seasonPerformance||{});
  let next={...prepared,round:roundNumber,results:[...prepared.results,...roundResults.map(compactStoredResult)],scorers,allTimeScorers:allTime,seasonPerformance,history:entry?[...(prepared.history||[]),entry]:(prepared.history||[]),lastRoundResults:roundResults,lastUserMatch:userResult||prepared.lastUserMatch,pendingRound:null};
  next=applyDisciplineAndInjuries(next,roundResults,roundNumber);next=updateConditions(next,roundResults,clubs);
  if(userClub)next={...next,lineup:sanitizeLineup(userClub,next,roundNumber+1,next.lineup)};
  if(userResult){next=applySponsorPayments(next,roundNumber,userOutcome(userResult,prepared.userClubId));next=applyMatchdayIncome(next,userResult);} next=applyTransferPayroll(next,clubs,roundNumber);
  if(userResult&&userClub){
    const matchEvent={type:'MATCH_FINISHED',importance:2,payload:{competition:'Brasileirão Série A',stage:'Rodada '+roundNumber,homeId:userResult.homeId,awayId:userResult.awayId,homeGoals:userResult.homeGoals,awayGoals:userResult.awayGoals,xg:userResult.xg||null}};
    next=dispatchCareerEvent(next,matchEvent,[
      state=>applyRoundConfidence(state,clubs,userResult,roundNumber),
      state=>applyMatchDynamics(state,userClub,clubs,userResult,{competition:'Brasileirão Série A',stage:'Rodada '+roundNumber}),
      state=>processPlayerPromises(state,userClub,userResult),
      state=>applyWeeklyTraining(state,userClub),
      state=>refreshJobOffers(state,clubs),
    ]);
    for(const injury of(userResult.events||[]).filter(event=>event.type==='injury'&&String(event.clubId)===String(next.userClubId)))next=emitCareerEvent(next,{type:'PLAYER_INJURED',playerId:injury.playerId,importance:Number(injury.injurySeverity||1)>=4?4:2,payload:{name:injury.player,label:injury.injuryLabel,duration:injury.severityMatches,severity:injury.injurySeverity||1}});
  }else next=applyRoundConfidence(next,clubs,userResult,roundNumber);
  next=advanceWorldManagers(next,clubs);
  next=syncWorldToDate(next,clubs,brasileiraoDateForRound(roundNumber,next.season));
  if(roundNumber===prepared.schedule.length)next=finalizeSeason(next,clubs);
  return next;
}
export function simulateRound(career,clubs){
  let prepared=career.pendingWorldMatch?finishPendingWorldFixture(career,clubs):career,guard=0;
  const targetDate=brasileiraoDateForRound(Math.min(38,prepared.round+1),prepared.season);
  while(guard++<40){
    const event=nextCareerEvent(prepared,clubs);
    if(!event||event.type!=='world'||event.date>targetDate)break;
    const advanced=playNextWorldFixture(prepared,clubs);if(advanced===prepared)break;prepared=advanced;
  }
  const started=startRound(prepared,clubs,'instant');if(started===prepared)return prepared;
  let next=finishPendingRound(started,clubs);
  if(next.round>=38){
    guard=0;
    while(pendingSeasonFixtures(next,clubs).length&&guard++<40){
      const advanced=playNextWorldFixture(next,clubs);if(advanced===next)break;next=advanced;
    }
  }
  return next;
}
export function startNextSeason(career,clubs){
  if(career.pendingRound||career.pendingWorldMatch||career.round<career.schedule.length)return career;
  if(pendingSeasonFixtures(career,clubs).length)return career;
  const challenge=challengeSeasonResult(career,career.seasonReview),withChallenge=challenge?emitCareerEvent({...career,challengeHistory:[{...challenge,season:career.season},...(career.challengeHistory||[])].slice(0,30)},{type:challenge.success?'CHALLENGE_COMPLETED':'CHALLENGE_MISSED',importance:challenge.success?4:3,payload:{challenge:career.careerChallenge,label:challenge.label,score:challenge.score}}):career,newSeason=career.season+1,currentClub=clubs.find(c=>String(c.id)===String(career.userClubId)),contracted=currentClub?expirePlayerContracts(withChallenge,currentClub,newSeason):withChallenge,evaluated=evaluateProjectObjectives(contracted,career.seasonReview),developed=advancePlayerLifecycle(evaluated,clubs,newSeason),userClub=clubs.find(c=>c.id===career.userClubId);
  const transitioned=userClub?applySeasonDynamics({...developed,season:newSeason},userClub,career.seasonReview):{...developed,season:newSeason};
  const cleanStatus={};for(const[key,value]of Object.entries(transitioned.playerStatus||{}))cleanStatus[key]={...value,yellowCount:0,suspensionThroughRound:0,injuryThroughRound:Math.max(0,Number(value.injuryThroughRound||0)-38),injuryLabel:Number(value.injuryThroughRound||0)>38?value.injuryLabel:null};
  let next={...transitioned,round:0,schedule:buildSchedule(clubs),results:[],scorers:{},seasonPerformance:{},lastRoundResults:[],lastUserMatch:null,pendingRound:null,pendingWorldMatch:null,playerStatus:cleanStatus,conditions:defaultConditions(clubs),sponsors:(transitioned.sponsors||[]).map(contract=>({...contract,active:false})),openingCash:transitioned.cash,seasonReview:null,pendingCelebration:null,pendingCinematic:null,boardPressureStreak:0,boardWarning:null,managerStatus:'active',dismissal:null};
  next.world=rollWorldToNextSeason(transitioned,clubs,newSeason);
  return userClub?{...next,lineup:autoLineup(userClub,next,1)}:next;
}
export function addWorldTitle(career,clubName){
  const count=(career.trophies||[]).filter(t=>t.id==='world').length+1;let next={...career,trophies:[...(career.trophies||[]),{id:'world',season:career.season,earnedAtRound:career.round}]};
  const message=worldRecordMessage(clubName,count);if(message&&!(next.messages||[]).some(item=>item.id===message.id))next={...next,messages:[message,...(next.messages||[])]};return next;
}
export function pendingUserDecision(career,second){
  const match=career.pendingRound?.matches?.find(m=>m.homeId===career.userClubId||m.awayId===career.userClubId);
  if(!match)return null;
  const penalty=(match.events||[]).find(e=>e.type==='penalty'&&e.requiresDecision&&!e.resolved&&e.second<=second);
  if(penalty)return{type:'penalty',event:penalty,match};
  const injury=(match.events||[]).find(e=>e.type==='injury'&&e.requiresAttention&&e.second<=second);
  return injury?{type:'injury',event:injury,match}:null;
}
