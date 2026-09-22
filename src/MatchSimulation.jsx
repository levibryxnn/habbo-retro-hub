import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, BrainCircuit, Clock3, FastForward, Flag, Gauge, History, Monitor, Pause, Play, RotateCcw, ShieldAlert, Target, Timer, Trophy, UserRoundCog, X, Zap } from 'lucide-react';
import {
  HALF_TIME_SECOND,
  MAX_SUBSTITUTIONS,
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
  updateUserLineup,
  userLineupForNextMatch,
  userMatchHistory,
} from './career-engine';
import {
  currentBench,
  currentLineup,
  lineupValidation,
  playerAvailability,
  playerCondition,
  playerGameStats,
} from './player-engine';
import { getClubWorld } from './club-world.js';
import { positionGroup, translatePosition } from './position-labels.js';
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
const clockAt=(second,duration)=>{const value=Math.max(0,Math.min(duration||FULL_TIME,second)),m=Math.floor(value/60),s=value%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');};
function EventLine({event,compact=false}) {
  if(!event)return <div className="match-event-line muted">Aguardando o próximo lance...</div>;
  return <div className={'match-event-line '+(compact?'compact ':'')+'type-'+event.type}><span className="event-symbol">{eventSymbol[event.type]||'•'}</span><strong>{event.minute}'</strong><span>{compact?event.text.replace(/^GOL! /,''):event.text}</span></div>;
}
function Comparison({label,values,percent=false}) {
  const total=Math.max(values[0]+values[1],1),left=percent?values[0]:Math.round(values[0]/total*100);
  return <div className="match-stat-row"><div><strong>{values[0]}{percent?'%':''}</strong><span>{label}</span><strong>{values[1]}{percent?'%':''}</strong></div><div className="match-stat-track"><i style={{width:left+'%'}}/><b style={{width:(100-left)+'%'}}/></div></div>;
}
function visibleStats(stats,second,duration) {
  if(!stats)return{possession:[50,50],shots:[0,0],onTarget:[0,0],corners:[0,0],fouls:[0,0]};
  const factor=Math.max(.03,Math.min(1,second/(duration||FULL_TIME))),progress=values=>values.map(v=>Math.round(v*factor));
  return{possession:stats.possession,shots:progress(stats.shots),onTarget:progress(stats.onTarget),corners:progress(stats.corners),fouls:progress(stats.fouls)};
}
const latestFor=(events,side,second)=>[...(events||[])].reverse().find(e=>e.side===side&&e.second<=second)||null;
function PlayerHighlight({club,result,side,second}) {
  const visible=(result?.events||[]).filter(e=>e.second<=second),goals=visible.filter(e=>e.type==='goal'&&e.side===side),player=goals[0]?.player||(club.players||[]).find(p=>positionGroup(p.position)==='ATA')?.name||club.name;
  const initials=player.split(' ').filter(Boolean).map((part,index,array)=>index===0||index===array.length-1?part[0]:'').join('').slice(0,2),rating=(6.6+goals.length*.7).toFixed(1),stats=visibleStats(result?.stats,second,result?.durationSecond);
  return <article className="player-highlight"><span className="highlight-avatar">{initials}</span><div className="highlight-name"><strong>{player}</strong><small>{club.abbreviation}</small></div><span className="highlight-rating">{rating}</span><div className="highlight-numbers"><span><strong>{goals.length}</strong><small>Gols</small></span><span><strong>{side==='home'?stats.shots[0]:stats.shots[1]}</strong><small>Finalizações</small></span></div></article>;
}
function LiveRoundBoard({matches,clubs,userClubId,roundNumber,Crest}) {
  return <section className="live-round-board"><div className="live-round-title"><div><Activity size={15}/><span><strong>Rodada {roundNumber} ao vivo</strong><small>Os 10 jogos avançam no mesmo relógio.</small></span></div><span className="live-dot">AO VIVO</span></div><div className="live-fixtures">{matches.map(match=>{
    const home=clubs.find(c=>c.id===match.homeId),away=clubs.find(c=>c.id===match.awayId),user=match.homeId===userClubId||match.awayId===userClubId;
    return <article key={match.id} className={user?'user-live-game':''}><span className="live-club-side home-side"><Crest club={home}/><span className="live-team home-name">{home?.abbreviation||home?.name}</span></span><strong>{match.liveHomeGoals}<i>×</i>{match.liveAwayGoals}</strong><span className="live-club-side"><Crest club={away}/><span className="live-team">{away?.abbreviation||away?.name}</span></span><small>{match.finished?'Encerrado':match.minute+"'"}</small></article>;
  })}</div></section>;
}
function MatchHistory({career,clubs,Crest}) {
  const history=userMatchHistory(career);
  return <section className="match-history-panel"><div className="match-history-title"><div><History size={16}/><span><strong>Histórico de partidas</strong><small>Resultados oficiais do seu clube no save.</small></span></div><b>{history.length} jogos</b></div>{history.length?<div className="match-history-list">{history.slice(0,12).map(item=>{
    const home=clubs.find(c=>c.id===item.homeId),away=clubs.find(c=>c.id===item.awayId);
    return <article key={item.id}><span className="history-round">Rodada {item.roundNumber}<small>{item.season}</small></span><div className="history-score"><div className="history-clubs"><span><Crest club={home}/>{home?.name||'Clube'}</span><strong>{item.homeGoals}<i>×</i>{item.awayGoals}</strong><span>{away?.name||'Clube'}<Crest club={away}/></span></div><small>{item.competition}</small></div><span className={'history-points points-'+item.points}>{item.points} {item.points===1?'ponto':'pontos'}<small>{item.result}</small></span></article>;
  })}</div>:<p className="match-empty history-empty">O histórico será preenchido quando a primeira rodada for encerrada.</p>}</section>;
}
function RatingPills({player}) {
  const s=playerGameStats(player);
  return <div className="rating-pills"><span>OVR <b>{s.overall}</b></span><span>FIN <b>{s.shooting}</b></span><span>PAS <b>{s.passing}</b></span><span>DEF <b>{s.defending}</b></span><span>PEN <b>{s.penalties}</b></span><span>COM <b>{s.composure}</b></span></div>;
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
    return playerGameStats(b).overall-playerGameStats(a).overall;
  });
  return <Overlay onClose={onClose} className="wide-decision"><div className="decision-kicker">PRÉ-JOGO · ESCALAÇÃO</div><h2>Escolha os 11 titulares</h2><p className="decision-intro">Condição física, posição e atributos entram no cálculo da IA. Jogadores suspensos ou lesionados ficam indisponíveis.</p><div className="lineup-count"><strong>{draft.length}/11</strong><span>{validation.valid?'Escalação pronta':validation.reason||'Escolha os titulares'}</span></div><div className="squad-selector">{sorted.map(player=>{
    const availability=playerAvailability(career,club.id,player,round),selected=draft.includes(String(player.id)),stats=playerGameStats(player),condition=playerCondition(career,club.id,player.id);
    return <button key={player.id} disabled={!availability.available&&!selected} className={'squad-choice '+(selected?'selected ':'')+(!availability.available?'unavailable':'')} onClick={()=>toggle(player)}>
      <span className="squad-state">{selected?'TIT':'BAN'}</span><span className="squad-player"><strong>{player.name}</strong><small>{translatePosition(player.position)} · Condição {condition}%</small></span><span className="squad-overall">{stats.overall}</span>{!availability.available&&<span className="unavailable-reason">{availability.reasons.join(' · ')}</span>}
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
  return <Overlay onClose={onClose} className="wide-decision"><div className="decision-kicker">{injuryEvent?'ATENDIMENTO MÉDICO':halftime?'INTERVALO':'ÁREA TÉCNICA'}</div><h2>{injuryEvent?injuryEvent.player+' está sentindo a lesão':'Substituições'}</h2><p className="decision-intro">{halftime?'Alterações no intervalo não consomem uma das três janelas de substituição.':'Escolha quem sai e quem entra. Até cinco trocas são permitidas.'}</p><div className="sub-summary"><span>{subs.length}/{MAX_SUBSTITUTIONS} substituições</span><span>{halftime?'Janela de intervalo':'Jogo em andamento'}</span></div>{message&&<div className="decision-message">{message}</div>}<div className="sub-columns"><section><h3>Em campo</h3>{onField.map(id=>{const p=player(id);if(!p)return null;const yellow=(match.events||[]).filter(e=>e.type==='yellow'&&e.playerId===String(id)&&e.second<=second).length;return <button key={id} className={outId===String(id)?'picked':''} onClick={()=>setOutId(String(id))}><span><strong>{p.name}</strong><small>{translatePosition(p.position)} · Cond. {playerCondition(career,club.id,p.id)}%</small></span>{yellow>0&&<em className="yellow-badge">Amarelo</em>}<b>{playerGameStats(p).overall}</b></button>;})}</section><section><h3>Banco</h3>{bench.map(id=>{const p=player(id);if(!p)return null;return <button key={id} className={inId===String(id)?'picked':''} onClick={()=>setInId(String(id))}><span><strong>{p.name}</strong><small>{translatePosition(p.position)} · Cond. {playerCondition(career,club.id,p.id)}%</small></span><b>{playerGameStats(p).overall}</b></button>;})}</section></div><div className="decision-actions"><button className="secondary-action" onClick={onClose}>{injuryEvent?'Manter em campo':'Voltar ao jogo'}</button><button className="primary-action" disabled={!outId||!inId} onClick={apply}>Confirmar substituição</button></div></Overlay>;
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
    if(!outcome)return;
    const timer=setInterval(()=>setStep(value=>Math.min(outcome.narrative.length-1,value+1)),900);
    return()=>clearInterval(timer);
  },[outcome]);
  return <Overlay onClose={outcome?onClose:()=>{}} className="penalty-decision"><div className="decision-kicker">MOMENTO DECISIVO · PÊNALTI</div><h2>{outcome?'A cobrança':'Quem vai para a bola?'}</h2>{!outcome?<><p className="decision-intro">Somente jogadores que estão em campo podem cobrar. Pênaltis e compostura do cobrador são confrontados com a capacidade do goleiro.</p>{error&&<div className="decision-message error">{error}</div>}<div className="penalty-roster">{ordered.map(player=>{const stats=playerGameStats(player),active=eligible.has(String(player.id));return <button key={player.id} disabled={!active} className={selected===String(player.id)?'picked':''} onClick={()=>setSelected(String(player.id))}><span className="penalty-player"><strong>{player.name}</strong><small>{translatePosition(player.position)}{active?' · Em campo':' · Fora de campo'}</small></span><RatingPills player={player}/><span className="penalty-score">PEN <b>{stats.penalties}</b></span></button>;})}</div><div className="decision-actions"><button className="primary-action penalty-kick-button" disabled={!selected} onClick={kick}>Bater pênalti</button></div></>:<div className={'penalty-drama '+(outcome.scored?'scored':'missed')}><div className="penalty-taker-name">{outcome.taker}</div><p>{outcome.narrative[step]}</p>{step===outcome.narrative.length-1&&<><strong className="penalty-result">{outcome.scored?'GOOOOL!':outcome.outcome==='saved'?'DEFENDEU!':outcome.outcome==='post'?'NA TRAVE!':outcome.outcome==='wide'?'PARA FORA!':'ISOLOU!'}</strong><button className="primary-action" onClick={onClose}>Voltar para a partida</button></>}</div>}</Overlay>;
}

export default function MatchSimulation({club,clubs,Crest,career,onCareerChange,canManage,onChoose,isVisible=true}) {
  const activeRound=career.pendingRound,fixture=fixtureForUser(career),pendingUserMatch=activeRound?.matches?.find(match=>match.id===activeRound.userMatchId),displayMatch=pendingUserMatch||career.lastUserMatch||fixture;
  const [second,setSecond]=useState(0),[paused,setPaused]=useState(false),[selectedMode,setSelectedMode]=useState(career.preferredSimulationMode||'normal'),[view,setView]=useState('tactical');
  const [lineupOpen,setLineupOpen]=useState(false),[subOpen,setSubOpen]=useState(false),[subContext,setSubContext]=useState(null),[halftimeOpen,setHalftimeOpen]=useState(false),[penaltyEvent,setPenaltyEvent]=useState(null);
  const finalizeLock=useRef(false),halftimeDone=useRef(false),acknowledgedInjuries=useRef(new Set());

  useEffect(()=>{if(activeRound){setSecond(0);setPaused(false);finalizeLock.current=false;halftimeDone.current=false;acknowledgedInjuries.current=new Set();}else if(career.lastUserMatch){setSecond(career.lastUserMatch.durationSecond||FULL_TIME);setPaused(true);finalizeLock.current=false;}else{setSecond(0);setPaused(true);finalizeLock.current=false;}},[activeRound?.id]);

  const activeMode=activeRound?SIMULATION_MODES[activeRound.mode]:null,totalRoundDuration=roundDuration(activeRound);
  useEffect(()=>{
    if(!activeRound||paused||activeRound.mode==='instant'||penaltyEvent||subOpen||halftimeOpen)return;
    const config=activeMode||SIMULATION_MODES.normal;
    const timer=setInterval(()=>setSecond(value=>{
      const next=Math.min(totalRoundDuration,value+config.gameSecondsPerTick);
      if(!halftimeDone.current&&value<HALF_TIME_SECOND&&next>=HALF_TIME_SECOND)return HALF_TIME_SECOND;
      return next;
    }),config.tickMs);
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

  useEffect(()=>{if(!activeRound&&career.lastUserMatch)setSecond(career.lastUserMatch.durationSecond||FULL_TIME);},[career.lastUserMatch?.id,activeRound]);

  const officialTable=useMemo(()=>standingsFromResults(career.results,clubs),[career.results,clubs]);
  if(!isVisible)return null;
  const home=clubs.find(item=>item.id===displayMatch?.homeId)||club,away=clubs.find(item=>item.id===displayMatch?.awayId)||clubs.find(item=>item.id!==club.id)||club,userDuration=displayMatch?.durationSecond||FULL_TIME,displaySecond=Math.min(second,userDuration);
  const score=displayMatch?.events?scoreAtSecond(displayMatch,displaySecond):{home:0,away:0},stats=visibleStats(displayMatch?.stats,displaySecond,userDuration),visible=(displayMatch?.events||[]).filter(e=>e.second<=displaySecond).slice().reverse().slice(0,7),latestHome=latestFor(displayMatch?.events,'home',displaySecond),latestAway=latestFor(displayMatch?.events,'away',displaySecond),nextEvent=(displayMatch?.events||[]).find(e=>e.second>displaySecond),completed=career.round>=38&&!activeRound,userMatchFinished=Boolean(displayMatch?.events)&&displaySecond>=userDuration;
  const userRow=officialTable.find(row=>row.clubId===career.userClubId),liveMatches=activeRound?liveRoundMatches(activeRound,second):(career.lastRoundResults||[]).map(result=>({...result,liveHomeGoals:result.homeGoals,liveAwayGoals:result.awayGoals,finished:true,minute:Math.floor((result.durationSecond||FULL_TIME)/60)})),boardRound=activeRound?.roundNumber||(career.round||1);
  const userSide=pendingUserMatch?(pendingUserMatch.homeId===career.userClubId?'home':'away'):null;
  const matchYellows=pendingUserMatch?(pendingUserMatch.events||[]).filter(e=>e.type==='yellow'&&e.side===userSide&&e.second<=second).length:0,matchReds=pendingUserMatch?(pendingUserMatch.events||[]).filter(e=>e.type==='red'&&e.side===userSide&&e.second<=second).length:0;

  function runRound(){
    if(!canManage||activeRound||completed)return;
    if(selectedMode==='instant'){const started=startRound(career,clubs,'instant'),finished=finishPendingRound(started,clubs);onCareerChange(finished);setSecond(finished.lastUserMatch?.durationSecond||FULL_TIME);setPaused(true);return;}
    const started=startRound(career,clubs,selectedMode);onCareerChange(started);setSecond(0);setPaused(false);
  }
  function nextSeason(){if(!canManage||activeRound)return;onCareerChange(startNextSeason(career,clubs));setSecond(0);setPaused(true);}
  function skipToNextEvent(){if(!activeRound||!nextEvent)return;setSecond(Math.min(totalRoundDuration,nextEvent.second+2));}
  function saveLineup(lineup){onCareerChange(updateUserLineup(career,club,lineup));setLineupOpen(false);}
  function resumeFromHalf(){halftimeDone.current=true;setHalftimeOpen(false);setPaused(false);}
  function openSubstitution(halftime=false){setPaused(true);setSubContext({halftime});setSubOpen(true);}
  function closeSubstitution(){setSubOpen(false);setSubContext(null);if(!halftimeOpen)setPaused(false);}

  return <div className="match-content">
    <div className="match-heading"><div><div className="eyebrow">DA BEIRA DO CAMPO</div><h2>Simulação de partida</h2><p>Escalação, condição, cartões, lesões e suas decisões agora alteram a partida.</p></div><span className="stage-two-badge"><BrainCircuit size={13}/> Engine v3</span></div>
    {!canManage&&<div className="choose-notice"><Target size={18}/><p>Escolha o {club.name} para iniciar uma carreira e simular as rodadas.</p><button onClick={onChoose}>Escolher clube</button></div>}
    <div className="match-meta"><span><Timer size={15}/> Brasileirão Série A · {completed?'Temporada encerrada':activeRound?'Rodada '+activeRound.roundNumber+' em andamento':'Próxima: rodada '+(career.round+1)}</span><span><Trophy size={15}/> {userRow?.points||0} pts oficiais · {userRow?.position||20}º lugar</span><span><ShieldAlert size={15}/> {matchYellows} amarelo(s) · {matchReds} vermelho(s)</span></div>

    {!activeRound&&!completed&&<section className="prematch-lineup-bar"><div><UserRoundCog size={18}/><span><strong>Escalação para a rodada {career.round+1}</strong><small>11 titulares · condição e atributos afetam a IA</small></span></div><div className="prematch-lineup-actions"><span>{userLineupForNextMatch(career,club).length}/11 definidos</span><button onClick={()=>setLineupOpen(true)}>Alterar escalação</button></div></section>}

    <section className={'match-stage view-'+view} aria-label={home.name+' contra '+away.name}><SidelineField/><div className="match-score-layer"><div className="match-team home"><Crest club={home} large/><h3>{home.name}</h3><EventLine event={latestHome} compact/></div><div className="score-center"><span className="match-period">{!displayMatch?.events?'PRÉ-JOGO':second===HALF_TIME_SECOND&&!halftimeDone.current?'INTERVALO':userMatchFinished?'FIM DE JOGO':displaySecond<45*60?'1º TEMPO':'2º TEMPO'}</span><span className="match-clock">{clockAt(displaySecond,userDuration)}</span><strong>{score.home}<i>–</i>{score.away}</strong><small>{activeRound?(userMatchFinished&&second<totalRoundDuration?'Aguardando os demais jogos':paused?'Jogo pausado':'Rodada em andamento'):career.lastUserMatch?'Resultado oficial':'Aguardando simulação'}</small><div className="match-venue"><strong>{displayMatch?.matchday?.stadium||getClubWorld(home.id).stadium}</strong>{displayMatch?.matchday&&<span>{displayMatch.matchday.attendance.toLocaleString('pt-BR')} torcedores · receita bruta {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(displayMatch.matchday.grossRevenue)}</span>}</div></div><div className="match-team away"><Crest club={away} large/><h3>{away.name}</h3><EventLine event={latestAway} compact/></div></div></section>

    <div className="simulation-mode-panel"><div className="mode-copy"><Gauge size={18}/><div><strong>Velocidade da próxima partida</strong><span>{activeRound?'Finalize a rodada atual antes de iniciar outra.':SIMULATION_MODES[selectedMode].description}</span></div></div><div className="mode-selector"><button disabled={Boolean(activeRound)} className={selectedMode==='normal'?'active':''} onClick={()=>setSelectedMode('normal')}><Clock3 size={14}/> Normal</button><button disabled={Boolean(activeRound)} className={selectedMode==='fast'?'active':''} onClick={()=>setSelectedMode('fast')}><FastForward size={14}/> Rápido</button><button disabled={Boolean(activeRound)} className={selectedMode==='instant'?'active':''} onClick={()=>setSelectedMode('instant')}><Zap size={14}/> Instantânea</button></div></div>

    <div className="match-action-strip"><div><strong>{completed?'Temporada '+career.season+' concluída':activeRound?'Rodada '+activeRound.roundNumber+' em andamento':'Rodada '+(career.round+1)+' de 38'}</strong><span>{activeRound?'Não é possível iniciar outra rodada antes do encerramento dos 10 jogos.':fixture&&!completed?(clubs.find(item=>item.id===fixture.homeId)?.name||'')+' × '+(clubs.find(item=>item.id===fixture.awayId)?.name||''):'O save está pronto para avançar.'}</span></div>{activeRound&&<button className="secondary-match-action" onClick={()=>openSubstitution(false)}><UserRoundCog size={16}/> Substituições</button>}{completed?<button className="season-action" disabled={!canManage||Boolean(activeRound)} onClick={nextSeason}><RotateCcw size={16}/> Iniciar temporada {career.season+1}</button>:<button className="season-action" disabled={!canManage||Boolean(activeRound)} onClick={runRound}><Play size={16}/> {activeRound?'Rodada em andamento':selectedMode==='instant'?'Simular instantaneamente':'Iniciar rodada '+(career.round+1)}</button>}</div>

    {liveMatches.length>0&&<LiveRoundBoard matches={liveMatches} clubs={clubs} userClubId={career.userClubId} roundNumber={boardRound} Crest={Crest}/>}
    <div className="match-lower-grid"><section className="match-card event-card"><div className="match-card-title"><h3>Últimos eventos</h3><span>{visible.length} lances</span></div><div className="event-feed">{visible.length?visible.map(event=><EventLine key={event.id} event={event}/>):<p className="match-empty">Inicie a próxima rodada para gerar os lances.</p>}</div></section><section className="match-card stats-card"><div className="match-card-title"><h3>Estatísticas da partida</h3><span>{home.abbreviation} × {away.abbreviation}</span></div><Comparison label="Posse de bola" values={stats.possession} percent/><Comparison label="Finalizações" values={stats.shots}/><Comparison label="Finalizações no gol" values={stats.onTarget}/><Comparison label="Escanteios" values={stats.corners}/><Comparison label="Faltas" values={stats.fouls}/></section><section className="match-card match-control-card"><div className="match-card-title"><h3>Destaques individuais</h3><span>Sem revelar eventos futuros</span></div><div className="player-highlights"><PlayerHighlight club={home} result={displayMatch?.events?displayMatch:null} side="home" second={displaySecond}/><PlayerHighlight club={away} result={displayMatch?.events?displayMatch:null} side="away" second={displaySecond}/></div><div className="simulation-controls"><h3>Controles da partida</h3><div className="control-row"><button onClick={()=>setPaused(value=>!value)} disabled={!activeRound||penaltyEvent||subOpen||halftimeOpen} className="pause-control">{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Continuar':'Pausar'}</button><button onClick={skipToNextEvent} disabled={!activeRound||!nextEvent||penaltyEvent||subOpen||halftimeOpen}><FastForward size={15}/> Próximo lance</button></div><div className="view-row"><button className={view==='tactical'?'active':''} onClick={()=>setView('tactical')}><Flag size={14}/> Visão tática</button><button className={view==='tv'?'active':''} onClick={()=>setView('tv')}><Monitor size={14}/> Visão TV</button><button className={view==='data'?'active':''} onClick={()=>setView('data')}><BarChart3 size={14}/> Dados</button></div><div className="live-note"><Activity size={15}/><span><strong>{activeRound?paused?'Decisão do técnico / partida pausada':'Rodada sincronizada em andamento':career.lastUserMatch?'Última rodada encerrada':'Nenhuma rodada simulada'}</strong><small>{activeRound?'Suas trocas e decisões podem alterar os eventos futuros.':'Classificação, artilharia e caixa refletem os resultados encerrados.'}</small></span></div></div></section></div>

    <MatchHistory career={career} clubs={clubs} Crest={Crest}/>
    <div className="match-footnote"><BrainCircuit size={15}/><p><strong>IA v3:</strong> os 11 escolhidos definem a força de cada setor. Condição física cai com minutos jogados; reservas chegam mais descansados; lesões e cartões geram indisponibilidade; expulsos deixam a equipe com um jogador a menos; e uma substituição tardia pode criar ou apagar acontecimentos futuros dependendo dos atributos e do contexto do placar.</p></div>
    {completed&&(career.trophies||[]).some(trophy=>trophy.id==='brasileirao'&&trophy.season===career.season)&&<div className="champion-banner"><Trophy size={19}/><div><strong>Campeão brasileiro {career.season}</strong><span>A taça desta temporada já foi enviada automaticamente para a sua galeria.</span></div></div>}

    {lineupOpen&&<LineupEditor career={career} club={club} onSave={saveLineup} onClose={()=>setLineupOpen(false)}/>}
    {halftimeOpen&&pendingUserMatch&&<Overlay onClose={()=>{}} className="halftime-decision"><div className="decision-kicker">INTERVALO · {score.home} × {score.away}</div><h2>Hora de mexer no time?</h2><p className="decision-intro">Confira cartões, condição e possíveis lesões antes do segundo tempo. Alterações feitas agora não consomem uma das três janelas.</p><div className="halftime-actions"><button className="secondary-action" onClick={()=>{setSubContext({halftime:true});setSubOpen(true);}}>Fazer substituições</button><button className="primary-action" onClick={resumeFromHalf}>Voltar para o 2º tempo</button></div></Overlay>}
    {subOpen&&pendingUserMatch&&<SubstitutionEditor career={career} club={club} match={pendingUserMatch} second={subContext?.halftime?HALF_TIME_SECOND:second} halftime={Boolean(subContext?.halftime)} injuryEvent={subContext?.injuryEvent} onCareerChange={onCareerChange} onClose={closeSubstitution}/>}
    {penaltyEvent&&pendingUserMatch&&<PenaltyDecision career={career} club={club} clubs={clubs} match={pendingUserMatch} event={penaltyEvent} onCareerChange={onCareerChange} onClose={()=>{setPenaltyEvent(null);setPaused(false);}}/>}
  </div>;
}
