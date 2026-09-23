import { getClubWorld, initialClubBudget } from './club-world.js';
import { applyConfidenceEvent } from './manager-confidence.js';

export const INITIAL_CASH=20000000;
export const slots={master:'Patrocínio máster',sleeve:'Mangas',training:'Uniforme de treino'};
export const offers=[
  {id:'vertice',name:'VÉRTICE',symbol:'V',tier:2,sector:'Tecnologia',slot:'master',color:'#536ca4',tagline:'O futuro veste a sua camisa.',payment:{type:'monthly',label:'Mensal',amount:900000,signingBonus:1800000},requirements:[{type:'reputation',value:63,label:'Reputação ≥ 63'}]},
  {id:'aurora',name:'AURORA',symbol:'A',tier:3,sector:'Energia',slot:'master',color:'#b08142',tagline:'Energia para ir mais longe.',payment:{type:'upfront',label:'À vista',amount:14000000,signingBonus:0},requirements:[{type:'position',value:8,minRound:5,label:'Estar no G8 após a 5ª rodada'},{type:'reputation',value:67,label:'Reputação ≥ 67'}]},
  {id:'imperium',name:'IMPERIUM',symbol:'I',tier:4,sector:'Serviços financeiros',slot:'master',color:'#1d2838',tagline:'Grandes marcas escolhem grandes histórias.',payment:{type:'quarterly',label:'Parcelas trimestrais',amount:6500000,signingBonus:5000000},requirements:[{type:'position',value:4,minRound:10,label:'Estar no G4 após a 10ª rodada'},{type:'reputation',value:74,label:'Reputação ≥ 74'},{type:'wins',value:6,label:'6 vitórias na temporada'}]},
  {id:'pulso',name:'PULSO',symbol:'P',tier:1,sector:'Mobilidade',slot:'sleeve',color:'#ae6260',tagline:'Sempre em movimento.',payment:{type:'per_match',label:'Por rodada',amount:150000,signingBonus:300000},requirements:[{type:'squad',value:25,label:'Elenco com pelo menos 25 atletas'}]},
  {id:'nexo',name:'NEXO',symbol:'N',tier:2,sector:'Conectividade',slot:'sleeve',color:'#6c5d9e',tagline:'Conectados pela mesma paixão.',payment:{type:'quarterly',label:'Parcelas trimestrais',amount:2300000,signingBonus:800000},requirements:[{type:'position',value:12,minRound:5,label:'Top 12 após a 5ª rodada'},{type:'reputation',value:60,label:'Reputação ≥ 60'}]},
  {id:'orbit',name:'ORBIT',symbol:'O',tier:3,sector:'Telecom',slot:'sleeve',color:'#275b70',tagline:'Sua torcida em qualquer lugar.',payment:{type:'performance',label:'Performance',amount:180000,winBonus:300000,signingBonus:1200000},requirements:[{type:'position',value:8,minRound:8,label:'Estar no G8 após a 8ª rodada'},{type:'wins',value:5,label:'5 vitórias na temporada'}]},
  {id:'orbe',name:'ORBE',symbol:'O',tier:1,sector:'Equipamentos esportivos',slot:'training',color:'#467a79',tagline:'Cada treino constrói uma vitória.',payment:{type:'monthly',label:'Mensal',amount:260000,signingBonus:350000},requirements:[{type:'squad',value:22,label:'Elenco com pelo menos 22 atletas'}]},
  {id:'impulso',name:'IMPULSO',symbol:'↗',tier:2,sector:'Nutrição esportiva',slot:'training',color:'#78874d',tagline:'Preparação que faz a diferença.',payment:{type:'performance',label:'Performance',amount:80000,winBonus:180000,signingBonus:0},requirements:[{type:'wins',value:3,label:'Conquistar 3 vitórias na temporada'}]},
  {id:'apex',name:'APEX',symbol:'▲',tier:3,sector:'Performance esportiva',slot:'training',color:'#374151',tagline:'Treine como quem quer chegar ao topo.',payment:{type:'monthly',label:'Mensal',amount:650000,signingBonus:1800000},requirements:[{type:'position',value:10,minRound:7,label:'Top 10 após a 7ª rodada'},{type:'reputation',value:66,label:'Reputação ≥ 66'}]},
];
const paymentRounds={monthly:[4,8,12,16,20,24,28,32,36,38],quarterly:[10,20,30,38]};
export const offerById=id=>offers.find(offer=>offer.id===id);
export function initialCashForClub(clubId){return initialClubBudget(clubId)||INITIAL_CASH;}
export function clubReputation(club){
  const players=club?.players||[],depth=Math.min(players.length,40),internationals=new Set(players.map(player=>player.countryCode).filter(Boolean)).size,prime=players.filter(player=>{const age=player.age??27;return age>=23&&age<=30;}).length;
  const world=getClubWorld(club?.id);
  return Math.max(45,Math.min(88,46+Math.round(depth*.55)+Math.min(8,internationals)+Math.min(6,Math.round(prime/5))+Math.round(world.fanIndex*8)));
}
export function sponsorContext(career,club,standing=[]){
  const row=standing.find(item=>item.clubId===career.userClubId),world=getClubWorld(club?.id);
  return{round:career.round||0,position:row?.position??20,wins:row?.wins??0,reputation:clubReputation(club),squadSize:club?.players?.length??0,trophies:(career.trophies||[]).length,fanIndex:world.fanIndex};
}
function singleRequirementStatus(req,context){
  if(req.type==='reputation')return{ok:context.reputation>=req.value,label:req.label};
  if(req.type==='squad')return{ok:context.squadSize>=req.value,label:req.label};
  if(req.type==='wins')return{ok:context.wins>=req.value,label:req.label};
  if(req.type==='trophies')return{ok:context.trophies>=req.value,label:req.label};
  if(req.type==='fanIndex')return{ok:context.fanIndex>=req.value,label:req.label};
  if(req.type==='position'){
    if(context.round<req.minRound)return{ok:false,label:req.label+' · disponível após a rodada '+req.minRound};
    return{ok:context.position<=req.value,label:req.label};
  }
  return{ok:false,label:req.label||'Requisito não atendido'};
}
export function requirementStatus(offer,context){
  const reqs=offer.requirements|| (offer.requirement?[offer.requirement]:[]);
  if(!reqs.length)return{ok:true,label:'Sem requisito adicional',details:[]};
  const details=reqs.map(req=>singleRequirementStatus(req,context));
  return{ok:details.every(item=>item.ok),label:details.map(item=>(item.ok?'✓ ':'✕ ')+item.label).join(' · '),details};
}
export const activeContracts=career=>(career.sponsors||[]).filter(contract=>contract.active!==false).map(contract=>({...contract,offer:offerById(contract.offerId)})).filter(contract=>contract.offer);
export function projectedOfferValue(offer,round=0){
  const remaining=Math.max(0,38-round);
  if(offer.payment.type==='upfront')return offer.payment.amount+offer.payment.signingBonus;
  if(offer.payment.type==='per_match')return offer.payment.signingBonus+offer.payment.amount*remaining;
  if(offer.payment.type==='performance')return offer.payment.signingBonus+offer.payment.amount*remaining;
  const rounds=(paymentRounds[offer.payment.type]||[]).filter(item=>item>round).length;
  return offer.payment.signingBonus+offer.payment.amount*rounds;
}
export function addTransaction(career,amount,label,round,kind='income',meta={}){
  const count=career.transactions?.length||0;
  return{...career,cash:(career.cash??initialCashForClub(career.userClubId))+amount,transactions:[{id:kind+'-'+round+'-'+count,round,amount,label,kind,...meta},...(career.transactions||[])].slice(0,140)};
}
export function signSponsor(career,offerId,club,standing=[]){
  const offer=offerById(offerId);if(!offer)return{career,error:'Proposta inválida.'};
  if(activeContracts(career).some(contract=>contract.offer.slot===offer.slot))return{career,error:'Este espaço já possui patrocinador.'};
  const status=requirementStatus(offer,sponsorContext(career,club,standing));if(!status.ok)return{career,error:status.label};
  const contract={offerId,signedRound:career.round||0,active:true,totalReceived:0,paidRounds:[]};let next={...career,sponsors:[...(career.sponsors||[]),contract]};
  const immediate=(offer.payment.signingBonus||0)+(offer.payment.type==='upfront'?offer.payment.amount:0);
  if(immediate>0){next=addTransaction(next,immediate,offer.name+' · assinatura',career.round||0,'sponsor');next={...next,sponsors:next.sponsors.map(item=>item.offerId===offerId&&item.signedRound===contract.signedRound?{...item,totalReceived:immediate}:item)};}
  next=applyConfidenceEvent(next,{board:Math.min(4,1+(offer.tier||1)*.8),kind:'finance',reason:'A diretoria aprovou o acordo comercial com '+offer.name+'.'});
  return{career:next,error:null};
}
export function endSponsor(career,offerId){
  const active=activeContracts(career).find(item=>item.offerId===offerId),early=(career.round||0)<30;
  let next={...career,sponsors:(career.sponsors||[]).map(contract=>contract.offerId===offerId&&contract.active!==false?{...contract,active:false,endedRound:career.round}:contract)};
  if(active)next=applyConfidenceEvent(next,{board:early?-3:-1,kind:'finance',reason:'O encerramento do contrato com '+active.offer.name+' reduziu a confiança comercial da diretoria.'});
  return next;
}
export function applySponsorPayments(career,round,userResult){
  let next=career;
  for(const view of activeContracts(next)){
    const offer=view.offer,source=(next.sponsors||[]).find(contract=>contract.offerId===offer.id&&contract.active!==false);
    if(!source||source.paidRounds?.includes(round)||round<=source.signedRound)continue;
    let amount=0;
    if(offer.payment.type==='per_match')amount=offer.payment.amount;
    if(offer.payment.type==='performance'){amount=offer.payment.amount;if(userResult?.winner==='user')amount+=offer.payment.winBonus||0;}
    if(['monthly','quarterly'].includes(offer.payment.type)&&(paymentRounds[offer.payment.type]||[]).includes(round))amount=offer.payment.amount;
    if(amount<=0)continue;
    next=addTransaction(next,amount,offer.name+' · '+offer.payment.label,round,'sponsor');
    next={...next,sponsors:(next.sponsors||[]).map(contract=>contract.offerId===source.offerId&&contract.signedRound===source.signedRound&&contract.active!==false?{...contract,totalReceived:(contract.totalReceived||0)+amount,paidRounds:[...(contract.paidRounds||[]),round]}:contract)};
  }
  return next;
}
export function applyMatchdayIncome(career,result){
  if(!result||result.homeId!==career.userClubId||!result.matchday?.clubShare)return career;
  return addTransaction(career,result.matchday.clubShare,'Receita de jogo · '+result.matchday.stadium,result.roundNumber||career.round,'matchday',{attendance:result.matchday.attendance,grossRevenue:result.matchday.grossRevenue});
}
export const expireSeasonSponsors=career=>({...career,sponsors:(career.sponsors||[]).map(contract=>contract.active===false?contract:{...contract,active:false,endedRound:38,expired:true})});
export function sponsorshipTotals(career){
  const active=activeContracts(career);
  return{active:active.length,received:(career.sponsors||[]).reduce((sum,contract)=>sum+(contract.totalReceived||0),0),projected:active.reduce((sum,contract)=>sum+projectedOfferValue(contract.offer,career.round),0)};
}
