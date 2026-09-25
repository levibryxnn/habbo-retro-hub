import { getClubWorld } from './club-world.js';
import { clamp, effectiveOverall, expectedGoals, formRegression, hashSeed, individualInjuryRisk, injuryRecovery, logisticDominance, mulberry32, teamStrength } from './ldf-engine.js';
import { createPlayerFinance, effectivePlayerAttributes, enqueuePlayerMoment, playerLifeBonuses, refreshPlayerSponsorOffers, sanitizePlayerFinance, settlePlayerMonth } from './player-life-engine.js';
import { parseSafeJson } from './save-format.js';

export const PLAYER_CAREER_KEY='ldf.playerCareer.v1';
export const PLAYER_CAREER_VERSION=2;
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
function clubLevel(club){
  const meta=getClubWorld(club.id),budget=finite(meta.gameBudgetM,20),fans=finite(meta.fanIndex,.5);
  return clamp(38,94,46+fans*31+Math.min(17,budget*.12));
}
function contractSalary(club,overall,age,score=60){
  const meta=getClubWorld(club.id),wealth=clamp(.75,1.6,.78+finite(meta.gameBudgetM,20)/90),quality=clamp(.65,1.8,.65+Math.max(0,overall-50)*.028),ageFactor=age<=17?.58:age<=20?.76:age>=34?.88:1,trial=clamp(.85,1.18,.85+score/360);
  return Math.max(2500,Math.round(5500*wealth*quality*ageFactor*trial/500)*500);
}
function faceDefaults(seed){
  const rng=mulberry32(hashSeed(seed,'face'));
  return{skin:Math.floor(rng()*5),hair:Math.floor(rng()*6),hairColor:Math.floor(rng()*5),eyes:Math.floor(rng()*4),shape:Math.floor(rng()*4)};
}
export function createPlayerCareer(input={},season=2026){
  const name=safeName(input.name),position=posDef(input.position).id,archetype=archetypeDef(input.archetype),seed=hashSeed(name,input.birthMonth||6,position,archetype.id,season),rng=mulberry32(seed),base=posDef(position).base,attributes={};
  for(const [key,value] of Object.entries(base))attributes[key]=Math.round(clamp(20,85,value+(archetype.mods?.[key]||0)+(rng()-.5)*6));
  const initialOverall=Math.round(roleSkill(position,attributes)),potential=Math.round(clamp(initialOverall+8,94,initialOverall+18+rng()*15));
  return{
    version:PLAYER_CAREER_VERSION,mode:'player',seed:String(seed),season,week:0,age:16,stage:'trial',clubId:null,dreamClubId:String(input.dreamClubId||''),trial:{answers:{},score:null,completed:false,report:null},player:{
      id:'user-player',name,position,foot:['left','right'].includes(input.foot)?input.foot:'right',archetype:archetype.id,face:{...faceDefaults(seed),...(input.face||{})},attributes,potential,currentOverall:initialOverall,condition:100,morale:78,form:0,coachTrust:42,reputation:5,contractSatisfaction:70,injury:null,injuryHistory:0,
    },
    trainingFocus:'balanced',matchApproach:'balanced',contract:null,nationalTeamStatus:'none',awards:[],dayOfSeason:0,dayOfWeek:0,finance:createPlayerFinance(),careerStats:{matches:0,starts:0,minutes:0,goals:0,assists:0,totalRating:0,titles:0},seasonStats:{matches:0,starts:0,minutes:0,goals:0,assists:0,totalRating:0},timeline:[{id:'career-created',season,week:0,type:'start',title:'O sonho começa',text:name+' inicia a carreira aos 16 anos e entra em uma peneira.'}],offers:[],pendingOffer:null,pendingMoment:null,momentQueue:[],news:[],lastMatch:null,lastDay:null,achievements:[],saveId:'pc-'+hashSeed(seed,'save').toString(36),
  };
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
  const ranked=(clubs||[]).map(club=>({club,level:clubLevel(club)})).sort((a,b)=>a.level-b.level),dream=ranked.find(x=>String(x.club.id)===String(career.dreamClubId));
  const eligibility=ranked.filter(x=>score>=clamp(42,88,34+x.level*.57));
  let destination=null,reason='';
  if(dream&&eligibility.some(x=>String(x.club.id)===String(dream.club.id))){destination=dream.club;reason='A atuação foi suficiente para abrir uma vaga na base do clube dos sonhos.';}
  else if(eligibility.length){const ideal=eligibility.slice().sort((a,b)=>Math.abs((score+8)-a.level)-Math.abs((score+8)-b.level))[0];destination=ideal.club;reason='A comissão encontrou um projeto compatível com o desempenho da peneira.';}
  else{destination=ranked[0]?.club||clubs[0]||null;reason='Uma equipe decidiu apostar no potencial, mesmo com uma peneira difícil.';}
  if(!destination)return{...career,trial:{...career.trial,score,completed:true,report:{reason:'Nenhum clube disponível nesta base.'}}};
  const clubName=destination.name,dreamSuccess=String(destination.id)===String(career.dreamClubId),salary=contractSalary(destination,playerCareerOverall(career),16,score),contract={clubId:String(destination.id),clubName,startSeason:career.season,expirySeason:career.season+3,salaryMonthly:salary,role:'Base',kind:'youth'};
  return{...career,stage:'academy',clubId:String(destination.id),week:0,dayOfSeason:0,dayOfWeek:0,contract,trial:{...career.trial,score,completed:true,report:{clubId:String(destination.id),clubName,reason,dreamSuccess}},player:{...career.player,coachTrust:clamp(0,100,38+score*.28),morale:clamp(0,100,career.player.morale+(dreamSuccess?10:4)),contractSatisfaction:82},timeline:[{id:'trial-'+career.season,title:'Aprovado na peneira',text:career.player.name+' fez '+score+' pontos e entrou na base do '+clubName+'.',season:career.season,week:0,type:'trial'},...(career.timeline||[])],news:[{id:'trial-news',title:'Novo talento chega à base do '+clubName,text:reason+' O primeiro vínculo de formação foi assinado.',season:career.season,week:0},...(career.news||[])]};
}
export function setPlayerTraining(career,id){return{...career,trainingFocus:trainingDef(id).id};}
export function setPlayerMatchApproach(career,id){return{...career,matchApproach:approachDef(id).id};}
function matchSelection(career,club){
  const p=career.player,overall=playerCareerOverall(career),effective=effectiveOverall({baseOverall:overall,condition:p.condition,form:p.form,morale:p.morale}),stageBonus=career.stage==='professional'?0:-7,competition=career.stage==='professional'?clubLevel(club):58,roleFit=70,context=50+Math.min(15,career.week/6);
  const strength=.35*effective+.15*(50+p.form*12)+.15*p.condition+.10*p.morale+.10*p.coachTrust+.10*roleFit+.05*context+stageBonus,threshold=competition*.66+21;
  return{strength,threshold,pStart:clamp(.05,.94,1/(1+Math.exp(-(strength-threshold)/6)))};
}
function simulatePerformance(career,club,started,rng,teamGoals=0,opponentGoals=0){
  const p=career.player,attrs=effectivePlayerAttributes(career),approach=approachDef(career.matchApproach),overall=playerCareerOverall(career),effective=effectiveOverall({baseOverall:overall,condition:p.condition,form:p.form,morale:p.morale,minute:started?78:24,fatigue:started?78:25}),position=p.position,minutes=started?62+Math.floor(rng()*29):18+Math.floor(rng()*24),baseRating=6.05+(effective-60)*.025+(p.coachTrust-50)*.004+approach.rating+(rng()-.5)*1.25;
  const attackWeight=position==='ATA'?1:position==='MEI'?.68:position==='DEF'?.20:.05,goalChance=clamp(.01,.62,(effective-48)*.012*attackWeight*(minutes/90)*approach.goal),assistChance=clamp(.01,.44,(finite(attrs.passing,50)-48)*.008*(position==='MEI'?1:position==='ATA'?.55:.30)*(minutes/90)*approach.assist),rawGoals=rng()<goalChance?1+(rng()<goalChance*.16?1:0):0,goals=Math.min(teamGoals,rawGoals),remainingGoals=Math.max(0,teamGoals-goals),assists=Math.min(remainingGoals,rng()<assistChance?1:0),cleanSheet=(position==='GOL'||position==='DEF')&&opponentGoals===0,rating=clamp(4,10,baseRating+goals*1.25+assists*.75+(cleanSheet?.45:0));
  return{minutes,goals,assists,cleanSheet,rating:Number(rating.toFixed(1)),approach:approach.id};
}
function addStats(stats,performance,started){
  return{matches:finite(stats.matches)+1,starts:finite(stats.starts)+(started?1:0),minutes:finite(stats.minutes)+performance.minutes,goals:finite(stats.goals)+performance.goals,assists:finite(stats.assists)+performance.assists,totalRating:finite(stats.totalRating)+performance.rating,titles:finite(stats.titles)};
}
function weeklyDevelopment(career,performance,rng){
  const focus=trainingDef(career.trainingFocus),p=career.player,attrs={...p.attributes},gap=Math.max(0,p.potential-playerBaseCareerOverall(career)),ageRate=career.age<=18?1.25:career.age<=21?1.05:career.age<=28?.65:.28,minutesFactor=performance?clamp(.15,1,performance.minutes/90):.08;
  for(const [key,gain] of Object.entries(focus.gain||{})){
    const chance=clamp(.01,.34,(gain||0)*ageRate*(.65+gap/25)*(.55+minutesFactor*.55));
    if(rng()<chance)attrs[key]=Number(clamp(20,96,finite(attrs[key],50)+.5).toFixed(1));
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
  const promoted={...career,stage:'professional',contract,player:{...p,morale:clamp(0,100,p.morale+8),reputation:clamp(1,100,p.reputation+6),contractSatisfaction:88},timeline:[{id:'promotion-'+career.season+'-'+career.week,title:'Promovido ao profissional',text:'A comissão do '+club.name+' decidiu integrar '+p.name+' ao elenco principal e ofereceu o primeiro contrato profissional.',season:career.season,week:career.week,type:'promotion'},...(career.timeline||[])],news:[{id:'promotion-news-'+career.season+'-'+career.week,title:p.name+' sobe ao profissional',text:'A evolução na base abriu a porta do elenco principal.',season:career.season,week:career.week},...(career.news||[])]};
  return enqueuePlayerMoment(promoted,{id:'promotion-'+career.season+'-'+career.week,type:'promotion',title:'Você subiu para o profissional',subtitle:club.name,text:'O trabalho na base virou contrato profissional.',season:career.season,day:career.dayOfSeason});
}
function maybeTransferOffer(career,clubs,rng){
  if(career.stage!=='professional'||career.pendingOffer||career.week%8!==0)return career;
  const p=career.player,life=playerLifeBonuses(career),avg=career.seasonStats.matches?career.seasonStats.totalRating/career.seasonStats.matches:0,signal=(p.reputation+life.reputationLifestyle+Math.max(0,avg-6.4)*14+Math.min(16,career.seasonStats.goals*1.2)+playerBaseCareerOverall(career)*.18)*life.marketMultiplier;
  if(signal<28||rng()>clamp(.10,.62,.30+life.marketMultiplier*.08))return career;
  const current=clubs.find(c=>String(c.id)===String(career.clubId))||{id:'x'},currentLevel=clubLevel(current),candidates=clubs.filter(c=>String(c.id)!==String(career.clubId)).map(c=>({club:c,level:clubLevel(c)})).filter(x=>x.level<=currentLevel+18&&x.level>=currentLevel-8).sort((a,b)=>Math.abs((currentLevel+8)-a.level)-Math.abs((currentLevel+8)-b.level));if(!candidates.length)return career;
  const dream=candidates.find(x=>String(x.club.id)===String(career.dreamClubId)),dreamEligible=dream&&signal>=44+dream.level*.28,dreamRoll=dreamEligible&&rng()<clamp(.08,.58,.12+(signal-45)/110),target=(dreamRoll?dream:candidates[Math.floor(rng()*Math.min(5,candidates.length))]).club,role=signal>62?'Titular em disputa':signal>45?'Rotação com espaço':'Projeto de desenvolvimento',salary=Math.round(contractSalary(target,playerBaseCareerOverall(career),career.age,Math.min(100,signal))*3.1*life.salaryMultiplier/500)*500,years=career.age<=22?4:3,offer={id:'offer-'+career.season+'-'+career.week+'-'+target.id,kind:'transfer',clubId:String(target.id),clubName:target.name,role,salaryMonthly:salary,years,expiresWeek:career.week+3,dreamClub:String(target.id)===String(career.dreamClubId)};
  return{...career,pendingOffer:offer,news:[{id:offer.id+'-news',title:target.name+' procura '+p.name,text:(offer.dreamClub?'O clube dos sonhos entrou na corrida. ':'')+'O desempenho despertou interesse no mercado.',season:career.season,week:career.week},...(career.news||[])]};
}
export function respondPlayerOffer(career,clubs,accept){
  const offer=career.pendingOffer;if(!offer)return career;
  if(!accept)return{...career,pendingOffer:null,player:{...career.player,morale:clamp(0,100,career.player.morale+1)},timeline:[{id:offer.id+'-reject',title:'Permanência escolhida',text:career.player.name+' decidiu seguir no projeto atual.',season:career.season,week:career.week,type:'decision'},...(career.timeline||[])]};
  const target=clubs.find(c=>String(c.id)===String(offer.clubId));if(!target)return{...career,pendingOffer:null};
  const contract={clubId:String(target.id),clubName:target.name,startSeason:career.season,expirySeason:career.season+Number(offer.years||3),salaryMonthly:Number(offer.salaryMonthly||contractSalary(target,playerBaseCareerOverall(career),career.age,60)),role:offer.role||'Profissional',kind:'pro'};
  const moved={...career,clubId:String(target.id),contract,pendingOffer:null,player:{...career.player,coachTrust:45,morale:clamp(0,100,career.player.morale+(offer.dreamClub?8:3)),reputation:clamp(1,100,career.player.reputation+2),contractSatisfaction:90},timeline:[{id:offer.id+'-accept',title:'Novo clube: '+target.name,text:career.player.name+' aceitou um novo passo na carreira'+(offer.dreamClub?' e realizou o objetivo de vestir a camisa do clube dos sonhos.':'.'),season:career.season,week:career.week,type:'transfer'},...(career.timeline||[])]};
  return enqueuePlayerMoment(moved,{id:offer.id+'-moment',type:offer.dreamClub?'dream-club':'transfer',title:offer.dreamClub?'O clube dos sonhos':'Novo capítulo',subtitle:target.name,text:career.player.name+' aceitou um novo passo na carreira'+(offer.dreamClub?' e realizou o objetivo de vestir a camisa do clube dos sonhos.':'.'),season:career.season,day:career.dayOfSeason});
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
  let prepared=seasonHonours(career);const age=prepared.age+1,season=prepared.season+1,p=prepared.player,decline=age>=35?(p.position==='GOL'&&age<39?0:.6):0,attrs={...p.attributes};if(decline)for(const key of ['pace','physical'])attrs[key]=clamp(20,96,finite(attrs[key],50)-decline);
  const shouldRetire=age>=43||(age>=40&&playerCareerOverall(prepared)<63);
  if(shouldRetire){
    const retired={...prepared,age,season,week:0,dayOfSeason:0,dayOfWeek:0,stage:'retired',player:{...p,attributes:attrs,condition:clamp(35,100,p.condition+8),form:0,injury:null},timeline:[{id:'retirement-'+season,title:'Fim da carreira',text:p.name+' encerra a trajetória profissional aos '+age+' anos.',season,week:0,type:'retirement'},...(prepared.timeline||[])]};
    return enqueuePlayerMoment(retired,{id:'retirement-'+season,type:'retirement',title:'Último apito',subtitle:'Fim da carreira',text:p.name+' encerra a trajetória profissional aos '+age+' anos.',season,day:0});
  }
  let contract=prepared.contract;
  if(contract&&Number(contract.expirySeason)<=season){
    const currentSalary=finite(contract.salaryMonthly,5000),life=playerLifeBonuses(prepared),raise=clamp(1.04,1.48,(1.08+Math.max(0,playerCareerOverall(prepared)-70)*.012+Math.max(0,p.form)*.025)*life.salaryMultiplier),salary=Math.round(currentSalary*raise/500)*500;
    contract={...contract,startSeason:season,expirySeason:season+3,salaryMonthly:salary,role:playerCareerOverall(prepared)>=78?'Titular em disputa':playerCareerOverall(prepared)>=70?'Rotação':'Desenvolvimento'};
  }
  return{...prepared,season,week:0,dayOfSeason:0,dayOfWeek:0,age,contract,seasonStats:{matches:0,starts:0,minutes:0,goals:0,assists:0,totalRating:0},player:{...p,attributes:attrs,condition:clamp(35,100,p.condition+12),form:formRegression(p.form,0),injury:null,contractSatisfaction:contract?clamp(0,100,82):p.contractSatisfaction},timeline:[{id:'season-'+season,title:'Temporada '+season,text:p.name+' inicia mais um ano aos '+age+' anos.',season,week:0,type:'season'},...(prepared.timeline||[])]};
}
function poissonGoals(lambda,rng){
  const limit=Math.exp(-Math.max(.05,lambda));let p=1,k=0;do{k++;p*=rng();}while(p>limit&&k<9);return Math.max(0,k-1);
}
function simulatePlayerTeamMatch(career,club,clubs,rng,selected){
  const opponents=(clubs||[]).filter(item=>String(item.id)!==String(club.id));const opponent=opponents.length?opponents[hashSeed(career.seed,career.season,career.dayOfSeason,'opponent')%opponents.length]:club,isHome=rng()<.5,ownLevel=clubLevel(club),oppLevel=clubLevel(opponent),playerImpact=selected?clamp(-2,5,(playerCareerOverall(career)-65)*.10):0;
  const ownStrength=teamStrength({quality:clamp(0,100,ownLevel+playerImpact),form:clamp(20,85,50+career.player.form*10),morale:career.player.morale,tactics:50,condition:career.player.condition,coach:career.player.coachTrust,home:isHome?100:0,context:52});
  const oppStrength=teamStrength({quality:oppLevel,form:50,morale:72,tactics:50,condition:88,coach:65,home:isHome?0:100,context:50}),dominance=logisticDominance(ownStrength,oppStrength),approach=approachDef(career.matchApproach);
  const ownXg=expectedGoals({dominance,base:1.18,attackVsDefense:(ownLevel-oppLevel)*.20,tacticalEdge:(approach.goal-1)*.16,min:.15,max:4}),oppXg=expectedGoals({dominance:1-dominance,base:1.10,attackVsDefense:(oppLevel-ownLevel)*.20,tacticalEdge:selected&&approach.id==='aggressive'?.035:0,min:.15,max:4});
  return{opponentId:String(opponent.id),opponentName:opponent.name,isHome,xg:[Number(ownXg.toFixed(2)),Number(oppXg.toFixed(2))],goalsFor:poissonGoals(ownXg,rng),goalsAgainst:poissonGoals(oppXg,rng),strength:[ownStrength,oppStrength]};
}
function simulatePlayerMatchDay(career,clubs=[]){
  const club=clubs.find(c=>String(c.id)===String(career.clubId));if(!club)return career;
  let next=career,p={...career.player},focus=trainingDef(career.trainingFocus),approach=approachDef(career.matchApproach),life=playerLifeBonuses(career),rng=mulberry32(hashSeed(career.seed,career.season,career.dayOfSeason,'match-day'));
  const injured=Boolean(p.injury&&finite(p.injury.daysRemaining,p.injury.matchesRemaining*7)>0),selection=matchSelection(next,club),selected=!injured&&rng()<clamp(.08,.97,selection.pStart+(next.stage==='academy'?.09:0)),started=selected&&rng()<clamp(.15,.90,selection.pStart*.86),teamMatch=simulatePlayerTeamMatch(next,club,clubs,rng,selected);
  let performance=null;
  if(selected){
    performance=simulatePerformance(next,club,started,rng,teamMatch.goalsFor,teamMatch.goalsAgainst);p.condition=clamp(35,100,p.condition-(performance.minutes/7)*(1+(focus.id==='physical'?.08:0))*approach.fatigue);p.form=formRegression(p.form,(performance.rating-6.5)/.7);p.morale=clamp(0,100,p.morale+(performance.rating>=7?2:performance.rating<6?-2:.3)+(teamMatch.goalsFor>teamMatch.goalsAgainst?.8:teamMatch.goalsFor<teamMatch.goalsAgainst?-.5:0));p.coachTrust=clamp(0,100,p.coachTrust+(performance.rating-6.4)*1.8+(started?.25:0)+approach.trust);
  }else if(!injured){p.form=formRegression(p.form,-.25);p.coachTrust=clamp(0,100,p.coachTrust-.35);}
  const injuryRisk=selected?individualInjuryRisk({baseRisk:.007,fatigue:100-p.condition,intensity:focus.id==='physical'?1.18:1,condition:p.condition,age:next.age,trainingMultiplier:focus.injury*approach.injury*life.injuryMultiplier,medicalLevel:clamp(1,5,Math.round(1+(getClubWorld(club.id).gameBudgetM||20)/35)),injuryHistory:p.injuryHistory}):0;
  if(selected&&rng()<injuryRisk){const severity=rng()<.58?1:rng()<.83?2:rng()<.95?3:rng()<.99?4:5,recovery=injuryRecovery({severity,medicalLevel:3,age:next.age,fitness:p.condition,injuryHistory:p.injuryHistory}),days=Math.max(2,Math.round(recovery.matches*7*life.injuryRecoveryMultiplier));p.injury={severity,label:severity>=5?'Lesão ligamentar grave':severity===4?'Lesão importante':severity===3?'Entorse moderada':severity===2?'Lesão muscular leve':'Pancada / desconforto',daysRemaining:days,matchesRemaining:Math.max(1,Math.ceil(days/7))};p.injuryHistory++;p.morale=clamp(0,100,p.morale-severity*1.4);}
  p.attributes=injured?p.attributes:weeklyDevelopment({...next,player:p},performance,rng);p.currentOverall=playerBaseCareerOverall({...next,player:p});
  const resultLabel=teamMatch.goalsFor>teamMatch.goalsAgainst?'Vitória':teamMatch.goalsFor===teamMatch.goalsAgainst?'Empate':'Derrota';
  next={...next,player:p,lastMatch:{day:next.dayOfSeason,week:next.week,selected,started,performance,injured,selectionChance:Number(selection.pStart.toFixed(2)),injury:p.injury||null,opponentName:teamMatch.opponentName,isHome:teamMatch.isHome,goalsFor:teamMatch.goalsFor,goalsAgainst:teamMatch.goalsAgainst,xg:teamMatch.xg,resultLabel},careerStats:performance?addStats(next.careerStats,performance,started):next.careerStats,seasonStats:performance?addStats(next.seasonStats,performance,started):next.seasonStats,lastDay:{day:next.dayOfSeason,type:'match',title:resultLabel+' · '+teamMatch.goalsFor+' x '+teamMatch.goalsAgainst,text:(selected?(started?'Você começou como titular.':'Você entrou durante a partida.'):'Você não entrou em campo.')+' Adversário: '+teamMatch.opponentName+'.'}};
  if(performance&&(performance.rating>=8.2||performance.goals>=2))next={...next,news:[{id:'player-performance-'+next.season+'-'+next.dayOfSeason,title:performance.goals>=2?'Atuação decisiva de '+p.name:p.name+' é destaque',text:'Nota '+performance.rating.toFixed(1)+' contra '+teamMatch.opponentName+(performance.goals?' · '+performance.goals+' gol(s)':'')+'.',season:next.season,week:next.week,day:next.dayOfSeason},...(next.news||[])].slice(0,80)};
  next=maybeMilestone(next,performance);next=maybeProfessionalPromotion(next,club);next=maybeNationalTeam(next);next=maybeTransferOffer(next,clubs,rng);return next;
}
export function simulatePlayerDay(career,clubs=[]){
  if(!career||!['academy','professional'].includes(career.stage))return career;
  const club=clubs.find(c=>String(c.id)===String(career.clubId));if(!club)return career;
  let next={...career,dayOfSeason:finite(career.dayOfSeason,career.week*7)+1},p={...career.player},life=playerLifeBonuses(career),focus=trainingDef(career.trainingFocus);
  next.week=Math.floor(next.dayOfSeason/7);next.dayOfWeek=next.dayOfSeason%7;
  if(next.pendingOffer&&next.week>finite(next.pendingOffer.expiresWeek,next.week)){next={...next,pendingOffer:null,news:[{id:'offer-expired-'+next.season+'-'+next.dayOfSeason,title:'Proposta expirada',text:'A janela de decisão terminou e o clube retirou a proposta.',season:next.season,week:next.week,day:next.dayOfSeason},...(next.news||[])].slice(0,80)};}
  const trainingDay=[1,2,3,4].includes(next.dayOfWeek),matchDay=next.dayOfWeek===5;
  if(p.injury){
    const remaining=Math.max(0,finite(p.injury.daysRemaining,p.injury.matchesRemaining*7)-1),injury=remaining>0?{...p.injury,daysRemaining:remaining,matchesRemaining:Math.max(1,Math.ceil(remaining/7))}:null;p.injury=injury;p.condition=clamp(35,100,p.condition+1.6+life.dailyRecovery);next.lastDay={day:next.dayOfSeason,type:injury?'recovery':'medical-clearance',title:injury?'Recuperação':'Liberado pelo departamento médico',text:injury?'O tratamento reduziu o tempo restante para '+remaining+' dia(s).':'Você está novamente disponível.'};
  }else{
    const trainingDelta=trainingDay?(focus.condition/7-(focus.id==='physical'?1.1:.35)):(1.05+life.dailyRecovery);p.condition=clamp(35,100,p.condition+trainingDelta);if(trainingDay)next.lastDay={day:next.dayOfSeason,type:'training',title:'Treino · '+focus.label,text:'A sessão alterou carga, preparação e risco para o próximo jogo.'};else next.lastDay={day:next.dayOfSeason,type:'recovery',title:'Rotina de recuperação',text:'Descanso, alimentação e estrutura pessoal influenciaram a condição.'};
  }
  p.morale=clamp(0,100,Math.max(p.morale,68+life.moraleBaseline*.45));next={...next,player:p};
  if(matchDay)next=simulatePlayerMatchDay(next,clubs);
  if(next.dayOfSeason>0&&next.dayOfSeason%28===0){next=settlePlayerMonth(next);next=refreshPlayerSponsorOffers(next);}
  return advancePlayerSeason(next);
}
export function simulatePlayerDays(career,clubs=[],days=1){
  let next=career;for(let i=0;i<Math.max(1,Math.min(31,Math.round(days)));i++){if(next.stage==='retired')break;next=simulatePlayerDay(next,clubs);}return next;
}
export function simulatePlayerWeek(career,clubs=[]){return simulatePlayerDays(career,clubs,7);}
export function acknowledgePlayerMoment(career){
  const queue=Array.isArray(career?.momentQueue)?career.momentQueue:[];
  return{...career,pendingMoment:queue[0]||null,momentQueue:queue.slice(1)};
}
export function playerCalendarLabel(career){
  const base=new Date(Date.UTC(Number(career?.season||2026),0,5)),date=new Date(base.getTime()+finite(career?.dayOfSeason,0)*86400000);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(date);
}
export function sanitizePlayerCareer(raw,clubs=[]){
  if(!raw||raw.mode!=='player'||!raw.player||Number(raw.version||0)>PLAYER_CAREER_VERSION)return null;
  const base=createPlayerCareer({name:raw.player.name,position:raw.player.position,archetype:raw.player.archetype,foot:raw.player.foot,dreamClubId:raw.dreamClubId,face:raw.player.face},finite(raw.season,2026));
  const stage=['trial','academy','professional','retired'].includes(raw.stage)?raw.stage:'trial';
  const dayOfSeason=clamp(0,266,finite(raw.dayOfSeason,finite(raw.week,0)*7)),dayOfWeek=dayOfSeason%7;
  const clubId=raw.clubId&&clubs.some(c=>String(c.id)===String(raw.clubId))?String(raw.clubId):null;
  const matchApproach=PLAYER_MATCH_APPROACHES.some(item=>item.id===raw.matchApproach)?raw.matchApproach:'balanced';
  const trainingFocus=PLAYER_TRAINING.some(item=>item.id===raw.trainingFocus)?raw.trainingFocus:'balanced';
  const nationalTeamStatus=['none','called-up'].includes(raw.nationalTeamStatus)?raw.nationalTeamStatus:'none';
  const rawContract=raw.contract&&typeof raw.contract==='object'&&!Array.isArray(raw.contract)?raw.contract:null;
  const contract=rawContract&&clubId?{
    clubId,
    clubName:String(rawContract.clubName||clubs.find(c=>String(c.id)===clubId)?.name||'Clube').slice(0,100),
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
    ...base,...raw,version:PLAYER_CAREER_VERSION,mode:'player',stage,clubId,matchApproach,trainingFocus,nationalTeamStatus,contract,finance:sanitizePlayerFinance(raw.finance||base.finance),dayOfSeason,dayOfWeek,
    age:clamp(16,50,finite(raw.age,16)),week:clamp(0,38,Math.floor(dayOfSeason/7)),season:clamp(2026,2100,finite(raw.season,2026)),
    player:{...base.player,...raw.player,name:safeName(raw.player.name),attributes:{...base.player.attributes,...Object.fromEntries(Object.entries(raw.player.attributes||{}).map(([key,value])=>[key,clamp(1,99,finite(value,base.player.attributes[key]||50))]))},condition:clamp(35,100,finite(raw.player.condition,100)),morale:clamp(0,100,finite(raw.player.morale,78)),coachTrust:clamp(0,100,finite(raw.player.coachTrust,42)),reputation:clamp(1,100,finite(raw.player.reputation,5)),contractSatisfaction:clamp(0,100,finite(raw.player.contractSatisfaction,70)),potential:clamp(45,99,finite(raw.player.potential,base.player.potential)),injuryHistory:clamp(0,100,finite(raw.player.injuryHistory,0)),injury:raw.player.injury?{...raw.player.injury,daysRemaining:clamp(0,365,finite(raw.player.injury.daysRemaining,finite(raw.player.injury.matchesRemaining,0)*7)),matchesRemaining:clamp(0,52,finite(raw.player.injury.matchesRemaining,Math.ceil(finite(raw.player.injury.daysRemaining,0)/7)))}:null,face:{...base.player.face,...raw.player.face}},
    careerStats:sanitizeStats(raw.careerStats),seasonStats:sanitizeStats(raw.seasonStats),
    timeline:Array.isArray(raw.timeline)?raw.timeline.slice(0,120):base.timeline,news:Array.isArray(raw.news)?raw.news.slice(0,80):[],achievements:Array.isArray(raw.achievements)?raw.achievements.slice(0,80):[],awards:Array.isArray(raw.awards)?raw.awards.slice(0,60):[],
    pendingOffer:raw.pendingOffer&&typeof raw.pendingOffer==='object'&&!Array.isArray(raw.pendingOffer)?{...raw.pendingOffer,clubId:String(raw.pendingOffer.clubId||'').slice(0,80),clubName:String(raw.pendingOffer.clubName||'').slice(0,100),salaryMonthly:clamp(0,100_000_000,finite(raw.pendingOffer.salaryMonthly,0)),years:clamp(1,5,finite(raw.pendingOffer.years,3)),expiresWeek:clamp(0,41,finite(raw.pendingOffer.expiresWeek,0))}:null,
    pendingMoment:raw.pendingMoment&&typeof raw.pendingMoment==='object'&&!Array.isArray(raw.pendingMoment)?{id:String(raw.pendingMoment.id||'moment').slice(0,100),type:String(raw.pendingMoment.type||'milestone').slice(0,40),title:String(raw.pendingMoment.title||'Momento da carreira').slice(0,120),subtitle:String(raw.pendingMoment.subtitle||'').slice(0,120),text:String(raw.pendingMoment.text||'').slice(0,500),season:clamp(2026,2100,finite(raw.pendingMoment.season,raw.season||2026)),day:clamp(0,266,finite(raw.pendingMoment.day,0))}:null,
    momentQueue:Array.isArray(raw.momentQueue)?raw.momentQueue.slice(0,20).filter(item=>item&&typeof item==='object').map(item=>({id:String(item.id||'moment').slice(0,100),type:String(item.type||'milestone').slice(0,40),title:String(item.title||'Momento da carreira').slice(0,120),subtitle:String(item.subtitle||'').slice(0,120),text:String(item.text||'').slice(0,500),season:clamp(2026,2100,finite(item.season,raw.season||2026)),day:clamp(0,266,finite(item.day,0))})):[],
    lastDay:raw.lastDay&&typeof raw.lastDay==='object'&&!Array.isArray(raw.lastDay)?{day:clamp(0,266,finite(raw.lastDay.day,0)),type:String(raw.lastDay.type||'day').slice(0,40),title:String(raw.lastDay.title||'Dia concluído').slice(0,120),text:String(raw.lastDay.text||'').slice(0,500)}:null,
  };
  return merged;
}
export function serializePlayerCareer(career){return JSON.stringify({signature:'linha-de-frente-player-save',fileVersion:2,exportedAt:new Date().toISOString(),career});}
export function parsePlayerCareer(text,clubs=[]){
  const payload=parseSafeJson(text);
  if(!payload||payload.signature!=='linha-de-frente-player-save'||payload.fileVersion>2)throw new Error('Este arquivo não é uma carreira de jogador válida.');
  const career=sanitizePlayerCareer(payload.career,clubs);if(!career)throw new Error('Estado da carreira de jogador inválido.');return career;
}
