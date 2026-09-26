import { getClubWorld } from './club-world.js';
import { clamp, effectiveOverall, expectedGoals, formRegression, hashSeed, individualInjuryRisk, injuryRecovery, logisticDominance, mulberry32, teamStrength } from './ldf-engine.js';
import { createPlayerFinance, effectivePlayerAttributes, enqueuePlayerMoment, playerLifeBonuses, refreshPlayerSponsorOffers, sanitizePlayerFinance, settlePlayerMonth } from './player-life-engine.js';
import { moraleAfterEvent, objectiveProgress, playerDevelopmentScore, playerMarketValue, playerSeasonObjectives, playerTransferInterest, positionPerformanceMetrics, squadStatus, starterProbability } from './player-career-intelligence.js';
import { buildPlayerMatchTimeline, coachPostMatchReview, ensurePlayerWorld, evolvePositionRivals, maybeChangePlayerCoach, personalityDef, playerAgendaForDay, playerCareerClubPool, playerClubBudgetM, playerClubLevel, playerClubMarket, playerPreMatchBriefing, playerSelectionContext, processPlayerWorldEvent } from './player-world-engine.js';
import { parseSafeJson } from './save-format.js';

export const PLAYER_CAREER_KEY='ldf.playerCareer.v1';
export const PLAYER_CAREER_VERSION=4;
export const PLAYER_POSITIONS=[
  {id:'GOL',label:'Goleiro',base:{finishing:28,passing:54,defending:38,pace:56,physical:64,technique:55,goalkeeping:67}},
  {id:'DEF',label:'Defensor',base:{finishing:46,passing:58,defending:68,pace:64,physical:68,technique:57,goalkeeping:12}},
  {id:'MEI',label:'Meio-campista',base:{finishing:58,passing:69,defending:52,pace:66,physical:61,technique:70,goalkeeping:10}},
  {id:'ATA',label:'Atacante',base:{finishing:69,passing:57,defending:34,pace:71,physical:63,technique:66,goalkeeping:8}},
];
export const PLAYER_ARCHETYPES=[
  {id:'technical',label:'Técnico',description:'Domínio, passe e tomada de decisão.',mods:{technique:5,passing:4,physical:-2}},
  {id:'fast',label:'Veloz',description:'Explosão para atacar espaço.',mods:{pace:6,physical:1,passing:-2}},
  {id:'strong',label:'Físico',description:'Contato, potência e resistência.',mods:{physical:6,pace:1,technique:-2}},
  {id:'creator',label:'Criador',description:'Passe e leitura entre linhas.',mods:{passing:6,technique:3,finishing:-2}},
  {id:'finisher',label:'Finalizador',description:'Movimento e definição perto do gol.',mods:{finishing:7,technique:1,defending:-3}},
];
export const PLAYER_TRAINING=[
  {id:'balanced',label:'Equilibrado',description:'Pequenos ganhos gerais e boa recuperação.',gain:{technique:.12,passing:.12,finishing:.12,defending:.12,pace:.08,physical:.10},condition:5,injury:.92},
  {id:'technique',label:'Técnica',description:'Domínio, passe e bola no pé.',gain:{technique:.32,passing:.20},condition:1,injury:1},
  {id:'finishing',label:'Finalização',description:'Definição, compostura e último toque.',gain:{finishing:.38,technique:.10},condition:0,injury:1.04},
  {id:'physical',label:'Físico',description:'Ritmo e força com carga maior.',gain:{pace:.18,physical:.34},condition:-3,injury:1.16},
  {id:'defending',label:'Defesa',description:'Tempo de bote, posicionamento e duelos.',gain:{defending:.38,physical:.08},condition:1,injury:1.02},
  {id:'recovery',label:'Recuperação',description:'Prioriza condição e reduz risco.',gain:{},condition:11,injury:.70},
];
export const PLAYER_MATCH_APPROACHES=[
  {id:'team',label:'Jogar para o time',description:'Mais confiança do técnico e criação; menos protagonismo individual.',rating:.10,goal:.88,assist:1.18,trust:.55,fatigue:.96,injury:.94},
  {id:'balanced',label:'Equilibrado',description:'Risco e protagonismo em níveis normais.',rating:0,goal:1,assist:1,trust:.10,fatigue:1,injury:1},
  {id:'aggressive',label:'Buscar o protagonismo',description:'Mais gols e impacto, com maior desgaste e risco.',rating:.05,goal:1.24,assist:.92,trust:-.12,fatigue:1.12,injury:1.18},
  {id:'disciplined',label:'Cumprir a função',description:'Menos brilho, mais consistência e confiança do treinador.',rating:.16,goal:.82,assist:.94,trust:.75,fatigue:.92,injury:.88},
];
export const TRIAL_DRILLS=[
  {id:'pace',title:'Arranque de 30 metros',copy:'Escolha como você encara o primeiro teste.',choices:[
    {id:'explode',label:'Explodir desde o primeiro passo',skill:'pace',bonus:6,risk:2},
    {id:'progressive',label:'Acelerar de forma progressiva',skill:'physical',bonus:4,risk:0},
    {id:'technique',label:'Poupar energia para a bola',skill:'technique',bonus:2,risk:-2},
  ]},
  {id:'ball',title:'Circuito com bola',copy:'Condução, domínio e passe sob pressão.',choices:[
    {id:'safe',label:'Jogar simples e sem erro',skill:'passing',bonus:4,risk:-1},
    {id:'show',label:'Arriscar dribles e passes difíceis',skill:'technique',bonus:7,risk:3},
    {id:'fast',label:'Executar tudo em velocidade',skill:'pace',bonus:5,risk:2},
  ]},
  {id:'role',title:'Teste específico da posição',copy:'A comissão quer ver sua principal ferramenta.',choices:[
    {id:'specialist',label:'Confiar na especialidade',skill:'role',bonus:7,risk:1},
    {id:'complete',label:'Mostrar repertório completo',skill:'technique',bonus:5,risk:0},
    {id:'discipline',label:'Fazer exatamente o pedido do treinador',skill:'mentality',bonus:6,risk:-1},
  ]},
  {id:'game',title:'Coletivo curto',copy:'O jogo aperta e você precisa decidir rápido.',choices:[
    {id:'team',label:'Priorizar a melhor jogada para o time',skill:'passing',bonus:6,risk:-1},
    {id:'hero',label:'Tentar resolver sozinho',skill:'role',bonus:8,risk:4},
    {id:'press',label:'Impressionar pela intensidade sem bola',skill:'physical',bonus:5,risk:1},
  ]},
  {id:'pressure',title:'Última bola da peneira',copy:'Todos estão olhando. Uma decisão encerra o teste.',choices:[
    {id:'calm',label:'Respirar e executar o fundamento',skill:'mentality',bonus:7,risk:-1},
    {id:'bold',label:'Tentar uma jogada de impacto',skill:'role',bonus:9,risk:4},
    {id:'assist',label:'Atrair a marcação e servir um companheiro',skill:'passing',bonus:7,risk:0},
  ]},
];

const finite=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
const posDef=id=>PLAYER_POSITIONS.find(x=>x.id===id)||PLAYER_POSITIONS[2];
const archetypeDef=id=>PLAYER_ARCHETYPES.find(x=>x.id===id)||PLAYER_ARCHETYPES[0];
const trainingDef=id=>PLAYER_TRAINING.find(x=>x.id===id)||PLAYER_TRAINING[0];
const approachDef=id=>PLAYER_MATCH_APPROACHES.find(x=>x.id===id)||PLAYER_MATCH_APPROACHES[1];
function safeName(value){return String(value||'Jogador').replace(/[<>]/g,'').trim().slice(0,40)||'Jogador';}
function roleSkill(position,attrs){
  if(position==='GOL')return attrs.goalkeeping*.72+attrs.passing*.12+attrs.physical*.10+attrs.technique*.06;
  if(position==='DEF')return attrs.defending*.52+attrs.physical*.18+attrs.pace*.14+attrs.passing*.10+attrs.technique*.06;
  if(position==='MEI')return attrs.passing*.34+attrs.technique*.31+attrs.physical*.10+attrs.pace*.10+attrs.finishing*.10+attrs.defending*.05;
  return attrs.finishing*.38+attrs.pace*.22+attrs.technique*.18+attrs.physical*.12+attrs.passing*.10;
}
export function playerBaseCareerOverall(state){
  const p=state?.player||state||{},attrs=p.attributes||{};
  return Math.round(clamp(40,97,roleSkill(p.position||'MEI',attrs)));
}
export function playerCareerOverall(state){
  const p=state?.player||state||{},attrs=state?.player?effectivePlayerAttributes(state):(p.attributes||{});
  return Math.round(clamp(40,97,roleSkill(p.position||'MEI',attrs)));
}
function clubLevel(club){return playerClubLevel(club);}
function contractSalary(club,overall,age,score=60){
  const market=playerClubMarket(club),wealth=clamp(.75,2.1,.78+playerClubBudgetM(club)/90),quality=clamp(.65,2.05,.65+Math.max(0,overall-50)*.028),ageFactor=age<=17?.58:age<=20?.76:age>=34?.88:1,trial=clamp(.85,1.22,.85+score/340);
  return Math.max(2500,Math.round(5500*wealth*quality*ageFactor*trial*market.salary/500)*500);
}
export function createPlayerCareer(input={},season=2026){
  const name=safeName(input.name),position=posDef(input.position).id,archetype=archetypeDef(input.archetype),personality=personalityDef(input.personalityId),seed=hashSeed(name,input.birthMonth||6,position,archetype.id,personality.id,season),rng=mulberry32(seed),base=posDef(position).base,attributes={};
  for(const [key,value] of Object.entries(base))attributes[key]=Math.round(clamp(20,85,value+(archetype.mods?.[key]||0)+(rng()-.5)*6));
  const initialOverall=Math.round(roleSkill(position,attributes)),potential=Math.round(clamp(initialOverall+8,94,initialOverall+18+rng()*15));
  const state={
    version:PLAYER_CAREER_VERSION,mode:'player',seed:String(seed),season,week:0,age:16,stage:'trial',clubId:null,dreamClubId:String(input.dreamClubId||''),trial:{answers:{},score:null,completed:false,report:null},player:{
      id:'user-player',name,position,foot:['left','right'].includes(input.foot)?input.foot:'right',archetype:archetype.id,personalityId:personality.id,attributes,potential,currentOverall:initialOverall,marketValue:0,condition:100,morale:78,form:0,coachTrust:42,reputation:5,contractSatisfaction:70,injury:null,injuryHistory:0,
    },
    trainingFocus:'balanced',matchApproach:'balanced',contract:null,pendingContractOffer:null,contractIntent:'open',contractPreference:'open',nationalTeamStatus:'none',awards:[],dayOfSeason:0,dayOfWeek:0,finance:createPlayerFinance(),world:null,worldEventLedger:[],objectiveRewards:[],careerStats:{matches:0,starts:0,minutes:0,goals:0,assists:0,totalRating:0,titles:0},seasonStats:{matches:0,starts:0,minutes:0,goals:0,assists:0,totalRating:0},teamSeason:{matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0},performanceHistory:[],timeline:[{id:'career-created',season,week:0,type:'start',title:'Peneira marcada',text:name+' inicia a carreira aos 16 anos e entra em uma peneira.'}],offers:[],pendingOffer:null,pendingMoment:null,momentQueue:[],careerEvents:[],news:[],lastMatch:null,lastDay:null,achievements:[],saveId:'pc-'+hashSeed(seed,'save').toString(36),
  };
  state.player.marketValue=playerMarketValue({position,state,overall:initialOverall,potential,age:16,form:0,leagueLevel:55,contractYears:0,reputation:5});
  state.objectives=playerSeasonObjectives(state);
  return state;
}
function trialSkillValue(career,choice){
  const p=career.player,a=p.attributes,role=roleSkill(p.position,a),mentality=(a.technique+a.physical+a.passing)/3;
  return choice.skill==='role'?role:choice.skill==='mentality'?mentality:finite(a[choice.skill],60);
}
export function answerTrialDrill(career,drillId,choiceId){
  if(career?.stage!=='trial')return career;
  const drill=TRIAL_DRILLS.find(x=>x.id===drillId),choice=drill?.choices.find(x=>x.id===choiceId);if(!drill||!choice)return career;
  return{...career,trial:{...career.trial,answers:{...(career.trial?.answers||{}),[drillId]:choiceId}}};
}
export function trialScore(career){
  const answers=career?.trial?.answers||{};if(TRIAL_DRILLS.some(d=>!answers[d.id]))return null;
  let total=0;
  for(const drill of TRIAL_DRILLS){
    const choice=drill.choices.find(x=>x.id===answers[drill.id]),skill=trialSkillValue(career,choice),rng=mulberry32(hashSeed(career.seed,'trial',drill.id,choice.id)),execution=(rng()-.5)*10-choice.risk*Math.max(0,rng()-.42)*2;
    total+=clamp(20,100,skill*.72+choice.bonus*3.3+execution);
  }
  return Math.round(clamp(0,100,total/TRIAL_DRILLS.length));
}
export function completeTrial(career,clubs=[]){
  if(career?.stage!=='trial')return career;const score=trialScore(career);if(score===null)return career;
  const ranked=playerCareerClubPool(clubs).filter(club=>(club.country||'BRA')==='BRA').map(club=>({club,level:clubLevel(club)})).sort((a,b)=>a.level-b.level),dream=ranked.find(x=>String(x.club.id)===String(career.dreamClubId));
  const eligibility=ranked.filter(x=>score>=clamp(42,88,34+x.level*.57));
  let destination=null,reason='';
  if(dream&&eligibility.some(x=>String(x.club.id)===String(dream.club.id))){destination=dream.club;reason='A atuação foi suficiente para abrir uma vaga na base do clube dos sonhos.';}
  else if(eligibility.length){const ideal=eligibility.slice().sort((a,b)=>Math.abs((score+8)-a.level)-Math.abs((score+8)-b.level))[0];destination=ideal.club;reason='A comissão encontrou um projeto compatível com o desempenho da peneira.';}
  else{destination=ranked[0]?.club||clubs[0]||null;reason='Uma equipe decidiu apostar no potencial, mesmo com uma peneira difícil.';}
  if(!destination)return{...career,trial:{...career.trial,score,completed:true,report:{reason:'Nenhum clube disponível nesta base.'}}};
  const clubName=destination.name,dreamSuccess=String(destination.id)===String(career.dreamClubId),salary=contractSalary(destination,playerCareerOverall(career),16,score),contract={clubId:String(destination.id),clubName,startSeason:career.season,expirySeason:career.season+3,salaryMonthly:salary,role:'Base',kind:'youth'};
  const signed={...career,stage:'academy',clubId:String(destination.id),week:0,dayOfSeason:0,dayOfWeek:0,contract,trial:{...career.trial,score,completed:true,report:{clubId:String(destination.id),clubName,reason,dreamSuccess}},player:{...career.player,coachTrust:clamp(0,100,38+score*.28),morale:moraleAfterEvent(career.player.morale,dreamSuccess?90:82,.30),contractSatisfaction:82},timeline:[{id:'trial-'+career.season,title:'Aprovado na peneira',text:career.player.name+' fez '+score+' pontos e entrou na base do '+clubName+'.',season:career.season,week:0,type:'trial'},...(career.timeline||[])],news:[{id:'trial-news',title:'Novo talento chega à base do '+clubName,text:reason+' O primeiro vínculo de formação foi assinado.',season:career.season,week:0},...(career.news||[])]};
  signed.objectives=playerSeasonObjectives(signed);signed.world=ensurePlayerWorld(signed,destination);return signed;
}
export function setPlayerTraining(career,id){return{...career,trainingFocus:trainingDef(id).id};}
export function setPlayerMatchApproach(career,id){return{...career,matchApproach:approachDef(id).id};}
function matchSelection(career,club){
  const p=career.player,overall=playerCareerOverall(career),effective=effectiveOverall({baseOverall:overall,condition:p.condition,form:p.form,morale:p.morale}),competition=career.stage==='professional'?clubLevel(club):58,recent=career.performanceHistory?.[0]?.rating??6.5,context=playerSelectionContext(career,club),coach=context.coach,personality=context.personality;
  const quality=effective+(career.age<=21?coach.selectionYouth*.10:0),discipline=clamp(20,100,context.discipline+personality.discipline*.15),managerTrust=clamp(0,100,p.coachTrust+(coach.id==='star'?p.reputation*.045:0));
  const selection=starterProbability({quality,form:p.form,fitness:p.condition,tacticalCompatibility:context.tacticalCompatibility,managerTrust,recentPerformance:recent,competition,roleCompetition:context.roleCompetition,discipline});
  return{strength:selection.score,threshold:selection.threshold,pStart:selection.probability,status:squadStatus({starterChance:selection.probability,starts:career.seasonStats?.starts,matches:career.seasonStats?.matches,trust:p.coachTrust,age:career.age,stage:career.stage}),context};
}
function simulatePerformance(career,club,started,rng,teamGoals=0,opponentGoals=0,teamXg=1.2,opponentXg=1.1){
  const p=career.player,attrs=effectivePlayerAttributes(career),approach=approachDef(career.matchApproach),overall=playerCareerOverall(career),effective=effectiveOverall({baseOverall:overall,condition:p.condition,form:p.form,morale:p.morale,minute:started?78:24,fatigue:started?78:25}),position=p.position,minutes=started?62+Math.floor(rng()*29):18+Math.floor(rng()*24);
  const attackWeight=position==='ATA'?1:position==='MEI'?.68:position==='DEF'?.20:.05,goalChance=clamp(.01,.62,(effective-48)*.012*attackWeight*(minutes/90)*approach.goal),assistChance=clamp(.01,.44,(finite(attrs.passing,50)-48)*.008*(position==='MEI'?1:position==='ATA'?.55:.30)*(minutes/90)*approach.assist),rawGoals=rng()<goalChance?1+(rng()<goalChance*.16?1:0):0,goals=Math.min(teamGoals,rawGoals),remainingGoals=Math.max(0,teamGoals-goals),assists=Math.min(remainingGoals,rng()<assistChance?1:0),cleanSheet=(position==='GOL'||position==='DEF')&&opponentGoals===0;
  const role=positionPerformanceMetrics({position,attributes:attrs,minutes,teamXg,opponentXg,goalsFor:teamGoals,goalsAgainst:opponentGoals,goals,assists,condition:p.condition,opponentDifficulty:clubLevel(club),seed:career.seed+'|'+career.season+'|'+career.dayOfSeason});
  const rating=clamp(4,10,role.rating+(effective-65)*.007+(p.coachTrust-50)*.0025+approach.rating+(rng()-.5)*.28);
  return{minutes,goals,assists,cleanSheet,rating:Number(rating.toFixed(1)),metrics:role.metrics,approach:approach.id};
}
function addStats(stats,performance,started){
  return{matches:finite(stats.matches)+1,starts:finite(stats.starts)+(started?1:0),minutes:finite(stats.minutes)+performance.minutes,goals:finite(stats.goals)+performance.goals,assists:finite(stats.assists)+performance.assists,totalRating:finite(stats.totalRating)+performance.rating,titles:finite(stats.titles)};
}
function weeklyDevelopment(career,performance,rng,club){
  const focus=trainingDef(career.trainingFocus),p=career.player,attrs={...p.attributes},history=[performance,...(career.performanceHistory||[])].filter(Boolean).slice(0,6),average=history.length?history.reduce((sum,item)=>sum+finite(item.rating,6.5),0)/history.length:6.5,variance=history.length?history.reduce((sum,item)=>sum+Math.pow(finite(item.rating,6.5)-average,2),0)/history.length:0,regularity=clamp(0,1,1-Math.sqrt(variance)/2),world=club?ensurePlayerWorld(career,club):career.world,coach=world?.coach?playerSelectionContext({...career,world},club).coach:{development:1},personality=personalityDef(p.personalityId),life=playerLifeBonuses(career),trainingFactor=clamp(.65,1.55,(.86+Object.values(focus.gain||{}).reduce((sum,value)=>sum+finite(value),0)/1.9)*finite(coach.development,1)*finite(personality.training,1)*finite(life.trainingMultiplier,1)),minutesFactor=performance?clamp(.08,1,performance.minutes/90):.06,model=playerDevelopmentScore({age:career.age,position:p.position,current:playerBaseCareerOverall(career),potential:p.potential,trainingFactor,minutesFactor,performance:average,morale:p.morale,competitionLevel:club?clubLevel(club):58,regularity,injuryHistory:p.injuryHistory,seed:career.seed,period:career.season+'-'+career.week});
  for(const [key,gain] of Object.entries(focus.gain||{})){
    const chance=clamp(.002,.32,Math.max(0,model.score)*(gain||0)*.52);
    if(rng()<chance)attrs[key]=Number(clamp(20,96,finite(attrs[key],50)+(model.score>1.1?1:.5)).toFixed(1));
  }
  if(model.score<-.18){
    const declineKeys=p.position==='GOL'?['pace','physical']:['pace','physical','technique'];
    for(const key of declineKeys)if(rng()<clamp(.02,.34,Math.abs(model.score)*.28))attrs[key]=Number(clamp(20,96,finite(attrs[key],50)-.5).toFixed(1));
  }
  return attrs;
}
function maybeMilestone(career,performance){
  let next=career,timeline=[...(career.timeline||[])],achievements=[...(career.achievements||[])];
  const ensure=(id,title,text,type='milestone')=>{
    if(timeline.some(item=>item.id===id))return;
    timeline.unshift({id,title,text,season:career.season,week:career.week,day:career.dayOfSeason,type});achievements.unshift(id);
    next=enqueuePlayerMoment({...next,timeline:timeline.slice(0,120),achievements:achievements.slice(0,80)},{id,type,title,subtitle:'Momento da carreira',text,season:career.season,day:career.dayOfSeason});
  };
  if(career.careerStats.matches>=1)ensure('first-match','Primeiro jogo','A carreira registrou a primeira partida oficial.','match');
  if(career.careerStats.goals>=1)ensure('first-goal','Primeiro gol','O primeiro gol da carreira virou memória do save.','goal');
  if(career.careerStats.matches>=50)ensure('matches-50','50 jogos','Uma marca importante de continuidade.','milestone');
  if(career.careerStats.goals>=50)ensure('goals-50','50 gols','A carreira alcançou cinquenta gols oficiais.','goal');
  return{...next,timeline:timeline.slice(0,120),achievements:achievements.slice(0,80)};
}
function maybeProfessionalPromotion(career,club){
  if(career.stage!=='academy')return career;const p=career.player,avg=career.seasonStats.matches?career.seasonStats.totalRating/career.seasonStats.matches:0,score=playerBaseCareerOverall(career)*.55+p.coachTrust*.25+avg*2.5+career.seasonStats.minutes/700;
  if(career.week<8||score<62)return career;
  const life=playerLifeBonuses(career),salary=contractSalary(club,playerBaseCareerOverall(career),career.age,Math.min(100,score))*life.salaryMultiplier,contract={clubId:String(club.id),clubName:club.name,startSeason:career.season,expirySeason:career.season+3,salaryMonthly:Math.round(salary*2.4/500)*500,role:'Profissional',kind:'pro'};
  const promoted={...career,stage:'professional',contract,player:{...p,morale:moraleAfterEvent(p.morale,90,.30),reputation:clamp(1,100,p.reputation+6),contractSatisfaction:88},timeline:[{id:'promotion-'+career.season+'-'+career.week,title:'Promovido ao profissional',text:'A comissão do '+club.name+' decidiu integrar '+p.name+' ao elenco principal e ofereceu o primeiro contrato profissional.',season:career.season,week:career.week,type:'promotion'},...(career.timeline||[])],news:[{id:'promotion-news-'+career.season+'-'+career.week,title:p.name+' sobe ao profissional',text:'A evolução na base abriu a porta do elenco principal.',season:career.season,week:career.week},...(career.news||[])]};
  promoted.objectives=playerSeasonObjectives(promoted);return enqueuePlayerMoment(promoted,{id:'promotion-'+career.season+'-'+career.week,type:'promotion',title:'Promovido ao profissional',subtitle:club.name,text:'A comissão confirmou sua integração ao elenco principal.',season:career.season,day:career.dayOfSeason});
}
function maybeTransferOffer(career,clubs,rng,{freeAgent=false}={}){
  if((career.stage!=='professional'&&!freeAgent)||career.pendingOffer||career.week%4!==0)return career;
  const pool=playerCareerClubPool(clubs),p=career.player,life=playerLifeBonuses(career),personality=personalityDef(p.personalityId),overall=playerBaseCareerOverall(career),marketValue=finite(p.marketValue,1_000_000),current=pool.find(c=>String(c.id)===String(career.clubId))||null,currentLevel=current?clubLevel(current):52,allowedMarkets=new Set(life.accessibleMarkets||['BRA']);
  const candidates=pool.filter(c=>(freeAgent||String(c.id)!==String(career.clubId))&&allowedMarkets.has(c.country||'BRA')).map(club=>{
    const level=clubLevel(club),need=45+(hashSeed(career.seed,career.season,career.week,club.id,'need')%5100)/100,affordability=clamp(15,100,110-marketValue/Math.max(1,playerClubBudgetM(club)*1_000_000)*42),tacticalFit=48+(hashSeed(career.seed,club.id,p.position,'fit')%4700)/100,variance=(rng()-.5)*14,market=playerClubMarket(club);
    const score=playerTransferInterest({playerQuality:overall,potential:p.potential,clubLevel:level,clubNeed:need,affordability,reputation:p.reputation+life.reputationLifestyle,tacticalFit,age:career.age,marketValue,scoutingVariance:variance})*life.marketMultiplier*(1+personality.ambition*.004)*(market.exposure>1&&career.age<20?.94:1);
    return{club,level,score};
  }).filter(item=>item.score>(freeAgent?42:56)&&item.level<=currentLevel+(freeAgent?35:18)).sort((a,b)=>b.score-a.score);
  if(!candidates.length||(!freeAgent&&rng()>.42))return career;
  const dream=candidates.find(item=>String(item.club.id)===String(career.dreamClubId)),dreamRoll=dream&&dream.score>=68&&rng()<clamp(.10,.58,(dream.score-45)/80),target=(dreamRoll?dream:candidates[0]),requestedStarter=career.contractPreference==='starter',role=requestedStarter&&target.score>=68?'Titular':target.score>=78?'Titular':target.score>=63?'Disputa posição':'Rotação',salary=Math.round(contractSalary(target.club,overall,career.age,Math.min(100,target.score))*3.05*life.salaryMultiplier/500)*500,years=career.age<=22?4:3,signingBonus=Math.round(salary*(1.5+life.negotiationBonus/12)/500)*500,offer={id:'offer-'+career.season+'-'+career.week+'-'+target.club.id,kind:freeAgent?'free-agent':'transfer',clubId:String(target.club.id),clubName:target.club.name,country:target.club.country||'BRA',league:target.club.league||'Brasileirão Série A',interestScore:Number(target.score.toFixed(1)),marketValue,role,salaryMonthly:salary,signingBonus,years,expiresWeek:career.week+3,dreamClub:String(target.club.id)===String(career.dreamClubId)};
  return{...career,pendingOffer:offer,news:[{id:offer.id+'-news',title:target.club.name+' formaliza proposta por '+p.name,text:(offer.dreamClub?'O clube dos sonhos entrou na negociação. ':'')+offer.league+' · '+offer.role+' · interesse '+offer.interestScore+'/100.',season:career.season,week:career.week,day:career.dayOfSeason},...(career.news||[])].slice(0,80)};
}
export function respondPlayerOffer(career,clubs,accept){
  const offer=career.pendingOffer;if(!offer)return career;
  if(!accept)return{...career,pendingOffer:null,player:{...career.player,morale:clamp(0,100,career.player.morale+1)},timeline:[{id:offer.id+'-reject',title:'Permanência escolhida',text:career.player.name+' decidiu seguir no projeto atual.',season:career.season,week:career.week,type:'decision'},...(career.timeline||[])]};
  const target=playerCareerClubPool(clubs).find(c=>String(c.id)===String(offer.clubId));if(!target)return{...career,pendingOffer:null};
  const contract={clubId:String(target.id),clubName:target.name,startSeason:career.season,expirySeason:career.season+Number(offer.years||3),salaryMonthly:Number(offer.salaryMonthly||contractSalary(target,playerBaseCareerOverall(career),career.age,60)),role:offer.role||'Profissional',kind:'pro'};
  let finance=career.finance;if(Number(offer.signingBonus)>0)finance={...finance,cash:finite(finance?.cash)+Number(offer.signingBonus),careerIncome:finite(finance?.careerIncome)+Number(offer.signingBonus),transactions:[{id:'transfer-signing-'+offer.id,amount:Number(offer.signingBonus),label:'Luvas contratuais · '+target.name,type:'contract-signing',season:career.season,day:career.dayOfSeason},...(finance?.transactions||[])].slice(0,120)};
  const moved={...career,stage:'professional',clubId:String(target.id),contract,pendingOffer:null,pendingContractOffer:null,contractIntent:'open',contractPreference:'open',finance,world:ensurePlayerWorld({...career,clubId:String(target.id)},target),player:{...career.player,coachTrust:45,morale:moraleAfterEvent(career.player.morale,offer.dreamClub?92:82,.28),reputation:clamp(1,100,career.player.reputation+2),contractSatisfaction:90},timeline:[{id:offer.id+'-accept',title:'Novo clube: '+target.name,text:career.player.name+' aceitou um novo passo na carreira'+(offer.dreamClub?' e realizou o objetivo de vestir a camisa do clube dos sonhos.':'.'),season:career.season,week:career.week,type:'transfer'},...(career.timeline||[])]};
  return enqueuePlayerMoment(moved,{id:offer.id+'-moment',type:offer.dreamClub?'dream-club':'transfer',title:offer.dreamClub?'Transferência para o clube dos sonhos':'Transferência concluída',subtitle:target.name,text:career.player.name+' aceitou um novo passo na carreira'+(offer.dreamClub?' e realizou o objetivo de vestir a camisa do clube dos sonhos.':'.'),season:career.season,day:career.dayOfSeason});
}
function maybeContractRenewalOffer(career,club){
  if(career.stage!=='professional'||!career.contract||career.pendingContractOffer||career.contractPreference==='leave'||career.dayOfSeason<160)return career;
  if(Number(career.contract.expirySeason)>Number(career.season)+1)return career;
  const overall=playerBaseCareerOverall(career),life=playerLifeBonuses(career),personality=personalityDef(career.player.personalityId),marketValue=finite(career.player.marketValue,1_000_000),avg=career.seasonStats.matches?career.seasonStats.totalRating/career.seasonStats.matches:6.5,performance=clamp(.88,1.38,.94+(avg-6.5)*.10),selection=matchSelection(career,club),baseRole=squadStatus({starterChance:selection.pStart,starts:career.seasonStats.starts,matches:career.seasonStats.matches,trust:career.player.coachTrust,age:career.age,stage:career.stage}),role=career.contractPreference==='starter'&&selection.pStart>=.52?'Titular':baseRole,preferenceBoost=career.contractPreference==='renew'?1.025:career.contractPreference==='starter'?1.04:1,salary=Math.round(Math.max(finite(career.contract.salaryMonthly,5000)*1.05,contractSalary(club,overall,career.age,70)*3*life.salaryMultiplier*performance*preferenceBoost)/500)*500,years=career.age<=24?4:career.age<=31?3:2,signingBonus=Math.round(salary*(1.4+life.negotiationBonus/10+Math.max(0,personality.ambition)/20)/500)*500;
  return{...career,pendingContractOffer:{id:'renew-'+career.season+'-'+career.dayOfSeason,clubId:String(club.id),clubName:club.name,salaryMonthly:salary,signingBonus,years,role,marketValue,expiresDay:Math.min(258,career.dayOfSeason+35),negotiated:false,preference:career.contractPreference||'open'}};
}
export function setPlayerContractPreference(career,preference){
  const allowed=['renew','open','leave','starter'],nextPreference=allowed.includes(preference)?preference:'open',next=processPlayerWorldEvent({...career,contractPreference:nextPreference,contractIntent:nextPreference==='leave'?'leave':'open'},{type:'CONTRACT_DECISION',id:'contract-preference-'+career.season+'-'+career.dayOfSeason+'-'+nextPreference,payload:{intent:nextPreference}});
  return{...next,timeline:[{id:'contract-preference-'+career.season+'-'+career.dayOfSeason,title:'Posição sobre o futuro',text:{renew:'Você comunicou ao empresário que deseja renovar.',open:'Você está aberto a ouvir o clube e o mercado.',leave:'Você comunicou que pretende deixar o clube ao fim do vínculo.',starter:'Sua prioridade é um contrato com status de titular.'}[nextPreference],season:career.season,week:career.week,day:career.dayOfSeason,type:'contract'},...(next.timeline||[])].slice(0,120)};
}
export function negotiatePlayerContractOffer(career,request='salary'){
  const offer=career?.pendingContractOffer;if(!offer||offer.negotiated)return career;
  const life=playerLifeBonuses(career),personality=personalityDef(career.player.personalityId),rng=mulberry32(hashSeed(career.seed,career.season,career.dayOfSeason,offer.id,request)),power=clamp(0,1,.38+life.negotiationBonus/35+Math.max(0,personality.ambition)/100),success=rng()<power;
  let nextOffer={...offer,negotiated:true,negotiationResult:success?'accepted':'rejected'};
  if(success&&request==='salary')nextOffer.salaryMonthly=Math.round(offer.salaryMonthly*(1.05+life.negotiationBonus/250)/500)*500;
  if(success&&request==='role')nextOffer.role='Titular';
  if(success&&request==='bonus')nextOffer.signingBonus=Math.round(finite(offer.signingBonus,0)*1.18/500)*500;
  return{...career,pendingContractOffer:nextOffer,news:[{id:offer.id+'-negotiation',title:success?'Negociação avançou':'Clube manteve a proposta',text:success?'O empresário conseguiu melhorar '+(request==='salary'?'o salário':request==='role'?'o papel no elenco':'as luvas')+'.':'O clube não aceitou alterar os termos nesta rodada.',season:career.season,week:career.week,day:career.dayOfSeason},...(career.news||[])].slice(0,80)};
}
export function respondPlayerContractOffer(career,accept){
  const offer=career?.pendingContractOffer;if(!offer)return career;
  if(!accept)return setPlayerContractPreference({...career,pendingContractOffer:null,player:{...career.player,contractSatisfaction:moraleAfterEvent(career.player.contractSatisfaction,42,.32)}},'leave');
  const contract={...career.contract,startSeason:career.season,expirySeason:career.season+Number(offer.years||3),salaryMonthly:Number(offer.salaryMonthly),role:offer.role||career.contract?.role||'Profissional'},signingBonus=finite(offer.signingBonus,0),finance=signingBonus>0?{...career.finance,cash:finite(career.finance?.cash)+signingBonus,careerIncome:finite(career.finance?.careerIncome)+signingBonus,transactions:[{id:offer.id+'-signing',amount:signingBonus,label:'Luvas de renovação · '+offer.clubName,type:'contract-signing',season:career.season,day:career.dayOfSeason},...(career.finance?.transactions||[])].slice(0,120)}:career.finance;
  return enqueuePlayerMoment({...career,contract,finance,pendingContractOffer:null,contractIntent:'renewed',contractPreference:'open',player:{...career.player,contractSatisfaction:90,morale:moraleAfterEvent(career.player.morale,84,.20)},timeline:[{id:offer.id+'-accept',title:'Contrato renovado',text:'Novo vínculo com o '+offer.clubName+' até '+contract.expirySeason+'.',season:career.season,week:career.week,day:career.dayOfSeason,type:'contract'},...(career.timeline||[])].slice(0,120)},{id:offer.id+'-moment',type:'contract',title:'Contrato renovado',subtitle:offer.clubName,text:'Salário '+offer.salaryMonthly+'/mês · luvas '+signingBonus+' · vínculo até '+contract.expirySeason+'.',season:career.season,day:career.dayOfSeason});
}
function maybeContextualCareerEvent(career,club){
  if(!club||career.dayOfSeason<14||career.dayOfSeason%21!==0)return career;
  const eventId='career-event-'+career.season+'-'+career.dayOfSeason;if((career.careerEvents||[]).some(item=>item.id===eventId))return career;
  const rng=mulberry32(hashSeed(career.seed,career.season,career.dayOfSeason,club.id,'context-event')),roll=rng(),p=career.player;let event=null,nextPlayer={...p};
  if(roll<.24){event={id:eventId,type:'competition',title:'Concorrência aumentou',text:'O clube trouxe um jogador para disputar minutos na sua posição.',impact:'A disputa por titularidade ficou mais forte.'};nextPlayer.coachTrust=clamp(0,100,p.coachTrust-.7);}
  else if(roll<.43){event={id:eventId,type:'manager',title:'Mudança na comissão',text:'O treinador ajustou a hierarquia e passou a observar novamente o desempenho recente.',impact:'Forma e treino ganharam mais peso na próxima sequência.'};nextPlayer.coachTrust=moraleAfterEvent(p.coachTrust,55,.16);}
  else if(roll<.63){event={id:eventId,type:'tactics',title:'Novo ajuste tático',text:'A equipe mudou o plano de jogo para a próxima sequência.',impact:'Seu encaixe depende da postura escolhida em campo.'};}
  else if(roll<.78&&p.condition<78){event={id:eventId,type:'recovery',title:'Carga reduzida',text:'A comissão identificou desgaste e diminuiu sua carga de treino.',impact:'Condição física recuperada sem forçar o retorno.'};nextPlayer.condition=clamp(35,100,p.condition+4);}
  if(!event)return career;
  return{...career,player:nextPlayer,careerEvents:[{...event,season:career.season,day:career.dayOfSeason},...(career.careerEvents||[])].slice(0,60),news:[{id:eventId+'-news',title:event.title,text:event.text+' '+event.impact,season:career.season,week:career.week,day:career.dayOfSeason},...(career.news||[])].slice(0,80)};
}
export function playerObjectiveSnapshot(career){return (career.objectives||playerSeasonObjectives(career)).map(objective=>objectiveProgress(career,objective));}
export function nextPlayerMatchPreview(career,clubs=[]){
  if(!career?.clubId)return null;const pool=playerCareerClubPool(clubs),club=pool.find(item=>String(item.id)===String(career.clubId));if(!club)return null;
  const daysUntil=((5-finite(career.dayOfWeek,0)+7)%7)||7,nextDay=finite(career.dayOfSeason,0)+daysUntil,opponents=pool.filter(item=>String(item.id)!==String(club.id)&&(item.country||'BRA')===(club.country||'BRA')),opponent=opponents.length?opponents[hashSeed(career.seed,career.season,nextDay,'opponent')%opponents.length]:null,selection=matchSelection(career,club);
  if(!opponent)return null;
  const briefing=playerPreMatchBriefing(career,club,opponent,selection.pStart);
  return{daysUntil,day:nextDay,opponentId:String(opponent.id),opponentName:opponent.name,competition:career.stage==='academy'?'Competição de base':club.league||'Brasileirão Série A',selectionChance:Number(selection.pStart.toFixed(2)),status:selection.status,briefing};
}
export function playerSquadCompetitionSnapshot(career,clubs=[]){
  if(!career?.clubId)return null;const club=playerCareerClubPool(clubs).find(item=>String(item.id)===String(career.clubId));if(!club)return null;
  const selection=matchSelection(career,club),ctx=selection.context;
  return{status:selection.status,starterChance:Number(selection.pStart.toFixed(3)),coach:ctx.world.coach,coachProfile:ctx.coach,rivals:(ctx.rivals||[]).slice().sort((a,b)=>(b.overall+b.form*2)-(a.overall+a.form*2)),bestRival:ctx.bestRival,tacticalCompatibility:Math.round(ctx.tacticalCompatibility),discipline:Math.round(ctx.discipline)};
}
export function playerAgendaSnapshot(career){return Array.from({length:7},(_,offset)=>playerAgendaForDay(career,offset));}


function applyPlayerObjectiveRewards(career){
  let next=career,rewards=Array.isArray(career.objectiveRewards)?career.objectiveRewards.slice(0,80):[];
  for(const objective of playerObjectiveSnapshot(career)){
    const key=career.season+':'+objective.id;if(!objective.completed||rewards.includes(key))continue;
    rewards=[key,...rewards].slice(0,80);next=processPlayerWorldEvent({...next,objectiveRewards:rewards},{type:'OBJECTIVE_COMPLETED',id:'objective-'+key,payload:{objectiveId:objective.id}});
    next={...next,timeline:[{id:'objective-'+key,title:'Objetivo cumprido',text:objective.label+' foi concluído. Confiança e reputação receberam impacto positivo.',season:career.season,week:career.week,day:career.dayOfSeason,type:'objective'},...(next.timeline||[])].slice(0,120)};
  }
  return{...next,objectiveRewards:rewards};
}
function seasonHonours(career){
  const s=career.seasonStats||{},avg=s.matches?finite(s.totalRating)/Math.max(1,s.matches):0,awards=[...(career.awards||[])],timeline=[...(career.timeline||[])];let reputation=finite(career.player?.reputation,5);
  const add=(id,title,text,rep=3)=>{if(awards.some(x=>x.id===id))return;awards.unshift({id,title,season:career.season,average:avg,goals:s.goals||0});timeline.unshift({id:'award-'+id,title,text,season:career.season,week:38,type:'award'});reputation=clamp(1,100,reputation+rep);};
  if(s.matches>=10&&avg>=7.45)add('best-'+career.season,'Destaque da temporada','A regularidade colocou '+career.player.name+' entre os destaques do clube.',4);
  if((s.goals||0)>=18)add('scorer-'+career.season,'Temporada goleadora',career.player.name+' encerrou o ano com '+s.goals+' gols oficiais.',3);
  if(career.age<=21&&s.matches>=10&&avg>=7.1)add('revelation-'+career.season,'Revelação','A temporada consolidou '+career.player.name+' como uma das jovens revelações do projeto.',4);
  return{...career,awards:awards.slice(0,60),timeline:timeline.slice(0,120),player:{...career.player,reputation}};
}
function maybeNationalTeam(career){
  if(career.nationalTeamStatus==='called-up'||career.stage!=='professional'||career.age<18)return career;
  const overall=playerCareerOverall(career),rep=finite(career.player.reputation,5),avg=career.seasonStats.matches?finite(career.seasonStats.totalRating)/Math.max(1,career.seasonStats.matches):0;
  if(overall<78||rep<50||avg<6.9)return career;
  const called={...career,nationalTeamStatus:'called-up',player:{...career.player,morale:clamp(0,100,career.player.morale+6),reputation:clamp(1,100,career.player.reputation+5)},timeline:[{id:'national-team-'+career.season,title:'Primeira convocação',text:career.player.name+' recebeu a primeira convocação para a seleção.',season:career.season,week:career.week,type:'national-team'},...(career.timeline||[])],news:[{id:'national-team-news-'+career.season,title:career.player.name+' é convocado',text:'O bom momento no clube abriu espaço na seleção.',season:career.season,week:career.week},...(career.news||[])]};
  return enqueuePlayerMoment(called,{id:'national-team-'+career.season,type:'national-team',title:'Primeira convocação',subtitle:'Seleção nacional',text:career.player.name+' recebeu a primeira convocação para a seleção.',season:career.season,day:career.dayOfSeason});
}
function advancePlayerSeason(career){
  if(finite(career.dayOfSeason,career.week*7)<266)return career;
  let prepared=seasonHonours(career);const age=prepared.age+1,season=prepared.season+1,p=prepared.player,attrs={...p.attributes};
  const offseason=playerDevelopmentScore({age,position:p.position,current:playerBaseCareerOverall(prepared),potential:p.potential,trainingFactor:.82,minutesFactor:Math.min(1,prepared.seasonStats.minutes/2200),performance:prepared.seasonStats.matches?prepared.seasonStats.totalRating/prepared.seasonStats.matches:6.4,morale:p.morale,competitionLevel:68,regularity:.65,injuryHistory:p.injuryHistory,seed:prepared.seed,period:'offseason-'+season});
  if(offseason.score<-.12)for(const key of p.position==='GOL'?['pace','physical']:['pace','physical','technique'])attrs[key]=Number(clamp(20,96,finite(attrs[key],50)-Math.min(1.5,Math.abs(offseason.score))).toFixed(1));
  const shouldRetire=age>=43||(age>=40&&playerCareerOverall(prepared)<63);
  if(shouldRetire){
    const retired={...prepared,age,season,week:0,dayOfSeason:0,dayOfWeek:0,stage:'retired',player:{...p,attributes:attrs,condition:clamp(35,100,p.condition+8),form:0,injury:null},timeline:[{id:'retirement-'+season,title:'Fim da carreira',text:p.name+' encerra a trajetória profissional aos '+age+' anos.',season,week:0,type:'retirement'},...(prepared.timeline||[])]};
    return enqueuePlayerMoment(retired,{id:'retirement-'+season,type:'retirement',title:'Último apito',subtitle:'Fim da carreira',text:p.name+' encerra a trajetória profissional aos '+age+' anos.',season,day:0});
  }
  let contract=prepared.contract,stage=prepared.stage,clubId=prepared.clubId,contractIntent=prepared.contractIntent||'open';
  if(contract&&Number(contract.expirySeason)<=season&&contractIntent!=='renewed'){
    contract=null;stage='free-agent';clubId=null;contractIntent='open';
  }
  if(contract)contractIntent='open';
  const nextState={...prepared,season,week:0,dayOfSeason:0,dayOfWeek:0,age,stage,clubId,contract,pendingContractOffer:null,contractIntent,teamSeason:{matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0},seasonStats:{matches:0,starts:0,minutes:0,goals:0,assists:0,totalRating:0},player:{...p,attributes:attrs,condition:clamp(35,100,p.condition+12),form:formRegression(p.form,0),injury:null,contractSatisfaction:contract?clamp(0,100,82):45},timeline:[{id:'season-'+season,title:stage==='free-agent'?'Livre no mercado':'Temporada '+season,text:stage==='free-agent'?p.name+' inicia o ano sem clube e aguarda propostas.':p.name+' inicia mais um ano aos '+age+' anos.',season,week:0,type:'season'},...(prepared.timeline||[])]};
  nextState.objectives=playerSeasonObjectives(nextState);return nextState;
}
function poissonGoals(lambda,rng){
  const limit=Math.exp(-Math.max(.05,lambda));let p=1,k=0;do{k++;p*=rng();}while(p>limit&&k<9);return Math.max(0,k-1);
}
function simulatePlayerTeamMatch(career,club,clubs,rng,selected){
  const pool=playerCareerClubPool(clubs),opponents=pool.filter(item=>String(item.id)!==String(club.id)&&(item.country||'BRA')===(club.country||'BRA'));const opponent=opponents.length?opponents[hashSeed(career.seed,career.season,career.dayOfSeason,'opponent')%opponents.length]:club,isHome=rng()<.5,ownLevel=clubLevel(club),oppLevel=clubLevel(opponent),playerImpact=selected?clamp(-2,5,(playerCareerOverall(career)-65)*.10):0;
  const ownStrength=teamStrength({quality:clamp(0,100,ownLevel+playerImpact),form:clamp(20,85,50+career.player.form*10),morale:career.player.morale,tactics:50,condition:career.player.condition,coach:career.player.coachTrust,home:isHome?100:0,context:52});
  const oppStrength=teamStrength({quality:oppLevel,form:50,morale:72,tactics:50,condition:88,coach:65,home:isHome?0:100,context:50}),dominance=logisticDominance(ownStrength,oppStrength),approach=approachDef(career.matchApproach);
  const ownXg=expectedGoals({dominance,base:1.18,attackVsDefense:(ownLevel-oppLevel)*.20,tacticalEdge:(approach.goal-1)*.16,min:.15,max:4}),oppXg=expectedGoals({dominance:1-dominance,base:1.10,attackVsDefense:(oppLevel-ownLevel)*.20,tacticalEdge:selected&&approach.id==='aggressive'?.035:0,min:.15,max:4});
  return{opponentId:String(opponent.id),opponentName:opponent.name,opponent,isHome,xg:[Number(ownXg.toFixed(2)),Number(oppXg.toFixed(2))],goalsFor:poissonGoals(ownXg,rng),goalsAgainst:poissonGoals(oppXg,rng),strength:[ownStrength,oppStrength]};
}
function simulatePlayerMatchDay(career,clubs=[]){
  const club=playerCareerClubPool(clubs).find(c=>String(c.id)===String(career.clubId));if(!club)return career;
  let next=career,p={...career.player},focus=trainingDef(career.trainingFocus),approach=approachDef(career.matchApproach),life=playerLifeBonuses(career),rng=mulberry32(hashSeed(career.seed,career.season,career.dayOfSeason,'match-day'));
  const injured=Boolean(p.injury&&finite(p.injury.daysRemaining,p.injury.matchesRemaining*7)>0),selection=matchSelection(next,club),selected=!injured&&rng()<clamp(.08,.97,selection.pStart+(next.stage==='academy'?.09:0)),started=selected&&rng()<clamp(.15,.90,selection.pStart*.86),teamMatch=simulatePlayerTeamMatch(next,club,clubs,rng,selected);
  let performance=null;
  if(selected){
    performance=simulatePerformance(next,club,started,rng,teamMatch.goalsFor,teamMatch.goalsAgainst,teamMatch.xg[0],teamMatch.xg[1]);p.condition=clamp(35,100,p.condition-(performance.minutes/7)*(1+(focus.id==='physical'?.08:0))*approach.fatigue);p.form=formRegression(p.form,(performance.rating-6.5)/.7);p.morale=moraleAfterEvent(p.morale,clamp(0,100,72+(performance.rating-6.5)*9+(teamMatch.goalsFor>teamMatch.goalsAgainst?5:teamMatch.goalsFor<teamMatch.goalsAgainst?-4:0)),.25);p.coachTrust=clamp(0,100,p.coachTrust+(performance.rating-6.4)*1.8+(started?.25:0)+approach.trust);
  }else if(!injured){p.form=formRegression(p.form,-.25);p.coachTrust=clamp(0,100,p.coachTrust-.35);}
  const injuryRisk=selected?individualInjuryRisk({baseRisk:.007,fatigue:100-p.condition,intensity:focus.id==='physical'?1.18:1,condition:p.condition,age:next.age,trainingMultiplier:focus.injury*approach.injury*life.injuryMultiplier,medicalLevel:clamp(1,5,Math.round(1+playerClubBudgetM(club)/35)),injuryHistory:p.injuryHistory}):0;
  if(selected&&rng()<injuryRisk){const severity=rng()<.58?1:rng()<.83?2:rng()<.95?3:rng()<.99?4:5,recovery=injuryRecovery({severity,medicalLevel:3,age:next.age,fitness:p.condition,injuryHistory:p.injuryHistory}),days=Math.max(2,Math.round(recovery.matches*7*life.injuryRecoveryMultiplier));p.injury={severity,label:severity>=5?'Lesão ligamentar grave':severity===4?'Lesão importante':severity===3?'Entorse moderada':severity===2?'Lesão muscular leve':'Pancada / desconforto',daysRemaining:days,matchesRemaining:Math.max(1,Math.ceil(days/7)),permanentLossRisk:recovery.permanentLossRisk,permanentResolved:false};p.injuryHistory++;p.morale=moraleAfterEvent(p.morale,Math.max(35,70-severity*7),.28);}
  p.attributes=injured?p.attributes:weeklyDevelopment({...next,player:p},performance,rng,club);p.currentOverall=playerBaseCareerOverall({...next,player:p});p.marketValue=playerMarketValue({position:p.position,overall:p.currentOverall,potential:p.potential,age:next.age,form:p.form,leagueLevel:clubLevel(club),contractYears:Math.max(0,finite(next.contract?.expirySeason,next.season)-next.season),reputation:p.reputation});
  const resultLabel=teamMatch.goalsFor>teamMatch.goalsAgainst?'Vitória':teamMatch.goalsFor===teamMatch.goalsAgainst?'Empate':'Derrota';
  const teamSeason={...(next.teamSeason||{matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0})};teamSeason.matches++;teamSeason.goalsFor+=teamMatch.goalsFor;teamSeason.goalsAgainst+=teamMatch.goalsAgainst;if(teamMatch.goalsFor>teamMatch.goalsAgainst){teamSeason.wins++;teamSeason.points+=3;}else if(teamMatch.goalsFor===teamMatch.goalsAgainst){teamSeason.draws++;teamSeason.points+=1;}else teamSeason.losses++;
  const performanceHistory=performance?[{rating:performance.rating,season:next.season,day:next.dayOfSeason},...(next.performanceHistory||[])].slice(0,12):(next.performanceHistory||[]);
  const briefing=playerPreMatchBriefing(next,club,teamMatch.opponent,selection.pStart),coachReview=coachPostMatchReview(next,performance,selected),timelineEvents=buildPlayerMatchTimeline({career:next,performance,teamMatch,started,selected});p.coachTrust=clamp(0,100,p.coachTrust+finite(coachReview.trustDelta,0));
  next={...next,player:p,world:ensurePlayerWorld(next,club),teamSeason,performanceHistory,lastMatch:{day:next.dayOfSeason,week:next.week,selected,started,performance,injured,status:selection.status,selectionChance:Number(selection.pStart.toFixed(2)),injury:p.injury||null,opponentName:teamMatch.opponentName,opponentId:teamMatch.opponentId,isHome:teamMatch.isHome,goalsFor:teamMatch.goalsFor,goalsAgainst:teamMatch.goalsAgainst,xg:teamMatch.xg,resultLabel,briefing,coachReview,timeline:timelineEvents,energyEnd:Math.round(p.condition)},careerStats:performance?addStats(next.careerStats,performance,started):next.careerStats,seasonStats:performance?addStats(next.seasonStats,performance,started):next.seasonStats,lastDay:{day:next.dayOfSeason,type:'match',title:resultLabel+' · '+teamMatch.goalsFor+' x '+teamMatch.goalsAgainst,text:(selected?(started?'Você começou como titular.':'Você entrou durante a partida.'):'Você não entrou em campo.')+' Adversário: '+teamMatch.opponentName+'.'}};
  if(performance&&(performance.rating>=8.2||performance.goals>=2))next={...next,news:[{id:'player-performance-'+next.season+'-'+next.dayOfSeason,title:performance.goals>=2?'Atuação decisiva de '+p.name:p.name+' é destaque',text:'Nota '+performance.rating.toFixed(1)+' contra '+teamMatch.opponentName+(performance.goals?' · '+performance.goals+' gol(s)':'')+'.',season:next.season,week:next.week,day:next.dayOfSeason},...(next.news||[])].slice(0,80)};
  next=processPlayerWorldEvent(next,{type:'MATCH_REVIEW',id:'match-review-'+next.season+'-'+next.dayOfSeason,payload:{rating:performance?.rating||6.2,goals:performance?.goals||0,assists:performance?.assists||0,country:club.country||'BRA'}});next=evolvePositionRivals(next,club,selected);next=applyPlayerObjectiveRewards(next);next=maybeMilestone(next,performance);next=maybeProfessionalPromotion(next,club);next=maybeNationalTeam(next);next=maybeTransferOffer(next,clubs,rng);next=maybeChangePlayerCoach(next,club);return next;
}
export function simulatePlayerDay(career,clubs=[]){
  if(!career||!['academy','professional','free-agent'].includes(career.stage))return career;
  if(career.stage==='free-agent'){
    let next={...career,dayOfSeason:finite(career.dayOfSeason,career.week*7)+1},p={...career.player};next.week=Math.floor(next.dayOfSeason/7);next.dayOfWeek=next.dayOfSeason%7;p.condition=clamp(35,100,p.condition+1.1);p.morale=moraleAfterEvent(p.morale,60,.08);next={...next,player:p,lastDay:{day:next.dayOfSeason,type:'market',title:'Treino individual',text:'Sem clube, você mantém a condição enquanto o empresário procura um novo contrato.'}};if(next.week%1===0)next=maybeTransferOffer(next,clubs,mulberry32(hashSeed(next.seed,next.season,next.dayOfSeason,'free-agent')),{freeAgent:true});return advancePlayerSeason(next);
  }
  const club=playerCareerClubPool(clubs).find(c=>String(c.id)===String(career.clubId));if(!club)return career;
  let next={...career,world:ensurePlayerWorld(career,club),dayOfSeason:finite(career.dayOfSeason,career.week*7)+1},p={...career.player},life=playerLifeBonuses(career),focus=trainingDef(career.trainingFocus);
  next.week=Math.floor(next.dayOfSeason/7);next.dayOfWeek=next.dayOfSeason%7;
  if(next.pendingOffer&&next.week>finite(next.pendingOffer.expiresWeek,next.week)){next={...next,pendingOffer:null,news:[{id:'offer-expired-'+next.season+'-'+next.dayOfSeason,title:'Proposta expirada',text:'A janela de decisão terminou e o clube retirou a proposta.',season:next.season,week:next.week,day:next.dayOfSeason},...(next.news||[])].slice(0,80)};}
  if(next.pendingContractOffer&&next.dayOfSeason>finite(next.pendingContractOffer.expiresDay,258)){const expired=next.pendingContractOffer;next={...next,pendingContractOffer:null,contractIntent:'leave',player:{...p,contractSatisfaction:moraleAfterEvent(p.contractSatisfaction,38,.30)},news:[{id:'contract-expired-'+next.season+'-'+next.dayOfSeason,title:'Renovação saiu da mesa',text:'O '+expired.clubName+' retirou a proposta de renovação após o prazo de resposta.',season:next.season,week:next.week,day:next.dayOfSeason},...(next.news||[])].slice(0,80)};p={...next.player};}
  const agenda=playerAgendaForDay(next,0),trainingDay=['training','tactical','preparation'].includes(agenda.type),matchDay=agenda.type==='match';
  if(p.injury){
    const previous={...p.injury},remaining=Math.max(0,finite(previous.daysRemaining,previous.matchesRemaining*7)-1);let injury=remaining>0?{...previous,daysRemaining:remaining,matchesRemaining:Math.max(1,Math.ceil(remaining/7))}:null,permanentText='';
    if(!injury&&!previous.permanentResolved&&finite(previous.permanentLossRisk,0)>0){
      const permanentRng=mulberry32(hashSeed(next.seed,next.season,next.dayOfSeason,'injury-permanent',previous.severity,previous.label));
      if(permanentRng()<previous.permanentLossRisk){
        const attrs={...p.attributes},loss=previous.severity>=5?1.5:1,target=p.position==='GOL'?'physical':permanentRng()<.55?'physical':'pace';attrs[target]=Number(clamp(20,96,finite(attrs[target],50)-loss).toFixed(1));p.attributes=attrs;permanentText=' A lesão deixou uma pequena sequela física permanente.';
        next={...next,careerEvents:[{id:'injury-sequela-'+next.season+'-'+next.dayOfSeason,type:'injury',title:'Retorno com sequela',text:'O departamento médico liberou '+p.name+', mas '+target+' sofreu perda permanente de '+loss+' ponto(s).',season:next.season,day:next.dayOfSeason},...(next.careerEvents||[])].slice(0,60)};
      }
    }
    p.injury=injury;p.condition=clamp(35,100,p.condition+1.6+life.dailyRecovery);next.lastDay={day:next.dayOfSeason,type:injury?'recovery':'medical-clearance',title:injury?'Recuperação':'Liberado pelo departamento médico',text:injury?'O tratamento reduziu o tempo restante para '+remaining+' dia(s).':'Você está novamente disponível.'+permanentText};
  }else{
    const agendaFactor=agenda.type==='preparation'?.55:agenda.type==='tactical'?.82:1,trainingDelta=trainingDay?(focus.condition/7-(focus.id==='physical'?1.1:.35))*agendaFactor:(1.05+life.dailyRecovery);p.condition=clamp(35,100,p.condition+trainingDelta);if(trainingDay)next.lastDay={day:next.dayOfSeason,type:agenda.type,title:agenda.label+' · '+focus.label,text:agenda.detail+' A sessão influencia condição, encaixe e risco.'};else next.lastDay={day:next.dayOfSeason,type:agenda.type,title:agenda.label,text:agenda.detail};
  }
  p.morale=moraleAfterEvent(p.morale,Math.max(52,68+life.moraleBaseline*.45+(p.coachTrust-50)*.08+(p.contractSatisfaction-60)*.05),.10);next={...next,player:p};
  if(matchDay)next=simulatePlayerMatchDay(next,clubs);
  next=maybeContractRenewalOffer(next,club);next=maybeContextualCareerEvent(next,club);
  if(next.dayOfSeason>0&&next.dayOfSeason%28===0){next=settlePlayerMonth(next);next=refreshPlayerSponsorOffers(next);}
  return advancePlayerSeason(next);
}
export function simulatePlayerDays(career,clubs=[],days=1){
  let next=career;for(let i=0;i<Math.max(1,Math.min(31,Math.round(days)));i++){if(next.stage==='retired')break;next=simulatePlayerDay(next,clubs);}return next;
}
export function simulatePlayerWeek(career,clubs=[]){return simulatePlayerDays(career,clubs,7);}
export function simulatePlayerUntilNextMatch(career,clubs=[]){
  const preview=nextPlayerMatchPreview(career,clubs);if(!preview)return simulatePlayerWeek(career,clubs);
  return simulatePlayerDays(career,clubs,Math.max(1,Math.min(7,preview.daysUntil)));
}
export function acknowledgePlayerMoment(career){
  const queue=Array.isArray(career?.momentQueue)?career.momentQueue:[];
  return{...career,pendingMoment:queue[0]||null,momentQueue:queue.slice(1)};
}
export function playerCalendarLabel(career){
  const base=new Date(Date.UTC(Number(career?.season||2026),0,5)),date=new Date(base.getTime()+finite(career?.dayOfSeason,0)*86400000);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(date);
}
export function sanitizePlayerCareer(raw,clubs=[]){
  if(!raw||raw.mode!=='player'||!raw.player||Number(raw.version||0)>PLAYER_CAREER_VERSION)return null;
  const base=createPlayerCareer({name:raw.player.name,position:raw.player.position,archetype:raw.player.archetype,personalityId:raw.player.personalityId,foot:raw.player.foot,dreamClubId:raw.dreamClubId},finite(raw.season,2026)),pool=playerCareerClubPool(clubs);
  const stage=['trial','academy','professional','free-agent','retired'].includes(raw.stage)?raw.stage:'trial';
  const dayOfSeason=clamp(0,266,finite(raw.dayOfSeason,finite(raw.week,0)*7)),dayOfWeek=dayOfSeason%7;
  const clubId=raw.clubId&&pool.some(c=>String(c.id)===String(raw.clubId))?String(raw.clubId):null;
  const matchApproach=PLAYER_MATCH_APPROACHES.some(item=>item.id===raw.matchApproach)?raw.matchApproach:'balanced';
  const trainingFocus=PLAYER_TRAINING.some(item=>item.id===raw.trainingFocus)?raw.trainingFocus:'balanced';
  const nationalTeamStatus=['none','called-up'].includes(raw.nationalTeamStatus)?raw.nationalTeamStatus:'none';
  const rawContract=raw.contract&&typeof raw.contract==='object'&&!Array.isArray(raw.contract)?raw.contract:null;
  const contract=rawContract&&clubId?{
    clubId,
    clubName:String(rawContract.clubName||pool.find(c=>String(c.id)===clubId)?.name||'Clube').slice(0,100),
    startSeason:clamp(2026,2100,finite(rawContract.startSeason,raw.season||2026)),
    expirySeason:clamp(2026,2110,finite(rawContract.expirySeason,(raw.season||2026)+3)),
    salaryMonthly:clamp(0,100_000_000,finite(rawContract.salaryMonthly,0)),
    role:String(rawContract.role||'Profissional').slice(0,60),
    kind:['youth','pro'].includes(rawContract.kind)?rawContract.kind:'pro',
  }:null;
  const sanitizeStats=value=>({
    matches:clamp(0,10000,finite(value?.matches,0)),starts:clamp(0,10000,finite(value?.starts,0)),minutes:clamp(0,1_000_000,finite(value?.minutes,0)),
    goals:clamp(0,10000,finite(value?.goals,0)),assists:clamp(0,10000,finite(value?.assists,0)),totalRating:clamp(0,100000,finite(value?.totalRating,0)),titles:clamp(0,500,finite(value?.titles,0)),
  });
  const merged={
    ...base,...raw,version:PLAYER_CAREER_VERSION,mode:'player',stage,clubId,matchApproach,trainingFocus,nationalTeamStatus,contract,finance:sanitizePlayerFinance(raw.finance||base.finance),dayOfSeason,dayOfWeek,contractIntent:['open','leave','renewed'].includes(raw.contractIntent)?raw.contractIntent:'open',contractPreference:['renew','open','leave','starter'].includes(raw.contractPreference)?raw.contractPreference:'open',objectiveRewards:Array.isArray(raw.objectiveRewards)?raw.objectiveRewards.slice(0,80).map(String):[],worldEventLedger:Array.isArray(raw.worldEventLedger)?raw.worldEventLedger.slice(0,160):[],
    age:clamp(16,50,finite(raw.age,16)),week:clamp(0,38,Math.floor(dayOfSeason/7)),season:clamp(2026,2100,finite(raw.season,2026)),
    player:{...base.player,...raw.player,name:safeName(raw.player.name),marketValue:clamp(0,250_000_000,finite(raw.player.marketValue,0)),attributes:{...base.player.attributes,...Object.fromEntries(Object.entries(raw.player.attributes||{}).map(([key,value])=>[key,clamp(1,99,finite(value,base.player.attributes[key]||50))]))},condition:clamp(35,100,finite(raw.player.condition,100)),morale:clamp(0,100,finite(raw.player.morale,78)),coachTrust:clamp(0,100,finite(raw.player.coachTrust,42)),reputation:clamp(1,100,finite(raw.player.reputation,5)),contractSatisfaction:clamp(0,100,finite(raw.player.contractSatisfaction,70)),potential:clamp(45,99,finite(raw.player.potential,base.player.potential)),injuryHistory:clamp(0,100,finite(raw.player.injuryHistory,0)),personalityId:personalityDef(raw.player.personalityId).id,injury:raw.player.injury?{...raw.player.injury,daysRemaining:clamp(0,365,finite(raw.player.injury.daysRemaining,finite(raw.player.injury.matchesRemaining,0)*7)),matchesRemaining:clamp(0,52,finite(raw.player.injury.matchesRemaining,Math.ceil(finite(raw.player.injury.daysRemaining,0)/7))),permanentLossRisk:clamp(0,.18,finite(raw.player.injury.permanentLossRisk,0)),permanentResolved:Boolean(raw.player.injury.permanentResolved)}:null,legacyFace:raw.player.face&&typeof raw.player.face==='object'?{...raw.player.face}:raw.player.legacyFace||null},
    careerStats:sanitizeStats(raw.careerStats),seasonStats:sanitizeStats(raw.seasonStats),
    timeline:Array.isArray(raw.timeline)?raw.timeline.slice(0,120):base.timeline,news:Array.isArray(raw.news)?raw.news.slice(0,80):[],achievements:Array.isArray(raw.achievements)?raw.achievements.slice(0,80):[],awards:Array.isArray(raw.awards)?raw.awards.slice(0,60):[],
    objectives:Array.isArray(raw.objectives)?raw.objectives.slice(0,8):playerSeasonObjectives({...base,...raw,stage,clubId}),teamSeason:raw.teamSeason&&typeof raw.teamSeason==='object'?{matches:clamp(0,100,finite(raw.teamSeason.matches,0)),wins:clamp(0,100,finite(raw.teamSeason.wins,0)),draws:clamp(0,100,finite(raw.teamSeason.draws,0)),losses:clamp(0,100,finite(raw.teamSeason.losses,0)),goalsFor:clamp(0,500,finite(raw.teamSeason.goalsFor,0)),goalsAgainst:clamp(0,500,finite(raw.teamSeason.goalsAgainst,0)),points:clamp(0,300,finite(raw.teamSeason.points,0))}:base.teamSeason,performanceHistory:Array.isArray(raw.performanceHistory)?raw.performanceHistory.slice(0,12):[],careerEvents:Array.isArray(raw.careerEvents)?raw.careerEvents.slice(0,60):[],pendingContractOffer:raw.pendingContractOffer&&typeof raw.pendingContractOffer==='object'&&!Array.isArray(raw.pendingContractOffer)?{...raw.pendingContractOffer,clubId:String(raw.pendingContractOffer.clubId||'').slice(0,80),clubName:String(raw.pendingContractOffer.clubName||'').slice(0,100),salaryMonthly:clamp(0,100_000_000,finite(raw.pendingContractOffer.salaryMonthly,0)),years:clamp(1,5,finite(raw.pendingContractOffer.years,3)),expiresDay:clamp(0,266,finite(raw.pendingContractOffer.expiresDay,250))}:null,
    pendingOffer:raw.pendingOffer&&typeof raw.pendingOffer==='object'&&!Array.isArray(raw.pendingOffer)?{...raw.pendingOffer,clubId:String(raw.pendingOffer.clubId||'').slice(0,80),clubName:String(raw.pendingOffer.clubName||'').slice(0,100),salaryMonthly:clamp(0,100_000_000,finite(raw.pendingOffer.salaryMonthly,0)),years:clamp(1,5,finite(raw.pendingOffer.years,3)),expiresWeek:clamp(0,41,finite(raw.pendingOffer.expiresWeek,0))}:null,
    pendingMoment:raw.pendingMoment&&typeof raw.pendingMoment==='object'&&!Array.isArray(raw.pendingMoment)?{id:String(raw.pendingMoment.id||'moment').slice(0,100),type:String(raw.pendingMoment.type||'milestone').slice(0,40),title:String(raw.pendingMoment.title||'Momento da carreira').slice(0,120),subtitle:String(raw.pendingMoment.subtitle||'').slice(0,120),text:String(raw.pendingMoment.text||'').slice(0,500),season:clamp(2026,2100,finite(raw.pendingMoment.season,raw.season||2026)),day:clamp(0,266,finite(raw.pendingMoment.day,0))}:null,
    momentQueue:Array.isArray(raw.momentQueue)?raw.momentQueue.slice(0,20).filter(item=>item&&typeof item==='object').map(item=>({id:String(item.id||'moment').slice(0,100),type:String(item.type||'milestone').slice(0,40),title:String(item.title||'Momento da carreira').slice(0,120),subtitle:String(item.subtitle||'').slice(0,120),text:String(item.text||'').slice(0,500),season:clamp(2026,2100,finite(item.season,raw.season||2026)),day:clamp(0,266,finite(item.day,0))})):[],
    lastDay:raw.lastDay&&typeof raw.lastDay==='object'&&!Array.isArray(raw.lastDay)?{day:clamp(0,266,finite(raw.lastDay.day,0)),type:String(raw.lastDay.type||'day').slice(0,40),title:String(raw.lastDay.title||'Dia concluído').slice(0,120),text:String(raw.lastDay.text||'').slice(0,500)}:null,
  };
  if(clubId){const currentClub=pool.find(item=>String(item.id)===clubId);merged.world=ensurePlayerWorld({...merged,world:raw.world},currentClub);}
  return merged;
}
export function serializePlayerCareer(career){return JSON.stringify({signature:'linha-de-frente-player-save',fileVersion:4,exportedAt:new Date().toISOString(),career});}
export function parsePlayerCareer(text,clubs=[]){
  const payload=parseSafeJson(text);
  if(!payload||payload.signature!=='linha-de-frente-player-save'||payload.fileVersion>4)throw new Error('Este arquivo não é uma carreira de jogador válida.');
  const career=sanitizePlayerCareer(payload.career,clubs);if(!career)throw new Error('Estado da carreira de jogador inválido.');return career;
}
