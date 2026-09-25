import { clamp, hashSeed, mulberry32 } from './ldf-engine.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const logistic=(x,scale=8)=>1/(1+Math.exp(-finite(x)/Math.max(1,scale)));

export const POSITION_METRIC_LABELS={
  GOL:{saves:'Defesas',goalsAllowed:'Gols sofridos',claims:'Saídas',penaltiesSaved:'Pênaltis defendidos',errors:'Erros'},
  DEF:{tackles:'Desarmes',interceptions:'Interceptações',duelsWon:'Duelos ganhos',aerialsWon:'Bolas aéreas',errors:'Erros'},
  MEI:{passesCompleted:'Passes certos',progressivePasses:'Passes progressivos',chancesCreated:'Chances criadas',recoveries:'Recuperações',dribbles:'Dribles'},
  ATA:{shots:'Finalizações',xg:'xG individual',dribbles:'Dribles',movements:'Movimentos de ruptura',chancesCreated:'Chances criadas'},
};

export function ageDevelopmentCurve(age,position='MEI',seed=''){
  const a=clamp(16,45,finite(age,20)),keeper=String(position)==='GOL';
  let base;
  if(keeper){
    base=a<=20?1.05:a<=24?1.10:a<=29?.92:a<=34?.68:a<=38?.38:a<=40?.12:-.38;
  }else{
    base=a<=20?1.30:a<=24?1.02:a<=28?.72:a<=31?.22:a<=34?-.18:-.52;
  }
  const rng=mulberry32(hashSeed(seed,'age-curve',position)),individual=.90+rng()*.20;
  return Number((base*individual).toFixed(3));
}

export function playerDevelopmentScore({
  age=20,position='MEI',current=65,potential=78,trainingFactor=1,minutesFactor=.5,
  performance=6.5,morale=72,competitionLevel=65,regularity=.5,injuryHistory=0,seed='',period=0,
}={}){
  const gap=Math.max(0,finite(potential,78)-finite(current,65)),potentialFactor=clamp(.15,1.35,.18+gap/18),ageCurve=ageDevelopmentCurve(age,position,seed);
  const training=clamp(.65,1.35,finite(trainingFactor,1)),minutes=clamp(.12,1.15,.18+finite(minutesFactor,.5)*.92);
  const performanceFactor=clamp(.72,1.28,.86+(finite(performance,6.5)-6)*.14),moraleFactor=clamp(.78,1.18,.84+clamp(0,100,finite(morale,72))/420);
  const competitionFactor=clamp(.82,1.18,.88+clamp(35,100,finite(competitionLevel,65))/600),regularityFactor=clamp(.82,1.16,.88+clamp(0,1,finite(regularity,.5))*.28);
  const injuryFactor=clamp(.70,1,1-Math.max(0,finite(injuryHistory,0))*.025);
  const rng=mulberry32(hashSeed(seed,'development',period)),controlledRandom=.91+rng()*.18;
  const score=potentialFactor*ageCurve*training*minutes*performanceFactor*moraleFactor*competitionFactor*regularityFactor*injuryFactor*controlledRandom;
  return{score:Number(score.toFixed(4)),potentialFactor,ageCurve,trainingFactor:training,minutesFactor:minutes,performanceFactor,moraleFactor,competitionFactor,regularityFactor,injuryFactor,randomFactor:Number(controlledRandom.toFixed(3))};
}

export function starterProbability({
  quality=65,form=0,fitness=90,tacticalCompatibility=70,managerTrust=50,recentPerformance=6.5,
  competition=65,roleCompetition=65,discipline=75,
}={}){
  const score=
    clamp(20,99,finite(quality,65))*.31+
    clamp(20,80,50+finite(form,0)*10)*.13+
    clamp(35,100,finite(fitness,90))*.13+
    clamp(0,100,finite(tacticalCompatibility,70))*.11+
    clamp(0,100,finite(managerTrust,50))*.16+
    clamp(35,100,50+(finite(recentPerformance,6.5)-6.5)*18)*.10+
    clamp(0,100,finite(discipline,75))*.06;
  const threshold=clamp(35,94,finite(competition,65)*.58+finite(roleCompetition,65)*.30+9);
  return{score:Number(score.toFixed(2)),threshold:Number(threshold.toFixed(2)),probability:clamp(.03,.96,logistic(score-threshold,6.2))};
}

export function squadStatus({starterChance=.5,starts=0,matches=0,trust=50,age=20,stage='professional'}={}){
  if(stage==='academy')return'Promessa da base';
  const startRate=finite(matches)>0?finite(starts)/Math.max(1,finite(matches)):0;
  const score=clamp(0,1,finite(starterChance,.5))*.55+clamp(0,1,startRate)*.25+clamp(0,100,finite(trust,50))/100*.20;
  if(score>=.76)return'Titular';
  if(score>=.58)return'Disputa posição';
  if(score>=.38)return'Rotação';
  if(age<=21)return'Desenvolvimento';
  return'Fora dos planos';
}

export function moraleAfterEvent(oldMorale=72,eventTarget=72,weight=.25){
  const alpha=clamp(.08,.36,finite(weight,.25));
  return Number(clamp(0,100,finite(oldMorale,72)*(1-alpha)+clamp(0,100,finite(eventTarget,72))*alpha).toFixed(1));
}

export function playerMarketValue({
  position='MEI',overall=65,potential=78,age=20,form=0,leagueLevel=70,contractYears=2,reputation=30,
}={}){
  const positionFactor={GOL:.78,DEF:.90,MEI:1,ATA:1.08}[String(position)]||1;
  const abilityFactor=Math.pow(clamp(.55,1.72,finite(overall,65)/70),3.65);
  const potentialGap=Math.max(0,finite(potential,78)-finite(overall,65)),potentialFactor=clamp(.72,1.85,.88+potentialGap*.035);
  const a=finite(age,20),ageFactor=a<=20?1.28:a<=23?1.36:a<=27?1.28:a<=30?1.08:a<=33?.80:a<=36?.52:.34;
  const formFactor=clamp(.82,1.24,1+finite(form,0)*.07),leagueFactor=clamp(.72,1.35,.78+clamp(35,100,finite(leagueLevel,70))/190);
  const contractFactor=clamp(.72,1.18,.78+Math.min(5,Math.max(0,finite(contractYears,2)))*.09),reputationFactor=clamp(.78,1.35,.82+clamp(0,100,finite(reputation,30))/190);
  const value=1_650_000*positionFactor*abilityFactor*potentialFactor*ageFactor*formFactor*leagueFactor*contractFactor*reputationFactor;
  return Math.round(clamp(150_000,250_000_000,value)/50_000)*50_000;
}

export function playerTransferInterest({
  playerQuality=65,potential=78,clubLevel=65,clubNeed=60,affordability=70,reputation=30,tacticalFit=70,
  age=22,marketValue=10_000_000,scoutingVariance=0,
}={}){
  const qualityMatch=100-Math.abs(clamp(35,100,finite(playerQuality,65))-clamp(35,100,finite(clubLevel,65)))*1.18;
  const potentialPremium=clamp(0,100,50+(finite(potential,78)-finite(playerQuality,65))*3.2+(24-finite(age,22))*2);
  const pricePressure=clamp(0,100,100-Math.log10(Math.max(1_000_000,finite(marketValue,10_000_000))/1_000_000)*18);
  const score=qualityMatch*.30+potentialPremium*.12+clamp(0,100,finite(clubNeed,60))*.16+clamp(0,100,finite(affordability,70))*.14+clamp(0,100,finite(reputation,30))*.10+clamp(0,100,finite(tacticalFit,70))*.12+pricePressure*.06+clamp(-12,12,finite(scoutingVariance,0));
  return Number(clamp(0,100,score).toFixed(2));
}

function randCount(rng,expected,max=50){
  const base=Math.max(0,finite(expected));return Math.min(max,Math.max(0,Math.round(base+(rng()-.5)*Math.max(1,Math.sqrt(base)*1.5))));
}

export function positionPerformanceMetrics({
  position='MEI',attributes={},minutes=90,teamXg=1.2,opponentXg=1.1,goalsFor=0,goalsAgainst=0,goals=0,assists=0,
  condition=85,opponentDifficulty=65,seed='',
}={}){
  const rng=mulberry32(hashSeed(seed,'role-metrics')),mins=clamp(1,120,finite(minutes,90)),share=mins/90,difficulty=clamp(.72,1.25,.92+(finite(opponentDifficulty,65)-60)/250),a=attributes||{};
  if(position==='GOL'){
    const shotsOnTarget=randCount(rng,(finite(opponentXg,1.1)*3.2+1.2)*share*difficulty,12),goalsAllowed=Math.min(shotsOnTarget,Math.max(0,finite(goalsAgainst))),saves=Math.max(0,shotsOnTarget-goalsAllowed),claims=randCount(rng,(finite(a.goalkeeping,60)/35)*share,7),penaltiesFaced=rng()<.09?1:0,penaltiesSaved=penaltiesFaced&&rng()<clamp(.08,.42,finite(a.goalkeeping,60)/220)?1:0,errors=rng()<clamp(.005,.09,(82-finite(a.goalkeeping,60))*.0025*difficulty)?1:0;
    const rating=clamp(4,10,6.1+saves*.13+(goalsAgainst===0?.48:0)+penaltiesSaved*.8-errors*.9-goalsAllowed*.13);
    return{metrics:{saves,goalsAllowed,claims,penaltiesSaved,errors},rating:Number(rating.toFixed(1))};
  }
  if(position==='DEF'){
    const tackles=randCount(rng,(finite(a.defending,60)/18)*share*difficulty,12),interceptions=randCount(rng,(finite(a.defending,60)/22)*share,10),duelsWon=randCount(rng,(finite(a.physical,60)/16)*share,14),aerialsWon=randCount(rng,(finite(a.physical,60)/25)*share,9),errors=rng()<clamp(.004,.10,(80-finite(a.defending,60))*.0028*difficulty)?1:0;
    const rating=clamp(4,10,6.05+tackles*.045+interceptions*.055+duelsWon*.025+aerialsWon*.035+(goalsAgainst===0?.35:0)+goals*.75+assists*.45-errors*.85);
    return{metrics:{tackles,interceptions,duelsWon,aerialsWon,errors},rating:Number(rating.toFixed(1))};
  }
  if(position==='MEI'){
    const passesCompleted=randCount(rng,(28+finite(a.passing,60)*.42)*share/difficulty,95),progressivePasses=randCount(rng,(finite(a.passing,60)*.095+finite(a.technique,60)*.055)*share,18),chancesCreated=randCount(rng,(finite(a.passing,60)*.028+finite(a.technique,60)*.022)*share,8),recoveries=randCount(rng,(2+finite(a.defending,45)*.055)*share*difficulty,12),dribbles=randCount(rng,(finite(a.technique,60)*.035)*share,8);
    const rating=clamp(4,10,6.0+progressivePasses*.025+chancesCreated*.16+recoveries*.035+dribbles*.05+goals*.85+assists*.62+(passesCompleted>=45?.18:0));
    return{metrics:{passesCompleted,progressivePasses,chancesCreated,recoveries,dribbles},rating:Number(rating.toFixed(1))};
  }
  const shots=randCount(rng,(1.2+finite(a.finishing,60)*.035)*share*difficulty,10),xg=Number(clamp(.02,3.5,finite(teamXg,1.2)*clamp(.08,.55,.14+(finite(a.finishing,60)-50)*.006)*share).toFixed(2)),dribbles=randCount(rng,(finite(a.technique,60)*.04+finite(a.pace,60)*.025)*share,10),movements=randCount(rng,(3+finite(a.pace,60)*.065)*share,14),chancesCreated=randCount(rng,(finite(a.passing,55)*.025)*share,6);
  const rating=clamp(4,10,5.95+goals*1.08+assists*.62+shots*.055+dribbles*.05+movements*.022+chancesCreated*.10-Math.max(0,xg-goals)*.18);
  return{metrics:{shots,xg,dribbles,movements,chancesCreated},rating:Number(rating.toFixed(1))};
}

export function playerSeasonObjectives(career={}){
  const p=career.player||{},position=String(p.position||'MEI'),stage=career.stage,overall=finite(p.currentOverall,65),trust=finite(p.coachTrust,50);
  if(stage==='academy')return[
    {id:'academy-minutes',label:'Ganhar minutos na base',target:600,metric:'minutes'},
    {id:'academy-trust',label:'Confiança do técnico',target:62,metric:'coachTrust'},
  ];
  const baseMatches=overall>=78?24:overall>=70?18:12;
  const role=position==='ATA'?{id:'goals',label:'Gols na temporada',target:Math.max(5,Math.round((overall-55)*.45)),metric:'goals'}:position==='MEI'?{id:'assists',label:'Assistências',target:Math.max(4,Math.round((overall-55)*.28)),metric:'assists'}:{id:'rating',label:'Média de avaliação',target:6.8,metric:'averageRating'};
  return[
    {id:'matches',label:'Participar de partidas',target:baseMatches,metric:'matches'},
    role,
    {id:'trust',label:'Manter confiança do técnico',target:Math.max(55,Math.round(trust)),metric:'coachTrust'},
  ];
}

export function objectiveProgress(career={},objective={}){
  const stats=career.seasonStats||{},p=career.player||{};
  const value=objective.metric==='coachTrust'?finite(p.coachTrust):objective.metric==='averageRating'?(finite(stats.matches)>0?finite(stats.totalRating)/stats.matches:0):finite(stats[objective.metric],0);
  return{...objective,value:Number(value.toFixed?.(2)??value),completed:value>=finite(objective.target,1),progress:clamp(0,1,value/Math.max(.01,finite(objective.target,1)))};
}
