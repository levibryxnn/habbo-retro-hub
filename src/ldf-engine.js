export const LDF_ENGINE_VERSION='1.1';
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
export function fatigueLoad({minutes=90,intensity=1,roleLoad:load=1,fitnessPenalty:fitness=1,tacticalFatigue=1}={}){
  return Math.max(0,finite(minutes,0))*clamp(.65,1.5,finite(intensity,1))*clamp(.65,1.35,finite(load,1))*clamp(.75,1.6,finite(fitness,1))*clamp(.72,1.48,finite(tacticalFatigue,1));
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
  injuryHistory=0,
}={}){
  const fatigueFactor=clamp(.78,1.75,.88+finite(fatigue,90)/135);
  const intensityFactor=clamp(.8,1.5,finite(intensity,1));
  const conditionFactor=clamp(.82,1.9,1+Math.max(0,82-finite(condition,100))*.024);
  const ageFactor=clamp(.9,1.45,1+Math.max(0,finite(age,27)-29)*.024);
  const medicalFactor=clamp(.70,1,1-(clamp(1,5,finite(medicalLevel,1))-1)*.065);
  const historyFactor=clamp(1,1.55,1+Math.max(0,finite(injuryHistory,0))*.07);
  const risk=finite(baseRisk,.012)*fatigueFactor*intensityFactor*conditionFactor*ageFactor*historyFactor*clamp(.75,1.45,finite(weatherMultiplier,1))*clamp(.8,1.35,finite(pitchMultiplier,1))*clamp(.72,1.48,finite(trainingMultiplier,1))*medicalFactor;
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
  minutesFactor=.45,
  trainingQuality=1,
  coachDevelopmentModifier=1,
  positionGroup='',
  injuryHistory=0,
}={}){
  const nextAge=finite(age,24)+1,gap=Math.max(0,finite(potential,75)-finite(current,65)),keeper=String(positionGroup).toUpperCase()==='GOL';
  const declineStart=keeper?39:35;
  if(nextAge>=declineStart+1){
    const years=nextAge-declineStart,physical=keeper?.65:1,injury=Math.min(.9,Math.max(0,finite(injuryHistory,0))*.08);
    const decline=clamp(1,4,Math.round((years>=7?3:years>=4?2:1)*physical+injury));
    return{mode:'decline',chance:1,maxGain:0,decline,ageFactor:0,gap};
  }
  const ageFactor=keeper?(nextAge<=22?1.1:nextAge<=29?.95:nextAge<=35?.62:.32):(nextAge<=20?1.35:nextAge<=24?1.05:nextAge<=28?.78:nextAge<=34?.34:.15);
  const environment=clamp(.65,1.35,finite(trainingQuality,1)*finite(coachDevelopmentModifier,1));
  const minutes=clamp(0,1,finite(minutesFactor,.45));
  const chance=clamp(.04,.94,.12+gap*.029+ageFactor*.18+finite(performanceBoost,0)*.12+finite(trainingYouth,0)*1.25+minutes*.16+(environment-1)*.24);
  const maxGain=nextAge<=21?3:nextAge<=28?2:1;
  return{mode:'growth',chance,maxGain,decline:0,ageFactor,gap,minutesFactor:minutes,environment};
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


export function hashSeed(...parts){
  let h=2166136261;
  for(const ch of parts.map(part=>String(part??'')).join('|')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
export function mulberry32(seed){
  let a=(Number(seed)>>>0)||0x6D2B79F5;
  return function(){
    a=(a+0x6D2B79F5)>>>0;
    let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
    return((t^(t>>>14))>>>0)/4294967296;
  };
}
export function seededRandom(...parts){return mulberry32(hashSeed(...parts));}

export function effectiveOverall({
  baseOverall=65,
  condition=100,
  injuryPenalty=0,
  form=0,
  morale=75,
  minute=0,
  fatigue=0,
}={}){
  const cond=clamp(.80,1.02,.78+clamp(35,100,condition)*.0024);
  const injury=clamp(.82,1,1-clamp(0,12,injuryPenalty)*.018);
  const formMod=clamp(.94,1.06,1+clamp(-2,2,form)*.022);
  const moraleMod=clamp(.94,1.05,.955+(clamp(0,100,morale)-50)*.0017);
  const liveFatigue=clamp(.88,1,1-Math.max(0,finite(fatigue,0))*0.00055-Math.max(0,finite(minute,0)-70)*.0007);
  return Number(clamp(25,99,finite(baseOverall,65)*cond*injury*formMod*moraleMod*liveFatigue).toFixed(2));
}

export function injuryRecovery({
  severity=1,
  medicalLevel=1,
  age=27,
  fitness=75,
  rehabQuality=1,
  injuryHistory=0,
}={}){
  const baseMatches={1:1,2:2,3:4,4:8,5:18}[clamp(1,5,Math.round(finite(severity,1)))]||2;
  const medical=1-(clamp(1,5,finite(medicalLevel,1))-1)*.07;
  const ageFactor=clamp(.92,1.34,1+Math.max(0,finite(age,27)-29)*.015);
  const fitnessFactor=clamp(.82,1.18,1+(72-clamp(35,100,finite(fitness,75)))*.006);
  const rehab=clamp(.78,1.12,1/clamp(.85,1.25,finite(rehabQuality,1)));
  const history=clamp(1,1.22,1+Math.max(0,finite(injuryHistory,0))*.025);
  const matches=clamp(1,38,Math.round(baseMatches*medical*ageFactor*fitnessFactor*rehab*history));
  const permanentLossRisk=clamp(0,.18,(Math.max(0,finite(severity,1)-3)*.035)+(Math.max(0,finite(age,27)-31)*.004)+(Math.max(0,finite(injuryHistory,0)-2)*.008));
  return{matches,permanentLossRisk};
}

export function formRegression(oldForm=0,recentPerformance=0){
  return clamp(-3,3,finite(oldForm,0)*.75+finite(recentPerformance,0)*.25);
}

export function scoutedPotentialRange(truePotential,{scoutingLevel=1,observations=0,seed=0}={}){
  const exact=clamp(40,99,finite(truePotential,70)),level=clamp(1,5,finite(scoutingLevel,1)),views=Math.max(0,finite(observations,0));
  const certainty=clamp(30,100,34+level*10+views*14);
  if(certainty>=94)return{min:Math.round(exact),max:Math.round(exact),certainty:100,exact:true};
  const spread=clamp(1,9,8-level-Math.floor(views*.8));
  const rng=mulberry32(hashSeed(seed,'potential',truePotential,level,views)),drift=Math.round((rng()-.5)*spread*.8);
  return{min:Math.round(clamp(35,99,exact-spread+drift)),max:Math.round(clamp(35,99,exact+spread+drift)),certainty:Math.round(certainty),exact:false};
}

export function transferAcceptanceProbability({
  clubReputation=50,
  salaryIncrease=0,
  playingTime=50,
  competitionPrestige=50,
  managerReputation=50,
  careerStep=0,
  loyalty=50,
  rivalry=0,
  adaptationRisk=0,
}={}){
  const x=(finite(clubReputation)-50)*.035+finite(salaryIncrease)*1.25+(finite(playingTime)-50)*.022+(finite(competitionPrestige)-50)*.018+(finite(managerReputation)-50)*.016+finite(careerStep)*.035-(finite(loyalty)-50)*.018-finite(rivalry)*.65-finite(adaptationRisk)*.55;
  return clamp(.04,.96,1/(1+Math.exp(-x)));
}

export function salaryDemand({
  baseSalary=35000,
  quality=70,
  marketValue=10000000,
  reputation=50,
  contractYearsLeft=2,
  agentDemand=1,
  clubWealth=1,
}={}){
  const qualityFactor=clamp(.72,1.75,.72+Math.max(0,finite(quality,70)-55)*.025);
  const marketFactor=clamp(.78,1.55,.82+Math.log10(Math.max(1_000_000,finite(marketValue,10_000_000))/1_000_000)*.16);
  const reputationFactor=clamp(.86,1.28,.9+finite(reputation,50)/500);
  const contractFactor=clamp(.9,1.24,1.16-Math.min(4,finite(contractYearsLeft,2))*.06);
  const demand=finite(baseSalary,35000)*qualityFactor*marketFactor*reputationFactor*contractFactor*clamp(.82,1.28,finite(agentDemand,1))*clamp(.82,1.25,finite(clubWealth,1));
  return Math.max(5000,Math.round(demand/1000)*1000);
}

export function boardTrustScore({
  results=70,
  objectives=70,
  finance=70,
  transfers=70,
  youth=70,
  clubDNA=70,
  president='balanced',
}={}){
  const weights=president==='ambitious'?{results:.40,objectives:.20,finance:.10,transfers:.10,youth:.07,clubDNA:.13}
    :president==='prudent'?{results:.22,objectives:.20,finance:.30,transfers:.12,youth:.08,clubDNA:.08}
    :president==='developer'?{results:.22,objectives:.20,finance:.13,transfers:.10,youth:.27,clubDNA:.08}
    :{results:.30,objectives:.22,finance:.18,transfers:.12,youth:.10,clubDNA:.08};
  return Number(clamp(0,100,Object.entries(weights).reduce((sum,[key,w])=>sum+clamp(0,100,finite({results,objectives,finance,transfers,youth,clubDNA}[key],70))*w,0)).toFixed(1));
}

export function newsworthiness({importance=1,surprise=0,rivalry=0,streak=0,playerImpact=0,historicalContext=0}={}){
  return Number((finite(importance,1)*1.5+finite(surprise,0)*3+finite(rivalry,0)*.035+finite(streak,0)*.4+finite(playerImpact,0)*.7+finite(historicalContext,0)*1.2).toFixed(2));
}

export function rivalryScore({historicBase=0,matches=0,knockouts=0,finals=0,titleBattles=0,controversies=0,derbyFactor=0}={}){
  return clamp(0,100,finite(historicBase,0)+finite(matches,0)*1.4+finite(knockouts,0)*4+finite(finals,0)*8+finite(titleBattles,0)*5+finite(controversies,0)*3+finite(derbyFactor,0)*12);
}

export function careerDifficultyScore({squadGap=0,budgetGap=0,boardPressure=0,competitionLevel=0,scheduleDensity=0,clubExpectation=0}={}){
  return clamp(1,100,50+finite(squadGap,0)*1.2+finite(budgetGap,0)*.8+finite(boardPressure,0)*.8+finite(competitionLevel,0)*.65+finite(scheduleDensity,0)*.55+finite(clubExpectation,0)*.7);
}

export function achievementValue({
  importance=1,
  expectedDifficulty=1,
  clubStrength=70,
}={}){
  const strength=clamp(35,100,finite(clubStrength,70));
  return Number(clamp(.15,4.5,finite(importance,1)*clamp(.45,2.4,finite(expectedDifficulty,1))*(72/strength)).toFixed(3));
}

export function jobInterestScore({
  managerReputation=50,
  clubTargetLevel=50,
  styleMatch=50,
  recentResults=50,
  availability=100,
  clubAmbition=50,
  salaryCost=50,
  projectMismatch=0,
  careerJump=0,
  variance=0,
}={}){
  const reputationMatch=100-Math.abs(clamp(1,100,finite(managerReputation,50))-clamp(1,100,finite(clubTargetLevel,50)))*1.15;
  const score=
    reputationMatch*.28+
    clamp(0,100,finite(styleMatch,50))*.14+
    clamp(0,100,finite(recentResults,50))*.17+
    clamp(0,100,finite(availability,100))*.08+
    clamp(0,100,finite(clubAmbition,50))*.14-
    clamp(0,100,finite(salaryCost,50))*.07-
    clamp(0,100,finite(projectMismatch,0))*.08-
    clamp(0,100,finite(careerJump,0))*.08+
    clamp(-12,12,finite(variance,0));
  return Number(clamp(0,100,score).toFixed(2));
}
