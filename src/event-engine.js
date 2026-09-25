const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function eventId(event,career){
  return String(event?.id||[event?.type||'EVENT',career?.season||0,career?.round||0,event?.clubId||career?.userClubId||'',event?.playerId||'',hashString(JSON.stringify(event?.payload||{}))].join(':'));
}
export function emitCareerEvent(career,event){
  if(!career||!event?.type)return career;
  const ledger=Array.isArray(career.eventLedger)?career.eventLedger:[],id=eventId(event,career);
  if(ledger.some(item=>item.id===id))return career;
  const normalized={id,type:String(event.type),season:Number(event.season??career.season??0),round:Number(event.round??career.round??0),clubId:String(event.clubId??career.userClubId??''),playerId:event.playerId!=null?String(event.playerId):null,importance:clamp(1,5,Number(event.importance)||2),payload:event.payload&&typeof event.payload==='object'?event.payload:{},timestamp:event.timestamp||String(career.season||0)+'-r'+String(career.round||0)};
  return{...career,eventLedger:[normalized,...ledger].slice(0,240)};
}
export function emitCareerEvents(career,events){let next=career;for(const event of events||[])next=emitCareerEvent(next,event);return next;}
export function recentCareerEvents(career,limit=30,type=null){
  return(career?.eventLedger||[]).filter(item=>!type||item.type===type).slice(0,limit);
}
export function eventImportance(event){return clamp(1,5,Number(event?.importance)||2);}
export function eventSurprise({expected=.5,actual=.5}={}){return clamp(0,1,Math.abs(Number(actual)-Number(expected)));}
