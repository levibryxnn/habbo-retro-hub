import { getClubWorld } from './club-world.js';
import { playerGameStats, autoLineup } from './player-engine.js';
import { applyConfidenceEvent, createManagerConfidence } from './manager-confidence.js';
import { initialCashForClub } from './finance-model.js';
import { initialTransferBudget } from './economy-engine.js';
import { emitCareerEvent } from './event-engine.js';
import { salaryDemand } from './ldf-engine.js';

const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const roll=seed=>(hashString(seed)%1000000)/1000000;
const FIRST=['André','Bruno','Caio','Diego','Eduardo','Felipe','Gabriel','Henrique','João','Leandro','Marcelo','Paulo','Rafael','Renato','Ricardo','Thiago','Vinícius'];
const LAST=['Almeida','Barbosa','Cardoso','Costa','Ferreira','Gomes','Lima','Martins','Mendes','Oliveira','Pereira','Ribeiro','Rocha','Santos','Silva','Souza'];
const managerName=seed=>FIRST[hashString(seed+'|f')%FIRST.length]+' '+LAST[hashString(seed+'|l')%LAST.length];

function contractKey(clubId,player){return String(player?._playerKey||String(player?._originClubId||clubId)+':'+String(player?.id));}
function estimatedSalary(player){
  const s=playerGameStats(player),age=Number(player?._careerAge??player?.age??27),peak=age>=23&&age<=30?1.08:age<=20?.84:age>=35?.9:1;
  return Math.round((18000+Math.pow(Math.max(45,s.overall)-45,2)*1050)*peak/1000)*1000;
}
function initialContracts(career,club){
  const current={...(career.playerContracts||{})};
  for(const player of club?.players||[]){
    const key=contractKey(club.id,player);if(current[key])continue;
    const years=1+(hashString(key+'|contract|'+career.season)%4);
    current[key]={key,playerId:String(player.id),name:player.name,clubId:String(club.id),startSeason:career.season,expirySeason:career.season+years,salaryMonthly:estimatedSalary(player),role:playerGameStats(player).overall>=78?'Titular':playerGameStats(player).overall>=70?'Rotação':'Elenco'};
  }
  return current;
}
function initialFacilities(clubId){
  const world=getClubWorld(clubId),base=clamp(1,5,Math.round(1+(world.fanIndex||.5)*2+(world.gameBudgetM||20)/95));
  return{training:base,medical:clamp(1,5,base-(hashString(clubId+'med')%2)),academy:clamp(1,5,base+(hashString(clubId+'aca')%2)),scouting:clamp(1,5,Math.max(1,base-1))};
}
function defaultObjectives(career,club){
  const world=getClubWorld(club.id),big=(world.fanIndex||.5)>.82,rich=(world.gameBudgetM||0)>=55;
  return[
    {id:'league-project',label:big?'Classificar à Libertadores':'Estabilizar o clube na Série A',targetSeason:career.season+1,type:'league',status:'active'},
    {id:'finance-project',label:rich?'Manter folha e mercado sob controle':'Encerrar a temporada com caixa positivo',targetSeason:career.season+1,type:'finance',status:'active'},
    {id:'academy-project',label:'Promover pelo menos um jogador da base',targetSeason:career.season+1,type:'academy',status:'active'},
  ];
}
function initialWorldManagers(clubs,season){
  return Object.fromEntries((clubs||[]).map(club=>[String(club.id),{clubId:String(club.id),name:managerName(club.id+'|'+season),sinceSeason:season,security:62+(hashString(club.id+'sec')%27)}]));
}

export function initializeCareerLife(career,club,clubs=[]){
  const facilities=career.facilities||initialFacilities(club.id);
  return{
    ...career,
    lifeSystemsVersion:2,
    playerContracts:initialContracts(career,club),
    playerPromises:Array.isArray(career.playerPromises)?career.playerPromises:[],
    facilities,
    projectObjectives:Array.isArray(career.projectObjectives)&&career.projectObjectives.length?career.projectObjectives:defaultObjectives(career,club),
    jobOffers:Array.isArray(career.jobOffers)?career.jobOffers:[],
    managerClubHistory:Array.isArray(career.managerClubHistory)&&career.managerClubHistory.length?career.managerClubHistory:[{clubId:String(club.id),clubName:club.name,fromSeason:career.season,fromRound:career.round||0,toSeason:null,toRound:null}],
    managerTrophies:Array.isArray(career.managerTrophies)?career.managerTrophies:[],
    worldManagers:career.worldManagers&&typeof career.worldManagers==='object'?career.worldManagers:initialWorldManagers(clubs,career.season),
  };
}
export function expiringContracts(career,club,withinSeasons=1){
  const contracts=career?.playerContracts||{};
  return(club?.players||[]).map(player=>({player,contract:contracts[contractKey(club.id,player)]})).filter(item=>item.contract&&item.contract.expirySeason<=career.season+withinSeasons).sort((a,b)=>a.contract.expirySeason-b.contract.expirySeason||b.contract.salaryMonthly-a.contract.salaryMonthly);
}
export function renewPlayerContract(career,club,playerId,years=3){
  const player=club?.players?.find(p=>String(p.id)===String(playerId));if(!player)return{career,error:'Jogador não encontrado.'};
  const key=contractKey(club.id,player),old=career.playerContracts?.[key]||{salaryMonthly:estimatedSalary(player)},stats=playerGameStats(player),overall=stats.overall,age=Number(player?._careerAge??player?.age??27),form=Number(career.playerForm?.[key]||0),role=String(old.role||'Elenco'),meta=getClubWorld(club.id),squadValueBRL=Math.max(8_000_000,Number(meta.marketTotalEurM||50)*1_000_000*6.25),estimatedValue=Math.max(1_000_000,squadValueBRL/Math.max(18,(club.players||[]).length)*Math.pow(Math.max(50,overall)/68,2.5)*(age<=23?1.25:age>=33?.72:1)),roleFactor=role==='Titular'?1.12:role==='Rotação'?1.03:.96,formFactor=clamp(.92,1.14,1+form*.035),agentDemand=.96+(hashString(key+'|renew-agent|'+career.season)%13)/100,wealth=clamp(.82,1.25,.82+Number(meta.gameBudgetM||20)/180,demand=salaryDemand({baseSalary:Number(old.salaryMonthly||estimatedSalary(player)),quality:overall,marketValue:estimatedValue,reputation:Number(career.managerReputation||50),contractYearsLeft:Math.max(0,Number(old.expirySeason||career.season)-Number(career.season)),agentDemand,clubWealth:wealth}),ageFactor=age<=21?.92:age>=34?.94:1,newSalary=Math.max(Number(old.salaryMonthly||0),Math.round(demand*roleFactor*formFactor*ageFactor/1000)*1000),signing=Math.round(newSalary*(1.4+clamp(1,5,years)*.35)),cash=Number(career.cash||0);
  if(cash<signing)return{career,error:'Caixa insuficiente para luvas e renovação.'};
  let next={...career,cash:cash-signing,playerContracts:{...(career.playerContracts||{}),[key]:{...old,key,playerId:String(player.id),name:player.name,clubId:String(club.id),startSeason:career.season,expirySeason:career.season+clamp(1,5,years),salaryMonthly:newSalary,signingBonus:signing,role}},transactions:[{id:'renew-'+key+'-'+career.season+'-'+career.round,round:career.round,amount:-signing,label:'Renovação de '+player.name,kind:'contract'},...(career.transactions||[])].slice(0,160)};
  next=emitCareerEvent(next,{type:'CONTRACT_RENEWED',playerId:player.id,importance:2,payload:{name:player.name,years,newSalary,signing,role}});
  return{career:next,contract:next.playerContracts[key]};
}
export const PROMISE_TYPES=[
  {id:'minutes',label:'Mais minutos',deadline:8},
  {id:'starter',label:'Brigar pela titularidade',deadline:6},
  {id:'no-sale',label:'Não será vendido nesta janela',deadline:10},
];
export function makePlayerPromise(career,club,playerId,type='minutes'){
  const player=club?.players?.find(p=>String(p.id)===String(playerId)),config=PROMISE_TYPES.find(item=>item.id===type)||PROMISE_TYPES[0];if(!player)return career;
  const key=contractKey(club.id,player),existing=(career.playerPromises||[]).some(item=>item.key===key&&item.status==='active');if(existing)return career;
  let next={...career,playerPromises:[{id:'promise-'+key+'-'+career.season+'-'+career.round,key,playerId:String(player.id),name:player.name,type:config.id,label:config.label,createdRound:career.round||0,deadlineMatches:config.deadline,matches:0,starts:0,appearances:0,status:'active'},...(career.playerPromises||[])].slice(0,40)};
  return emitCareerEvent(next,{type:'PROMISE_MADE',playerId:player.id,importance:2,payload:{name:player.name,promise:config.label}});
}
function appeared(result,clubId,playerId){
  const side=String(result.homeId)===String(clubId)?'home':String(result.awayId)===String(clubId)?'away':null;if(!side)return{start:false,appearance:false};
  const lineup=(side==='home'?result.homeLineup:result.awayLineup)||[],subs=(result.substitutions||[]).filter(item=>item.side===side),id=String(playerId),start=lineup.map(String).includes(id),sub=subs.some(item=>String(item.inPlayerId)===id);
  return{start,appearance:start||sub};
}
export function processPlayerPromises(career,club,result){
  const promises=[...(career.playerPromises||[])];if(!promises.some(item=>item.status==='active'))return career;
  const mood={...(career.dressingRoom?.playerMood||{})};let next=career,changed=false;
  const updated=promises.map(item=>{
    if(item.status!=='active')return item;
    const a=appeared(result,club.id,item.playerId),matches=item.matches+1,starts=item.starts+(a.start?1:0),appearances=item.appearances+(a.appearance?1:0);
    let status='active';
    if(item.type==='minutes'&&appearances>=Math.max(3,Math.ceil(matches*.55)))status='fulfilled';
    if(item.type==='starter'&&starts>=Math.max(2,Math.ceil(matches*.5)))status='fulfilled';
    if(item.type==='no-sale'&&matches>=item.deadlineMatches)status='fulfilled';
    if(matches>=item.deadlineMatches&&status==='active')status='broken';
    if(status!==item.status){changed=true;const old=mood[item.key]||{name:item.name,morale:72,managerTrust:60};mood[item.key]={...old,name:item.name,morale:clamp(20,100,(old.morale||72)+(status==='fulfilled'?8:-12)),managerTrust:clamp(0,100,(old.managerTrust||60)+(status==='fulfilled'?12:-18)),promiseStatus:status};next=emitCareerEvent(next,{type:status==='fulfilled'?'PROMISE_FULFILLED':'PROMISE_BROKEN',playerId:item.playerId,importance:status==='fulfilled'?2:4,payload:{name:item.name,promise:item.label}});}
    return{...item,matches,starts,appearances,status};
  });
  next={...next,playerPromises:updated,dressingRoom:{...(next.dressingRoom||{}),playerMood:mood}};
  if(changed){
    const broken=updated.filter(item=>item.status==='broken'&&item.matches===item.deadlineMatches).length,fulfilled=updated.filter(item=>item.status==='fulfilled'&&item.matches<=item.deadlineMatches).length;
    if(broken)next=applyConfidenceEvent(next,{fans:-.5*broken,board:-.4*broken,kind:'promise',reason:'Promessas não cumpridas começaram a repercutir no vestiário.'});
    if(fulfilled)next=applyConfidenceEvent(next,{board:.25*fulfilled,kind:'promise',reason:'Compromissos cumpridos reforçaram a confiança interna no treinador.'});
  }
  return next;
}
export function upgradeFacility(career,type){
  const current=Number(career.facilities?.[type]||1);if(current>=5)return{career,error:'Esta estrutura já está no nível máximo.'};
  const base={training:7000000,medical:6000000,academy:9000000,scouting:5000000}[type];if(!base)return{career,error:'Estrutura inválida.'};
  const cost=Math.round(base*Math.pow(current,1.45)/100000)*100000;if(Number(career.cash||0)<cost)return{career,error:'Caixa insuficiente para este investimento.'};
  const facilities={...(career.facilities||{}),[type]:current+1};let next={...career,cash:Number(career.cash||0)-cost,facilities,transactions:[{id:'facility-'+type+'-'+career.season+'-'+career.round,round:career.round,amount:-cost,label:'Melhoria de '+type,kind:'facility'},...(career.transactions||[])].slice(0,160)};
  if(type==='academy')next={...next,youthAcademy:{...(next.youthAcademy||{}),level:Math.max(next.youthAcademy?.level||1,current+1)}};
  if(type==='scouting')next={...next,scouting:{...(next.scouting||{}),level:Math.max(next.scouting?.level||1,current+1)}};
  return{career:emitCareerEvent(next,{type:'FACILITY_UPGRADED',importance:3,payload:{type,level:current+1,cost}}),cost};
}
function clubAttractiveness(club){const w=getClubWorld(club.id);return clamp(1,100,(w.fanIndex||.5)*55+(w.gameBudgetM||20)*.45);}
export function refreshJobOffers(career,clubs){
  const record=career.careerRecord||{},matches=Number(record.matches||0);if(matches<8||matches%6!==0)return career;
  const active=(career.jobOffers||[]).filter(item=>item.expiresAtMatch>matches&&item.status==='open');if(active.length)return career;
  const current=clubs.find(c=>String(c.id)===String(career.userClubId)),currentLevel=current?clubAttractiveness(current):50,rep=Number(career.managerReputation||50),seed=career.season+'|'+matches+'|jobs';
  const candidates=(clubs||[]).filter(c=>String(c.id)!==String(career.userClubId)).map(club=>{
    const target=clubAttractiveness(club),step=target-currentLevel,fit=rep-target*.58-step*.16+(roll(seed+'|'+club.id)-.5)*22;
    return{club,score:fit,target,step};
  }).filter(item=>item.score>6&&item.step<28).sort((a,b)=>b.score-a.score).slice(0,2);
  if(!candidates.length)return career;
  let next={...career,jobOffers:candidates.map(item=>({id:'job-'+career.season+'-'+matches+'-'+item.club.id,clubId:String(item.club.id),clubName:item.club.name,score:Number(item.score.toFixed(1)),status:'open',createdAtMatch:matches,expiresAtMatch:matches+5,project:item.step>10?'Salto de carreira':item.step<-8?'Projeto de reconstrução':'Novo desafio'}))};
  for(const offer of next.jobOffers)next=emitCareerEvent(next,{type:'JOB_OFFERED',clubId:offer.clubId,importance:3,payload:{clubName:offer.clubName,project:offer.project}});
  return next;
}
export function acceptJobOffer(career,clubs,clubId){
  const target=clubs.find(c=>String(c.id)===String(clubId)),offer=(career.jobOffers||[]).find(item=>String(item.clubId)===String(clubId)&&item.status==='open');if(!target||!offer)return{career,error:'Proposta indisponível.'};
  const history=(career.managerClubHistory||[]).map((item,index)=>index===0&&item.toSeason==null?{...item,toSeason:career.season,toRound:career.round}:item);
  let next={...career,userClubId:String(target.id),cash:initialCashForClub(target.id),openingCash:initialCashForClub(target.id),transferBudget:initialTransferBudget(target.id),sponsors:[],lineup:autoLineup(target,career,career.round+1),managerConfidence:createManagerConfidence(),boardPressureStreak:0,boardWarning:null,managerStatus:'active',dismissal:null,jobOffers:[],playerPromises:[],projectObjectives:defaultObjectives(career,target),facilities:initialFacilities(target.id),managerTrophies:[...(career.managerTrophies||[]),...(career.trophies||[])],trophies:[],managerClubHistory:[{clubId:String(target.id),clubName:target.name,fromSeason:career.season,fromRound:career.round,toSeason:null,toRound:null},...history],playerContracts:initialContracts(career,target)};
  next=emitCareerEvent(next,{type:'MANAGER_CHANGED_CLUB',clubId:target.id,importance:5,payload:{clubName:target.name,project:offer.project}});
  return{career:next,club:target};
}
export function advanceWorldManagers(career,clubs){
  if((career.round||0)%8!==0)return career;
  const managers={...(career.worldManagers||initialWorldManagers(clubs,career.season))},notes=[...(career.universeNotes||[])];let changed=false;
  for(const club of clubs||[]){
    if(String(club.id)===String(career.userClubId))continue;
    const id=String(club.id),current=managers[id]||{clubId:id,name:managerName(id+'|'+career.season),sinceSeason:career.season,security:70},rating=Number(career.world?.ratings?.[id]||0),pressure=rating<-2.5?16:rating<-1?7:0,trigger=roll(career.season+'|'+career.round+'|manager|'+id);
    if(pressure&&trigger<pressure/100){
      const old=current.name,name=managerName(id+'|'+career.season+'|'+career.round+'|new');managers[id]={clubId:id,name,sinceSeason:career.season,security:65};
      notes.unshift({id:'manager-change-'+career.season+'-'+career.round+'-'+id,season:career.season,type:'manager',importance:3,title:club.name+' troca o comando técnico',text:old+' deixa o cargo e '+name+' assume o projeto.',clubId:id,date:String(career.season)+'-r'+career.round});changed=true;
    }
  }
  return changed?{...career,worldManagers:managers,universeNotes:notes.slice(0,70)}:career;
}

export function declineJobOffer(career,offerId){
  return{...career,jobOffers:(career.jobOffers||[]).map(item=>item.id===offerId?{...item,status:'declined'}:item)};
}
export function evaluateProjectObjectives(career,seasonReview){
  const objectives=(career.projectObjectives||[]).map(item=>{
    if(item.status!=='active'||item.targetSeason>career.season)return item;
    let completed=false;
    if(item.type==='league')completed=Number(seasonReview?.position||20)<=12;
    else if(item.type==='finance')completed=Number(career.cash||0)>=0;
    else if(item.type==='academy')completed=(career.regens||[]).some(player=>String(player._originClubId)===String(career.userClubId)&&String(player.id||'').startsWith('youth-'));
    return{...item,status:completed?'completed':'missed',resolvedSeason:career.season};
  });
  const resolved=objectives.filter(item=>item.resolvedSeason===career.season),completed=resolved.filter(item=>item.status==='completed').length,missed=resolved.filter(item=>item.status==='missed').length;
  let next={...career,projectObjectives:objectives};
  if(completed)next=applyConfidenceEvent(next,{board:completed*1.4,kind:'project-objective',reason:'Metas de médio prazo foram cumpridas.'});
  if(missed)next=applyConfidenceEvent(next,{board:-missed*1.2,kind:'project-objective',reason:'Metas de médio prazo ficaram abaixo do esperado.'});
  for(const item of resolved)next=emitCareerEvent(next,{type:item.status==='completed'?'PROJECT_OBJECTIVE_COMPLETED':'PROJECT_OBJECTIVE_MISSED',importance:item.status==='completed'?2:3,payload:{label:item.label}});
  return next;
}

export function expirePlayerContracts(career,club,newSeason){
  if(!club)return career;
  const contracts={...(career.playerContracts||{})},released={...(career.releasedPlayers||{})};let next=career,changed=false;
  for(const player of club.players||[]){
    const key=contractKey(club.id,player),contract=contracts[key];
    if(!contract||contract.status==='expired'||Number(contract.expirySeason)>=Number(newSeason))continue;
    contracts[key]={...contract,status:'expired',expiredSeason:newSeason};released[key]={key,playerId:String(player.id),name:player.name,clubId:String(club.id),season:newSeason,reason:'Fim de contrato'};changed=true;
    next=emitCareerEvent(next,{type:'PLAYER_LEFT_FREE',playerId:player.id,importance:3,payload:{name:player.name,reason:'Fim de contrato'}});
  }
  return changed?{...next,playerContracts:contracts,releasedPlayers:released}:career;
}
