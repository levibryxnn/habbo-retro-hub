import { clamp, hashSeed, mulberry32 } from './ldf-engine.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export const PLAYER_PERSONALITIES=[
  {id:'professional',name:'Profissional',description:'Treino, disciplina e consistência acima de exposição.',training:1.10,discipline:10,ambition:2,loyalty:5,media:.92,moraleStability:1.12,contractPressure:.92},
  {id:'ambitious',name:'Ambicioso',description:'Busca desafios maiores, minutos e evolução rápida.',training:1.05,discipline:3,ambition:13,loyalty:-5,media:1.04,moraleStability:.94,contractPressure:1.15},
  {id:'loyal',name:'Leal',description:'Valoriza continuidade e relacionamento com clube e torcida.',training:1.02,discipline:5,ambition:-2,loyalty:15,media:.95,moraleStability:1.10,contractPressure:.84},
  {id:'media',name:'Midiático',description:'Mais exposição comercial e pressão pública.',training:.98,discipline:0,ambition:7,loyalty:-2,media:1.22,moraleStability:.88,contractPressure:1.06},
  {id:'reserved',name:'Reservado',description:'Menos ruído externo, foco no vestiário e menor oscilação.',training:1.04,discipline:7,ambition:1,loyalty:6,media:.82,moraleStability:1.18,contractPressure:.92},
  {id:'competitive',name:'Competitivo',description:'Cresce em jogos grandes, mas cobra espaço no time.',training:1.07,discipline:2,ambition:10,loyalty:0,media:1.02,moraleStability:.96,contractPressure:1.12},
  {id:'undisciplined',name:'Indisciplinado',description:'Alto teto de protagonismo, com maior risco de perder confiança.',training:.91,discipline:-15,ambition:8,loyalty:-4,media:1.08,moraleStability:.82,contractPressure:1.08},
];

export const COACH_PROFILES=[
  {id:'developer',name:'Formador',description:'Aceita erros de jovens e acelera desenvolvimento.',development:1.18,trustTolerance:1.12,selectionYouth:8,disciplineWeight:.85,attackBias:0,tacticalDemand:70},
  {id:'disciplinarian',name:'Disciplinador',description:'Premia disciplina, condição e cumprimento da função.',development:1.02,trustTolerance:.82,selectionYouth:0,disciplineWeight:1.28,attackBias:-2,tacticalDemand:82},
  {id:'attacking',name:'Ofensivo',description:'Valoriza intensidade, técnica e produção com bola.',development:1.05,trustTolerance:.96,selectionYouth:2,disciplineWeight:.92,attackBias:8,tacticalDemand:76},
  {id:'conservative',name:'Conservador',description:'Prefere estabilidade, experiência e baixo risco.',development:.96,trustTolerance:.92,selectionYouth:-5,disciplineWeight:1.08,attackBias:-7,tacticalDemand:80},
  {id:'meritocratic',name:'Meritocrático',description:'Desempenho recente pesa mais que reputação ou nome.',development:1.04,trustTolerance:1.00,selectionYouth:1,disciplineWeight:1.00,attackBias:0,tacticalDemand:74},
  {id:'star',name:'Gestor de estrelas',description:'Tolera protagonismo e protege jogadores de maior reputação.',development:.97,trustTolerance:1.08,selectionYouth:-2,disciplineWeight:.78,attackBias:4,tacticalDemand:68},
];

export const PLAYER_WORLD_MARKETS=[
  {id:'BRA',name:'Brasil',league:'Brasileirão Série A',level:72,salary:1,exposure:1,difficulty:1},
  {id:'ARG',name:'Argentina',league:'Liga Argentina',level:70,salary:.90,exposure:.92,difficulty:.98},
  {id:'POR',name:'Portugal',league:'Liga Portugal',level:78,salary:1.45,exposure:1.24,difficulty:1.12},
  {id:'ESP',name:'Espanha',league:'LaLiga',level:87,salary:2.25,exposure:1.62,difficulty:1.35},
];

export const INTERNATIONAL_PLAYER_CLUBS=[
  {id:'pc-river',name:'River Plate',abbreviation:'RIV',country:'ARG',league:'Liga Argentina',level:80,budgetM:60,fanIndex:.88,primary:'#d71920',secondary:'#ffffff',external:true},
  {id:'pc-boca',name:'Boca Juniors',abbreviation:'BOC',country:'ARG',league:'Liga Argentina',level:79,budgetM:58,fanIndex:.90,primary:'#0b2f6b',secondary:'#f2c500',external:true},
  {id:'pc-racing',name:'Racing Club',abbreviation:'RAC',country:'ARG',league:'Liga Argentina',level:73,budgetM:34,fanIndex:.66,primary:'#5ab2e6',secondary:'#ffffff',external:true},
  {id:'pc-benfica',name:'Benfica',abbreviation:'BEN',country:'POR',league:'Liga Portugal',level:84,budgetM:105,fanIndex:.83,primary:'#d71920',secondary:'#ffffff',external:true},
  {id:'pc-porto',name:'Porto',abbreviation:'POR',country:'POR',league:'Liga Portugal',level:84,budgetM:100,fanIndex:.80,primary:'#1358a5',secondary:'#ffffff',external:true},
  {id:'pc-sporting',name:'Sporting CP',abbreviation:'SCP',country:'POR',league:'Liga Portugal',level:83,budgetM:96,fanIndex:.78,primary:'#178447',secondary:'#ffffff',external:true},
  {id:'pc-braga',name:'Braga',abbreviation:'BRA',country:'POR',league:'Liga Portugal',level:77,budgetM:55,fanIndex:.52,primary:'#d71920',secondary:'#ffffff',external:true},
  {id:'pc-real',name:'Real Madrid',abbreviation:'RMA',country:'ESP',league:'LaLiga',level:94,budgetM:280,fanIndex:.98,primary:'#ffffff',secondary:'#e5c45c',external:true},
  {id:'pc-barcelona',name:'Barcelona',abbreviation:'BAR',country:'ESP',league:'LaLiga',level:93,budgetM:260,fanIndex:.98,primary:'#1f3c88',secondary:'#a50044',external:true},
  {id:'pc-atletico',name:'Atlético de Madrid',abbreviation:'ATM',country:'ESP',league:'LaLiga',level:88,budgetM:175,fanIndex:.82,primary:'#d71920',secondary:'#ffffff',external:true},
  {id:'pc-sevilla',name:'Sevilla',abbreviation:'SEV',country:'ESP',league:'LaLiga',level:82,budgetM:105,fanIndex:.66,primary:'#d71920',secondary:'#ffffff',external:true},
  {id:'pc-villarreal',name:'Villarreal',abbreviation:'VIL',country:'ESP',league:'LaLiga',level:81,budgetM:100,fanIndex:.56,primary:'#f3dc39',secondary:'#12355b',external:true},
];

const COACH_NAMES=['Rafael Nunes','Marcelo Valença','Bruno Azevedo','Eduardo Serrano','Thiago Fontes','Leandro Barros','André Farias','Gustavo Neri','Caio Mendonça','Renato Vidal','Martín Salas','João Tavares'];
const FIRST_NAMES=['Lucas','Matheus','Gabriel','Rafael','Pedro','João','Diego','Bruno','Caio','Henrique','Nicolás','Tomás','Miguel','André','Felipe','Daniel'];
const LAST_NAMES=['Silva','Santos','Costa','Pereira','Oliveira','Ramos','Almeida','Mendes','Ferreira','Barros','Souza','Lima','Gomes','Martins','Rocha','Vidal'];

export const personalityDef=id=>PLAYER_PERSONALITIES.find(item=>item.id===id)||PLAYER_PERSONALITIES[0];
export const coachProfileDef=id=>COACH_PROFILES.find(item=>item.id===id)||COACH_PROFILES[0];
export const playerMarketDef=id=>PLAYER_WORLD_MARKETS.find(item=>item.id===id)||PLAYER_WORLD_MARKETS[0];

export function playerCareerClubPool(baseClubs=[]){
  const domestic=(baseClubs||[]).filter(Boolean).map(club=>({...club,country:club.country||'BRA',league:club.league||'Brasileirão Série A',external:Boolean(club.external)}));
  const merged=[...domestic,...INTERNATIONAL_PLAYER_CLUBS],seen=new Set();
  return merged.filter(club=>{const id=String(club.id);if(seen.has(id))return false;seen.add(id);return true;});
}

export function playerClubLevel(club){
  if(!club)return 50;
  if(Number.isFinite(Number(club.level)))return clamp(38,96,Number(club.level));
  const budget=finite(club.gameBudgetM??club.budgetM,20),players=Array.isArray(club.players)?club.players:[],squad=players.length?players.reduce((sum,p)=>sum+finite(p.overall??p.rating,65),0)/players.length:64;
  return clamp(38,94,44+squad*.32+Math.min(18,budget*.10));
}

export function playerClubBudgetM(club){return Math.max(8,finite(club?.budgetM??club?.gameBudgetM,25));}
export function playerClubMarket(club){return playerMarketDef(club?.country||'BRA');}

function pick(seed,list){return list[hashSeed(seed)%list.length];}
function rivalName(seed){return pick(seed+'-first',FIRST_NAMES)+' '+pick(seed+'-last',LAST_NAMES);}

export function createCoachState(seed,clubId,season=2026,sequence=0){
  const rng=mulberry32(hashSeed(seed,clubId,season,'coach',sequence)),profile=COACH_PROFILES[Math.floor(rng()*COACH_PROFILES.length)],name=COACH_NAMES[Math.floor(rng()*COACH_NAMES.length)];
  return{id:'coach-'+hashSeed(seed,clubId,season,sequence).toString(36),name,profileId:profile.id,profileName:profile.name,description:profile.description,appointedSeason:season,sequence,security:72+Math.round(rng()*20)};
}

export function createPositionRivals({seed,club,position='MEI',season=2026,playerOverall=65}={}){
  const level=playerClubLevel(club);
  return Array.from({length:3},(_,index)=>{
    const rng=mulberry32(hashSeed(seed,club?.id,position,season,'rival',index)),age=18+Math.floor(rng()*15),offset=index===0?2:index===1?-1:-5;
    return{id:'rival-'+hashSeed(seed,club?.id,position,index).toString(36),name:rivalName(seed+'-'+club?.id+'-'+index),position,age,overall:Math.round(clamp(48,92,level*.76+playerOverall*.24+offset+(rng()-.5)*7)),form:Number(((rng()-.5)*1.8).toFixed(1)),fitness:Math.round(82+rng()*16),starts:0,matches:0,lastRating:Number((6.2+rng()*.8).toFixed(1))};
  });
}

export function ensurePlayerWorld(career,club){
  const current=career?.world&&typeof career.world==='object'?career.world:{};
  let coach=current.coach;
  if(!coach||String(current.clubId)!==String(club?.id))coach=createCoachState(career?.seed,club?.id,career?.season,finite(current.coachSequence,0));
  let rivals=Array.isArray(current.rivals)?current.rivals:[];
  if(String(current.clubId)!==String(club?.id)||!rivals.length)rivals=createPositionRivals({seed:career?.seed,club,position:career?.player?.position,season:career?.season,playerOverall:career?.player?.currentOverall});
  return{...current,clubId:String(club?.id||''),coach,rivals:rivals.slice(0,4),coachSequence:finite(current.coachSequence,coach.sequence||0),lastCoachChangeDay:finite(current.lastCoachChangeDay,-99),events:Array.isArray(current.events)?current.events.slice(0,80):[],leagueCountry:club?.country||'BRA',leagueName:club?.league||'Brasileirão Série A'};
}

export function sanitizePlayerWorld(raw,career,club){
  const base=ensurePlayerWorld({...career,world:null},club),source=raw&&typeof raw==='object'?raw:{},rawCoach=source.coach&&typeof source.coach==='object'?source.coach:null,profile=coachProfileDef(rawCoach?.profileId);
  const coach=rawCoach?{id:String(rawCoach.id||base.coach.id).slice(0,100),name:String(rawCoach.name||base.coach.name).slice(0,80),profileId:profile.id,profileName:profile.name,description:profile.description,appointedSeason:clamp(2026,2100,finite(rawCoach.appointedSeason,career?.season||2026)),sequence:clamp(0,100,finite(rawCoach.sequence,0)),security:clamp(0,100,finite(rawCoach.security,75))}:base.coach;
  const rivals=Array.isArray(source.rivals)?source.rivals.slice(0,4).map((rival,index)=>({
    id:String(rival?.id||base.rivals[index]?.id||'rival-'+index).slice(0,100),
    name:String(rival?.name||base.rivals[index]?.name||'Concorrente').slice(0,80),
    position:['GOL','DEF','MEI','ATA'].includes(rival?.position)?rival.position:career?.player?.position||'MEI',
    age:clamp(16,42,finite(rival?.age,22)),overall:clamp(40,96,finite(rival?.overall,65)),form:clamp(-2,2,finite(rival?.form,0)),
    fitness:clamp(35,100,finite(rival?.fitness,90)),starts:clamp(0,1000,finite(rival?.starts,0)),matches:clamp(0,1000,finite(rival?.matches,0)),lastRating:clamp(4,10,finite(rival?.lastRating,6.5)),
  })):base.rivals;
  return{clubId:String(club?.id||''),coach,rivals:rivals.length?rivals:base.rivals,coachSequence:clamp(0,100,finite(source.coachSequence,coach.sequence||0)),lastCoachChangeDay:clamp(-999,266,finite(source.lastCoachChangeDay,-99)),events:Array.isArray(source.events)?source.events.slice(0,80).filter(item=>item&&typeof item==='object').map(item=>({id:String(item.id||'world-event').slice(0,100),type:String(item.type||'event').slice(0,40),title:String(item.title||'Evento').slice(0,120),text:String(item.text||'').slice(0,500),season:clamp(2026,2100,finite(item.season,career?.season||2026)),day:clamp(0,266,finite(item.day,0))})):[],leagueCountry:club?.country||'BRA',leagueName:club?.league||'Brasileirão Série A'};
}

export function playerSelectionContext(career,club){
  const world=ensurePlayerWorld(career,club),coach=coachProfileDef(world.coach.profileId),personality=personalityDef(career?.player?.personalityId),rivals=world.rivals||[],best=rivals.slice().sort((a,b)=>(b.overall+b.form*2)-(a.overall+a.form*2))[0];
  const roleCompetition=best?best.overall+best.form*1.8:playerClubLevel(club);
  const tacticalCompatibility=clamp(35,98,72+coach.attackBias*(career?.player?.position==='ATA'?1:career?.player?.position==='DEF'?-1:.35)+(career?.matchApproach==='disciplined'?8:career?.matchApproach==='aggressive'?-5:2));
  const discipline=clamp(20,100,76+personality.discipline+(career?.matchApproach==='disciplined'?10:career?.matchApproach==='aggressive'?-5:0));
  return{world,coach,personality,rivals,bestRival:best||null,roleCompetition,tacticalCompatibility,discipline};
}

export function evolvePositionRivals(career,club,played=false){
  const world=ensurePlayerWorld(career,club),rng=mulberry32(hashSeed(career?.seed,career?.season,career?.week,club?.id,'rivals'));
  const rivals=(world.rivals||[]).map(rival=>{
    const selected=rng()<.72,performance=selected?5.9+rng()*2.1:rival.lastRating,form=clamp(-2,2,finite(rival.form)+(performance-6.5)*.12+(rng()-.5)*.16);
    return{...rival,form:Number(form.toFixed(1)),fitness:Math.round(clamp(60,100,finite(rival.fitness,90)+(selected?-3:2)+rng()*2)),matches:finite(rival.matches)+(selected?1:0),starts:finite(rival.starts)+(selected&&rng()<.8?1:0),lastRating:Number(performance.toFixed(1))};
  });
  return{...career,world:{...world,rivals}};
}

export function playerPreMatchBriefing(career,club,opponent,selectionChance=.5){
  const context=playerSelectionContext(career,club),coach=context.world.coach,profile=context.coach,p=career?.player||{},oppLevel=playerClubLevel(opponent),ownLevel=playerClubLevel(club),chance=Math.round(clamp(0,1,selectionChance)*100);
  const role=chance>=72?'Provável titular':chance>=45?'Disputa aberta':chance>=22?'Provável banco':'Fora da rotação';
  const expectation=p.position==='ATA'?'Atacar profundidade e finalizar com eficiência':p.position==='MEI'?'Acelerar circulação e criar vantagens':p.position==='DEF'?'Ganhar duelos e proteger a área':'Controlar a área e iniciar a saída';
  const objective=p.position==='ATA'?'Participar de gol ou gerar ao menos 0,45 xG':p.position==='MEI'?'Criar chances e manter boa qualidade de passe':p.position==='DEF'?'Vencer duelos e evitar erros decisivos':'Evitar erros e superar o xG sofrido';
  return{coachName:coach.name,coachProfile:profile.name,role,selectionChance:chance,expectation,objective,opponentName:opponent?.name||'Adversário',difficulty:oppLevel-ownLevel>=8?'Muito difícil':oppLevel>ownLevel?'Difícil':ownLevel-oppLevel>=9?'Favorável':'Equilibrado',opponentLevel:oppLevel,ownLevel,bestRival:context.bestRival};
}

export function buildPlayerMatchTimeline({career,performance,teamMatch,started=false,selected=false}={}){
  const events=[],seed=hashSeed(career?.seed,career?.season,career?.dayOfSeason,'timeline'),rng=mulberry32(seed),name=career?.player?.name||'Jogador';
  events.push({minute:1,type:'kickoff',text:'A partida começou.'});
  if(!selected){events.push({minute:18,type:'bench',text:name+' acompanha a partida no banco.'});events.push({minute:90,type:'fulltime',text:'Fim de jogo.'});return events;}
  if(!started)events.push({minute:Math.round(52+rng()*20),type:'sub',text:name+' é chamado para entrar na partida.'});
  const start=started?8:60;
  if(performance?.goals)for(let i=0;i<performance.goals;i++)events.push({minute:Math.min(88,start+Math.round(rng()*28)+i*11),type:'goal',text:'Gol de '+name+'.'});
  if(performance?.assists)for(let i=0;i<performance.assists;i++)events.push({minute:Math.min(87,start+Math.round(rng()*30)+i*9),type:'assist',text:name+' cria a jogada do gol.'});
  if(rng()<.75)events.push({minute:Math.min(84,start+Math.round(rng()*35)),type:'action',text:career?.player?.position==='DEF'?'Boa leitura defensiva e corte importante.':career?.player?.position==='GOL'?'Defesa importante mantém a equipe no jogo.':'Boa participação em uma jogada perigosa.'});
  events.push({minute:90,type:'fulltime',text:'Fim de jogo: '+finite(teamMatch?.goalsFor)+' x '+finite(teamMatch?.goalsAgainst)+'.'});
  return events.sort((a,b)=>a.minute-b.minute).slice(0,12);
}

export function coachPostMatchReview(career,performance,selected){
  const p=career?.player||{},context=playerSelectionContext(career,{id:career?.clubId,level:finite(career?.world?.clubLevel,70)}),coach=context.coach;
  if(!selected)return{tone:'neutral',title:'Sem minutos',text:coach.id==='developer'?'Continue treinando; a comissão ainda acompanha sua evolução.':'Você precisa aumentar sua competitividade nos treinos.',trustDelta:-.2};
  const rating=finite(performance?.rating,6.2),discipline=context.discipline;
  let trustDelta=(rating-6.4)*1.55+(discipline-70)*.012;
  if(coach.id==='meritocratic')trustDelta*=1.18;
  if(coach.id==='disciplinarian'&&discipline<65)trustDelta-=.8;
  if(rating>=7.6)return{tone:'positive',title:'Aprovado pela comissão',text:'Sua atuação fortaleceu sua posição na hierarquia do elenco.',trustDelta:Number(trustDelta.toFixed(2))};
  if(rating<6)return{tone:'negative',title:'Cobrança do treinador',text:'A comissão espera resposta nos próximos treinos e jogos.',trustDelta:Number(trustDelta.toFixed(2))};
  return{tone:'neutral',title:'Dentro do esperado',text:'Você manteve sua posição, mas a concorrência segue aberta.',trustDelta:Number(trustDelta.toFixed(2))};
}

export function maybeChangePlayerCoach(career,club){
  if(!club||career?.stage!=='professional')return career;
  const world=ensurePlayerWorld(career,club),team=career?.teamSeason||{},matches=finite(team.matches);
  if(matches<10||finite(career?.dayOfSeason)-finite(world.lastCoachChangeDay,-99)<56)return{...career,world};
  const pointsPerMatch=finite(team.points)/Math.max(1,matches),rng=mulberry32(hashSeed(career?.seed,career?.season,career?.week,club.id,'coach-change'));
  const pressure=clamp(0,1,(1.32-pointsPerMatch)*.55+(matches>=20?.10:0));
  if(rng()>pressure)return{...career,world};
  const sequence=finite(world.coachSequence,0)+1,newCoach=createCoachState(career.seed,club.id,career.season,sequence),old=world.coach,resetTrust=clamp(30,72,46+career.player.form*3+personalityDef(career.player.personalityId).discipline*.15);
  return{...career,player:{...career.player,coachTrust:resetTrust},world:{...world,coach:newCoach,coachSequence:sequence,lastCoachChangeDay:career.dayOfSeason,events:[{id:'coach-change-'+career.season+'-'+career.dayOfSeason,type:'coach-change',title:'Troca de treinador',text:old.name+' deixou o cargo. '+newCoach.name+' assume com perfil '+newCoach.profileName+'.',season:career.season,day:career.dayOfSeason},...(world.events||[])].slice(0,80)},news:[{id:'coach-news-'+career.season+'-'+career.dayOfSeason,title:'Novo treinador no '+club.name,text:newCoach.name+' assume o comando e reavalia a hierarquia do elenco.',season:career.season,week:career.week,day:career.dayOfSeason},...(career.news||[])].slice(0,80)};
}

export function processPlayerWorldEvent(career,event={}){
  if(!career||!event.type)return career;
  const ledger=Array.isArray(career.worldEventLedger)?career.worldEventLedger:[],id=String(event.id||event.type+'-'+career.season+'-'+career.dayOfSeason);
  if(ledger.some(item=>item.id===id))return career;
  let next={...career,worldEventLedger:[{id,type:event.type,season:career.season,day:career.dayOfSeason,payload:event.payload||{}},...ledger].slice(0,160)},p={...career.player};
  if(event.type==='MATCH_REVIEW'){
    const rating=finite(event.payload?.rating,6.4),personality=personalityDef(p.personalityId),exposure=playerMarketDef(event.payload?.country||'BRA').exposure;
    const repDelta=clamp(-1.2,2.4,(rating-6.5)*.36+(finite(event.payload?.goals)*.22+finite(event.payload?.assists)*.14))*personality.media*exposure;
    p.reputation=clamp(1,100,finite(p.reputation,5)+repDelta);
  }
  if(event.type==='OBJECTIVE_COMPLETED'){
    p.coachTrust=clamp(0,100,finite(p.coachTrust,50)+1.5);p.reputation=clamp(1,100,finite(p.reputation,5)+.7);
  }
  if(event.type==='CONTRACT_DECISION'&&event.payload?.intent==='leave')p.morale=clamp(0,100,finite(p.morale,70)-1);
  return{...next,player:p};
}

export function playerAgendaForDay(career,offset=0){
  const day=(finite(career?.dayOfWeek,0)+offset)%7,injured=Boolean(career?.player?.injury),stage=career?.stage;
  if(stage==='free-agent')return{day,type:'individual',label:'Treino individual',detail:'Manter forma e aguardar o mercado.'};
  if(injured)return{day,type:'recovery',label:'Fisioterapia',detail:'Recuperação e controle de carga.'};
  if(day===5)return{day,type:'match',label:'Jogo',detail:'Partida oficial.'};
  if(day===6)return{day,type:'rest',label:'Folga',detail:'Recuperação física e mental.'};
  if(day===0)return{day,type:'recovery',label:'Recuperação',detail:'Baixa carga e preparação da semana.'};
  if(day===4)return{day,type:'preparation',label:'Preparação',detail:'Treino leve, bolas paradas e plano de jogo.'};
  if(day===3)return{day,type:'tactical',label:'Treino tático',detail:'Encaixe no modelo do treinador.'};
  return{day,type:'training',label:'Treino',detail:'Sessão técnica e física.'};
}
