import { clamp, hashSeed, mulberry32 } from './ldf-engine.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const money=value=>Math.round(finite(value,0)/100)*100;

export const PLAYER_AGENTS=[
  {id:'self',name:'Sem empresário',cost:0,commission:.02,salaryBoost:1,sponsorBoost:1,marketBoost:1,description:'Você e sua família cuidam da carreira. Quase sem custo, mas com alcance limitado.'},
  {id:'local',name:'Empresário regional',cost:18000,commission:.04,salaryBoost:1.035,sponsorBoost:1.12,marketBoost:1.08,description:'Abre portas regionais e melhora pequenas negociações.'},
  {id:'national',name:'Agência nacional',cost:85000,commission:.065,salaryBoost:1.075,sponsorBoost:1.28,marketBoost:1.18,description:'Boa rede no país, contratos melhores e mais marcas interessadas.'},
  {id:'elite',name:'Agência de elite',cost:360000,commission:.095,salaryBoost:1.13,sponsorBoost:1.52,marketBoost:1.32,description:'Rede forte, negociação agressiva e acesso mais rápido a grandes projetos.'},
];

export const PLAYER_BOOTS=[
  {id:'academy',name:'Chuteira da base',cost:0,bonuses:{},description:'Equipamento padrão. Sem bônus específico.'},
  {id:'velocity',name:'Veloce X',cost:22000,bonuses:{pace:2,technique:1},description:'+2 velocidade · +1 técnica'},
  {id:'precision',name:'Precision Pro',cost:26000,bonuses:{finishing:2,technique:1},description:'+2 finalização · +1 técnica'},
  {id:'maestro',name:'Maestro Control',cost:30000,bonuses:{passing:2,technique:2},description:'+2 passe · +2 técnica'},
  {id:'guardian',name:'Guardian Grip',cost:24500,bonuses:{defending:2,physical:1},description:'+2 defesa · +1 físico'},
  {id:'keeper',name:'Keeper One',cost:28000,bonuses:{goalkeeping:3,passing:1},description:'+3 goleiro · +1 passe'},
];

export const PLAYER_PHYSIOS=[
  {id:'club',name:'Departamento do clube',cost:0,monthly:0,recovery:1,injury:.98,condition:0,description:'Tratamento padrão oferecido pelo clube.'},
  {id:'personal',name:'Fisioterapeuta pessoal',cost:24000,monthly:3500,recovery:.84,injury:.90,condition:.7,description:'Acompanhamento individual e retorno cerca de 16% mais rápido.'},
  {id:'performance',name:'Equipe de performance',cost:110000,monthly:12000,recovery:.68,injury:.78,condition:1.4,description:'Prevenção, recuperação e controle de carga em nível de elite.'},
];

export const PLAYER_HOMES=[
  {id:'family',name:'Casa da família',cost:0,monthly:0,morale:0,recovery:0,reputation:0,description:'Estrutura simples e sem custo no início da carreira.'},
  {id:'apartment',name:'Apartamento',cost:160000,monthly:900,morale:1,recovery:.3,reputation:1,description:'Mais privacidade e rotina estável.'},
  {id:'house',name:'Casa confortável',cost:650000,monthly:2600,morale:2.5,recovery:.7,reputation:2,description:'Conforto, descanso e estrutura para a vida profissional.'},
  {id:'luxury',name:'Casa de alto padrão',cost:2800000,monthly:9500,morale:4,recovery:1.1,reputation:5,description:'Patrimônio, conforto máximo e ganho de imagem fora de campo.'},
];

export const PLAYER_SPONSOR_BRANDS=[
  {id:'vertice',name:'Vértice Sports',baseMonthly:9000,signing:18000,reputationMin:12,performanceWeight:.9,description:'Marca esportiva focada em jovens talentos.'},
  {id:'nexo',name:'Nexo Energy',baseMonthly:18000,signing:42000,reputationMin:28,performanceWeight:1.05,description:'Campanhas nacionais e bônus por desempenho.'},
  {id:'atlas',name:'Atlas Wear',baseMonthly:36000,signing:90000,reputationMin:48,performanceWeight:1.14,description:'Linha premium e exposição em grandes jogos.'},
  {id:'prisma',name:'Prisma Bank',baseMonthly:72000,signing:190000,reputationMin:68,performanceWeight:1.22,description:'Contrato de imagem para atletas consolidados.'},
];

const byId=(list,id)=>list.find(item=>item.id===id)||list[0];
export const agentDef=id=>byId(PLAYER_AGENTS,id);
export const bootsDef=id=>byId(PLAYER_BOOTS,id);
export const physioDef=id=>byId(PLAYER_PHYSIOS,id);
export const homeDef=id=>byId(PLAYER_HOMES,id);

export function createPlayerFinance(){
  return{cash:0,careerIncome:0,careerSpending:0,transactions:[],agentId:'self',bootsId:'academy',ownedBoots:['academy'],physioId:'club',homeId:'family',ownedHomes:['family'],sponsorship:null,sponsorOffers:[],lastSettlementDay:0};
}
export function sanitizePlayerFinance(raw={}){
  const agent=agentDef(raw.agentId),boots=bootsDef(raw.bootsId),physio=physioDef(raw.physioId),home=homeDef(raw.homeId);
  return{
    cash:clamp(-5_000_000,999_999_999,finite(raw.cash,0)),
    careerIncome:clamp(0,999_999_999,finite(raw.careerIncome,0)),
    careerSpending:clamp(0,999_999_999,finite(raw.careerSpending,0)),
    transactions:Array.isArray(raw.transactions)?raw.transactions.slice(0,120):[],
    agentId:agent.id,bootsId:boots.id,ownedBoots:Array.from(new Set(['academy',...(Array.isArray(raw.ownedBoots)?raw.ownedBoots.filter(id=>PLAYER_BOOTS.some(item=>item.id===id)):[])])),
    physioId:physio.id,homeId:home.id,ownedHomes:Array.from(new Set(['family',...(Array.isArray(raw.ownedHomes)?raw.ownedHomes.filter(id=>PLAYER_HOMES.some(item=>item.id===id)):[])])),
    sponsorship:raw.sponsorship&&typeof raw.sponsorship==='object'?{...raw.sponsorship,monthly:clamp(0,10_000_000,finite(raw.sponsorship.monthly,0)),monthsRemaining:clamp(0,36,finite(raw.sponsorship.monthsRemaining,0)),performanceBonus:clamp(0,5_000_000,finite(raw.sponsorship.performanceBonus,0)),targetAverage:clamp(5.5,8.5,finite(raw.sponsorship.targetAverage,6.8))}:null,
    sponsorOffers:Array.isArray(raw.sponsorOffers)?raw.sponsorOffers.slice(0,4):[],
    lastSettlementDay:clamp(0,400,finite(raw.lastSettlementDay,0)),
  };
}
function transaction(finance,{amount,label,type,season,day}){
  const value=money(amount),cash=finite(finance.cash)+value;
  return{...finance,cash,careerIncome:finite(finance.careerIncome)+(value>0?value:0),careerSpending:finite(finance.careerSpending)+(value<0?Math.abs(value):0),transactions:[{id:'pf-'+season+'-'+day+'-'+type+'-'+hashSeed(label,value,finance.transactions?.length||0).toString(36),amount:value,label,type,season,day},...(finance.transactions||[])].slice(0,120)};
}
export function playerLifeBonuses(career){
  const finance=sanitizePlayerFinance(career?.finance),agent=agentDef(finance.agentId),boots=bootsDef(finance.bootsId),physio=physioDef(finance.physioId),home=homeDef(finance.homeId);
  return{
    agent,boots,physio,home,
    attributeBonuses:{...(boots.bonuses||{})},
    salaryMultiplier:agent.salaryBoost,
    sponsorMultiplier:agent.sponsorBoost,
    marketMultiplier:agent.marketBoost,
    injuryMultiplier:physio.injury,
    injuryRecoveryMultiplier:physio.recovery,
    dailyRecovery:physio.condition+home.recovery,
    moraleBaseline:home.morale,
    reputationLifestyle:home.reputation,
  };
}
export function effectivePlayerAttributes(career){
  const attrs={...(career?.player?.attributes||{})},bonuses=playerLifeBonuses(career).attributeBonuses;
  for(const [key,value] of Object.entries(bonuses))attrs[key]=clamp(1,99,finite(attrs[key],50)+finite(value));
  return attrs;
}
export function playerFinancialSnapshot(career){
  const finance=sanitizePlayerFinance(career?.finance),contract=career?.contract||{},life=playerLifeBonuses({...career,finance}),grossMonthly=finite(contract.salaryMonthly,0)+finite(finance.sponsorship?.monthly,0),commission=grossMonthly*life.agent.commission,expenses=commission+life.physio.monthly+life.home.monthly;
  return{...finance,grossMonthly:money(grossMonthly),projectedExpenses:money(expenses),projectedNet:money(grossMonthly-expenses),agent:life.agent,boots:life.boots,physio:life.physio,home:life.home};
}
export function purchasePlayerLifeItem(career,type,id){
  const finance=sanitizePlayerFinance(career?.finance);
  const map={agent:PLAYER_AGENTS,boots:PLAYER_BOOTS,physio:PLAYER_PHYSIOS,home:PLAYER_HOMES},list=map[type],item=list?.find(entry=>entry.id===id);
  if(!item)return{career,error:'Item de carreira inválido.'};
  if(type==='boots'&&finance.ownedBoots.includes(id))return{career:{...career,finance:{...finance,bootsId:id}},item,equipped:true};
  if(type==='home'&&finance.ownedHomes.includes(id))return{career:{...career,finance:{...finance,homeId:id}},item,equipped:true};
  if(finance.cash<item.cost)return{career,error:'Saldo pessoal insuficiente para esta decisão.'};
  let nextFinance=transaction(finance,{amount:-item.cost,label:type==='agent'?'Contratação de '+item.name:type==='physio'?'Estrutura médica · '+item.name:type==='home'?'Compra · '+item.name:'Equipamento · '+item.name,type,season:career.season,day:career.dayOfSeason||0});
  if(type==='agent')nextFinance={...nextFinance,agentId:id};
  if(type==='physio')nextFinance={...nextFinance,physioId:id};
  if(type==='boots')nextFinance={...nextFinance,bootsId:id,ownedBoots:Array.from(new Set([...(nextFinance.ownedBoots||[]),id]))};
  if(type==='home')nextFinance={...nextFinance,homeId:id,ownedHomes:Array.from(new Set([...(nextFinance.ownedHomes||[]),id]))};
  let next={...career,finance:nextFinance};
  if(type==='home'&&id!=='family')next={...next,player:{...next.player,morale:clamp(0,100,finite(next.player?.morale,75)+item.morale)},pendingMoment:next.pendingMoment||{id:'home-'+id,type:'home',title:'Novo patrimônio',subtitle:item.name,text:'A carreira fora de campo também começou a crescer.',season:career.season,day:career.dayOfSeason||0}};
  if(type==='agent'&&id==='elite')next={...next,pendingMoment:next.pendingMoment||{id:'elite-agent',type:'agent',title:'Outro nível de representação',subtitle:item.name,text:'A nova equipe passa a negociar contratos, marcas e oportunidades com alcance maior.',season:career.season,day:career.dayOfSeason||0}};
  return{career:next,item};
}
export function refreshPlayerSponsorOffers(career){
  const finance=sanitizePlayerFinance(career?.finance);
  if(finance.sponsorship?.monthsRemaining>0)return{...career,finance:{...finance,sponsorOffers:[]}};
  const stats=career?.seasonStats||{},avg=finite(stats.matches)>0?finite(stats.totalRating)/Math.max(1,finite(stats.matches)):6.3,goals=finite(stats.goals),life=playerLifeBonuses({...career,finance}),rep=finite(career?.player?.reputation,5)+life.reputationLifestyle,seed=hashSeed(career?.seed,career?.season,career?.dayOfSeason,'sponsors'),rng=mulberry32(seed);
  const offers=PLAYER_SPONSOR_BRANDS.filter(brand=>rep>=brand.reputationMin-8&&rng()<clamp(.08,.92,.28+(rep-brand.reputationMin)*.012+(avg-6.4)*.16+life.agent.sponsorBoost*.08)).map(brand=>{
    const performance=clamp(.78,1.7,1+(avg-6.5)*.18+Math.min(10,goals)*.018),monthly=money(brand.baseMonthly*(.72+rep/120)*performance*life.agent.sponsorBoost),signing=money(brand.signing*(.8+rep/160)*life.agent.sponsorBoost),months=4+Math.floor(rng()*5);
    const targetAverage=Number(clamp(6.5,7.6,6.58+brand.performanceWeight*.18+rep/550).toFixed(2)),performanceBonus=money(monthly*(.12+brand.performanceWeight*.08));
    return{id:'sp-'+brand.id+'-'+career.season+'-'+(career.dayOfSeason||0),brandId:brand.id,name:brand.name,monthly,signing,months,description:brand.description,targetAverage,performanceBonus};
  }).sort((a,b)=>b.monthly-a.monthly).slice(0,3);
  return{...career,finance:{...finance,sponsorOffers:offers}};
}
export function acceptPlayerSponsor(career,offerId){
  const finance=sanitizePlayerFinance(career?.finance),offer=finance.sponsorOffers.find(item=>item.id===offerId);if(!offer)return{career,error:'Proposta de patrocínio indisponível.'};
  let nextFinance=transaction(finance,{amount:offer.signing,label:'Luvas de imagem · '+offer.name,type:'sponsor-signing',season:career.season,day:career.dayOfSeason||0});
  nextFinance={...nextFinance,sponsorship:{brandId:offer.brandId,name:offer.name,monthly:offer.monthly,monthsRemaining:offer.months,targetAverage:offer.targetAverage,performanceBonus:offer.performanceBonus},sponsorOffers:[]};
  const next={...career,finance:nextFinance,player:{...career.player,reputation:clamp(1,100,finite(career.player?.reputation,5)+1.5)},pendingMoment:career.pendingMoment||{id:'sponsor-'+offer.brandId+'-'+career.season,type:'sponsor',title:'Primeiro contrato de imagem',subtitle:offer.name,text:'Seu desempenho virou valor de mercado também fora do campo.',season:career.season,day:career.dayOfSeason||0}};
  return{career:next,offer};
}
export function declinePlayerSponsor(career,offerId){
  const finance=sanitizePlayerFinance(career?.finance);return{...career,finance:{...finance,sponsorOffers:finance.sponsorOffers.filter(item=>item.id!==offerId)}};
}
export function settlePlayerMonth(career){
  let finance=sanitizePlayerFinance(career?.finance),life=playerLifeBonuses({...career,finance}),gross=0;
  if(career?.contract?.salaryMonthly){gross+=finite(career.contract.salaryMonthly);finance=transaction(finance,{amount:career.contract.salaryMonthly,label:'Salário · '+String(career.contract.clubName||'clube'),type:'salary',season:career.season,day:career.dayOfSeason||0});}
  if(finance.sponsorship?.monthsRemaining>0){
    gross+=finite(finance.sponsorship.monthly);finance=transaction(finance,{amount:finance.sponsorship.monthly,label:'Patrocínio · '+finance.sponsorship.name,type:'sponsor',season:career.season,day:career.dayOfSeason||0});
    const stats=career?.seasonStats||{},avg=finite(stats.matches)>0?finite(stats.totalRating)/Math.max(1,finite(stats.matches)):0;
    if(avg>=finite(finance.sponsorship.targetAverage,6.8)&&finite(finance.sponsorship.performanceBonus)>0){const bonus=finite(finance.sponsorship.performanceBonus);gross+=bonus;finance=transaction(finance,{amount:bonus,label:'Bônus de performance · '+finance.sponsorship.name,type:'sponsor-bonus',season:career.season,day:career.dayOfSeason||0});}
    finance={...finance,sponsorship:{...finance.sponsorship,monthsRemaining:finance.sponsorship.monthsRemaining-1}};if(finance.sponsorship.monthsRemaining<=0)finance={...finance,sponsorship:null};
  }
  const commission=money(gross*life.agent.commission),services=money(life.physio.monthly+life.home.monthly);
  if(commission>0)finance=transaction(finance,{amount:-commission,label:'Comissão · '+life.agent.name,type:'agent-commission',season:career.season,day:career.dayOfSeason||0});
  if(services>0)finance=transaction(finance,{amount:-services,label:'Custos pessoais e performance',type:'life-costs',season:career.season,day:career.dayOfSeason||0});
  finance={...finance,lastSettlementDay:career.dayOfSeason||0};
  let next={...career,finance};
  if(finance.cash<0){
    const stress=clamp(1,6,1+Math.abs(finance.cash)/120000);
    next={...next,player:{...next.player,morale:clamp(0,100,finite(next.player?.morale,75)-stress)},news:[{id:'finance-stress-'+career.season+'-'+(career.dayOfSeason||0),title:'Finanças pessoais exigem atenção',text:'Custos de carreira superaram o saldo disponível. O estresse financeiro afetou a moral.',season:career.season,week:career.week,day:career.dayOfSeason||0},...(career.news||[])].slice(0,80)};
  }
  if(finance.cash>=1_000_000&&!career.achievements?.includes('millionaire'))next={...next,achievements:['millionaire',...(career.achievements||[])],pendingMoment:career.pendingMoment||{id:'millionaire',type:'finance',title:'Primeiro milhão',subtitle:'Patrimônio pessoal',text:'O saldo da carreira ultrapassou R$ 1 milhão.',season:career.season,day:career.dayOfSeason||0}};
  return next;
}
