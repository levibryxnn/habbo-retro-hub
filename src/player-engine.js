import { positionGroup } from './position-labels.js';
import { fatigueLoad, fitnessPenalty, roleLoad } from './ldf-engine.js';

function hashString(value){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function seeded(id,salt,min,max){
  const h=hashString(String(id)+'|'+salt);
  return min+(h%(max-min+1));
}
const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const playerStatsCache=new Map();
function ageModifier(age){
  const value=age??27;
  if(value>=24&&value<=29)return 4;
  if(value>=21&&value<=32)return 2;
  if(value<=19)return -3;
  if(value>=35)return -4;
  return 0;
}
export function playerGameStats(player){
  const pos=positionGroup(player?.position);
  const id=player?.id||player?.name||'player';
  const careerAge=player?._careerAge??player?.age,baseAge=player?._baseAge??player?.age;
  const delta=Number(player?._overallDelta||0),generated=Number.isFinite(Number(player?._generatedOverall))?Number(player._generatedOverall):null;
  const cacheKey=String(id)+'|'+String(player?.position||'')+'|'+String(baseAge??'')+'|'+String(careerAge??'')+'|'+String(delta)+'|'+String(generated??'');
  const cached=playerStatsCache.get(cacheKey);if(cached)return cached;
  const ageMod=ageModifier(baseAge);
  let shooting=seeded(id,'shot',55,72);
  let passing=seeded(id,'pass',58,74);
  let defending=seeded(id,'def',50,70);
  let goalkeeping=seeded(id,'gk',8,22);
  let pace=seeded(id,'pace',61,82);
  let stamina=seeded(id,'stam',64,84);
  let penalties=seeded(id,'pen',58,79);
  let composure=seeded(id,'comp',60,82);
  if(pos==='GOL'){
    goalkeeping=seeded(id,'gk',68,86)+Math.round(ageMod*.5);
    defending=seeded(id,'def',28,45);
    shooting=seeded(id,'shot',20,39);
    passing=seeded(id,'pass',52,74);
    penalties=seeded(id,'pen',38,62);
  }else if(pos==='DEF'){
    defending+=10+ageMod;
    shooting-=8;
    passing+=Math.round(ageMod*.5);
  }else if(pos==='MEI'){
    passing+=9+ageMod;
    shooting+=2;
    defending+=2;
    penalties+=4;
  }else{
    shooting+=11+ageMod;
    passing+=2;
    defending-=9;
    penalties+=7;
    composure+=3;
  }
  const fields={shooting,passing,defending,goalkeeping,pace,stamina,penalties,composure};
  for(const key of Object.keys(fields))fields[key]=clamp(20,91,Math.round(fields[key]));
  const overall=pos==='GOL'
    ? fields.goalkeeping*.62+fields.passing*.13+fields.composure*.15+fields.stamina*.1
    : pos==='DEF'
      ? fields.defending*.48+fields.passing*.15+fields.pace*.14+fields.stamina*.13+fields.composure*.1
      : pos==='MEI'
        ? fields.passing*.36+fields.composure*.19+fields.stamina*.16+fields.pace*.11+fields.shooting*.11+fields.defending*.07
        : fields.shooting*.38+fields.composure*.2+fields.pace*.17+fields.passing*.1+fields.stamina*.1+fields.penalties*.05;
  const rawOverall=clamp(45,90,Math.round(overall));
  const targetOverall=clamp(42,94,Math.round((generated??rawOverall)+delta)),shift=targetOverall-rawOverall;
  const adjusted={...fields};
  const fieldWeights=pos==='GOL'?{goalkeeping:1,passing:.45,composure:.65,stamina:.45}:{shooting:.72,passing:.72,defending:.72,pace:.48,stamina:.62,penalties:.38,composure:.72};
  for(const [key,weight] of Object.entries(fieldWeights))adjusted[key]=clamp(20,94,Math.round((adjusted[key]??50)+shift*weight));
  const computed=Object.freeze({...adjusted,overall:targetOverall});
  playerStatsCache.set(cacheKey,computed);
  return computed;
}
export function statusKey(clubId,playerId){return String(clubId)+':'+String(playerId);}
export function playerStatus(career,clubId,playerId){
  return career?.playerStatus?.[statusKey(clubId,playerId)]||{yellowCount:0,injuryThroughRound:0,suspensionThroughRound:0};
}
export function playerCondition(career,clubId,playerId){
  const value=career?.conditions?.[statusKey(clubId,playerId)];
  return clamp(35,100,Number.isFinite(value)?value:100);
}
export function injuryOverallPenalty(career,clubId,playerId,roundNumber=(career?.round||0)+1){
  const status=playerStatus(career,clubId,playerId);
  if((status.injuryThroughRound||0)<roundNumber)return 0;
  const remaining=Math.max(1,(status.injuryThroughRound||roundNumber)-roundNumber+1);
  const label=String(status.injuryLabel||'');
  const severity=/importante/i.test(label)?4:/moderada/i.test(label)?3:/leve/i.test(label)?2:1;
  return clamp(1,7,Math.max(severity,remaining+severity-1));
}
export function careerPlayerOverall(player,career,clubId,roundNumber=(career?.round||0)+1){
  return clamp(35,94,playerGameStats(player).overall-injuryOverallPenalty(career,clubId,player.id,roundNumber));
}
export function playerAvailability(career,clubId,player,roundNumber){
  const status=playerStatus(career,clubId,player.id);
  const reasons=[];
  if((status.injuryThroughRound||0)>=roundNumber)reasons.push(status.injuryLabel||'Lesionado');
  if((status.suspensionThroughRound||0)>=roundNumber)reasons.push('Suspenso');
  return {available:reasons.length===0,reasons,status,condition:playerCondition(career,clubId,player.id)};
}
function roleScore(player,career,clubId){
  const overall=careerPlayerOverall(player,career,clubId);
  const condition=playerCondition(career,clubId,player.id);
  return overall*(.72+condition/100*.28);
}
export function autoLineup(club,career,roundNumber){
  const available=(club?.players||[]).filter(function(player){
    return playerAvailability(career,club.id,player,roundNumber).available;
  });
  const sort=function(a,b){return roleScore(b,career,club.id)-roleScore(a,career,club.id);};
  const groups={
    Goalkeeper:available.filter(p=>positionGroup(p.position)==='GOL').sort(sort),
    Defender:available.filter(p=>positionGroup(p.position)==='DEF').sort(sort),
    Midfielder:available.filter(p=>positionGroup(p.position)==='MEI').sort(sort),
    Forward:available.filter(p=>positionGroup(p.position)==='ATA').sort(sort),
  };
  const mean=function(list,count){
    const picked=list.slice(0,count);if(!picked.length)return 0;
    return picked.reduce((sum,p)=>sum+roleScore(p,career,club.id),0)/picked.length;
  };
  const avgCondition=available.length?available.reduce((sum,p)=>sum+playerCondition(career,club.id,p.id),0)/available.length:100;
  const attackStrength=mean(groups.Forward,3),midStrength=mean(groups.Midfielder,4),defStrength=mean(groups.Defender,5);
  let formation={def:4,mid:3,fwd:3,label:'4-3-3'};
  if(groups.Defender.length>=5&&avgCondition<76&&defStrength>=attackStrength-2)formation={def:5,mid:3,fwd:2,label:'5-3-2'};
  else if(groups.Midfielder.length>=4&&midStrength>=attackStrength+1)formation={def:4,mid:4,fwd:2,label:'4-4-2'};
  else if(groups.Defender.length>=3&&groups.Midfielder.length>=4&&groups.Forward.length>=3&&attackStrength>defStrength+3)formation={def:3,mid:4,fwd:3,label:'3-4-3'};
  const chosen=[];
  function take(group,count){for(const p of group.slice(0,count))if(!chosen.includes(p.id))chosen.push(p.id);}
  take(groups.Goalkeeper,1);take(groups.Defender,formation.def);take(groups.Midfielder,formation.mid);take(groups.Forward,formation.fwd);
  const rest=available.slice().sort(sort);
  for(const p of rest){if(chosen.length>=11)break;if(!chosen.includes(p.id))chosen.push(p.id);}
  return chosen.slice(0,11);
}
export function sanitizeLineup(club,career,roundNumber,requested){
  const available=new Set((club?.players||[]).filter(p=>playerAvailability(career,club.id,p,roundNumber).available).map(p=>String(p.id)));
  const requestedIds=(requested||[]).map(String).filter((id,index,array)=>available.has(id)&&array.indexOf(id)===index);
  const auto=autoLineup(club,career,roundNumber).map(String);
  const merged=requestedIds.concat(auto.filter(id=>!requestedIds.includes(id))).slice(0,11);
  return merged;
}
export function lineupValidation(club,career,roundNumber,lineup){
  const ids=sanitizeLineup(club,career,roundNumber,lineup);
  const players=ids.map(id=>club.players.find(p=>String(p.id)===String(id))).filter(Boolean);
  const goalkeeper=players.some(p=>positionGroup(p.position)==='GOL');
  return {valid:ids.length===11&&goalkeeper,lineup:ids,reason:ids.length!==11?'A escalação precisa ter 11 jogadores.':!goalkeeper?'A escalação precisa ter um goleiro.':null};
}
export function matchBench(club,career,roundNumber,lineup,limit=12){
  const starters=new Set((lineup||[]).map(String));
  return (club?.players||[]).filter(p=>!starters.has(String(p.id))&&playerAvailability(career,club.id,p,roundNumber).available)
    .sort((a,b)=>roleScore(b,career,club.id)-roleScore(a,career,club.id)).slice(0,limit).map(p=>String(p.id));
}
export function lineupProfile(club,lineupIds,career){
  const ids=(lineupIds||[]).map(String);
  const players=ids.map(id=>club?.players?.find(p=>String(p.id)===id)).filter(Boolean);
  if(!players.length)return {goalkeeper:50,defense:50,midfield:50,attack:50,overall:50,condition:100};
  const unit=function(list,selector){
    if(!list.length)return 48;
    return list.reduce((sum,p)=>{
      const stats=playerGameStats(p);const condition=playerCondition(career,club.id,p.id);
      return sum+selector(stats)*(.68+condition/100*.32);
    },0)/list.length;
  };
  const keepers=players.filter(p=>positionGroup(p.position)==='GOL');
  const defenders=players.filter(p=>positionGroup(p.position)==='DEF');
  const mids=players.filter(p=>positionGroup(p.position)==='MEI');
  const forwards=players.filter(p=>positionGroup(p.position)==='ATA');
  const goalkeeper=unit(keepers,s=>s.goalkeeping);
  const defense=unit(defenders,s=>s.defending);
  const midfield=unit(mids,s=>s.passing*.62+s.composure*.23+s.stamina*.15);
  const attack=unit(forwards,s=>s.shooting*.58+s.composure*.25+s.pace*.17);
  const condition=players.reduce((sum,p)=>sum+playerCondition(career,club.id,p.id),0)/players.length;
  return {goalkeeper,defense,midfield,attack,overall:(goalkeeper+defense+midfield+attack)/4,condition};
}
export function currentLineup(result,side,second){
  const base=[...(side==='home'?(result?.homeLineup||[]):(result?.awayLineup||[]))].map(String);
  const changes=(result?.substitutions||[]).filter(s=>s.side===side&&s.second<=second).sort((a,b)=>a.second-b.second);
  for(const sub of changes){
    const index=base.indexOf(String(sub.outPlayerId));
    if(index>=0)base[index]=String(sub.inPlayerId);
  }
  const reds=(result?.events||[]).filter(e=>e.type==='red'&&e.side===side&&e.second<=second).map(e=>String(e.playerId));
  return base.filter(id=>!reds.includes(id));
}
export function currentBench(result,side,second){
  const bench=[...(side==='home'?(result?.homeBench||[]):(result?.awayBench||[]))].map(String);
  const changes=(result?.substitutions||[]).filter(s=>s.side===side&&s.second<=second);
  const usedIn=new Set(changes.map(s=>String(s.inPlayerId)));
  return bench.filter(id=>!usedIn.has(id));
}
export function effectivePlayerRating(player,career,clubId,minute,isSubstitute){
  const overall=careerPlayerOverall(player,career,clubId),condition=playerCondition(career,clubId,player.id),stats=playerGameStats(player),age=Number(player?._careerAge??player?.age??27);
  const minutesPlayed=isSubstitute?0:Math.max(0,Number(minute)||0);
  const load=fatigueLoad({minutes:minutesPlayed,intensity:1,roleLoad:roleLoad(positionGroup(player?.position)),fitnessPenalty:fitnessPenalty({stamina:stats.stamina,condition,age})});
  return overall*(.7+condition/100*.3)-load*.035;
}


function playerParticipation(result,side,playerId,second){
  const id=String(playerId),start=(side==='home'?result?.homeLineup:result?.awayLineup)||[];
  const started=start.map(String).includes(id);
  const subs=(result?.substitutions||[]).filter(s=>s.side===side&&s.second<=second);
  const entered=subs.find(s=>String(s.inPlayerId)===id);
  const left=subs.find(s=>String(s.outPlayerId)===id);
  const red=(result?.events||[]).find(e=>e.side===side&&e.type==='red'&&String(e.playerId)===id&&e.second<=second);
  if(!started&&!entered)return 0;
  const from=started?0:entered.second;
  const to=Math.min(second,left?.second??red?.second??second);
  return Math.max(0,to-from);
}

export function matchPlayerPerformances(club,result,side,second){
  if(!club||!result)return[];
  const end=Math.min(Number(second)||0,result.durationSecond||90*60);
  const events=(result.events||[]).filter(e=>e.side===side&&e.second<=end);
  const ids=new Set((side==='home'?(result.homeLineup||[]):(result.awayLineup||[])).map(String));
  for(const sub of result.substitutions||[])if(sub.side===side&&sub.second<=end)ids.add(String(sub.inPlayerId));
  for(const event of events){if(event.playerId)ids.add(String(event.playerId));if(event.assistPlayerId)ids.add(String(event.assistPlayerId));}
  const homeSide=side==='home',gf=homeSide?result.homeGoals:result.awayGoals,ga=homeSide?result.awayGoals:result.homeGoals;
  const finished=end>=(result.durationSecond||90*60),outcome=gf>ga?'win':gf<ga?'loss':'draw';
  const rows=[];
  for(const id of ids){
    const player=club.players.find(p=>String(p.id)===id);if(!player)continue;
    const participation=playerParticipation(result,side,id,end);
    if(participation<=0)continue;
    const group=positionGroup(player.position),stats=playerGameStats(player);
    const own=events.filter(e=>String(e.playerId)===id),assists=events.filter(e=>e.type==='goal'&&String(e.assistPlayerId)===id).length;
    const goals=own.filter(e=>e.type==='goal').length,shots=own.filter(e=>e.type==='shot').length,bigMisses=own.filter(e=>e.type==='big-chance').length;
    const yellows=own.filter(e=>e.type==='yellow').length,reds=own.filter(e=>e.type==='red').length,fouls=own.filter(e=>e.type==='foul').length,penaltyMisses=own.filter(e=>e.type==='penalty-miss').length;
    const impactGoals=own.filter(e=>e.type==='goal'&&e.substitutionImpact).length;
    const goalWeight=group==='GOL'?2.1:group==='DEF'?1.75:group==='MEI'?1.5:1.32;
    const assistWeight=group==='DEF'?.95:group==='MEI'?.88:.72;
    let rating=6.15+(stats.overall-70)*.012;
    rating+=goals*goalWeight+assists*assistWeight+shots*.10-bigMisses*.24-fouls*.07-yellows*.28-reds*1.45-penaltyMisses*.8+impactGoals*.18;
    if(finished)rating+=outcome==='win'?.22:outcome==='draw'?.05:-.14;
    if(finished&&ga===0&&(group==='GOL'||group==='DEF'))rating+=group==='GOL'?.65:.45;
    if(finished&&ga>0&&(group==='GOL'||group==='DEF'))rating-=Math.min(.7,ga*(group==='GOL'?.12:.08));
    const minuteShare=Math.min(1,participation/Math.max(1,end));
    if(minuteShare<.22&&!goals&&!assists)rating-=.18;
    rows.push({
      playerId:id,name:player.name,position:player.position,countryCode:player.countryCode,
      rating:Number(clamp(0,10,rating).toFixed(1)),goals,assists,shots,bigMisses,yellows,reds,fouls,
      minutes:Math.round(participation/60),impactGoals,
    });
  }
  return rows.sort((a,b)=>b.rating-a.rating||b.goals-a.goals||b.assists-a.assists||a.name.localeCompare(b.name,'pt-BR'));
}

export function bestMatchPlayer(club,result,side,second){
  return matchPlayerPerformances(club,result,side,second)[0]||null;
}
