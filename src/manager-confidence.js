import { boardTrustScore } from './ldf-engine.js';
const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));

export function createManagerConfidence(){
  return{fans:100,board:100,lastFanDelta:0,lastBoardDelta:0,events:[]};
}

export function sanitizeManagerConfidence(raw){
  const base=createManagerConfidence();
  if(!raw||typeof raw!=='object')return base;
  return{
    fans:clamp(0,100,Number.isFinite(Number(raw.fans))?Number(raw.fans):100),
    board:clamp(0,100,Number.isFinite(Number(raw.board))?Number(raw.board):100),
    lastFanDelta:Number(raw.lastFanDelta)||0,
    lastBoardDelta:Number(raw.lastBoardDelta)||0,
    events:Array.isArray(raw.events)?raw.events.slice(0,40):[],
  };
}

export function confidenceLabel(value){
  const score=Number(value)||0;
  if(score>=90)return'Prestígio máximo';
  if(score>=75)return'Em alta';
  if(score>=60)return'Estável';
  if(score>=40)return'Em observação';
  if(score>=20)return'Pressionado';
  return'Risco alto';
}

export function jobSecurityLabel(board){
  const score=Number(board)||0;
  if(score>=75)return'Seguro';
  if(score>=55)return'Estável';
  if(score>=35)return'Sob cobrança';
  if(score>=18)return'Em risco';
  return'Crítico';
}

export function applyConfidenceEvent(career,event){
  const current=sanitizeManagerConfidence(career?.managerConfidence);
  const rawFanDelta=Number(event?.fans)||0,boardDelta=Number(event?.board)||0,legacyCredit=clamp(0,.72,Number(career?.fanCredit||0)/42),fanDelta=rawFanDelta<0?rawFanDelta*(1-legacyCredit):rawFanDelta;
  const alpha=.55,currentEventScore=clamp(0,100,current.fans+fanDelta/alpha),fans=clamp(0,100,Math.round((alpha*currentEventScore+(1-alpha)*current.fans)*10)/10);
  const board=clamp(0,100,Math.round((current.board+boardDelta)*10)/10);
  const record={
    id:'confidence-'+(career?.season||0)+'-'+(career?.round||0)+'-'+((current.events||[]).length+1)+'-'+String(event?.kind||'event'),
    season:career?.season||2026,
    round:career?.round||0,
    kind:event?.kind||'general',
    reason:String(event?.reason||'O ambiente do clube reagiu às suas decisões.'),
    fanDelta:Number(fanDelta.toFixed?fanDelta.toFixed(1):fanDelta),
    rawFanDelta:Number(rawFanDelta.toFixed?rawFanDelta.toFixed(1):rawFanDelta),
    legacyCredit:Number(legacyCredit.toFixed(2)),
    boardDelta:Number(boardDelta.toFixed?boardDelta.toFixed(1):boardDelta),
    fans,
    board,
  };
  return{
    ...career,
    managerConfidence:{
      fans,
      board,
      lastFanDelta:fanDelta,
      lastBoardDelta:boardDelta,
      events:[record,...(current.events||[])].slice(0,40),
    },
  };
}

export function confidenceSnapshot(career){
  const value=sanitizeManagerConfidence(career?.managerConfidence);
  return{
    ...value,
    fanLabel:confidenceLabel(value.fans),
    boardLabel:confidenceLabel(value.board),
    jobSecurity:jobSecurityLabel(value.board),
  };
}


function structuralInputs(career){
  const record=career?.careerRecord||{},matches=Math.max(0,Number(record.matches||0)),wins=Math.max(0,Number(record.wins||0)),draws=Math.max(0,Number(record.draws||0)),pointsRate=matches?((wins*3+draws)/(matches*3)):0.58,results=clamp(35,96,52+pointsRate*47);
  const objectives=Array.isArray(career?.projectObjectives)?career.projectObjectives:[],resolved=objectives.filter(x=>['completed','missed'].includes(x.status)),objectivesScore=resolved.length?clamp(35,98,48+(resolved.filter(x=>x.status==='completed').length/resolved.length)*50):78;
  const cash=Number(career?.cash||0),opening=Math.max(1,Number(career?.openingCash||cash||1)),cashRatio=cash/opening,finance=clamp(20,98,64+Math.max(-1,Math.min(1.3,cashRatio-0.55))*27);
  const transfers=Array.isArray(career?.transferHistory)?career.transferHistory:[],sales=transfers.filter(x=>['sell','loan-out'].includes(x.type)),badSales=sales.filter(x=>Number(x.amount||0)<Number(x.marketValue||0)*.82).length,transfersScore=clamp(35,95,75+(sales.length?((sales.length-badSales)/sales.length-.7)*24:0));
  const promoted=(career?.regens||[]).filter(x=>String(x._originClubId||'')===String(career?.userClubId||'')&&String(x.id||'').startsWith('youth-')).length,youth=clamp(50,96,70+Math.min(4,promoted)*6);
  const dnaLabels=career?.clubDNA?.labels||[],clubDNA=clamp(55,94,74+(dnaLabels.length>=3?4:0)+(cash>=0?2:0));
  return{results,objectives:objectivesScore,finance,transfers:transfersScore,youth,clubDNA};
}
export function reconcileStructuralBoardTrust(career,{weight=.08}={}){
  const current=sanitizeManagerConfidence(career?.managerConfidence),inputs=structuralInputs(career),president=String(career?.presidentProfile?.id||'balanced'),target=boardTrustScore({...inputs,president}),blend=clamp(.02,.22,weight),board=Number(clamp(0,100,current.board*(1-blend)+target*blend).toFixed(1));
  return{...career,managerConfidence:{...current,board,structuralBoardTarget:target,structuralInputs:inputs}};
}
export function confidenceStructure(career){
  const inputs=structuralInputs(career),target=boardTrustScore({...inputs,president:String(career?.presidentProfile?.id||'balanced')});
  return{inputs,target};
}
