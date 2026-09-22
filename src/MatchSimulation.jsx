import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BrainCircuit, FastForward, Flag, Monitor, Pause, Play, RotateCcw, Target, Timer, Trophy, Users } from 'lucide-react';
import { fixtureForUser, simulateRound, startNextSeason } from './career-engine';
import './match.css';

const eventSymbol={ goal:'⚽', yellow:'■', corner:'⚑', foul:'◆', shot:'◎' };
const FULL_TIME=90*60;

function PlayerDot({x,y,away=false,n=1}) {
  return <g transform={'translate('+x+' '+y+')'}>
    <ellipse cx="0" cy="11" rx="7" ry="3" fill="#07140d" opacity=".24"/>
    <circle cx="0" cy="-6" r="4" fill={away?'#f2eee6':'#d7b997'}/>
    <path d="M-5 -1 L5 -1 L7 12 L-7 12 Z" fill={away?'#f4f1e8':'#315f44'} stroke={away?'#b8655e':'#dce6ce'} strokeWidth="1"/>
    <text x="0" y="8" textAnchor="middle" fontSize="5" fontWeight="700" fill={away?'#9a413b':'#eef4e7'}>{n}</text>
  </g>;
}

function SidelineField() {
  const home=[[222,235],[330,185],[430,245],[540,180],[646,238],[282,315],[405,320],[530,298],[675,318],[160,300],[735,205]];
  const away=[[750,235],[650,186],[565,248],[460,205],[355,246],[710,315],[595,322],[480,300],[330,327],[820,295],[260,205]];
  return <svg className="sideline-field" viewBox="0 0 1000 420" role="img" aria-label="Campo estático visto da beira do gramado">
    <defs>
      <linearGradient id="crowd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2119"/><stop offset="1" stopColor="#243f31"/></linearGradient>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#587949"/><stop offset="1" stopColor="#759558"/></linearGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#07130e" stopOpacity=".7"/><stop offset=".55" stopColor="#07130e" stopOpacity=".12"/><stop offset="1" stopColor="#07130e" stopOpacity=".48"/></linearGradient>
    </defs>
    <rect width="1000" height="420" fill="#101d17"/>
    <path d="M0 0H1000V150L0 175Z" fill="url(#crowd)"/>
    <path d="M0 35C130 14 240 43 360 23S620 41 760 17 920 28 1000 11V55C875 43 760 63 620 51S360 63 210 52 82 64 0 71Z" fill="#627868" opacity=".28"/>
    <g opacity=".22" fill="#dfe7d6">{Array.from({length:52},function(_,i){return <circle key={i} cx={(i*43)%1010} cy={70+(i%4)*19} r={2+(i%3)}/>;})}</g>
    <path d="M76 146 L925 132 L1000 410 L0 410 Z" fill="url(#grass)"/>
    <g opacity=".16" fill="#e4efcf">{Array.from({length:9},function(_,i){return <path key={i} d={'M'+(76+i*94)+' 146 L'+(170+i*115)+' 410 L'+(80+i*115)+' 410 L'+(i*94)+' 149 Z'}/>;})}</g>
    <path d="M76 146L925 132L1000 410L0 410Z" fill="none" stroke="#eaf1df" strokeWidth="2"/>
    <path d="M503 139L500 410" stroke="#eaf1df" strokeWidth="2" opacity=".88"/>
    <ellipse cx="502" cy="246" rx="79" ry="43" fill="none" stroke="#eaf1df" strokeWidth="2" opacity=".88"/>
    <path d="M76 146L202 144L170 256L35 269M925 132L805 134L838 247L968 250" fill="none" stroke="#eaf1df" strokeWidth="2" opacity=".8"/>
    <path d="M0 410H1000" stroke="#f4f6ed" strokeWidth="5"/>
    <path d="M0 378H1000" stroke="#f4f6ed" strokeWidth="1" opacity=".45"/>
    {home.map(function(p,i){return <PlayerDot key={'h'+i} x={p[0]} y={p[1]} n={(i+2)%11+1}/>;})}
    {away.map(function(p,i){return <PlayerDot key={'a'+i} x={p[0]} y={p[1]} away n={(i+3)%11+1}/>;})}
    <g transform="translate(110 337)">
      <ellipse cx="0" cy="52" rx="17" ry="5" fill="#07120d" opacity=".35"/>
      <circle cx="0" cy="-8" r="8" fill="#caa98a"/>
      <path d="M-10 1L11 1L15 45L-15 45Z" fill="#15211c"/>
      <path d="M-9 10L-25 29M10 10L23 30M-8 43L-14 59M8 43L14 59" stroke="#111b17" strokeWidth="7" strokeLinecap="round"/>
      <text x="0" y="22" textAnchor="middle" fontSize="7" fill="#d7e3d2" fontWeight="700">TÉC.</text>
    </g>
    <rect width="1000" height="420" fill="url(#shade)"/>
    <text x="28" y="126" fill="#dce9cd" opacity=".55" fontSize="13" fontWeight="700">LINHA DE FRENTE · VISÃO DA ÁREA TÉCNICA</text>
  </svg>;
}

function clockAt(second) {
  const value=Math.max(0,Math.min(FULL_TIME,second));
  const minute=Math.floor(value/60);
  const seconds=value%60;
  return String(minute).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
}

function EventLine({event,compact=false}) {
  if(!event) return <div className="match-event-line muted">Aguardando o próximo lance...</div>;
  return <div className={'match-event-line '+(compact?'compact ':'')+'type-'+event.type}>
    <span className="event-symbol" aria-hidden="true">{eventSymbol[event.type]}</span><strong>{event.minute}'</strong><span>{compact?event.text.replace(/^GOL! /,''):event.text}</span>
  </div>;
}

function Comparison({label,values,percent=false}) {
  const total=Math.max(values[0]+values[1],1);
  const left=percent?values[0]:Math.round(values[0]/total*100);
  return <div className="match-stat-row"><div><strong>{values[0]}{percent?'%':''}</strong><span>{label}</span><strong>{values[1]}{percent?'%':''}</strong></div><div className="match-stat-track"><i style={{width:left+'%'}}/><b style={{width:(100-left)+'%'}}/></div></div>;
}

function visibleStats(stats,second) {
  if(!stats) return {possession:[50,50],shots:[0,0],onTarget:[0,0],corners:[0,0],fouls:[0,0]};
  const factor=Math.max(.05,Math.min(1,second/FULL_TIME));
  function progress(values){return values.map(function(value){return Math.round(value*factor);});}
  return {possession:stats.possession,shots:progress(stats.shots),onTarget:progress(stats.onTarget),corners:progress(stats.corners),fouls:progress(stats.fouls)};
}

function scoreAt(events,second) {
  return (events||[]).filter(function(event){return event.type==='goal'&&event.second<=second;}).reduce(function(score,event){score[event.side]++;return score;},{home:0,away:0});
}

function latestFor(events,side,second) {
  return [...(events||[])].reverse().find(function(event){return event.side===side&&event.second<=second;})||null;
}

function PlayerHighlight({club,result,side}) {
  const goals=(result?.events||[]).filter(function(event){return event.type==='goal'&&event.side===side;});
  const player=goals[0]?.player || (club.players||[]).find(function(item){return item.position==='Forward'||item.position==='Attacker';})?.name || club.name;
  const initials=player.split(' ').filter(Boolean).map(function(part,index,array){return index===0||index===array.length-1?part[0]:'';}).join('').slice(0,2);
  const rating=(6.7+goals.length*.7).toFixed(1);
  return <article className="player-highlight"><span className="highlight-avatar">{initials}</span><div className="highlight-name"><strong>{player}</strong><small>{club.abbreviation}</small></div><span className="highlight-rating">{rating}</span><div className="highlight-numbers"><span><strong>{goals.length}</strong><small>Gols</small></span><span><strong>{side==='home'?result?.stats?.shots?.[0]||0:result?.stats?.shots?.[1]||0}</strong><small>Finalizações</small></span></div></article>;
}

export default function MatchSimulation({club,clubs,Crest,career,onCareerChange,canManage,onChoose}) {
  const fixture=fixtureForUser(career);
  const replay=career.lastUserMatch;
  const [second,setSecond]=useState(replay?FULL_TIME:0);
  const [paused,setPaused]=useState(true);
  const [speed,setSpeed]=useState(2);
  const [view,setView]=useState('tactical');

  useEffect(function(){
    if(!replay){setSecond(0);setPaused(true);return;}
    setSecond(0);
    setPaused(false);
  },[replay?.id]);

  useEffect(function(){
    if(paused||!replay||second>=FULL_TIME) return;
    const timer=setInterval(function(){setSecond(function(value){return Math.min(FULL_TIME,value+60*speed);});},500);
    return function(){clearInterval(timer);};
  },[paused,replay,second,speed]);

  const displayFixture=replay?{homeId:replay.homeId,awayId:replay.awayId}:fixture;
  const home=clubs.find(function(item){return item.id===displayFixture?.homeId;})||club;
  const away=clubs.find(function(item){return item.id===displayFixture?.awayId;})||clubs.find(function(item){return item.id!==club.id;})||club;
  const score=scoreAt(replay?.events,second);
  const stats=visibleStats(replay?.stats,second);
  const visible=(replay?.events||[]).filter(function(event){return event.second<=second;}).slice().reverse().slice(0,6);
  const latestHome=latestFor(replay?.events,'home',second);
  const latestAway=latestFor(replay?.events,'away',second);
  const nextEvent=(replay?.events||[]).find(function(event){return event.second>second;});
  const completed=career.round>=38;

  function runRound() {
    if(!canManage) return;
    const next=simulateRound(career,clubs);
    onCareerChange(next);
  }

  function nextSeason() {
    if(!canManage) return;
    onCareerChange(startNextSeason(career,clubs));
  }

  function skip() {
    if(!replay) return;
    setSecond(nextEvent?Math.min(FULL_TIME,nextEvent.second+2):FULL_TIME);
  }

  return <div className="match-content">
    <div className="match-heading"><div><div className="eyebrow">DA BEIRA DO CAMPO</div><h2>Simulação de partida</h2><p>IA procedural local, temporada real do save e interface leve para qualquer dispositivo.</p></div><span className="stage-two-badge"><BrainCircuit size={13}/> Engine ativa</span></div>

    {!canManage&&<div className="choose-notice"><Target size={18}/><p>Escolha o {club.name} para iniciar uma carreira e simular as rodadas.</p><button onClick={onChoose}>Escolher clube</button></div>}

    <div className="match-meta">
      <span><Timer size={15}/> Brasileirão Série A · {completed?'Temporada encerrada':'Próxima: rodada '+(career.round+1)}</span>
      <span><Users size={15}/> {career.results.length} partidas registradas no save</span>
      <span><Activity size={15}/> IA: elenco + mando + contexto + aleatoriedade semeada</span>
    </div>

    <section className={'match-stage view-'+view} aria-label={home.name+' contra '+away.name}>
      <SidelineField/>
      <div className="match-score-layer">
        <div className="match-team home"><Crest club={home} large/><h3>{home.name}</h3><EventLine event={latestHome} compact/></div>
        <div className="score-center"><span className="match-period">{second>=FULL_TIME?'FIM DE JOGO':second<45*60?'1º TEMPO':'2º TEMPO'}</span><span className="match-clock">{clockAt(second)}</span><strong>{score.home}<i>–</i>{score.away}</strong><small>{replay?second>=FULL_TIME?'Resultado registrado':'Reprodução da rodada':'Aguardando simulação'}</small></div>
        <div className="match-team away"><Crest club={away} large/><h3>{away.name}</h3><EventLine event={latestAway} compact/></div>
      </div>
    </section>

    <div className="match-action-strip">
      <div><strong>{completed?'Temporada '+career.season+' concluída':'Rodada '+(career.round+1)+' de 38'}</strong><span>{fixture&&!completed?(clubs.find(function(item){return item.id===fixture.homeId;})?.name||'')+' × '+(clubs.find(function(item){return item.id===fixture.awayId;})?.name||''):'O save está pronto para avançar.'}</span></div>
      {completed?<button className="season-action" disabled={!canManage} onClick={nextSeason}><RotateCcw size={16}/> Iniciar temporada {career.season+1}</button>:<button className="season-action" disabled={!canManage} onClick={runRound}><Play size={16}/> Simular rodada {career.round+1}</button>}
    </div>

    <div className="match-lower-grid">
      <section className="match-card event-card"><div className="match-card-title"><h3>Últimos eventos</h3><span>{visible.length} lances</span></div><div className="event-feed">{visible.length?visible.map(function(event){return <EventLine key={event.id} event={event}/>;}):<p className="match-empty">Simule a próxima rodada para gerar os lances.</p>}</div></section>
      <section className="match-card stats-card"><div className="match-card-title"><h3>Estatísticas da partida</h3><span>{home.abbreviation} × {away.abbreviation}</span></div><Comparison label="Posse de bola" values={stats.possession} percent/><Comparison label="Finalizações" values={stats.shots}/><Comparison label="Finalizações no gol" values={stats.onTarget}/><Comparison label="Escanteios" values={stats.corners}/><Comparison label="Faltas" values={stats.fouls}/></section>
      <section className="match-card match-control-card">
        <div className="match-card-title"><h3>Destaques individuais</h3><span>Gerados pela partida</span></div>
        <div className="player-highlights"><PlayerHighlight club={home} result={replay} side="home"/><PlayerHighlight club={away} result={replay} side="away"/></div>
        <div className="simulation-controls"><h3>Controles da reprodução</h3><div className="control-row"><button onClick={function(){setPaused(function(value){return !value;});}} disabled={!replay} className="pause-control">{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Continuar':'Pausar'}</button>{[1,2,4].map(function(value){return <button key={value} className={speed===value?'active':''} aria-pressed={speed===value} onClick={function(){setSpeed(value);}}>{value}x</button>;})}<button onClick={skip} disabled={!replay||second>=FULL_TIME}><FastForward size={15}/> Próximo lance</button></div><div className="view-row"><button className={view==='tactical'?'active':''} onClick={function(){setView('tactical');}}><Flag size={14}/> Visão tática</button><button className={view==='tv'?'active':''} onClick={function(){setView('tv');}}><Monitor size={14}/> Visão TV</button><button className={view==='data'?'active':''} onClick={function(){setView('data');}}><BarChart3 size={14}/> Dados</button></div><div className="live-note"><Activity size={15}/><span><strong>{replay?second>=FULL_TIME?'Partida concluída':paused?'Reprodução pausada':'Reproduzindo lances':'Nenhuma rodada simulada'}</strong><small>{replay?'O resultado já alimentou tabela, artilharia e finanças.':'A engine resolve os 10 jogos da rodada ao mesmo tempo.'}</small></span></div></div>
      </section>
    </div>

    <div className="match-footnote"><BrainCircuit size={15}/><p><strong>Como a IA funciona nesta versão:</strong> calcula uma força técnica procedural pelo tamanho e equilíbrio do elenco, idade dos atletas e posições disponíveis; aplica mando de campo; estima oportunidades de gol; sorteia eventos com gerador determinístico por temporada/rodada; e distribui gols com peso maior para atacantes e meias. Não usa vídeo, 3D ou chamadas pagas de IA.</p></div>
    {completed&&(career.trophies||[]).some(function(trophy){return trophy.id==='brasileirao'&&trophy.season===career.season;})&&<div className="champion-banner"><Trophy size={19}/><div><strong>Campeão brasileiro {career.season}</strong><span>A taça desta temporada já foi enviada automaticamente para a sua galeria.</span></div></div>}
  </div>;
}
