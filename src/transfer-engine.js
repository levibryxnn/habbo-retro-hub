import { addTransaction } from './finance-model.js';
import { getClubWorld, marketSquadReference, rivalryLevel } from './club-world.js';
import { playerGameStats } from './player-engine.js';

export const EUR_BRL_REFERENCE=6.25;
const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
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
  const total=marketSquadReference(originClub.id);
  const weights=(originClub.players||[]).map(playerWeight),sum=weights.reduce((a,b)=>a+b,0)||1;
  const index=(originClub.players||[]).findIndex(p=>String(p.id)===String(player.id));
  const weight=index>=0?weights[index]:playerWeight(player);
  const allocated=Math.max(100000,Math.round(total*weight/sum/50000)*50000);
  return{value:allocated,source:'Referência Transfermarkt 2026 · rateio estimado do valor do elenco'};
}
export function playerMarketValueBRL(player,originClub){const eur=playerMarketValueEUR(player,originClub);return{...eur,valueBRL:Math.round(eur.value*EUR_BRL_REFERENCE)};}
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
      const key=playerKey(origin.id,raw.id),owner=currentOwnerId(career,key,origin.id),target=byId[owner]||byId[origin.id];
      target.players.push(playerRef(raw,origin.id));
    }
  }
  return clones;
}
export function findCareerPlayer(baseClubs,key){
  const item=basePlayerIndex(baseClubs).get(key);
  return item?{...item,player:playerRef(item.player,item.originClub.id)}:null;
}
export function estimatedMonthlySalary(player,originClub){
  const mv=playerMarketValueBRL(player,originClub).valueBRL,s=playerGameStats(player),age=player.age??27;
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
export function transferDifficulty(player,originClub,buyerClub){
  const market=playerMarketValueBRL(player,originClub).valueBRL,stars=starLevel(player,originClub),rivalry=rivalryLevel(originClub.id,buyerClub.id),age=player.age??27;
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
export function evaluateTransferOffer(career,baseClubs,offer){
  const item=findCareerPlayer(baseClubs,offer.playerKey);if(!item)return{status:'rejected',reason:'Jogador não encontrado.'};
  const {player,originClub}=item;
  const dynamic=applyCareerRoster(baseClubs,career),seller=dynamic.find(c=>c.id===String(offer.fromClubId)),buyer=dynamic.find(c=>c.id===String(offer.toClubId));
  if(!seller||!buyer)return{status:'rejected',reason:'Clube inválido.'};
  const current=currentOwnerId(career,offer.playerKey,originClub.id);
  if(current!==String(offer.fromClubId))return{status:'rejected',reason:'O jogador já não pertence a esse clube.'};
  const permanent=String(career?.ownership?.[offer.playerKey]||originClub.id);
  const isLoaned=current!==permanent;
  if(isLoaned&&['sell','loan-out','swap','buy'].includes(offer.type))return{status:'rejected',reason:'O atleta está emprestado. O clube que o recebeu não pode vendê-lo, trocá-lo ou subemprestá-lo.'};
  const diff=transferDifficulty(player,originClub,buyer),rivalry=diff.rivalry,stars=diff.stars,seed=negotiationSeed(career,offer),random=.94+roll(seed)*.14;
  const sellerMeta=getClubWorld(seller.id),buyerMeta=getClubWorld(buyer.id);
  if(offer.type==='buy'){
    if(rivalry===2&&stars>=2&&Number(offer.amount||0)<diff.market*1.85)return{status:'rejected',reason:'O rival não pretende fortalecer um adversário direto com uma estrela.',minimum:Math.round(diff.market*1.9/100000)*100000};
    const target=Math.round(diff.minimum*random/100000)*100000,amount=Number(offer.amount||0);
    if(amount>=target)return{status:'accepted',reason:'A diretoria aceitou a proposta.',agreedAmount:amount,wageMonthly:estimatedMonthlySalary(player,originClub)};
    if(amount>=target*.78)return{status:'counter',reason:'O clube aceita negociar, mas quer mais.',counterAmount:target,wageMonthly:estimatedMonthlySalary(player,originClub)};
    return{status:'rejected',reason:'A proposta ficou muito abaixo da avaliação do clube.',minimum:target};
  }
  if(offer.type==='loan-in'){
    if(rivalry===2&&stars>=2)return{status:'rejected',reason:'O rival não aceita emprestar um jogador-chave para você.'};
    if(stars>=3&&offer.salaryShare<80)return{status:'counter',reason:'Para liberar uma estrela por empréstimo, o clube exige maior participação salarial.',counterLoanFee:Math.round(diff.market*.07/100000)*100000,counterSalaryShare:90,buyOption:Math.round(diff.market*1.3/100000)*100000};
    const feeTarget=Math.round(diff.market*(.025+stars*.018+rivalry*.01)/100000)*100000;
    if((offer.loanFee||0)>=feeTarget*.8&&(offer.salaryShare||0)>=50)return{status:'accepted',reason:'Empréstimo aceito.',agreedLoanFee:offer.loanFee,salaryShare:offer.salaryShare,buyOption:offer.buyOption||Math.round(diff.market*1.2/100000)*100000};
    return{status:'counter',reason:'O clube aceita o empréstimo com ajustes.',counterLoanFee:feeTarget,counterSalaryShare:Math.max(60,offer.salaryShare||0),buyOption:Math.round(diff.market*1.22/100000)*100000};
  }
  if(offer.type==='swap'){
    const swap=findCareerPlayer(baseClubs,offer.swapPlayerKey);if(!swap)return{status:'rejected',reason:'Jogador oferecido na troca não encontrado.'};
    const swapValue=playerMarketValueBRL(swap.player,swap.originClub).valueBRL;
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
  return{id:'tr-'+career.season+'-'+career.round+'-'+(career.transferHistory?.length||0),season:career.season,round:career.round,type:offer.type,playerKey:offer.playerKey,player:item.player.name,fromClubId:String(offer.fromClubId),toClubId:String(offer.toClubId),amount:result.agreedAmount??result.cashAmount??result.agreedLoanFee??0,salaryShare:result.salaryShare??offer.salaryShare??null,buyOption:result.buyOption??offer.buyOption??null};
}
export function executeTransfer(career,baseClubs,offer,evaluation){
  if(!evaluation||evaluation.status!=='accepted')return{career,error:'A negociação ainda não foi aceita.'};
  const item=findCareerPlayer(baseClubs,offer.playerKey);if(!item)return{career,error:'Jogador não encontrado.'};
  let next={...career,ownership:{...(career.ownership||{})},loans:[...(career.loans||[])],transferHistory:[...(career.transferHistory||[])],transferContracts:[...(career.transferContracts||[])]};
  const user=String(career.userClubId),from=String(offer.fromClubId),to=String(offer.toClubId);
  if(['buy','sell'].includes(offer.type)){
    const amount=Number(evaluation.agreedAmount||offer.amount||0);
    if(to===user&&next.cash<amount)return{career,error:'Caixa insuficiente para concluir a transferência.'};
    next.ownership[offer.playerKey]=to;
    if(to===user){next=addTransaction(next,-amount,'Compra · '+item.player.name,career.round,'transfer',{playerKey:offer.playerKey});next.transferContracts.push({playerKey:offer.playerKey,clubId:user,wageMonthly:evaluation.wageMonthly||estimatedMonthlySalary(item.player,item.originClub),active:true,signedSeason:career.season,signedRound:career.round});}
    if(from===user){next=addTransaction(next,amount,'Venda · '+item.player.name,career.round,'transfer',{playerKey:offer.playerKey});next.transferContracts=next.transferContracts.map(contract=>contract.playerKey===offer.playerKey&&contract.clubId===user?{...contract,active:false,endedRound:career.round}:contract);}
  }
  if(offer.type==='swap'){
    const swap=findCareerPlayer(baseClubs,evaluation.swapPlayerKey||offer.swapPlayerKey);if(!swap)return{career,error:'Jogador de troca não encontrado.'};
    const cash=Number(evaluation.cashAmount||offer.amount||0);
    if(to===user&&next.cash<cash)return{career,error:'Caixa insuficiente para a compensação da troca.'};
    next.ownership[offer.playerKey]=to;
    next.ownership[evaluation.swapPlayerKey||offer.swapPlayerKey]=from;
    if(to===user&&cash>0)next=addTransaction(next,-cash,'Troca · compensação por '+item.player.name,career.round,'transfer');
  }
  if(['loan-in','loan-out'].includes(offer.type)){
    const fee=Number(evaluation.agreedLoanFee||offer.loanFee||0);
    if(to===user&&next.cash<fee)return{career,error:'Caixa insuficiente para a taxa de empréstimo.'};
    next.loans.push({id:'loan-'+career.season+'-'+career.round+'-'+next.loans.length,playerKey:offer.playerKey,fromClubId:from,toClubId:to,season:career.season,startRound:career.round,endRound:38,active:true,fee,salaryShare:evaluation.salaryShare??offer.salaryShare??60,buyOption:evaluation.buyOption??offer.buyOption??null,wageMonthly:estimatedMonthlySalary(item.player,item.originClub)});
    if(to===user&&fee>0)next=addTransaction(next,-fee,'Empréstimo · '+item.player.name,career.round,'transfer');
    if(from===user&&fee>0)next=addTransaction(next,fee,'Taxa de empréstimo · '+item.player.name,career.round,'transfer');
  }
  next.transferHistory.push(transferRecord(next,offer,item,evaluation));
  return{career:next,error:null};
}
export function negotiationPreset(player,originClub,buyerClub){
  const diff=transferDifficulty(player,originClub,buyerClub);
  return{market:diff.market,suggestedBid:Math.round(diff.minimum*.92/100000)*100000,loanFee:Math.round(diff.market*.035/100000)*100000,salaryShare:70,buyOption:Math.round(diff.market*1.18/100000)*100000,rivalry:diff.rivalry,stars:diff.stars};
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
