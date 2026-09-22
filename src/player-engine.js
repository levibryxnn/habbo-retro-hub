import { positionGroup } from './position-labels.js';

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
  const ageMod=ageModifier(player?.age);
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
  return {...fields,overall:clamp(45,90,Math.round(overall))};
}
export function statusKey(clubId,playerId){return String(clubId)+':'+String(playerId);}
export function playerStatus(career,clubId,playerId){
  return career?.playerStatus?.[statusKey(clubId,playerId)]||{yellowCount:0,injuryThroughRound:0,suspensionThroughRound:0};
}
export function playerCondition(career,clubId,playerId){
  const value=career?.conditions?.[statusKey(clubId,playerId)];
  return clamp(35,100,Number.isFinite(value)?value:100);
}
export function playerAvailability(career,clubId,player,roundNumber){
  const status=playerStatus(career,clubId,player.id);
  const reasons=[];
  if((status.injuryThroughRound||0)>=roundNumber)reasons.push(status.injuryLabel||'Lesionado');
  if((status.suspensionThroughRound||0)>=roundNumber)reasons.push('Suspenso');
  return {available:reasons.length===0,reasons,status,condition:playerCondition(career,clubId,player.id)};
}
function roleScore(player,career,clubId){
  const stats=playerGameStats(player);
  const condition=playerCondition(career,clubId,player.id);
  return stats.overall*(.72+condition/100*.28);
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
  const chosen=[];
  function take(group,count){for(const p of group.slice(0,count))if(!chosen.includes(p.id))chosen.push(p.id);}
  take(groups.Goalkeeper,1);take(groups.Defender,4);take(groups.Midfielder,3);take(groups.Forward,3);
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
  const stats=playerGameStats(player);
  const condition=playerCondition(career,clubId,player.id);
  const fatigue=isSubstitute?Math.max(0,(minute-1)*.08):Math.max(0,(minute-55)*.22);
  return stats.overall*(.7+condition/100*.3)-fatigue;
}
