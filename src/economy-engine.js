import { getClubWorld, monthlyWageBudget } from './club-world.js';

const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const round100k=n=>Math.round(Number(n||0)/100000)*100000;

export function initialTransferBudget(clubId){
  const meta=getClubWorld(clubId),base=Number(meta.gameBudgetM||18);
  // Gameplay budget: deliberately lower than club cash to force choices.
  const millions=clamp(6,90,6+base*.56+(meta.fanIndex||.5)*5);
  return round100k(millions*1_000_000);
}
export function transferWageCeiling(clubId){
  return round100k(monthlyWageBudget(clubId)*.30);
}
export function activeMarketPayroll(career){
  const user=String(career.userClubId);let total=0;
  for(const contract of career.transferContracts||[])if(contract.active!==false&&String(contract.clubId)===user)total+=Number(contract.wageMonthly||0);
  for(const loan of career.loans||[])if(loan.active!==false&&String(loan.toClubId)===user&&Number(loan.season)===Number(career.season))total+=Number(loan.wageMonthly||0)*(Number(loan.salaryShare||0)/100);
  return Math.round(total);
}
export function wageRoom(career){
  return Math.max(0,transferWageCeiling(career.userClubId)-activeMarketPayroll(career));
}
export function reinvestmentRate(career){
  const board=Number(career.managerConfidence?.board??70),profile=career.managerProfile||'balanced';
  const profileBonus=profile==='negotiator'?.05:profile==='manager'?.03:0;
  return clamp(.58,.88,.58+board*.0028+profileBonus);
}
export function transferBudgetSnapshot(career){
  const initial=initialTransferBudget(career.userClubId);
  const budget=Number.isFinite(Number(career.transferBudget))?Number(career.transferBudget):initial;
  const ceiling=transferWageCeiling(career.userClubId),payroll=activeMarketPayroll(career);
  return{budget,initial,wageCeiling:ceiling,payroll,wageRoom:Math.max(0,ceiling-payroll),reinvestmentRate:reinvestmentRate(career)};
}
export function canFundDeal(career,{fee=0,wageMonthly=0}={}){
  const view=transferBudgetSnapshot(career),cash=Number(career.cash||0);
  if(Number(fee)>view.budget)return{ok:false,reason:'O orçamento de transferências não comporta esse investimento.',...view};
  if(Number(fee)>cash)return{ok:false,reason:'O caixa do clube não comporta esse investimento.',...view};
  if(Number(wageMonthly)>view.wageRoom)return{ok:false,reason:'A folha reservada para novos contratos não comporta esse salário.',...view};
  return{ok:true,...view};
}
export function spendTransferBudget(career,amount){
  const view=transferBudgetSnapshot(career);
  return{...career,transferBudget:Math.max(0,view.budget-Math.max(0,Number(amount)||0))};
}
export function creditTransferSale(career,amount){
  const view=transferBudgetSnapshot(career),credit=Math.round(Math.max(0,Number(amount)||0)*view.reinvestmentRate/100000)*100000;
  return{...career,transferBudget:view.budget+credit,lastReinvestment:{amount:Number(amount)||0,credited:credit,rate:view.reinvestmentRate,season:career.season,round:career.round}};
}
export function resetSeasonTransferBudget(career){
  const base=initialTransferBudget(career.userClubId),cash=Number(career.cash||0),opening=Math.max(1,Number(career.openingCash||cash||1));
  const health=clamp(.75,1.25,.92+(cash-opening)/Math.max(opening,50_000_000)*.18);
  const board=clamp(.85,1.12,.88+(Number(career.managerConfidence?.board??70)/100)*.22);
  const performance=career.seasonReview?.position<=4?1.12:career.seasonReview?.position<=8?1.06:career.seasonReview?.position>=17?.88:1;
  const president=clamp(.82,1.10,Number(career.presidentProfile?.finance||1)),dna=clamp(.96,1.04,2-Number(career.clubDNA?.financeWeight||1));
  return round100k(base*health*board*performance*president*dna);
}
export function financeHealth(career){
  const view=transferBudgetSnapshot(career),cash=Number(career.cash||0);
  const stress=view.wageCeiling?view.payroll/view.wageCeiling:0;
  const label=cash<0||stress>.95?'Crítico':cash<10_000_000||stress>.8?'Apertado':cash>80_000_000&&stress<.55?'Confortável':'Controlado';
  return{...view,cash,stress:Number(stress.toFixed(2)),label};
}
