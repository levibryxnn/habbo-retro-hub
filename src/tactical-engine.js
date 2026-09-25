const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const roll=seed=>(hashString(seed)%1000000)/1000000;

export const DEFAULT_TACTIC={preset:'balanced',mentality:50,pressing:52,defensiveLine:50,tempo:52,width:50,directness:48,risk:48,setPieces:{corners:'mixed',freeKicks:'best',penalties:'best'}};
export const TACTICAL_PRESETS=[
  {id:'compact',name:'Bloco compacto',description:'Menos espaço, ritmo baixo e transição segura.',values:{mentality:36,pressing:42,defensiveLine:38,tempo:42,width:46,directness:55,risk:31}},
  {id:'balanced',name:'Equilibrado',description:'Sem exageros: controla risco e escolhe quando acelerar.',values:{mentality:50,pressing:52,defensiveLine:50,tempo:52,width:50,directness:48,risk:48}},
  {id:'control',name:'Controle',description:'Mais posse, circulação e presença no campo rival.',values:{mentality:58,pressing:58,defensiveLine:57,tempo:48,width:58,directness:35,risk:50}},
  {id:'vertical',name:'Vertical',description:'Ataca espaço rápido e aceita perder um pouco de controle.',values:{mentality:66,pressing:61,defensiveLine:57,tempo:68,width:54,directness:72,risk:64}},
  {id:'pressing',name:'Pressão alta',description:'Recupera cedo, cria volume e cobra muito fisicamente.',values:{mentality:63,pressing:78,defensiveLine:67,tempo:64,width:55,directness:52,risk:67}},
  {id:'all-in',name:'Pressão total',description:'Para buscar o resultado. Aumenta ataque, fadiga e contra-ataque rival.',values:{mentality:78,pressing:88,defensiveLine:78,tempo:79,width:61,directness:70,risk:86}},
];
export const TRAINING_FOCUS=[
  {id:'balanced',name:'Equilibrado',description:'Preparação geral sem sobrecarregar o elenco.',attack:0,defense:0,condition:2,injury:1,youth:0},
  {id:'recovery',name:'Recuperação',description:'Reduz fadiga e risco de lesão, com menor ganho técnico.',attack:-.02,defense:-.01,condition:7,injury:.76,youth:0},
  {id:'physical',name:'Físico',description:'Melhora intensidade e condição no médio prazo, mas exige mais do grupo.',attack:.01,defense:.01,condition:-1,injury:1.18,youth:.01},
  {id:'attacking',name:'Ataque',description:'Trabalha finalização, movimentos e criação.',attack:.07,defense:-.02,condition:0,injury:1.05,youth:.01},
  {id:'defending',name:'Defesa',description:'Compactação, coberturas e proteção da área.',attack:-.02,defense:.07,condition:0,injury:1.04,youth:.01},
  {id:'possession',name:'Posse',description:'Saída curta, controle e retenção da bola.',attack:.035,defense:.02,condition:0,injury:1.03,youth:.015},
  {id:'setpieces',name:'Bola parada',description:'Aumenta a eficiência em escanteios e faltas.',attack:.02,defense:.01,condition:1,injury:.98,youth:0,setPiece:.09},
  {id:'academy',name:'Integração da base',description:'Ajuda jovens a treinar com o profissional.',attack:0,defense:0,condition:1,injury:1,youth:.05},
];

export function tacticalPreset(id){return TACTICAL_PRESETS.find(item=>item.id===id)||TACTICAL_PRESETS[1];}
export function trainingFocus(id){return TRAINING_FOCUS.find(item=>item.id===id)||TRAINING_FOCUS[0];}
export function sanitizeTacticalState(raw){
  const base={...DEFAULT_TACTIC,...(raw&&typeof raw==='object'?raw:{})},preset=tacticalPreset(base.preset);
  const state={...DEFAULT_TACTIC,...preset.values,...base,preset:base.preset||preset.id,setPieces:{...DEFAULT_TACTIC.setPieces,...(base.setPieces||{})}};
  for(const key of['mentality','pressing','defensiveLine','tempo','width','directness','risk'])state[key]=clamp(0,100,Number(state[key])||DEFAULT_TACTIC[key]);
  return state;
}
export function setTacticalPreset(career,id){
  const preset=tacticalPreset(id),current=sanitizeTacticalState(career?.tacticalState);
  return{...career,tacticalState:{...current,...preset.values,preset:preset.id}};
}
export function updateTacticalState(career,patch){
  const current=sanitizeTacticalState(career?.tacticalState),next=sanitizeTacticalState({...current,...patch,setPieces:{...current.setPieces,...(patch?.setPieces||{})},preset:patch?.preset??current.preset});
  return{...career,tacticalState:next};
}
export function setTrainingFocus(career,id){const focus=trainingFocus(id);return{...career,trainingState:{...(career.trainingState||{}),focus:focus.id,lastChangedRound:career.round||0}};}
export function trainingMatchModifier(career){
  const focus=trainingFocus(career?.trainingState?.focus||'balanced');
  return{attack:focus.attack||0,defense:focus.defense||0,condition:focus.condition||0,injury:focus.injury||1,setPiece:focus.setPiece||0,youth:focus.youth||0,label:focus.name};
}
export function applyWeeklyTraining(career,club){
  if(!club)return career;
  const mod=trainingMatchModifier(career),conditions={...(career.conditions||{})};
  for(const player of club.players||[]){
    const key=String(club.id)+':'+String(player.id),value=Number.isFinite(conditions[key])?conditions[key]:100;
    conditions[key]=clamp(35,100,value+mod.condition);
  }
  return{...career,conditions,trainingState:{...(career.trainingState||{}),focus:career.trainingState?.focus||'balanced',sessions:Number(career.trainingState?.sessions||0)+1,lastAppliedRound:career.round||0}};
}
export function aiPlanVector(plan){
  const id=String(plan?.id||plan||'balanced');
  if(id==='vertical')return{pressing:58,defensiveLine:58,tempo:68,width:52,directness:74,risk:65,buildUp:48};
  if(id==='control')return{pressing:55,defensiveLine:55,tempo:48,width:60,directness:34,risk:45,buildUp:72};
  if(id==='compact')return{pressing:40,defensiveLine:36,tempo:42,width:44,directness:56,risk:30,buildUp:50};
  if(id==='pressing')return{pressing:76,defensiveLine:67,tempo:63,width:54,directness:48,risk:66,buildUp:56};
  return{pressing:52,defensiveLine:50,tempo:52,width:50,directness:50,risk:48,buildUp:55};
}
export function tacticVector(career){const t=sanitizeTacticalState(career?.tacticalState);return{...t,buildUp:clamp(20,85,72-t.directness*.45+t.tempo*.12)};}
export function tacticalMatchup(career,opponentPlan,{isHome=false}={}){
  const own=tacticVector(career),opp=aiPlanVector(opponentPlan),training=trainingMatchModifier(career);
  const pressure=(own.pressing-opp.buildUp)/100,lineSpace=(own.defensiveLine-opp.directness)/100,counterRisk=clamp(-.18,.30,(own.risk+own.defensiveLine-105)/180+(opp.directness-50)/240),control=(own.width-50)/250+(55-own.directness)/260;
  const attackBoost=clamp(-.20,.30,(own.mentality-50)/190+pressure*.12+training.attack-counterRisk*.12);
  const defenseBoost=clamp(-.20,.24,(50-own.risk)/250-lineSpace*.07+training.defense);
  const possession=clamp(-7,8,control*12+pressure*3+(own.tempo<50?1.5:0));
  const tempo=clamp(.82,1.25,.82+own.tempo/235);
  const fatigueMultiplier=clamp(.82,1.34,.82+own.pressing/230+own.tempo/520+own.risk/650);
  const injuryMultiplier=clamp(.72,1.48,training.injury*(.88+fatigueMultiplier*.18));
  return{attackBoost,defenseBoost,possession,tempo,fatigueMultiplier,injuryMultiplier,counterRisk,setPiece:training.setPiece||0,label:tacticalPreset(own.preset).name};
}
export function matchWeather(seed){
  const r=roll(seed+'|weather'),r2=roll(seed+'|temperature');
  if(r<.10)return{id:'heavy-rain',label:'Chuva forte',passing:-.06,tempo:-.05,injury:1.10,variance:.08,temperature:18+Math.round(r2*6)};
  if(r<.27)return{id:'rain',label:'Chuva',passing:-.035,tempo:-.025,injury:1.05,variance:.04,temperature:19+Math.round(r2*7)};
  if(r>.91)return{id:'heat',label:'Calor forte',passing:0,tempo:-.02,injury:1.06,variance:.02,temperature:31+Math.round(r2*5)};
  return{id:'clear',label:'Tempo firme',passing:0,tempo:0,injury:1,variance:0,temperature:22+Math.round(r2*8)};
}
export function setPieceAttackModifier(career){
  const t=sanitizeTacticalState(career?.tacticalState),training=trainingMatchModifier(career);
  const corner=t.setPieces?.corners==='near-post'?.045:t.setPieces?.corners==='far-post'?.035:t.setPieces?.corners==='short'?.02:.028;
  return clamp(0,.15,corner+(training.setPiece||0));
}
export function matchPreparationSummary(career,opponentPlan,seed){
  const matchup=tacticalMatchup(career,opponentPlan),weather=matchWeather(seed),training=trainingMatchModifier(career);
  return{tactic:matchup.label,training:training.label,weather,attackBoost:matchup.attackBoost,defenseBoost:matchup.defenseBoost,fatigueMultiplier:matchup.fatigueMultiplier};
}
