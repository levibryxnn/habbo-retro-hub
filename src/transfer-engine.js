import { addTransaction } from './finance-model.js';
import { getClubWorld, marketSquadReference, rivalryLevel } from './club-world.js';
import { playerGameStats } from './player-engine.js';
import { applyConfidenceEvent } from './manager-confidence.js';
import { applyDevelopmentProfile } from './development-engine.js';
import { canFundDeal, creditTransferSale, spendTransferBudget, transferBudgetSnapshot } from './economy-engine.js';
import { applyTransferDynamics, managerProfile } from './career-dynamics.js';
import { emitCareerEvent } from './event-engine.js';
import { transferAllowedByChallenge } from './challenge-engine.js';

export const EUR_BRL_REFERENCE=6.25;
const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const marketAllocationCache=new Map();
function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function roll(value){return(hashString(value)%10000)/10000;}
export const playerKey=(originClubId,playerId)=>String(originClubId)+':'+String(playerId);
export function normalizeName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
const exactMarketEur={
  '874:hugo souza':11000000,
  '874:andre':16000000,
  '2674:neymar':8000000,
  '2674:gabriel brazao':12000000,
  '3456:pedro morisco':5000000,
  '2026:carlos coronel':1500000,
  '2026:rafael':400000,
};
function playerWeight(player){
  const s=playerGameStats(player),age=player.age??27;
  const ageCurve=age<=20?1.38:age<=23?1.26:age<=27?1.12:age<=30?1:age<=33?.74:age<=35?.5:.3;
  const pos=player.position==='Forward'||player.position==='Attacker'?1.12:player.position==='Midfielder'?1.05:player.position==='Goalkeeper'?.88:1;
  return Math.pow(Math.max(45,s.overall)/65,3.35)*ageCurve*pos;
}
export function playerMarketValueEUR(player,originClub){
  const exact=exactMarketEur[String(originClub.id)+':'+normalizeName(player.name)];
  if(exact)return{value:exact,source:'Transfermarkt 2026 · valor individual'};
  const roster=originClub.players||[],cacheKey=String(originClub.id)+'|'+roster.length+'|'+roster.map(p=>p.id).join(',');
  let allocation=marketAllocationCache.get(cacheKey);
  if(!allocation){
    const total=marketSquadReference(originClub.id),weights=roster.map(playerWeight),sum=weights.reduce((a,b)=>a+b,0)||1;
    allocation=new Map();
    roster.forEach((item,index)=>allocation.set(String(item.id),Math.max(100000,Math.round(total*weights[index]/sum/50000)*50000)));
    marketAllocationCache.set(cacheKey,allocation);
  }
  const allocated=allocation.get(String(player.id))??Math.max(100000,Math.round(marketSquadReference(originClub.id)*playerWeight(player)/Math.max(1,roster.reduce((sum,item)=>sum+playerWeight(item),0))/50000)*50000);
  return{value:allocated,source:'Referência Transfermarkt 2026 · rateio estimado do valor do elenco'};
}
export function playerMarketValueBRL(player,originClub){const eur=playerMarketValueEUR(player,originClub);return{...eur,valueBRL:Math.round(eur.value*EUR_BRL_REFERENCE)};}
function performanceMarketFactor(career,player,key){
  if(!career)return 1;
  const perf=career.seasonPerformance?.[String(player.id)]||career.seasonPerformance?.[String(key||'')]||null,stats=playerGameStats(player),age=Number(player._careerAge??player.age??27);
  if(!perf?.appearances)return 1;
  const avg=Number(perf.totalRating||0)/Math.max(1,Number(perf.appearances||0)),goals=Number(perf.goals||0),assists=Number(perf.assists||0),sample=Math.min(1,Number(perf.appearances||0)/10);
  const form=((avg-6.5)*.16+goals*.012+assists*.008)*sample,potential=Number(player._potential||stats.overall),development=age<=24?Math.max(0,potential-stats.overall)*.006:0;
  return clamp(.78,1.48,1+form+development);
}
export function careerMarketValueEUR(career,player,originClub,key){
  const base=playerMarketValueEUR(player,originClub),factor=performanceMarketFactor(career,player,key||player._playerKey||playerKey(originClub.id,player.id)),value=Math.max(100000,Math.round(base.value*factor/50000)*50000);
  return{...base,value,factor:Number(factor.toFixed(3)),source:factor===1?base.source:base.source+' · ajustado pelo desempenho no save'};
}
export function careerMarketValueBRL(career,player,originClub,key){
  const eur=careerMarketValueEUR(career,player,originClub,key);return{...eur,valueBRL:Math.round(eur.value*EUR_BRL_REFERENCE)};
}
export function formatMarketEUR(value){
  if(value>=1000000)return'€ '+(value/1000000).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
  return'€ '+Math.round(value/1000).toLocaleString('pt-BR')+' mil';
}
export function formatMoneyBRL(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value||0);}
export function playerRef(player,originClubId){return{...player,_originClubId:String(originClubId),_playerKey:playerKey(originClubId,player.id)};}
export function basePlayerIndex(baseClubs){
  const map=new Map();
  for(const club of baseClubs)for(const player of club.players||[])map.set(playerKey(club.id,player.id),{player,originClub:club});
  return map;
}
export function currentOwnerId(career,key,originClubId){
  const permanent=career?.ownership?.[key]||String(originClubId);
  const activeLoan=(career?.loans||[]).find(loan=>loan.playerKey===key&&loan.active!==false&&Number(loan.season)===Number(career.season)&&(career.round||0)<(loan.endRound??38));
  return activeLoan?String(activeLoan.toClubId):String(permanent);
}
export function applyCareerRoster(baseClubs,career){
  const clones=baseClubs.map(club=>({...club,players:[]}));
  const byId=Object.fromEntries(clones.map(club=>[club.id,club]));
  for(const origin of baseClubs){
    for(const raw of origin.players||[]){
      const key=playerKey(origin.id,raw.id);if(career?.retiredPlayers?.[key]||career?.releasedPlayers?.[key])continue;
      const owner=currentOwnerId(career,key,origin.id),target=byId[owner]||byId[origin.id];
      target.players.push(applyDevelopmentProfile(playerRef(raw,origin.id),key,career));
    }
  }
  for(const raw of career?.regens||[]){
    const originId=String(raw._originClubId||raw.clubId||career.userClubId),key=String(raw._playerKey||playerKey(originId,raw.id));
    if(career?.retiredPlayers?.[key]||career?.releasedPlayers?.[key])continue;
    const owner=currentOwnerId(career,key,originId),target=byId[owner]||byId[originId];
    if(target)target.players.push(applyDevelopmentProfile(playerRef(raw,originId),key,career));
  }
  return clones;
}
export function findCareerPlayer(baseClubs,key,career){
  const item=basePlayerIndex(baseClubs).get(key);
  if(item)return{...item,player:applyDevelopmentProfile(playerRef(item.player,item.originClub.id),key,career)};
  const regen=(career?.regens||[]).find(player=>String(player._playerKey||playerKey(player._originClubId,player.id))===String(key));
  if(!regen)return null;
  const originClub=baseClubs.find(club=>String(club.id)===String(regen._originClubId));
  return originClub?{player:applyDevelopmentProfile(playerRef(regen,originClub.id),key,career),originClub}:null;
}
export function estimatedMonthlySalary(player,originClub,career=null,key=null){
  const mv=careerMarketValueBRL(career,player,originClub,key).valueBRL,s=playerGameStats(player),age=player._careerAge??player.age??27;
  const star=s.overall>=80?1.35:s.overall>=75?1.15:1;
  const ageFactor=age<=23?.82:age>=34?.78:1;
  return Math.max(35000,Math.round(mv*.0065*star*ageFactor/5000)*5000);
}
function starLevel(player,originClub){
  const stats=playerGameStats(player),market=playerMarketValueEUR(player,originClub).value,total=marketSquadReference(originClub.id);
  const share=market/Math.max(total,1);
  if(stats.overall>=82||share>.16)return 3;
  if(stats.overall>=77||share>.095)return 2;
  if(stats.overall>=72||share>.055)return 1;
  return 0;
}
export function transferDifficulty(player,originClub,buyerClub,career=null,key=null){
  const market=careerMarketValueBRL(career,player,originClub,key).valueBRL,stars=starLevel(player,originClub),rivalry=rivalryLevel(originClub.id,buyerClub.id),age=player._careerAge??player.age??27;
  const young=age<=23?.14:age>=32?-.08:0;
  const retention=1+stars*.15+rivalry*.22+young;
  return{market,stars,rivalry,retention,minimum:Math.round(market*retention/100000)*100000};
}
function squadNeed(club,player){
  const position=player.position;
  const count=(club.players||[]).filter(p=>p.position===position||(position==='Forward'&&p.position==='Attacker')||(position==='Attacker'&&p.position==='Forward')).length;
  const target=position==='Goalkeeper'?3:position==='Defender'?8:position==='Midfielder'?8:7;
  return clamp(-.12,.18,(target-count)*.035);
}
function negotiationSeed(career,offer){return[career.season,career.round,offer.type,offer.playerKey,offer.fromClubId,offer.toClubId,offer.amount||0,offer.loanFee||0,offer.salaryShare||0,offer.swapPlayerKey||''].join('|');}
function destinationAppeal(career,player,buyerClub,stars){
  const meta=getClubWorld(buyerClub.id),profile=managerProfile(career.managerProfile),reputation=Number(career.managerReputation||50),continental=Object.values(career.world?.competitions||{}).some(comp=>comp.teams?.includes(String(buyerClub.id))&&['libertadores','sudamericana'].includes(comp.id)&&!comp.eliminated?.includes(String(buyerClub.id)))?1:0;
  const base=.34+(meta.fanIndex||.5)*.28+Math.min(.18,(meta.gameBudgetM||20)/500)+reputation/500+continental*.08+(profile.id==='negotiator'?.04:0);
  const demand=stars>=3?.78:stars===2?.65:stars===1?.48:.32;
  return{score:clamp(.2,.96,base),demand};
}

export function evaluateTransferOffer(career,baseClubs,offer){
  const item=findCareerPlayer(baseClubs,offer.playerKey,career);if(!item)return{status:'rejected',reason:'Jogador não encontrado.'};
  const {player,originClub}=item;
  const challengeRule=transferAllowedByChallenge(career,player,offer.type);if(!challengeRule.ok&&String(offer.toClubId)===String(career.userClubId))return{status:'rejected',reason:challengeRule.reason,challengeBlocked:true};
  const dynamic=applyCareerRoster(baseClubs,career),seller=dynamic.find(c=>c.id===String(offer.fromClubId)),buyer=dynamic.find(c=>c.id===String(offer.toClubId));
  if(!seller||!buyer)return{status:'rejected',reason:'Clube inválido.'};
  const current=currentOwnerId(career,offer.playerKey,originClub.id);
  if(current!==String(offer.fromClubId))return{status:'rejected',reason:'O jogador já não pertence a esse clube.'};
  const permanent=String(career?.ownership?.[offer.playerKey]||originClub.id);
  const isLoaned=current!==permanent;
  if(isLoaned&&['sell','loan-out','swap','buy'].includes(offer.type))return{status:'rejected',reason:'O atleta está emprestado. O clube que o recebeu não pode vendê-lo, trocá-lo ou subemprestá-lo.'};
  const diff=transferDifficulty(player,originClub,buyer,career,offer.playerKey),rivalry=diff.rivalry,stars=diff.stars,seed=negotiationSeed(career,offer),random=.94+roll(seed)*.14;
  const sellerMeta=getClubWorld(seller.id),buyerMeta=getClubWorld(buyer.id);
  if(offer.type==='buy'){
    if(rivalry===2&&stars>=2&&Number(offer.amount||0)<diff.market*1.85)return{status:'rejected',reason:'O rival não pretende fortalecer um adversário direto com uma estrela.',minimum:Math.round(diff.market*1.9/100000)*100000};
    const negotiationFactor=String(buyer.id)===String(career.userClubId)?managerProfile(career.managerProfile).transfer:1,target=Math.round(diff.minimum*random*negotiationFactor/100000)*100000,amount=Number(offer.amount||0),wageMonthly=estimatedMonthlySalary(player,originClub,career,offer.playerKey);
    if(String(buyer.id)===String(career.userClubId)){
      const appeal=destinationAppeal(career,player,buyer,stars),interestRoll=roll(seed+'|player-interest');
      if(appeal.score+interestRoll*.16<appeal.demand)return{status:'rejected',reason:'O estafe do jogador não vê este projeto como o próximo passo ideal da carreira. Resultados, reputação e competições continentais podem mudar esse cenário.',playerRejected:true};
      const funding=canFundDeal(career,{fee:amount,wageMonthly});if(!funding.ok)return{status:'rejected',reason:funding.reason,budgetBlocked:true};
    }
    if(amount>=target)return{status:'accepted',reason:'A diretoria aceitou a proposta e o jogador sinalizou interesse.',agreedAmount:amount,wageMonthly};
    if(amount>=target*.78)return{status:'counter',reason:'O clube aceita negociar, mas quer mais.',counterAmount:target,wageMonthly};
    return{status:'rejected',reason:'A proposta ficou muito abaixo da avaliação do clube.',minimum:target};
  }
  if(offer.type==='loan-in'){
    if(rivalry===2&&stars>=2)return{status:'rejected',reason:'O rival não aceita emprestar um jogador-chave para você.'};
    if(String(buyer.id)===String(career.userClubId)){
      const monthly=estimatedMonthlySalary(player,originClub,career,offer.playerKey)*(Number(offer.salaryShare||60)/100),funding=canFundDeal(career,{fee:Number(offer.loanFee||0),wageMonthly:monthly});
      if(!funding.ok)return{status:'rejected',reason:funding.reason,budgetBlocked:true};
    }
    if(stars>=3&&offer.salaryShare<80)return{status:'counter',reason:'Para liberar uma estrela por empréstimo, o clube exige maior participação salarial.',counterLoanFee:Math.round(diff.market*.07/100000)*100000,counterSalaryShare:90,buyOption:Math.round(diff.market*1.3/100000)*100000};
    const feeTarget=Math.round(diff.market*(.025+stars*.018+rivalry*.01)/100000)*100000;
    if((offer.loanFee||0)>=feeTarget*.8&&(offer.salaryShare||0)>=50)return{status:'accepted',reason:'Empréstimo aceito.',agreedLoanFee:offer.loanFee,salaryShare:offer.salaryShare,buyOption:offer.buyOption||Math.round(diff.market*1.2/100000)*100000};
    return{status:'counter',reason:'O clube aceita o empréstimo com ajustes.',counterLoanFee:feeTarget,counterSalaryShare:Math.max(60,offer.salaryShare||0),buyOption:Math.round(diff.market*1.22/100000)*100000};
  }
  if(offer.type==='swap'){
    const swap=findCareerPlayer(baseClubs,offer.swapPlayerKey,career);if(!swap)return{status:'rejected',reason:'Jogador oferecido na troca não encontrado.'};
    const swapValue=careerMarketValueBRL(career,swap.player,swap.originClub,offer.swapPlayerKey).valueBRL;
    const packageValue=swapValue+Number(offer.amount||0);
    const target=diff.minimum*(rivalry===2?1.18:1);
    if(rivalry===2&&stars>=2&&packageValue<target*1.1)return{status:'rejected',reason:'Para uma troca entre rivais, o pacote teria de ser excepcional.'};
    if(packageValue>=target)return{status:'accepted',reason:'A troca foi aceita.',cashAmount:Number(offer.amount||0),swapPlayerKey:offer.swapPlayerKey};
    return{status:'counter',reason:'O clube gostou do jogador, mas quer compensação maior.',counterAmount:Math.max(0,Math.round((target-swapValue)/100000)*100000),swapPlayerKey:offer.swapPlayerKey};
  }
  if(offer.type==='sell'||offer.type==='loan-out'){
    const need=squadNeed(buyer,player),buyerCapacity=buyerMeta.gameBudgetM*1_000_000,market=diff.market,interest=.48+need+(stars===0?.08:0)-(market>buyerCapacity*.55?.18:0)-(rivalry===2?.12:0);
    if(roll(seed)>clamp(.15,.88,interest))return{status:'rejected',reason:'O clube não considera essa posição prioridade no momento.'};
    if(offer.type==='sell'){
      const bid=Math.round(market*(.82+roll(seed+'bid')*.28)/100000)*100000;
      return{status:'accepted',reason:'O clube demonstrou interesse e enviou uma oferta.',agreedAmount:bid};
    }
    const fee=Math.round(market*(.012+roll(seed+'loan')*.03)/100000)*100000;
    return{status:'accepted',reason:'O clube aceita receber o jogador por empréstimo.',agreedLoanFee:fee,salaryShare:50+Math.round(roll(seed+'salary')*5)*10,buyOption:Math.round(market*(1.05+roll(seed+'opt')*.2)/100000)*100000};
  }
  return{status:'rejected',reason:'Tipo de proposta não suportado.'};
}
function transferRecord(career,offer,item,result){
  const amount=result.agreedAmount??result.cashAmount??result.agreedLoanFee??0,marketValue=careerMarketValueBRL(career,item.player,item.originClub,offer.playerKey).valueBRL;
  return{id:'tr-'+career.season+'-'+career.round+'-'+(career.transferHistory?.length||0),season:career.season,round:career.round,type:offer.type,playerKey:offer.playerKey,player:item.player.name,fromClubId:String(offer.fromClubId),toClubId:String(offer.toClubId),amount,marketValue,valueRatio:marketValue?Number((Number(amount||0)/marketValue).toFixed(3)):null,salaryShare:result.salaryShare??offer.salaryShare??null,buyOption:result.buyOption??offer.buyOption??null};
}
function applyTransferConfidence(career,offer,item,evaluation){
  const user=String(career.userClubId),from=String(offer.fromClubId),to=String(offer.toClubId),market=careerMarketValueBRL(career,item.player,item.originClub,offer.playerKey).valueBRL;
  if(!market)return career;
  if(offer.type==='sell'&&from===user){
    const amount=Number(evaluation.agreedAmount||offer.amount||0),ratio=amount/market;
    const board=ratio>=1.15?5:ratio>=.98?2:ratio>=.85?-2:ratio>=.7?-6:-12;
    const reason=board>=0?'Venda de '+item.player.name+' valorizou o patrimônio do clube.':'Venda de '+item.player.name+' por '+Math.round(ratio*100)+'% do valor de mercado desagradou a diretoria.';
    return applyConfidenceEvent(career,{board,kind:'transfer',reason});
  }
  if(offer.type==='buy'&&to===user){
    const amount=Number(evaluation.agreedAmount||offer.amount||0),ratio=amount/market;
    const board=ratio>=1.5?-6:ratio>=1.25?-3:ratio<=.9?3:ratio<=1.05?1:0;
    const reason=board<0?'A diretoria considera alto o investimento feito em '+item.player.name+'.':'A negociação por '+item.player.name+' foi considerada financeiramente equilibrada.';
    return applyConfidenceEvent(career,{board,kind:'transfer',reason});
  }
  if(offer.type==='loan-out'&&from===user)return applyConfidenceEvent(career,{board:1,kind:'transfer',reason:'O empréstimo de '+item.player.name+' reduziu pressão sobre o elenco e a folha.'});
  if(offer.type==='loan-in'&&to===user){
    const share=Number(evaluation.salaryShare??offer.salaryShare??60);
    return applyConfidenceEvent(career,{board:share>=90?-1:.5,kind:'transfer',reason:'A diretoria avaliou o custo do empréstimo de '+item.player.name+'.'});
  }
  return career;
}
function breakNoSalePromise(career,key,playerName){
  const promises=(career.playerPromises||[]).map(item=>item.key===key&&item.status==='active'&&item.type==='no-sale'?{...item,status:'broken',brokenReason:'Jogador negociado apesar da promessa'}:item),broken=promises.some((item,index)=>item.status==='broken'&&(career.playerPromises||[])[index]?.status==='active'&&(career.playerPromises||[])[index]?.key===key&&(career.playerPromises||[])[index]?.type==='no-sale');
  if(!broken)return career;
  const mood={...(career.dressingRoom?.playerMood||{})},old=mood[key]||{name:playerName,morale:70,managerTrust:60};mood[key]={...old,name:playerName,morale:clamp(20,100,(old.morale||70)-13),managerTrust:clamp(0,100,(old.managerTrust||60)-22),promiseStatus:'broken'};
  let next={...career,playerPromises:promises,dressingRoom:{...(career.dressingRoom||{}),playerMood:mood}};
  next=applyConfidenceEvent(next,{fans:-1.2,board:-.8,kind:'promise',reason:'Uma promessa de permanência foi quebrada durante a negociação.'});
  return emitCareerEvent(next,{type:'PROMISE_BROKEN',playerId:key.split(':').pop(),importance:4,payload:{name:playerName,promise:'Não será vendido nesta janela'}});
}
function applyPermanentContract(career,key,player,toClubId,wageMonthly){
  const old=career.playerContracts?.[key]||{},contract={...old,key,playerId:String(player.id),name:player.name,clubId:String(toClubId),startSeason:career.season,expirySeason:career.season+3,salaryMonthly:Number(wageMonthly||old.salaryMonthly||35000),status:'active'};
  return{...career,playerContracts:{...(career.playerContracts||{}),[key]:contract}};
}
export function executeTransfer(career,baseClubs,offer,evaluation){
  if(!evaluation||evaluation.status!=='accepted')return{career,error:'A negociação ainda não foi aceita.'};
  const item=findCareerPlayer(baseClubs,offer.playerKey,career);if(!item)return{career,error:'Jogador não encontrado.'};
  let next={...career,ownership:{...(career.ownership||{})},loans:[...(career.loans||[])],transferHistory:[...(career.transferHistory||[])],transferContracts:[...(career.transferContracts||[])]};
  if(!Number.isFinite(Number(next.transferBudget)))next={...next,transferBudget:transferBudgetSnapshot(next).budget};
  const user=String(career.userClubId),from=String(offer.fromClubId),to=String(offer.toClubId);
  if(['buy','sell'].includes(offer.type)){
    const amount=Number(evaluation.agreedAmount||offer.amount||0);
    if(to===user){const funding=canFundDeal(next,{fee:amount,wageMonthly:evaluation.wageMonthly||estimatedMonthlySalary(item.player,item.originClub,next,offer.playerKey)});if(!funding.ok)return{career,error:funding.reason};}
    next.ownership[offer.playerKey]=to;
    if(to===user){const wage=evaluation.wageMonthly||estimatedMonthlySalary(item.player,item.originClub,next,offer.playerKey);next=spendTransferBudget(next,amount);next=addTransaction(next,-amount,'Compra · '+item.player.name,career.round,'transfer',{playerKey:offer.playerKey});next.transferContracts.push({playerKey:offer.playerKey,clubId:user,wageMonthly:wage,active:true,signedSeason:career.season,signedRound:career.round});next=applyPermanentContract(next,offer.playerKey,item.player,user,wage);}
    if(from===user){next=breakNoSalePromise(next,offer.playerKey,item.player.name);next=addTransaction(next,amount,'Venda · '+item.player.name,career.round,'transfer',{playerKey:offer.playerKey});next=creditTransferSale(next,amount);next.transferContracts=next.transferContracts.map(contract=>contract.playerKey===offer.playerKey&&contract.clubId===user?{...contract,active:false,endedRound:career.round}:contract);next=applyPermanentContract(next,offer.playerKey,item.player,to,evaluation.wageMonthly||estimatedMonthlySalary(item.player,item.originClub,next,offer.playerKey));}
  }
  if(offer.type==='swap'){
    const swap=findCareerPlayer(baseClubs,evaluation.swapPlayerKey||offer.swapPlayerKey,career);if(!swap)return{career,error:'Jogador de troca não encontrado.'};
    const cash=Number(evaluation.cashAmount||offer.amount||0);
    if(to===user){const funding=canFundDeal(next,{fee:cash,wageMonthly:0});if(!funding.ok)return{career,error:funding.reason};}
    if(from===user)next=breakNoSalePromise(next,offer.playerKey,item.player.name);
    next.ownership[offer.playerKey]=to;
    next.ownership[evaluation.swapPlayerKey||offer.swapPlayerKey]=from;
    next=applyPermanentContract(next,offer.playerKey,item.player,to,estimatedMonthlySalary(item.player,item.originClub,next,offer.playerKey));
    next=applyPermanentContract(next,evaluation.swapPlayerKey||offer.swapPlayerKey,swap.player,from,estimatedMonthlySalary(swap.player,swap.originClub,next,evaluation.swapPlayerKey||offer.swapPlayerKey));
    if(to===user&&cash>0){next=spendTransferBudget(next,cash);next=addTransaction(next,-cash,'Troca · compensação por '+item.player.name,career.round,'transfer');}
  }
  if(['loan-in','loan-out'].includes(offer.type)){
    const fee=Number(evaluation.agreedLoanFee||offer.loanFee||0);
    if(to===user){const wage=estimatedMonthlySalary(item.player,item.originClub,next,offer.playerKey)*(Number(evaluation.salaryShare??offer.salaryShare??60)/100),funding=canFundDeal(next,{fee,wageMonthly:wage});if(!funding.ok)return{career,error:funding.reason};}
    next.loans.push({id:'loan-'+career.season+'-'+career.round+'-'+next.loans.length,playerKey:offer.playerKey,fromClubId:from,toClubId:to,season:career.season,startRound:career.round,endRound:38,active:true,fee,salaryShare:evaluation.salaryShare??offer.salaryShare??60,buyOption:evaluation.buyOption??offer.buyOption??null,wageMonthly:estimatedMonthlySalary(item.player,item.originClub,next,offer.playerKey)});
    if(to===user&&fee>0){next=spendTransferBudget(next,fee);next=addTransaction(next,-fee,'Empréstimo · '+item.player.name,career.round,'transfer');}
    if(from===user&&fee>0)next=addTransaction(next,fee,'Taxa de empréstimo · '+item.player.name,career.round,'transfer');
  }
  next=applyTransferConfidence(next,offer,item,evaluation);
  const record=transferRecord(next,offer,item,evaluation);next.transferHistory=[...next.transferHistory,record].slice(-240);
  next=applyTransferDynamics(next,{type:offer.type,playerName:item.player.name,amount:record.amount,marketValue:record.marketValue,fromUser:from===user,toUser:to===user});
  next=emitCareerEvent(next,{type:'TRANSFER_COMPLETED',playerId:item.player.id,importance:record.amount>=100000000?4:2,payload:{type:offer.type,player:item.player.name,fromClubId:from,toClubId:to,amount:record.amount,marketValue:record.marketValue}});
  return{career:next,error:null};
}
export function negotiationPreset(player,originClub,buyerClub,career=null,key=null){
  const diff=transferDifficulty(player,originClub,buyerClub,career,key);
  return{market:diff.market,suggestedBid:Math.round(diff.minimum*.92/100000)*100000,loanFee:Math.round(diff.market*.035/100000)*100000,salaryShare:70,buyOption:Math.round(diff.market*1.18/100000)*100000,rivalry:diff.rivalry,stars:diff.stars};
}

export function incomingMarketOffers(career,baseClubs){
  if(Number(career.round||0)<6)return[];
  const user=String(career.userClubId),roster=applyCareerRoster(baseClubs,career).find(club=>String(club.id)===user);
  if(!roster)return[];
  const window=Math.floor(Number(career.round||0)/6),decisions=career.marketOfferDecisions||{},candidates=(roster.players||[]).map(player=>{
    const key=String(player._playerKey||playerKey(player._originClubId||user,player.id)),perf=career.seasonPerformance?.[String(player.id)]||career.seasonPerformance?.[key]||null,stats=playerGameStats(player);
    const avg=perf?.appearances?perf.totalRating/perf.appearances:0,goals=perf?.goals||0,signal=(avg-6.2)*14+goals*2.4+stats.overall*.12;
    return{player,key,perf,signal};
  }).filter(item=>item.signal>8).sort((a,b)=>b.signal-a.signal).slice(0,4);
  const buyers=baseClubs.filter(club=>String(club.id)!==user);
  return candidates.map((item,index)=>{
    const id='incoming-'+career.season+'-'+window+'-'+item.key;if(decisions[id])return null;
    const buyer=buyers[hashString(id+'|buyer')%buyers.length],market=careerMarketValueBRL(career,item.player,roster,item.key).valueBRL,formBoost=clamp(.94,1.16,1+(roll(id+'|price')-.5)*.16),amount=Math.max(500000,Math.round(market*formBoost/100000)*100000);
    return{id,season:career.season,round:career.round,playerKey:item.key,playerId:String(item.player.id),player:item.player.name,fromClubId:user,toClubId:String(buyer.id),buyerName:buyer.name,amount,marketValue:market,form:item.perf?.appearances?Number((item.perf.totalRating/item.perf.appearances).toFixed(2)):null,goals:item.perf?.goals||0};
  }).filter(Boolean).slice(0,3);
}
export function rejectIncomingOffer(career,offerId){
  return{...career,marketOfferDecisions:{...(career.marketOfferDecisions||{}),[offerId]:'rejected'}};
}

const payrollRounds=[4,8,12,16,20,24,28,32,36,38];
export function applyTransferPayroll(career,baseClubs,round){
  if(!payrollRounds.includes(round))return career;
  const user=String(career.userClubId);
  let total=0;
  for(const contract of career.transferContracts||[]){
    if(contract.active!==false&&String(contract.clubId)===user)total+=Number(contract.wageMonthly||0);
  }
  for(const loan of career.loans||[]){
    if(loan.active!==false&&Number(loan.season)===Number(career.season)&&String(loan.toClubId)===user&&round<=(loan.endRound??38)){
      total+=Number(loan.wageMonthly||0)*(Number(loan.salaryShare||0)/100);
    }
  }
  if(total<=0)return career;
  return addTransaction(career,-Math.round(total),'Folha mensal · contratos do mercado',round,'payroll');
}
