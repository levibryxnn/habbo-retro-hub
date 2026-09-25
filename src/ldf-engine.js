export const LDF_ENGINE_VERSION='1.0';
export const TEAM_STRENGTH_WEIGHTS=Object.freeze({
  quality:.38,
  form:.15,
  morale:.10,
  tactics:.12,
  condition:.08,
  coach:.07,
  home:.05,
  context:.05,
});

export const clamp=(min,max,value)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=(value,fallback=50)=>Number.isFinite(Number(value))?Number(value):fallback;

export function teamStrength(input={}){
  const values={
    quality:clamp(0,100,finite(input.quality)),
    form:clamp(0,100,finite(input.form)),
    morale:clamp(0,100,finite(input.morale,75)),
    tactics:clamp(0,100,finite(input.tactics)),
    condition:clamp(0,100,finite(input.condition,100)),
    coach:clamp(0,100,finite(input.coach,65)),
    home:clamp(0,100,finite(input.home)),
    context:clamp(0,100,finite(input.context)),
  };
  const score=Object.entries(TEAM_STRENGTH_WEIGHTS).reduce((sum,[key,weight])=>sum+values[key]*weight,0);
  return Number(clamp(0,100,score).toFixed(3));
}

export function logisticDominance(homeStrength,awayStrength,k=8.5){
  const scale=Math.max(1,finite(k,8.5));
  const difference=finite(homeStrength)-finite(awayStrength);
  return clamp(.03,.97,1/(1+Math.exp(-difference/scale)));
}

export function formScore(form){
  return clamp(20,85,50+finite(form,0)*10);
}

export function tacticalExecutionScore(matchup={}){
  const attack=finite(matchup.attackBoost,0),defense=finite(matchup.defenseBoost,0),possession=finite(matchup.possession,0),counterRisk=finite(matchup.counterRisk,0),tempo=finite(matchup.tempo,1);
  return clamp(18,92,50+attack*72+defense*66+possession*.65-counterRisk*34+(tempo-1)*22);
}

export function contextScore(weather={},options={}){
  const passing=finite(weather?.passing,0),tempo=finite(weather?.tempo,0),variance=finite(weather?.variance,0),importance=clamp(.7,1.4,finite(options.importance,1)),pressure=clamp(-15,15,finite(options.pressure,0));
  const pitch=String(weather?.pitch||'');
  const pitchAdjustment=/pesado/i.test(pitch)?-4:/irregular/i.test(pitch)?-5:/rápido/i.test(pitch)?2:0;
  return clamp(20,85,50+passing*160+tempo*90-variance*25+pitchAdjustment+(importance-1)*7-pressure);
}

export function expectedGoals({
  dominance=.5,
  base=1.15,
  attackVsDefense=0,
  tacticalEdge=0,
  setPiece=0,
  weatherPassing=0,
  tempoEdge=0,
  min=.18,
  max=3.9,
}={}){
  const lambda=finite(base,1.15)+(clamp(.03,.97,dominance)-.5)*2.15+finite(attackVsDefense,0)*.035+finite(tacticalEdge,0)*.70+finite(setPiece,0)+finite(weatherPassing,0)*.35+finite(tempoEdge,0)*.12;
  return clamp(min,max,lambda);
}

export function roleLoad(positionGroup){
  const group=String(positionGroup||'').toUpperCase();
  if(group==='GOL')return .72;
  if(group==='DEF')return .96;
  if(group==='MEI')return 1.08;
  if(group==='ATA')return 1.03;
  return 1;
}

export function fitnessPenalty({stamina=72,condition=100,age=27}={}){
  const staminaPenalty=Math.max(0,72-finite(stamina,72))*.006;
  const conditionPenalty=Math.max(0,82-finite(condition,100))*.009;
  const agePenalty=Math.max(0,finite(age,27)-30)*.009;
  return clamp(.86,1.48,1+staminaPenalty+conditionPenalty+agePenalty);
}

// Fórmula-base da LDF Engine: Minutes × Intensity × RoleLoad × FitnessPenalty.
export function fatigueLoad({minutes=90,intensity=1,roleLoad:load=1,fitnessPenalty:fitness=1}={}){
  return Math.max(0,finite(minutes,0))*clamp(.65,1.5,finite(intensity,1))*clamp(.65,1.35,finite(load,1))*clamp(.75,1.6,finite(fitness,1));
}

export function fatigueConditionLoss(load){
  return clamp(0,29,Math.round(finite(load,0)/7));
}

export function individualInjuryRisk({
  baseRisk=.012,
  fatigue=90,
  intensity=1,
  condition=100,
  age=27,
  weatherMultiplier=1,
  pitchMultiplier=1,
  trainingMultiplier=1,
  medicalLevel=1,
}={}){
  const fatigueFactor=clamp(.78,1.75,.88+finite(fatigue,90)/135);
  const intensityFactor=clamp(.8,1.5,finite(intensity,1));
  const conditionFactor=clamp(.82,1.9,1+Math.max(0,82-finite(condition,100))*.024);
  const ageFactor=clamp(.9,1.45,1+Math.max(0,finite(age,27)-29)*.024);
  const medicalFactor=clamp(.70,1,1-(clamp(1,5,finite(medicalLevel,1))-1)*.065);
  const risk=finite(baseRisk,.012)*fatigueFactor*intensityFactor*conditionFactor*ageFactor*clamp(.75,1.45,finite(weatherMultiplier,1))*clamp(.8,1.35,finite(pitchMultiplier,1))*clamp(.72,1.45,finite(trainingMultiplier,1))*medicalFactor;
  return clamp(.002,.12,risk);
}

export function combinedInjuryChance(risks=[]){
  const survival=(risks||[]).reduce((value,risk)=>value*(1-clamp(0,.5,finite(risk,0))),1);
  return clamp(0,.58,1-survival);
}

export function developmentModel({
  age=24,
  current=65,
  potential=75,
  performanceBoost=0,
  trainingYouth=0,
}={}){
  const nextAge=finite(age,24)+1,gap=Math.max(0,finite(potential,75)-finite(current,65));
  if(nextAge>=36){
    const decline=nextAge>=42?3:nextAge>=38?2:1;
    return{mode:'decline',chance:1,maxGain:0,decline};
  }
  const ageFactor=nextAge<=20?1.35:nextAge<=24?1.05:nextAge<=29?.70:nextAge<=32?.45:.24;
  const chance=clamp(.06,.94,.22+gap*.034+ageFactor*.20+finite(performanceBoost,0)*.13+finite(trainingYouth,0)*1.4);
  const maxGain=nextAge<=21?3:nextAge<=27?2:1;
  return{mode:'growth',chance,maxGain,decline:0,ageFactor,gap};
}

export function adaptiveAiDecision({scoreDiff=0,minute=60,condition=78,basePlan='balanced'}={}){
  const diff=finite(scoreDiff,0),m=finite(minute,60),fitness=finite(condition,78);
  if(m<48)return{id:basePlan,aggression:0,reason:'plano inicial'};
  if(diff<=-2)return{id:'all-in',aggression:.92,reason:'busca reação imediata'};
  if(diff===-1&&m>=67)return{id:'all-in',aggression:.78,reason:'pressão pelo empate'};
  if(diff===-1)return{id:fitness<67?'vertical':'pressing',aggression:.58,reason:'aumenta o risco'};
  if(diff>=2)return{id:'compact',aggression:-.68,reason:'protege a vantagem'};
  if(diff===1&&m>=70)return{id:'compact',aggression:-.48,reason:'fecha espaços'};
  if(fitness<66)return{id:'control',aggression:-.18,reason:'administra energia'};
  return{id:basePlan,aggression:0,reason:'mantém o plano'};
}
