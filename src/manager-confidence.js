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
  const fanDelta=Number(event?.fans)||0,boardDelta=Number(event?.board)||0;
  const fans=clamp(0,100,Math.round((current.fans+fanDelta)*10)/10);
  const board=clamp(0,100,Math.round((current.board+boardDelta)*10)/10);
  const record={
    id:'confidence-'+(career?.season||0)+'-'+(career?.round||0)+'-'+((current.events||[]).length+1)+'-'+String(event?.kind||'event'),
    season:career?.season||2026,
    round:career?.round||0,
    kind:event?.kind||'general',
    reason:String(event?.reason||'O ambiente do clube reagiu às suas decisões.'),
    fanDelta:Number(fanDelta.toFixed?fanDelta.toFixed(1):fanDelta),
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
