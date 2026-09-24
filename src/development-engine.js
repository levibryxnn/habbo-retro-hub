import { playerGameStats } from './player-engine.js';

const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const roll=seed=>(hashString(seed)%1000000)/1000000;
const FIRST=['Arthur','Bernardo','Caio','Davi','Enzo','Gabriel','Guilherme','Heitor','João','Lucas','Matheus','Miguel','Pedro','Rafael','Samuel','Theo','Vinícius','Yuri','Nicolas','Bruno','Felipe','Gustavo','Henrique','Luan','Murilo'];
const LAST=['Almeida','Barbosa','Cardoso','Costa','Dias','Ferreira','Gomes','Lima','Martins','Melo','Moreira','Nunes','Oliveira','Pereira','Ribeiro','Rocha','Santos','Silva','Souza','Teixeira','Vieira','Moura','Freitas','Azevedo','Monteiro'];
function randomName(seed){return FIRST[hashString(seed+'|f')%FIRST.length]+' '+LAST[hashString(seed+'|l')%LAST.length];}
function cleanForBase(player){const copy={...player};delete copy._overallDelta;delete copy._generatedOverall;delete copy._potential;delete copy._careerAge;return copy;}
function baseOverall(player){return player._generatedOverall??playerGameStats(cleanForBase(player)).overall;}
function developmentKey(club,player){return String(player._playerKey||club.id+':'+player.id);}
function initialProfile(club,player,season){
  const base=baseOverall(player),age=Number(player._careerAge??player.age??24),seed=developmentKey(club,player);
  const potential=clamp(base,94,Math.round(base+4+roll(seed+'|potential')*Math.max(5,22-Math.max(0,age-18)*.65)));
  return{age,baseAge:Number(player._baseAge??player.age??age),baseOverall:base,delta:Number(player._overallDelta)||0,potential,generation:Number(player._generation)||0,rootName:player._rootName||player.name,position:player.position,createdSeason:season};
}
function performanceBoost(career,key){
  const perf=career.seasonPerformance?.[String(key)]||career.seasonPerformance?.[String(key).split(':').pop()];
  if(!perf?.appearances)return 0;
  const avg=perf.totalRating/perf.appearances;
  if(avg>=7.5)return .9;
  if(avg>=7.0)return .45;
  if(avg<6.1)return-.4;
  return 0;
}
function nextDelta(profile,key,season,boost){
  const age=profile.age+1,current=profile.baseOverall+profile.delta,potential=profile.potential;
  if(age<=35){
    const gap=Math.max(0,potential-current);
    if(!gap)return profile.delta;
    const ageFactor=age<=20?1.35:age<=24?1.05:age<=29?.7:age<=32?.45:.24;
    const chance=clamp(.08,.92,.24+gap*.035+ageFactor*.2+boost*.13);
    if(roll(key+'|grow|'+season)>chance)return profile.delta;
    const gain=age<=21?1+Math.floor(roll(key+'|gain|'+season)*3):age<=27?1+Math.floor(roll(key+'|gain|'+season)*2):1;
    return profile.delta+Math.min(gain,gap);
  }
  const decline=age>=42?2+Math.floor(roll(key+'|decline|'+season)*3):age>=38?1+Math.floor(roll(key+'|decline|'+season)*3):1+Math.floor(roll(key+'|decline|'+season)*2);
  return profile.delta-decline;
}
function regenFor(player,club,profile,season,index){
  const firstSuccessor=Number(profile.generation||0)===0;
  const seed=developmentKey(club,player)+'|regen|'+season+'|'+index;
  const name=firstSuccessor?String(profile.rootName||player.name).replace(/\s+Jr\.?$/i,'')+' Jr':randomName(seed);
  const generatedOverall=firstSuccessor
    ?clamp(48,66,Math.round(50+roll(seed+'|ovr')*10+(profile.potential-75)*.16))
    :48+Math.floor(roll(seed+'|ovr')*15);
  const potential=firstSuccessor
    ?clamp(generatedOverall+5,94,Math.round(generatedOverall+10+roll(seed+'|pot')*18+(profile.potential-78)*.18))
    :clamp(generatedOverall+4,93,Math.round(generatedOverall+8+roll(seed+'|pot')*25));
  const id='regen-'+hashString(seed).toString(36);
  return{id,name,number:null,birthDate:null,age:16,nationality:'Brazil',countryCode:'BRA',position:player.position,heightCm:player.heightCm||null,_generatedOverall:generatedOverall,_potential:potential,_generation:firstSuccessor?1:2,_rootName:firstSuccessor?(profile.rootName||player.name):name,_careerAge:16,_baseAge:16,_originClubId:String(club.id),_playerKey:String(club.id)+':'+id};
}
export function applyDevelopmentProfile(player,key,career){
  const profile=career?.playerDevelopment?.[String(key)];
  if(!profile)return player;
  return{...player,age:profile.age,_careerAge:profile.age,_baseAge:profile.baseAge,_overallDelta:profile.delta,_potential:profile.potential,_generation:profile.generation,_rootName:profile.rootName};
}
export function advancePlayerLifecycle(career,clubs,newSeason){
  const development={...(career.playerDevelopment||{})},retired={...(career.retiredPlayers||{})},regens=[...(career.regens||[])],pending=[];
  const seen=new Set();
  for(const club of clubs){
    for(const player of club.players||[]){
      const key=developmentKey(club,player);if(seen.has(key)||retired[key])continue;seen.add(key);
      const profile={...initialProfile(club,player,career.season),...(development[key]||{})};
      const nextAge=profile.age+1;
      if(nextAge>=45){
        retired[key]={season:newSeason-1,clubId:String(club.id),name:player.name,generation:profile.generation};
        delete development[key];
        const successor=regenFor(player,club,profile,newSeason,regens.length);regens.push(successor);
        development[successor._playerKey]={age:16,baseAge:16,baseOverall:successor._generatedOverall,delta:0,potential:successor._potential,generation:successor._generation,rootName:successor._rootName,position:successor.position,createdSeason:newSeason};
        if(String(club.id)===String(career.userClubId))pending.push({id:'retire-'+key+'-'+newSeason,player:key,name:player.name,age:nextAge,clubId:String(club.id),successorName:successor.name,successorOverall:successor._generatedOverall,successorPotential:successor._potential});
        continue;
      }
      const boost=performanceBoost(career,key),delta=nextDelta(profile,key,newSeason,boost);
      development[key]={...profile,age:nextAge,delta,potential:profile.potential};
    }
  }
  const activeRegens=regens.filter(player=>!retired[String(player._playerKey||String(player._originClubId||'')+':'+player.id)]);
  return{...career,playerDevelopment:development,retiredPlayers:retired,regens:activeRegens,pendingRetirements:[...(career.pendingRetirements||[]),...pending].slice(-20)};
}
export function retirementSummary(career){return Array.isArray(career.pendingRetirements)?career.pendingRetirements:[];}
