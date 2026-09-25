import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CalendarDays, Clock3, FastForward, Flag, Gauge, History, Pause, Play, RotateCcw, ShieldAlert, Target, Timer, Trophy, UserRoundCog, X, Zap } from 'lucide-react';
import {
  HALF_TIME_SECOND,
  MAX_SUBSTITUTIONS,
  changeUserMatchTactic,
  changeUserMatchTacticalState,
  finishPendingRound,
  fixtureForUser,
  liveRoundMatches,
  makeUserSubstitution,
  resolveUserPenalty,
  roundDuration,
  scoreAtSecond,
  SIMULATION_MODES,
  standingsFromResults,
  startNextSeason,
  startRound,
  setCareerTacticalPreset,
  updateCareerTactics,
  updateUserLineup,
  userLineupForNextMatch,
} from './career-engine';
import {
  careerPlayerOverall,
  currentBench,
  currentLineup,
  lineupValidation,
  playerAvailability,
  playerCondition,
  playerGameStats,
  bestMatchPlayer,
} from './player-engine';
import { getClubWorld } from './club-world.js';
import { positionGroup, translatePosition } from './position-labels.js';
import { changePendingWorldTactic, changePendingWorldTacticalState, finishPendingWorldFixture, nextCareerEvent, pendingSeasonFixtures, startWorldFixture, unifiedUserMatchHistory, worldClub } from './competition-engine.js';
import { TACTICAL_DECISIONS, TACTICAL_PRESETS, sanitizeTacticalState, tacticalTradeoffSummary } from './tactical-engine.js';
import { opponentScoutingReport } from './scouting-engine.js';
import WorldCrest from './WorldCrest.jsx';
import './match.css';

const eventSymbol={goal:'⚽',yellow:'■',red:'▰',injury:'✚',penalty:'●','penalty-miss':'×',corner:'⚑',foul:'◆',shot:'◎','big-chance':'!','substitution':'↕'};
const FULL_TIME=90*60;

function SidelineField() {
  const base=import.meta.env.BASE_URL.replace(/\/$/,'');
  return <picture className="sideline-picture" aria-hidden="true">
    <source media="(max-width: 620px)" srcSet={base+'/stadium-sideline-mobile.webp'}/>
    <img className="sideline-field" src={base+'/stadium-sideline-desktop.webp'} alt="" draggable="false" decoding="async" fetchPriority="high"/>
  </picture>;
}
const clockAt=second=>{const value=Math.max(0,Math.floor(second||0)),m=Math.floor(value/60),s=value%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');};
function EventLine({event,compact=false}) {
  if(!event)return <div className="match-event-line muted">Aguardando o próximo lance...</div>;
  return <div className={'match-event-line '+(compact?'compact ':'')+'type-'+event.type}><span className="event-symbol">{eventSymbol[event.type]||'•'}</span><strong>{event.minute}'</strong><span>{compact?event.text.replace(/^GOL! /,''):event.text}</span></div>;
}
function Comparison({label,values,percent=false,Icon=Activity}) {
  const total=Math.max(values[0]+values[1],1),left=percent?values[0]:Math.round(values[0]/total*100);
  return <div className="match-stat-row"><div><strong>{values[0]}{percent?'%':''}</strong><span className="match-stat-label"><i><Icon size={13}/></i>{label}</span><strong>{values[1]}{percent?'%':''}</strong></div><div className="match-stat-track"><i style={{width:left+'%'}}/><b style={{width:(100-left)+'%'}}/></div></div>;
}
function visibleStats(stats,second,duration) {
  if(!stats)return{possession:[50,50],shots:[0,0],onTarget:[0,0],corners:[0,0],fouls:[0,0]};
  const factor=Math.max(.03,Math.min(1,second/(duration||FULL_TIME))),progress=values=>values.map(v=>Math.round(v*factor));
  return{possession:stats.possession,shots:progress(stats.shots),onTarget:progress(stats.onTarget),corners:progress(stats.corners),fouls:progress(stats.fouls)};
}
function matchMomentum(stats){
  const raw=50+(stats.possession[0]-50)*.35+(stats.shots[0]-stats.shots[1])*2.2+(stats.onTarget[0]-stats.onTarget[1])*4.6+(stats.corners[0]-stats.corners[1])*1.3;
  return Math.max(18,Math.min(82,Math.round(raw)));
}
function worldHash(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function worldGoalTimeline(result){
  if(!result)return[];
  const goals=[];
  for(let i=0;i<(result.homeGoals||0);i++)goals.push({side:'home',second:360+(worldHash(result.fixtureId+'|h|'+i)%4620)});
  for(let i=0;i<(result.awayGoals||0);i++)goals.push({side:'away',second:360+(worldHash(result.fixtureId+'|a|'+i)%4620)});
  return goals.sort((a,b)=>a.second-b.second);
}
function worldScoreAt(result,second){
  const score={home:0,away:0};for(const goal of worldGoalTimeline(result))if(goal.second<=second)score[goal.side]++;return score;
}
function worldMatchStats(result,second){
  if(!result)return{possession:[50,50],shots:[0,0],onTarget:[0,0],corners:[0,0],fouls:[0,0]};
  const hp=result.homePower||70,ap=result.awayPower||70,homePoss=Math.max(38,Math.min(62,Math.round(50+(hp-ap)*.45))),factor=Math.max(.03,Math.min(1,second/FULL_TIME));
  const homeShots=Math.max(result.homeGoals+5,Math.round(8+(hp-ap)*.18)),awayShots=Math.max(result.awayGoals+5,Math.round(8+(ap-hp)*.18));
  return{possession:[homePoss,100-homePoss],shots:[Math.round(homeShots*factor),Math.round(awayShots*factor)],onTarget:[Math.round(Math.max(result.homeGoals+2,homeShots*.42)*factor),Math.round(Math.max(result.awayGoals+2,awayShots*.42)*factor)],corners:[Math.round((3+(worldHash(result.fixtureId+'|hc')%5))*factor),Math.round((3+(worldHash(result.fixtureId+'|ac')%5))*factor)],fouls:[Math.round((8+(worldHash(result.fixtureId+'|hf')%8))*factor),Math.round((8+(worldHash(result.fixtureId+'|af')%8))*factor)]};
}
function worldImportance(id,stage=''){
  if(/final/i.test(stage))return'Decisiva';
  if(id==='mundial'||id==='libertadores')return'Alta';
  if(id==='copa-do-brasil'||id==='sudamericana'||id==='supercopa')return'Alta';
  if(/semi|quartas|oitavas|playoff/i.test(stage))return'Alta';
  return'Média';
}
function MatchTacticStrip({career,onSelect,onPatch,live=false,disabled=false}){
  const [advanced,setAdvanced]=useState(false),tactic=sanitizeTacticalState(career?.tacticalState),current=TACTICAL_PRESETS.find(item=>item.id===tactic.preset)||TACTICAL_PRESETS[1],effects=tacticalTradeoffSummary(career,{id:'balanced'});
  return <section className={'match-tactic-strip '+(live?'live':'')}>
    <div className="match-tactic-copy"><Gauge size={16}/><span><small>{live?'AJUSTE DURANTE O JOGO':'PLANO DE JOGO'}</small><strong>{current.name}</strong><em>{live?'Buscar o resultado aumenta chance ofensiva, fadiga e espaço para o rival.':current.description}</em></span><button type="button" className="advanced-tactic-toggle" onClick={()=>setAdvanced(v=>!v)}>{advanced?'Fechar ajustes':'Ajustes finos'}</button></div>
    <div className="match-tactic-options">{TACTICAL_PRESETS.map(item=><button key={item.id} disabled={disabled} className={tactic.preset===item.id?'active':''} onClick={()=>onSelect(item.id)}>{item.name}</button>)}</div>
    {advanced&&<div className="live-tactic-advanced"><div className="live-tactic-effects"><span>Ataque <b>{effects.attack>0?'+':''}{effects.attack}%</b></span><span>Fadiga <b>{effects.fatigue>0?'+':''}{effects.fatigue}%</b></span><span>Risco contra <b>{effects.counterRisk>0?'+':''}{effects.counterRisk}%</b></span></div><div className="live-tactic-sliders">{TACTICAL_DECISIONS.map(item=><label key={item.key}><span>{item.label}<b>{Math.round(tactic[item.key])}</b></span><input disabled={disabled} type="range" min="0" max="100" value={tactic[item.key]} onChange={e=>onPatch?.({[item.key]:Number(e.target.value)})}/></label>)}</div><div className="live-tactic-toggles"><button disabled={disabled} className={tactic.counterAttack?'active':''} onClick={()=>onPatch?.({counterAttack:!tactic.counterAttack})}>Contra-ataque {tactic.counterAttack?'ON':'OFF'}</button>{[['mixed','Misto'],['left','Esquerda'],['center','Centro'],['right','Direita']].map(([id,label])=><button disabled={disabled} key={id} className={tactic.attackingFocus===id?'active':''} onClick={()=>onPatch?.({attackingFocus:id})}>{label}</button>)}</div></div>}
  </section>;
}
function MatchContextStrip({result,career}){
  const weather=result?.environment?.weather,info=result?.intelligence;
  return <div className="match-context-strip"><span><small>Treino</small><strong>{info?.training||({balanced:'Equilibrado',recovery:'Recuperação',physical:'Físico',attacking:'Ataque',defending:'Defesa',possession:'Posse',setpieces:'Bola parada',academy:'Integração da base'}[career?.trainingState?.focus]||'Equilibrado')}</strong></span><span><small>Clima / campo</small><strong>{weather?.label||info?.weather||'A confirmar'}{weather?.pitch?' · '+weather.pitch:''}</strong></span><span><small>xG</small><strong>{result?.xg?result.xg[0].toFixed(2)+' × '+result.xg[1].toFixed(2):'pré-jogo'}</strong></span>{Number.isFinite(info?.homeStrength)&&<span><small>Força LDF</small><strong>{info.homeStrength.toFixed(1)} × {info.awayStrength.toFixed(1)}</strong></span>}</div>;
}
function OpponentBrief({career,club,opponent,roundNumber}){
  if(!opponent)return null;
  const report=opponentScoutingReport(career,opponent,roundNumber||career.round+1),top=(opponent.players||[]).slice().sort((a,b)=>playerGameStats(b).overall-playerGameStats(a).overall)[0],avg=(opponent.players||[]).slice().sort((a,b)=>playerGameStats(b).overall-playerGameStats(a).overall).slice(0,14).reduce((sum,p)=>sum+playerGameStats(p).overall,0)/Math.max(1,Math.min(14,(opponent.players||[]).length));
  return <section className="opponent-brief detailed"><div className="opponent-brief-head"><div><Target size={17}/><span><small>LEITURA DO ADVERSÁRIO</small><strong>{opponent.name}</strong></span></div><em>Relatório tático</em></div><dl><div><dt>Força do núcleo</dt><dd>{Math.round(avg||0)}</dd></div><div><dt>Destaque</dt><dd>{top?.name||'—'} <small>OVR {top?playerGameStats(top).overall:'—'}</small></dd></div><div><dt>Forma recente</dt><dd className="brief-form">{report?.form?.length?report.form.map((item,index)=><i key={index} className={item}>{item}</i>):<small>sem amostra</small>}</dd></div><div><dt>Desfalques</dt><dd>{report?.unavailable?.length||0}</dd></div></dl><div className="scout-reading-grid"><div><small>PONTOS A EXPLORAR</small>{report?.weaknesses?.length?report.weaknesses.slice(0,4).map((text,index)=><p key={index}>↗ {text}</p>):<p>Nenhuma fraqueza clara na amostra atual.</p>}</div><div><small>AMEAÇAS</small>{report?.strengths?.length?report.strengths.slice(0,4).map((text,index)=><p key={index}>⚠ {text}</p>):<p>Sem tendência forte detectada.</p>}</div></div>{report?.suggestions?.length>0&&<div className="scout-tactic-suggestions">{report.suggestions.slice(0,3).map(item=><span key={item.key}><b>{item.label}</b>{item.action}</span>)}</div>}</section>;
}
function PostMatchSummary({career,club,clubs,result}){
  if(!result?.events)return null;
  const side=result.homeId===club.id?'home':'away',opp=clubs.find(item=>item.id===(side==='home'?result.awayId:result.homeId)),score=side==='home'?[result.homeGoals,result.awayGoals]:[result.awayGoals,result.homeGoals],performance=bestMatchPlayer(club,result,side,result.durationSecond||FULL_TIME),confidence=career.managerConfidence||{},gross=result.matchday?.grossRevenue||0,row=standingsFromResults(career.results,clubs).find(item=>String(item.clubId)===String(club.id)),tone=score[0]>score[1]?(confidence.fans>=75?'A arquibancada saiu empolgada com o momento.':'A vitória alivia a pressão e aproxima a torcida.'):score[0]===score[1]?'A reação é dividida: o próximo jogo ganhou peso.':confidence.board<30?'A diretoria aumentou a cobrança depois do resultado.':'A derrota incomodou, mas o projeto ainda tem margem para reagir.';
  return <section className="post-match-summary"><div className="post-match-head"><span><small>PÓS-JOGO</small><strong>{score[0]>score[1]?'Vitória':score[0]===score[1]?'Empate':'Derrota'} contra {opp?.name||'adversário'}</strong><em>{tone}</em></span><b>{score[0]} × {score[1]}</b></div><div className="post-match-facts"><span><small>Melhor do time</small><strong>{performance?.name||'—'}{performance?<em>{performance.rating.toFixed(1)}</em>:null}</strong></span><span><small>Classificação</small><strong>{row?row.position+'º':'—'} <em>{row?row.points+' pts':''}</em></strong></span><span><small>Torcida</small><strong>{confidence.lastFanDelta>0?'+':''}{Number(confidence.lastFanDelta||0).toFixed(1)} <em>{Math.round(confidence.fans||0)}%</em></strong></span><span><small>Diretoria</small><strong>{confidence.lastBoardDelta>0?'+':''}{Number(confidence.lastBoardDelta||0).toFixed(1)} <em>{Math.round(confidence.board||0)}%</em></strong></span><span><small>Receita do jogo</small><strong>{gross?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1}).format(gross):'—'}</strong></span><span><small>xG</small><strong>{result.xg?result.xg[0].toFixed(2)+' × '+result.xg[1].toFixed(2):'—'}</strong></span></div></section>;
}
const latestFor=(events,side,second)=>[...(events||[])].reverse().find(e=>e.side===side&&e.second<=second)||null;
function PlayerHighlight({club,result,side,second}) {
  const performance=result?bestMatchPlayer(club,result,side,second):null;
  const fallback=(club.players||[]).find(p=>positionGroup(p.position)==='ATA')||(club.players||[])[0];
  const playerName=performance?.name||fallback?.name||club.name;
  const initials=playerName.split(' ').filter(Boolean).map((part,index,array)=>index===0||index===array.length-1?part[0]:'').join('').slice(0,2);
  return <article className="player-highlight"><span className="highlight-avatar">{initials}</span><div className="highlight-name"><strong>{playerName}</strong><small>{performance?.countryCode||fallback?.countryCode||club.abbreviation}</small></div><span className="highlight-rating">{performance?performance.rating.toFixed(1):'—'}</span><div className="highlight-numbers"><span><strong>{performance?.goals||0}</strong><small>Gols</small></span><span><strong>{performance?.assists||0}</strong><small>Assist.</small></span><span><strong>{performance?.shots||0}</strong><small>Finalizações</small></span></div></article>;
}
function LiveRoundBoard({matches,clubs,userClubId,roundNumber,Crest,live=true}) {
  return <section className="live-round-board"><div className="live-round-title"><div><Activity size={15}/><span><strong>Rodada {roundNumber} {live?'ao vivo':'encerrada'}</strong><small>{live?'Os 10 jogos avançam no mesmo relógio.':'Resultados oficiais da rodada concluída.'}</small></span></div><span className={'live-dot '+(live?'':'finished')}>{live?'AO VIVO':'ENCERRADA'}</span></div><div className="live-fixtures">{matches.map(match=>{
    const home=clubs.find(c=>c.id===match.homeId),away=clubs.find(c=>c.id===match.awayId),user=match.homeId===userClubId||match.awayId===userClubId;
    return <article key={match.id} className={user?'user-live-game':''}><span className="live-club-side home-side"><Crest club={home}/><span className="live-team home-name">{home?.abbreviation||home?.name}</span></span><strong>{match.liveHomeGoals}<i>×</i>{match.liveAwayGoals}</strong><span className="live-club-side"><Crest club={away}/><span className="live-team">{away?.abbreviation||away?.name}</span></span><small>{match.finished?'Encerrado':match.minute+"'"}</small></article>;
  })}</div></section>;
}
function MatchHistory({career,clubs,Crest}) {
  const history=unifiedUserMatchHistory(career),[filter,setFilter]=useState('Todos'),[visibleCount,setVisibleCount]=useState(12);
  const filters=['Todos',...Array.from(new Set(history.map(item=>item.competition)))],filtered=filter==='Todos'?history:history.filter(item=>item.competition===filter),visible=filtered.slice(0,visibleCount);
  useEffect(()=>setVisibleCount(12),[filter]);
  const formatDate=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'—';
  const crestFor=team=>team?.external?<WorldCrest club={team} size="mini"/>:<Crest club={team}/>;
  return <section className="match-history-panel"><div className="match-history-title"><div><History size={16}/><span><strong>Histórico de partidas</strong><small>Brasileirão e copas no mesmo registro oficial.</small></span></div><b>{history.length} jogos</b></div>
    {history.length?<><div className="history-filters" aria-label="Filtrar histórico">{filters.map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div><div className="match-history-list">{visible.map(item=>{
      const home=worldClub(career,clubs,item.homeId),away=worldClub(career,clubs,item.awayId);
      return <article key={item.id} className={'history-result '+item.result.toLowerCase()}><span className="history-round">{item.stage||('Rodada '+item.roundNumber)}<small>{formatDate(item.date)} · {item.season}</small></span><div className="history-score"><div className="history-clubs"><span>{crestFor(home)}{home?.name||'Clube'}</span><strong>{item.homeGoals}<i>×</i>{item.awayGoals}</strong><span>{away?.name||'Clube'}{crestFor(away)}</span></div><small>{item.competition}</small></div><span className={'history-points points-'+item.points}>{item.points} {item.points===1?'ponto':'pontos'}<small>{item.result}</small></span></article>;
    })}</div>{filtered.length>visibleCount&&<button className="history-more" onClick={()=>setVisibleCount(value=>value+12)}>Mostrar mais {Math.min(12,filtered.length-visibleCount)} partidas</button>}</>:<p className="match-empty history-empty">O histórico será preenchido depois da primeira partida oficial.</p>}</section>;
}
function RatingPills({player,career,clubId}) {
  const s=playerGameStats(player),overall=careerPlayerOverall(player,career,clubId);
  return <div className="rating-pills"><span>OVR <b>{overall}</b></span><span>FIN <b>{s.shooting}</b></span><span>PAS <b>{s.passing}</b></span><span>DEF <b>{s.defending}</b></span><span>PEN <b>{s.penalties}</b></span><span>COM <b>{s.composure}</b></span></div>;
}
function Overlay({children,onClose,className=''}) {
  return <div className={'decision-backdrop '+className} role="dialog" aria-modal="true"><div className="decision-modal"><button className="decision-close" onClick={onClose} aria-label="Fechar"><X size={18}/></button>{children}</div></div>;
}
function LineupEditor({career,club,onSave,onClose}) {
  const round=career.round+1;
  const [draft,setDraft]=useState(()=>userLineupForNextMatch(career,club).map(String));
  const validation=lineupValidation(club,career,round,draft);
  function toggle(player){
    const id=String(player.id);
    if(draft.includes(id))setDraft(draft.filter(x=>x!==id));
    else if(draft.length<11&&playerAvailability(career,club.id,player,round).available)setDraft([...draft,id]);
  }
  const sorted=club.players.slice().sort((a,b)=>{
    const aa=playerAvailability(career,club.id,a,round),bb=playerAvailability(career,club.id,b,round);
    if(aa.available!==bb.available)return aa.available?-1:1;
    return careerPlayerOverall(b,career,club.id,round)-careerPlayerOverall(a,career,club.id,round);
  });
  return <Overlay onClose={onClose} className="wide-decision"><div className="decision-kicker">PRÉ-JOGO · ESCALAÇÃO</div><h2>Escolha os 11 titulares</h2><p className="decision-intro">Condição física, posição e atributos entram no cálculo da partida. Jogadores suspensos ou lesionados ficam indisponíveis.</p><div className="lineup-count"><strong>{draft.length}/11</strong><span>{validation.valid?'Escalação pronta':validation.reason||'Escolha os titulares'}</span></div><div className="squad-selector">{sorted.map(player=>{
    const availability=playerAvailability(career,club.id,player,round),selected=draft.includes(String(player.id)),overall=careerPlayerOverall(player,career,club.id,round),condition=playerCondition(career,club.id,player.id);
    return <button key={player.id} disabled={!availability.available&&!selected} className={'squad-choice '+(selected?'selected ':'')+(!availability.available?'unavailable':'')} onClick={()=>toggle(player)}>
      <span className="squad-state">{selected?'TIT':'BAN'}</span><span className="squad-player"><strong>{player.name}</strong><small>{translatePosition(player.position)} · Condição {condition}%</small></span><span className="squad-overall">{overall}</span>{!availability.available&&<span className="unavailable-reason">{availability.reasons.join(' · ')}</span>}
    </button>;
  })}</div><div className="decision-actions"><button className="secondary-action" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={!validation.valid} onClick={()=>onSave(validation.lineup)}>Salvar escalação</button></div></Overlay>;
}
function SubstitutionEditor({career,club,match,second,halftime=false,injuryEvent,onCareerChange,onClose}) {
  const side=match.homeId===career.userClubId?'home':'away',onField=currentLineup(match,side,second),bench=currentBench(match,side,second);
  const [outId,setOutId]=useState(injuryEvent?String(injuryEvent.playerId):''),[inId,setInId]=useState(''),[message,setMessage]=useState('');
  const subs=(match.substitutions||[]).filter(s=>s.side===side);
  function apply(){
    const result=makeUserSubstitution(career,[club,...[]],outId,inId,second,{halftime});
    if(result.error){setMessage(result.error);return;}
    onCareerChange(result.career);setMessage(result.impactChance>=.18?'Substituição feita. O jogador descansado pode mudar o jogo.':'Substituição confirmada.');setOutId('');setInId('');
  }
  const player=id=>club.players.find(p=>String(p.id)===String(id));
  return <Overlay onClose={onClose} className="wide-decision"><div className="decision-kicker">{injuryEvent?'ATENDIMENTO MÉDICO':halftime?'INTERVALO':'ÁREA TÉCNICA'}</div><h2>{injuryEvent?injuryEvent.player+' está sentindo a lesão':'Substituições'}</h2><p className="decision-intro">{halftime?'Alterações no intervalo não consomem uma das três janelas de substituição.':'Escolha quem sai e quem entra. Até cinco trocas são permitidas.'}</p><div className="sub-summary"><span>{subs.length}/{MAX_SUBSTITUTIONS} substituições</span><span>{halftime?'Janela de intervalo':'Jogo em andamento'}</span></div>{message&&<div className="decision-message">{message}</div>}<div className="sub-columns"><section><h3>Em campo</h3>{onField.map(id=>{const p=player(id);if(!p)return null;const yellow=(match.events||[]).filter(e=>e.type==='yellow'&&e.playerId===String(id)&&e.second<=second).length;return <button key={id} className={outId===String(id)?'picked':''} onClick={()=>setOutId(String(id))}><span><strong>{p.name}</strong><small>{translatePosition(p.position)} · Cond. {playerCondition(career,club.id,p.id)}%</small></span>{yellow>0&&<em className="yellow-badge">Amarelo</em>}<b>{careerPlayerOverall(p,career,club.id)}</b></button>;})}</section><section><h3>Banco</h3>{bench.map(id=>{const p=player(id);if(!p)return null;return <button key={id} className={inId===String(id)?'picked':''} onClick={()=>setInId(String(id))}><span><strong>{p.name}</strong><small>{translatePosition(p.position)} · Cond. {playerCondition(career,club.id,p.id)}%</small></span><b>{careerPlayerOverall(p,career,club.id)}</b></button>;})}</section></div><div className="decision-actions"><button className="secondary-action" onClick={onClose}>{injuryEvent?'Manter em campo':'Voltar ao jogo'}</button><button className="primary-action" disabled={!outId||!inId} onClick={apply}>Confirmar substituição</button></div></Overlay>;
}
function PenaltyDecision({career,club,clubs,match,event,onCareerChange,onClose}) {
  const side=match.homeId===career.userClubId?'home':'away',eligible=new Set(currentLineup(match,side,event.second).map(String));
  const [selected,setSelected]=useState(''),[outcome,setOutcome]=useState(null),[step,setStep]=useState(0),[error,setError]=useState('');
  const ordered=club.players.slice().sort((a,b)=>(eligible.has(String(b.id))?1:0)-(eligible.has(String(a.id))?1:0)||playerGameStats(b).penalties-playerGameStats(a).penalties);
  function kick(){
    const result=resolveUserPenalty(career,clubs,event.id,selected);
    if(result.error){setError(result.error);return;}
    onCareerChange(result.career);setOutcome(result.outcome);setStep(0);
  }
  useEffect(()=>{
    if(!outcome||step>=outcome.narrative.length-1)return;
    const timer=setTimeout(()=>setStep(value=>Math.min(outcome.narrative.length-1,value+1)),900);
    return()=>clearTimeout(timer);
  },[outcome,step]);
  return <Overlay onClose={outcome?onClose:()=>{}} className="penalty-decision"><div className="decision-kicker">MOMENTO DECISIVO · PÊNALTI</div><h2>{outcome?'A cobrança':'Quem vai para a bola?'}</h2>{!outcome?<><p className="decision-intro">Somente jogadores que estão em campo podem cobrar. Pênaltis e compostura do cobrador são confrontados com a capacidade do goleiro.</p>{error&&<div className="decision-message error">{error}</div>}<div className="penalty-roster">{ordered.map(player=>{const stats=playerGameStats(player),active=eligible.has(String(player.id));return <button key={player.id} disabled={!active} className={selected===String(player.id)?'picked':''} onClick={()=>setSelected(String(player.id))}><span className="penalty-player"><strong>{player.name}</strong><small>{translatePosition(player.position)}{active?' · Em campo':' · Fora de campo'}</small></span><RatingPills player={player} career={career} clubId={club.id}/><span className="penalty-score">PEN <b>{stats.penalties}</b></span></button>;})}</div><div className="decision-actions"><button className="primary-action penalty-kick-button" disabled={!selected} onClick={kick}>Bater pênalti</button></div></>:<div className={'penalty-drama '+(outcome.scored?'scored':'missed')}><div className="penalty-taker-name">{outcome.taker}</div><p>{outcome.narrative[step]}</p>{step===outcome.narrative.length-1&&<><strong className="penalty-result">{outcome.scored?'GOOOOL!':outcome.outcome==='saved'?'DEFENDEU!':outcome.outcome==='post'?'NA TRAVE!':outcome.outcome==='wide'?'PARA FORA!':'ISOLOU!'}</strong><button className="primary-action" onClick={onClose}>Voltar para a partida</button></>}</div>}</Overlay>;
}

export default function MatchSimulation({club,clubs,Crest,career,onCareerChange,canManage,onChoose,onNavigate,isVisible=true}) {
  const activeRound=career.pendingRound,activeWorld=career.pendingWorldMatch,fixture=fixtureForUser(career),pendingUserMatch=activeRound?.matches?.find(match=>match.id===activeRound.userMatchId),displayMatch=pendingUserMatch||career.lastUserMatch||fixture;
  const [second,setSecond]=useState(0),[realElapsed,setRealElapsed]=useState(0),[paused,setPaused]=useState(false),[selectedMode,setSelectedMode]=useState(career.preferredSimulationMode||'normal');
  const [lineupOpen,setLineupOpen]=useState(false),[subOpen,setSubOpen]=useState(false),[subContext,setSubContext]=useState(null),[halftimeOpen,setHalftimeOpen]=useState(false),[penaltyEvent,setPenaltyEvent]=useState(null),[worldCompleted,setWorldCompleted]=useState(null);
  const finalizeLock=useRef(false),halftimeDone=useRef(false),acknowledgedInjuries=useRef(new Set());

  useEffect(()=>{if(activeWorld){setSecond(0);setRealElapsed(0);setPaused(activeWorld.mode==='instant');setWorldCompleted(null);finalizeLock.current=false;}else if(activeRound){setSecond(0);setRealElapsed(0);setPaused(false);finalizeLock.current=false;halftimeDone.current=false;acknowledgedInjuries.current=new Set();}else if(career.lastUserMatch){const mode=SIMULATION_MODES[career.lastUserMatch.simulationMode]||SIMULATION_MODES.normal;setSecond(career.lastUserMatch.durationSecond||FULL_TIME);setRealElapsed(mode.realDurationSeconds ?? 0);setPaused(true);finalizeLock.current=false;}else{setSecond(0);setRealElapsed(0);setPaused(true);finalizeLock.current=false;}},[activeRound?.id,activeWorld?.id]);

  const activeMode=activeRound?SIMULATION_MODES[activeRound.mode]:null,totalRoundDuration=roundDuration(activeRound);
  const worldMode=activeWorld?SIMULATION_MODES[activeWorld.mode]:null;
  useEffect(()=>{
    if(!activeWorld||paused||activeWorld.mode==='instant')return;
    const target=Math.max(1,worldMode?.realDurationSeconds||60);
    const timer=setInterval(()=>setRealElapsed(value=>{const nextReal=Math.min(target,value+1);setSecond(Math.min(FULL_TIME,Math.round(FULL_TIME*(nextReal/target))));return nextReal;}),1000);
    return()=>clearInterval(timer);
  },[activeWorld?.id,activeWorld?.mode,paused,worldMode?.realDurationSeconds]);
  useEffect(()=>{
    if(!activeWorld||second<FULL_TIME||finalizeLock.current)return;
    finalizeLock.current=true;setPaused(true);setWorldCompleted(activeWorld.result||null);onCareerChange(finishPendingWorldFixture(career,clubs));
  },[activeWorld?.id,second]);
  useEffect(()=>{
    if(!activeRound||paused||activeRound.mode==='instant'||penaltyEvent||subOpen||halftimeOpen)return;
    const config=activeMode||SIMULATION_MODES.normal,target=Math.max(1,config.realDurationSeconds||60);
    const timer=setInterval(()=>{
      setRealElapsed(value=>{
        const nextReal=Math.min(target,value+1);
        const targetVirtual=Math.min(totalRoundDuration,Math.round(totalRoundDuration*(nextReal/target)));
        setSecond(current=>{
          const next=Math.max(current,targetVirtual);
          if(!halftimeDone.current&&current<HALF_TIME_SECOND&&next>=HALF_TIME_SECOND)return HALF_TIME_SECOND;
          return next;
        });
        return nextReal;
      });
    },1000);
    return()=>clearInterval(timer);
  },[activeRound?.id,activeRound?.mode,paused,totalRoundDuration,penaltyEvent,subOpen,halftimeOpen]);

  useEffect(()=>{
    if(!activeRound||activeRound.mode==='instant'||halftimeDone.current||second!==HALF_TIME_SECOND||penaltyEvent)return;
    setPaused(true);setHalftimeOpen(true);
  },[second,activeRound?.id,penaltyEvent]);

  useEffect(()=>{
    if(!pendingUserMatch||!activeRound||penaltyEvent)return;
    const pending=(pendingUserMatch.events||[]).find(e=>e.type==='penalty'&&e.requiresDecision&&!e.resolved&&e.second<=second);
    if(pending){setPaused(true);setPenaltyEvent(pending);}
  },[second,pendingUserMatch?.events,activeRound?.id,penaltyEvent]);

  useEffect(()=>{
    if(!pendingUserMatch||!activeRound||subOpen||penaltyEvent)return;
    const injury=(pendingUserMatch.events||[]).find(e=>e.type==='injury'&&e.requiresAttention&&e.second<=second&&!acknowledgedInjuries.current.has(e.id));
    if(injury){acknowledgedInjuries.current.add(injury.id);setPaused(true);setSubContext({injuryEvent:injury,halftime:false});setSubOpen(true);}
  },[second,pendingUserMatch?.events,activeRound?.id,subOpen,penaltyEvent]);

  useEffect(()=>{
    if(!activeRound||second<totalRoundDuration||finalizeLock.current||penaltyEvent||subOpen||halftimeOpen)return;
    finalizeLock.current=true;setPaused(true);onCareerChange(finishPendingRound(career,clubs));
  },[second,totalRoundDuration,activeRound?.id,penaltyEvent,subOpen,halftimeOpen]);

  useEffect(()=>{if(!activeRound&&!activeWorld&&career.lastUserMatch){const mode=SIMULATION_MODES[career.lastUserMatch.simulationMode]||SIMULATION_MODES.normal;setSecond(career.lastUserMatch.durationSecond||FULL_TIME);setRealElapsed(mode.realDurationSeconds ?? 0);}},[career.lastUserMatch?.id,activeRound,activeWorld]);

  const officialTable=useMemo(()=>standingsFromResults(career.results,clubs),[career.results,clubs]);
  if(!isVisible)return null;
  const home=clubs.find(item=>item.id===displayMatch?.homeId)||club,away=clubs.find(item=>item.id===displayMatch?.awayId)||clubs.find(item=>item.id!==club.id)||club,userDuration=displayMatch?.durationSecond||FULL_TIME,displaySecond=Math.min(second,userDuration);
  const score=displayMatch?.events?scoreAtSecond(displayMatch,displaySecond):{home:0,away:0},stats=visibleStats(displayMatch?.stats,displaySecond,userDuration),visible=(displayMatch?.events||[]).filter(e=>e.second<=displaySecond).slice().reverse().slice(0,7),latestHome=latestFor(displayMatch?.events,'home',displaySecond),latestAway=latestFor(displayMatch?.events,'away',displaySecond),nextEvent=(displayMatch?.events||[]).find(e=>e.second>displaySecond),completed=career.round>=38&&!activeRound,userMatchFinished=Boolean(displayMatch?.events)&&displaySecond>=userDuration;
  const careerEvent=nextCareerEvent(career,clubs),blockedByCompetition=!activeRound&&!activeWorld&&careerEvent?.type==='world',remainingSeason=pendingSeasonFixtures(career,clubs),seasonFinished=completed&&remainingSeason.length===0;
  const momentum=matchMomentum(stats),pressureLabel=momentum>=57?(home.abbreviation||home.name)+' está pressionando':momentum<=43?(away.abbreviation||away.name)+' está pressionando':'Jogo equilibrado';
  const homePlan=displayMatch?.intelligence?.homePlan||'Equilibrado',awayPlan=displayMatch?.intelligence?.awayPlan||'Equilibrado';
  const userRow=officialTable.find(row=>row.clubId===career.userClubId),liveMatches=activeRound?liveRoundMatches(activeRound,second):(career.lastRoundResults||[]).map(result=>({...result,liveHomeGoals:result.homeGoals,liveAwayGoals:result.awayGoals,finished:true,minute:Math.floor((result.durationSecond||FULL_TIME)/60)})),boardRound=activeRound?.roundNumber||(career.round||1);
  const userSide=pendingUserMatch?(pendingUserMatch.homeId===career.userClubId?'home':'away'):null;
  const matchYellows=pendingUserMatch?(pendingUserMatch.events||[]).filter(e=>e.type==='yellow'&&e.side===userSide&&e.second<=second).length:0,matchReds=pendingUserMatch?(pendingUserMatch.events||[]).filter(e=>e.type==='red'&&e.side===userSide&&e.second<=second).length:0;

  function runWorld(){
    if(!canManage||activeRound||activeWorld||careerEvent?.type!=='world')return;
    const started=startWorldFixture(career,clubs,selectedMode);if(started===career)return;
    const preview=started.pendingWorldMatch?.result||null;setWorldCompleted(null);
    if(selectedMode==='instant'){
      const finished=finishPendingWorldFixture(started,clubs);setWorldCompleted(preview);setSecond(FULL_TIME);setRealElapsed(0);setPaused(true);onCareerChange(finished);return;
    }
    onCareerChange(started);setSecond(0);setRealElapsed(0);setPaused(false);
  }
  function clearWorldResult(){setWorldCompleted(null);setSecond(0);setRealElapsed(0);setPaused(true);}
  function chooseLeagueTactic(id){
    const next=activeRound?changeUserMatchTactic(career,clubs,id,second):setCareerTacticalPreset(career,id);
    onCareerChange(next);
  }
  function patchLeagueTactic(patch){onCareerChange(activeRound?changeUserMatchTacticalState(career,clubs,patch,second):updateCareerTactics(career,patch));}
  function chooseWorldTactic(id){
    const next=activeWorld?changePendingWorldTactic(career,id,second):setCareerTacticalPreset(career,id);
    onCareerChange(next);
  }
  function patchWorldTactic(patch){onCareerChange(activeWorld?changePendingWorldTacticalState(career,patch,second):updateCareerTactics(career,patch));}
  function runRound(){
    if(!canManage||activeRound||completed||blockedByCompetition)return;
    if(selectedMode==='instant'){const started=startRound(career,clubs,'instant'),finished=finishPendingRound(started,clubs);onCareerChange(finished);setSecond(finished.lastUserMatch?.durationSecond||FULL_TIME);setRealElapsed(0);setPaused(true);return;}
    const started=startRound(career,clubs,selectedMode);onCareerChange(started);setSecond(0);setRealElapsed(0);setPaused(false);
  }
  function nextSeason(){if(!canManage||activeRound)return;onCareerChange(startNextSeason(career,clubs));setSecond(0);setRealElapsed(0);setPaused(true);}
  function skipToNextEvent(){if(!activeRound||!nextEvent)return;const config=activeMode||SIMULATION_MODES.normal,target=Math.max(1,config.realDurationSeconds||60),virtual=Math.min(totalRoundDuration,nextEvent.second+2);setSecond(virtual);setRealElapsed(Math.min(target,Math.floor(virtual/Math.max(1,totalRoundDuration)*target)));}
  function saveLineup(lineup){onCareerChange(updateUserLineup(career,club,lineup));setLineupOpen(false);}
  function resumeFromHalf(){halftimeDone.current=true;setHalftimeOpen(false);setPaused(false);}
  function openSubstitution(halftime=false){setPaused(true);setSubContext({halftime});setSubOpen(true);}
  function closeSubstitution(){setSubOpen(false);setSubContext(null);if(!halftimeOpen)setPaused(false);}

  const worldContext=activeWorld||blockedByCompetition||worldCompleted;
  if(worldContext){
    const pending=activeWorld||null,event=activeWorld?{competitionName:activeWorld.competitionName,stage:activeWorld.stage,date:activeWorld.date,fixture:{id:activeWorld.fixtureId,homeId:activeWorld.result?.homeId,awayId:activeWorld.result?.awayId}}:blockedByCompetition?careerEvent:null;
    const result=pending?.result||worldCompleted||null,homeWorld=worldClub(career,clubs,result?.homeId||event?.fixture?.homeId),awayWorld=worldClub(career,clubs,result?.awayId||event?.fixture?.awayId),playing=Boolean(activeWorld),finished=Boolean(worldCompleted&&!activeWorld),virtualSecond=finished?FULL_TIME:playing?Math.min(second,FULL_TIME):0,worldScore=result?worldScoreAt(result,virtualSecond):{home:0,away:0},worldStats=worldMatchStats(result,virtualSecond),worldMomentum=matchMomentum(worldStats),modeLocked=playing;
    return <div className="match-content world-match-content">
      <div className="match-heading"><div><div className="eyebrow">CALENDÁRIO INTEGRADO</div><h2>{event?.competitionName||result?.competitionName||'Competição'}</h2><p>{event?.stage||result?.stage||'Partida oficial'} · as três velocidades usam a mesma engine e o resultado permanece no save.</p></div><span className="stage-two-badge"><Trophy size={13}/> {event?.stage||result?.stage}</span></div>
      {!canManage&&<div className="choose-notice"><Target size={18}/><p>Escolha o {club.name} para administrar esta partida.</p><button onClick={onChoose}>Escolher clube</button></div>}
      <div className="match-meta"><span><CalendarDays size={15}/> {event?.date||result?.date}</span><span><Trophy size={15}/> {event?.competitionName||result?.competitionName}</span><span><Timer size={15}/> {finished?'Partida encerrada':playing?'Partida em andamento':'Pré-jogo'}</span></div>
      {!finished&&canManage&&<MatchTacticStrip career={career} onSelect={chooseWorldTactic} onPatch={patchWorldTactic} live={playing}/>}
      <MatchContextStrip result={result} career={career}/>
      {!playing&&!finished&&<section className="pregame-insights"><article><small>PESO DO JOGO</small><strong>{worldImportance(event?.competitionId,event?.stage)}</strong><span>{event?.stage}</span></article><article><small>TORCIDA</small><strong>{Math.round(career.managerConfidence?.fans??100)}%</strong><span>confiança atual</span></article><article><small>DIRETORIA</small><strong>{Math.round(career.managerConfidence?.board??100)}%</strong><span>segurança do trabalho</span></article><article><small>FORÇA PROJETADA</small><strong>{Math.round(result?.homePower||0)} × {Math.round(result?.awayPower||0)}</strong><span>{result?.homePower>result?.awayPower?(homeWorld?.abbreviation||'Mandante')+' chega mais forte':result?.awayPower>result?.homePower?(awayWorld?.abbreviation||'Visitante')+' chega mais forte':'equilíbrio técnico'}</span></article></section>}
      <section className="match-stage world-match-stage" aria-label={(homeWorld?.name||'Mandante')+' contra '+(awayWorld?.name||'Visitante')}><SidelineField/><div className="match-score-layer"><div className="match-team home"><WorldCrest club={homeWorld} size="large"/><h3>{homeWorld?.name||'Mandante'}</h3></div><div className="score-center"><span className="match-period">{finished?'FIM DE JOGO':playing?(virtualSecond<45*60?'1º TEMPO':'2º TEMPO'):'PRÉ-JOGO'}</span><span className="match-clock">{playing?Math.min(90,Math.floor(virtualSecond/60))+"'":finished?"90'":"00:00"}</span><strong>{worldScore.home}<i>–</i>{worldScore.away}</strong><small>{finished?'RESULTADO OFICIAL':playing?paused?'JOGO PAUSADO':'PARTIDA EM ANDAMENTO':'AGUARDANDO SIMULAÇÃO'}</small><div className="match-venue"><strong>{event?.competitionName||result?.competitionName}</strong><span>{event?.stage||result?.stage}</span></div></div><div className="match-team away"><WorldCrest club={awayWorld} size="large"/><h3>{awayWorld?.name||'Visitante'}</h3></div></div></section>
      <section className="match-momentum-panel" aria-label="Momento da partida"><div className="momentum-copy"><Activity size={15}/><span><small>MOMENTO DO JOGO</small><strong>{worldMomentum>=57?(homeWorld?.abbreviation||homeWorld?.name)+' pressiona':worldMomentum<=43?(awayWorld?.abbreviation||awayWorld?.name)+' pressiona':'Jogo equilibrado'}</strong></span></div><div className="momentum-teams"><span>{homeWorld?.abbreviation}</span><div className="momentum-track"><i style={{width:worldMomentum+'%'}}/><b style={{width:(100-worldMomentum)+'%'}}/></div><span>{awayWorld?.abbreviation}</span></div><small className="momentum-note">Leitura calculada por força das equipes, posse projetada e volume ofensivo.</small></section>
      <div className="simulation-mode-panel"><div className="mode-copy"><Gauge size={18}/><div><strong>Velocidade da partida</strong><span>{playing?'A partida já está em andamento.':SIMULATION_MODES[selectedMode].description}</span></div></div><div className="mode-selector"><button disabled={modeLocked||finished} className={selectedMode==='normal'?'active':''} onClick={()=>setSelectedMode('normal')}><Clock3 size={14}/> Normal</button><button disabled={modeLocked||finished} className={selectedMode==='fast'?'active':''} onClick={()=>setSelectedMode('fast')}><FastForward size={14}/> Rápido</button><button disabled={modeLocked||finished} className={selectedMode==='instant'?'active':''} onClick={()=>setSelectedMode('instant')}><Zap size={14}/> Instantânea</button></div></div>
      <div className="match-action-strip"><div><strong>{finished?'Partida encerrada':playing?'Partida em andamento':'Próximo compromisso oficial'}</strong><span>{homeWorld?.name} × {awayWorld?.name} · {event?.stage||result?.stage}</span></div>{playing?<button className="season-action" onClick={()=>setPaused(value=>!value)}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'Continuar':'Pausar'}</button>:finished?<button className="season-action" onClick={clearWorldResult}><CalendarDays size={16}/> Próximo compromisso</button>:<button className="season-action" disabled={!canManage} onClick={runWorld}><Play size={16}/> {selectedMode==='instant'?'Simular instantaneamente':'Iniciar partida'}</button>}</div>
      <div className="match-lower-grid world-match-grid"><section className="match-card stats-card"><div className="match-card-title stats-title"><div><Activity size={17}/><h3>Estatísticas projetadas</h3></div><span>{homeWorld?.abbreviation} × {awayWorld?.abbreviation}</span></div><Comparison Icon={Gauge} label="Posse de bola" values={worldStats.possession} percent/><Comparison Icon={Target} label="Finalizações" values={worldStats.shots}/><Comparison Icon={Target} label="Finalizações no gol" values={worldStats.onTarget}/><Comparison Icon={Flag} label="Escanteios" values={worldStats.corners}/><Comparison Icon={ShieldAlert} label="Faltas" values={worldStats.fouls}/></section><section className="match-card world-engine-card"><div className="match-card-title"><h3>Engine da competição</h3><span>Sincronizada</span></div><p>Este jogo usa o mesmo calendário da carreira. O resultado altera classificação, chaveamento, confiança, eliminação e títulos sem sair da tela de partida.</p><div className="world-power-row"><span>{homeWorld?.abbreviation}<b>{Math.round(result?.homePower||0)}</b></span><em>força calculada</em><span>{awayWorld?.abbreviation}<b>{Math.round(result?.awayPower||0)}</b></span></div></section></div>
    </div>;
  }

  return <div className="match-content">
    <div className="match-heading"><div><div className="eyebrow">DA BEIRA DO CAMPO</div><h2>Simulação de partida</h2><p>Escalação, condição, momento e decisões táticas e momento alteram cada partida em tempo real.</p></div><span className="stage-two-badge"><Trophy size={13}/> Brasileirão {career.season}</span></div>
    {!canManage&&<div className="choose-notice"><Target size={18}/><p>Escolha o {club.name} para iniciar uma carreira e simular as rodadas.</p><button onClick={onChoose}>Escolher clube</button></div>}
    {canManage&&blockedByCompetition&&<div className="competition-gate"><CalendarDays size={18}/><span><strong>{careerEvent.competitionName} vem antes da próxima rodada.</strong><small>{careerEvent.stage} · o calendário não permite pular este compromisso.</small></span><button onClick={()=>onNavigate?.('competitions')}>Ir para Competições</button></div>}
    <div className="match-meta"><span><Timer size={15}/> Brasileirão Série A · {completed?'Temporada encerrada':activeRound?'Rodada '+activeRound.roundNumber+' em andamento':'Próxima: rodada '+(career.round+1)}</span><span><Trophy size={15}/> {userRow?.points||0} pts oficiais · {userRow?.position||20}º lugar</span><span><ShieldAlert size={15}/> {matchYellows} amarelo(s) · {matchReds} vermelho(s)</span></div>
    {!completed&&!blockedByCompetition&&canManage&&<MatchTacticStrip career={career} onSelect={chooseLeagueTactic} onPatch={patchLeagueTactic} live={Boolean(activeRound)}/>}
    <MatchContextStrip result={displayMatch?.events?displayMatch:null} career={career}/>

    {!activeRound&&!completed&&!blockedByCompetition&&fixture&&<OpponentBrief career={career} club={club} opponent={clubs.find(item=>item.id===(fixture.homeId===club.id?fixture.awayId:fixture.homeId))} roundNumber={career.round+1}/>}
    {!activeRound&&!completed&&!blockedByCompetition&&<section className="prematch-lineup-bar"><div><UserRoundCog size={18}/><span><strong>Escalação para a rodada {career.round+1}</strong><small>11 titulares · condição e atributos influenciam a partida</small></span></div><div className="prematch-lineup-actions"><span>{userLineupForNextMatch(career,club).length}/11 definidos</span><button onClick={()=>setLineupOpen(true)}>Alterar escalação</button></div></section>}

    <section className="match-stage" aria-label={home.name+' contra '+away.name}><SidelineField/><div className="match-score-layer"><div className="match-team home"><Crest club={home} large/><h3>{home.name}</h3><EventLine event={latestHome} compact/></div><div className="score-center"><span className="match-period">{!displayMatch?.events?'PRÉ-JOGO':second===HALF_TIME_SECOND&&!halftimeDone.current?'INTERVALO':userMatchFinished?'FIM DE JOGO':displaySecond<45*60?'1º TEMPO':'2º TEMPO'}</span><span className="match-clock">{userMatchFinished?Math.floor(userDuration/60)+"'":clockAt(activeRound?realElapsed:career.lastUserMatch?(SIMULATION_MODES[career.lastUserMatch.simulationMode]?.realDurationSeconds ?? 60):0)}</span><strong>{score.home}<i>–</i>{score.away}</strong><small>{activeRound?(userMatchFinished&&second<totalRoundDuration?'Aguardando os demais jogos':paused?'Jogo pausado':'Rodada em andamento'):career.lastUserMatch?'Resultado oficial':'Aguardando simulação'}</small><div className="match-venue"><strong>{displayMatch?.matchday?.stadium||getClubWorld(home.id).stadium}</strong>{displayMatch?.matchday&&<span>{displayMatch.matchday.attendance.toLocaleString('pt-BR')} torcedores · receita bruta {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(displayMatch.matchday.grossRevenue)}</span>}</div></div><div className="match-team away"><Crest club={away} large/><h3>{away.name}</h3><EventLine event={latestAway} compact/></div></div></section>

    <section className="match-momentum-panel" aria-label="Pressão da partida"><div className="momentum-copy"><Activity size={15}/><span><small>MOMENTO DO JOGO</small><strong>{pressureLabel}</strong></span></div><div className="momentum-teams"><span>{home.abbreviation||home.name}</span><div className="momentum-track"><i style={{width:momentum+'%'}}/><b style={{width:(100-momentum)+'%'}}/></div><span>{away.abbreviation||away.name}</span></div><small className="momentum-note">Leitura ao vivo baseada em posse, finalizações, chutes no gol e escanteios.</small><div className="tactical-plan-row"><span><b>{home.abbreviation||home.name}</b>{homePlan}</span><em>Leitura tática</em><span><b>{away.abbreviation||away.name}</b>{awayPlan}</span></div></section>

    <div className="simulation-mode-panel"><div className="mode-copy"><Gauge size={18}/><div><strong>Velocidade da próxima partida</strong><span>{activeRound?'Finalize a rodada atual antes de iniciar outra.':SIMULATION_MODES[selectedMode].description}</span></div></div><div className="mode-selector"><button disabled={Boolean(activeRound)} className={selectedMode==='normal'?'active':''} onClick={()=>setSelectedMode('normal')}><Clock3 size={14}/> Normal</button><button disabled={Boolean(activeRound)} className={selectedMode==='fast'?'active':''} onClick={()=>setSelectedMode('fast')}><FastForward size={14}/> Rápido</button><button disabled={Boolean(activeRound)} className={selectedMode==='instant'?'active':''} onClick={()=>setSelectedMode('instant')}><Zap size={14}/> Instantânea</button></div></div>

    <div className="match-action-strip"><div><strong>{completed?(seasonFinished?'Temporada '+career.season+' concluída':'Brasileirão concluído'):activeRound?'Rodada '+activeRound.roundNumber+' em andamento':blockedByCompetition?'Calendário bloqueado por outro torneio':'Rodada '+(career.round+1)+' de 38'}</strong><span>{activeRound?'Não é possível iniciar outra rodada antes do encerramento dos 10 jogos.':blockedByCompetition?careerEvent.competitionName+' · '+careerEvent.stage:fixture&&!completed?(clubs.find(item=>item.id===fixture.homeId)?.name||'')+' × '+(clubs.find(item=>item.id===fixture.awayId)?.name||''):seasonFinished?'O save está pronto para avançar.':remainingSeason.length+' compromisso(s) ainda fecham o ano.'}</span></div>{activeRound&&<button className="secondary-match-action" onClick={()=>openSubstitution(false)}><UserRoundCog size={16}/> Substituições</button>}{completed?(seasonFinished?<button className="season-action" disabled={!canManage||Boolean(activeRound)} onClick={nextSeason}><RotateCcw size={16}/> Iniciar temporada {career.season+1}</button>:<button className="season-action" onClick={()=>onNavigate?.('competitions')}><CalendarDays size={16}/> Continuar calendário</button>):blockedByCompetition?<button className="season-action" onClick={()=>onNavigate?.('competitions')}><CalendarDays size={16}/> Próximo torneio</button>:<button className="season-action" disabled={!canManage||Boolean(activeRound)} onClick={runRound}><Play size={16}/> {activeRound?'Rodada em andamento':selectedMode==='instant'?'Simular instantaneamente':'Iniciar rodada '+(career.round+1)}</button>}</div>

    {!activeRound&&career.lastUserMatch&&<PostMatchSummary career={career} club={club} clubs={clubs} result={career.lastUserMatch}/>}
    {liveMatches.length>0&&<LiveRoundBoard matches={liveMatches} clubs={clubs} userClubId={career.userClubId} roundNumber={boardRound} Crest={Crest} live={Boolean(activeRound)}/>}
    <div className="match-lower-grid"><section className="match-card event-card"><div className="match-card-title"><h3>Últimos eventos</h3><span>{visible.length} lances</span></div><div className="event-feed">{visible.length?visible.map(event=><EventLine key={event.id} event={event}/>):<p className="match-empty">Inicie a próxima rodada para gerar os lances.</p>}</div></section><section className="match-card stats-card"><div className="match-card-title stats-title"><div><Activity size={17}/><h3>Estatísticas da partida</h3></div><span>{home.abbreviation} × {away.abbreviation}</span></div><Comparison Icon={Gauge} label="Posse de bola" values={stats.possession} percent/><Comparison Icon={Target} label="Finalizações" values={stats.shots}/><Comparison Icon={Target} label="Finalizações no gol" values={stats.onTarget}/><Comparison Icon={Flag} label="Escanteios" values={stats.corners}/><Comparison Icon={ShieldAlert} label="Faltas" values={stats.fouls}/></section><section className="match-card match-control-card"><div className="match-card-title"><h3>Destaques individuais</h3><span>Sem revelar eventos futuros</span></div><div className="player-highlights"><PlayerHighlight club={home} result={displayMatch?.events?displayMatch:null} side="home" second={displaySecond}/><PlayerHighlight club={away} result={displayMatch?.events?displayMatch:null} side="away" second={displaySecond}/></div><div className="simulation-controls"><h3>Controles da partida</h3><div className="control-row"><button onClick={()=>setPaused(value=>!value)} disabled={!activeRound||penaltyEvent||subOpen||halftimeOpen} className="pause-control">{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Continuar':'Pausar'}</button><button onClick={skipToNextEvent} disabled={!activeRound||!nextEvent||penaltyEvent||subOpen||halftimeOpen}><FastForward size={15}/> Próximo lance</button></div><div className="live-note"><Activity size={15}/><span><strong>{activeRound?paused?'Partida pausada':'Rodada sincronizada em andamento':career.lastUserMatch?'Última rodada encerrada':'Nenhuma rodada simulada'}</strong><small>{activeRound?'Suas decisões podem alterar os acontecimentos da partida.':'Classificação, artilharia e caixa refletem os resultados encerrados.'}</small></span></div></div></section></div>

    <MatchHistory career={career} clubs={clubs} Crest={Crest}/>

    {completed&&(career.trophies||[]).some(trophy=>trophy.id==='brasileirao'&&trophy.season===career.season)&&<div className="champion-banner"><Trophy size={19}/><div><strong>Campeão brasileiro {career.season}</strong><span>A taça desta temporada já foi enviada automaticamente para a sua galeria.</span></div></div>}

    {lineupOpen&&<LineupEditor career={career} club={club} onSave={saveLineup} onClose={()=>setLineupOpen(false)}/>}
    {halftimeOpen&&pendingUserMatch&&<Overlay onClose={()=>{}} className="halftime-decision"><div className="decision-kicker">INTERVALO · {score.home} × {score.away}</div><h2>Hora de mexer no time?</h2><p className="decision-intro">Confira cartões, condição e possíveis lesões antes do segundo tempo. Alterações feitas agora não consomem uma das três janelas.</p><div className="halftime-actions"><button className="secondary-action" onClick={()=>{setSubContext({halftime:true});setSubOpen(true);}}>Fazer substituições</button><button className="primary-action" onClick={resumeFromHalf}>Voltar para o 2º tempo</button></div></Overlay>}
    {subOpen&&pendingUserMatch&&<SubstitutionEditor career={career} club={club} match={pendingUserMatch} second={subContext?.halftime?HALF_TIME_SECOND:second} halftime={Boolean(subContext?.halftime)} injuryEvent={subContext?.injuryEvent} onCareerChange={onCareerChange} onClose={closeSubstitution}/>}
    {penaltyEvent&&pendingUserMatch&&<PenaltyDecision career={career} club={club} clubs={clubs} match={pendingUserMatch} event={penaltyEvent} onCareerChange={onCareerChange} onClose={()=>{setPenaltyEvent(null);setPaused(false);}}/>}
  </div>;
}
