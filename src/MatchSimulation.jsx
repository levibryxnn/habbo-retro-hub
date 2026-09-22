import React, {useEffect, useMemo, useState} from 'react';
import { Activity, BarChart3, FastForward, Flag, FlaskConical, Monitor, Pause, Play, Target, Timer, Users } from 'lucide-react';
import { clockAt, createMatchEvents, FULL_TIME_SECOND, INITIAL_MATCH_SECOND, latestEventFor, nextEventAfter, periodAt, scoreAt, statsAt } from './match-model';
import './match.css';

const eventSymbol={goal:'⚽',yellow:'■',corner:'⚑',foul:'◆',shot:'◎'};

function shortName(name='') {
  const parts=name.trim().split(/\s+/).filter(Boolean);
  return parts.length>2 ? `${parts[0]} ${parts.at(-1)}` : name;
}

function PlayerDot({x,y,away=false,n=1}) {
  return <g transform={`translate(${x} ${y})`}>
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
    <g opacity=".22" fill="#dfe7d6">{Array.from({length:52},(_,i)=><circle key={i} cx={(i*43)%1010} cy={70+(i%4)*19} r={2+(i%3)}/>)}</g>
    <path d="M76 146 L925 132 L1000 410 L0 410 Z" fill="url(#grass)"/>
    <g opacity=".16" fill="#e4efcf">{Array.from({length:9},(_,i)=><path key={i} d={`M${76+i*94} 146 L${170+i*115} 410 L${80+i*115} 410 L${0+i*94} 149 Z`}/>)}</g>
    <path d="M76 146L925 132L1000 410L0 410Z" fill="none" stroke="#eaf1df" strokeWidth="2"/>
    <path d="M503 139L500 410" stroke="#eaf1df" strokeWidth="2" opacity=".88"/>
    <ellipse cx="502" cy="246" rx="79" ry="43" fill="none" stroke="#eaf1df" strokeWidth="2" opacity=".88"/>
    <path d="M76 146L202 144L170 256L35 269M925 132L805 134L838 247L968 250" fill="none" stroke="#eaf1df" strokeWidth="2" opacity=".8"/>
    <path d="M0 410H1000" stroke="#f4f6ed" strokeWidth="5"/>
    <path d="M0 378H1000" stroke="#f4f6ed" strokeWidth="1" opacity=".45"/>
    {home.map((p,i)=><PlayerDot key={'h'+i} x={p[0]} y={p[1]} n={(i+2)%11+1}/>)}
    {away.map((p,i)=><PlayerDot key={'a'+i} x={p[0]} y={p[1]} away n={(i+3)%11+1}/>)}
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

function EventLine({event,compact=false}) {
  if(!event) return <div className="match-event-line muted">Aguardando o próximo lance...</div>;
  return <div className={`match-event-line ${compact?'compact':''} type-${event.type}`}>
    <span className="event-symbol" aria-hidden="true">{eventSymbol[event.type]}</span><strong>{event.minute}'</strong><span>{compact?event.text.replace(/^GOL! /,''):event.text}</span>
  </div>;
}

function Comparison({label,values,percent=false}) {
  const total=Math.max(values[0]+values[1],1);
  const left=percent?values[0]:Math.round(values[0]/total*100);
  return <div className="match-stat-row">
    <div><strong>{values[0]}{percent?'%':''}</strong><span>{label}</span><strong>{values[1]}{percent?'%':''}</strong></div>
    <div className="match-stat-track"><i style={{width:`${left}%`}}/><b style={{width:`${100-left}%`}}/></div>
  </div>;
}

function pickPlayer(club,index=0) {
  const preferred=(club.players||[]).filter(p=>['Forward','Attacker','Midfielder'].includes(p.position));
  return preferred[index%Math.max(preferred.length,1)] || club.players?.[index] || {name:'Jogador',number:'—'};
}

function PlayerHighlight({club,player,rating,primary,secondary}) {
  const initials=player.name.split(' ').filter(Boolean).map((p,i,a)=>i===0||i===a.length-1?p[0]:'').join('').slice(0,2);
  return <article className="player-highlight">
    <span className="highlight-avatar">{initials}</span>
    <div className="highlight-name"><strong>{shortName(player.name)}</strong><small>{club.abbreviation}</small></div>
    <span className="highlight-rating">{rating}</span>
    <div className="highlight-numbers"><span><strong>{primary.value}</strong><small>{primary.label}</small></span><span><strong>{secondary.value}</strong><small>{secondary.label}</small></span></div>
  </article>;
}

export default function MatchSimulation({club,clubs,Crest}) {
  const opponent=useMemo(()=>clubs.find(c=>c.id!==club.id) || clubs[0],[club.id,clubs]);
  const events=useMemo(()=>createMatchEvents(club,opponent),[club,opponent]);
  const [second,setSecond]=useState(INITIAL_MATCH_SECOND);
  const [paused,setPaused]=useState(false);
  const [speed,setSpeed]=useState(2);
  const [view,setView]=useState('tactical');

  useEffect(()=>{
    setSecond(INITIAL_MATCH_SECOND); setPaused(false); setSpeed(2); setView('tactical');
  },[club.id]);

  useEffect(()=>{
    if(paused || second>=FULL_TIME_SECOND) return;
    const timer=setInterval(()=>setSecond(value=>Math.min(FULL_TIME_SECOND,value+15*speed)),1000);
    return ()=>clearInterval(timer);
  },[paused,speed,second]);

  const score=scoreAt(events,second);
  const stats=statsAt(events,second);
  const visible=[...events].filter(e=>e.second<=second).reverse().slice(0,6);
  const latestHome=latestEventFor(events,'home',second);
  const latestAway=latestEventFor(events,'away',second);
  const next=nextEventAfter(events,second);
  const homeStar=pickPlayer(club,0), awayStar=pickPlayer(opponent,0);

  function skipToNext() {
    if(!next) { setSecond(FULL_TIME_SECOND); return; }
    setSecond(Math.min(FULL_TIME_SECOND,next.second+5));
  }

  return <div className="match-content">
    <div className="match-heading">
      <div><div className="eyebrow">DA BEIRA DO CAMPO</div><h2>Simulação de partida</h2><p>Acompanhe o jogo sem animações pesadas: campo estático, eventos e dados em tempo real.</p></div>
      <span className="lab-badge"><FlaskConical size={13}/> Protótipo v0.4</span>
    </div>

    <div className="match-meta">
      <span><Timer size={15}/> Brasileirão Série A · Rodada de teste</span>
      <span><Users size={15}/> Público simulado · 38.124</span>
      <span><Activity size={15}/> 20°C · Parcialmente nublado</span>
    </div>

    <section className={`match-stage view-${view}`} aria-label={`${club.name} contra ${opponent.name}`}>
      <SidelineField/>
      <div className="match-score-layer">
        <div className="match-team home">
          <Crest club={club} large/>
          <h3>{club.name}</h3>
          <EventLine event={latestHome} compact/>
        </div>
        <div className="score-center">
          <span className="match-period">{periodAt(second)}</span>
          <span className="match-clock">{clockAt(second)}</span>
          <strong>{score.home}<i>–</i>{score.away}</strong>
          <small>{second>=FULL_TIME_SECOND?'Partida encerrada':'Simulação em andamento'}</small>
        </div>
        <div className="match-team away">
          <Crest club={opponent} large/>
          <h3>{opponent.name}</h3>
          <EventLine event={latestAway} compact/>
        </div>
      </div>
    </section>

    <div className="match-lower-grid">
      <section className="match-card event-card">
        <div className="match-card-title"><h3>Últimos eventos</h3><span aria-live="polite">{visible.length} lances</span></div>
        <div className="event-feed">{visible.map(event=><EventLine key={event.id} event={event}/>)}</div>
      </section>

      <section className="match-card stats-card">
        <div className="match-card-title"><h3>Estatísticas da partida</h3><span>{club.abbreviation} × {opponent.abbreviation}</span></div>
        <Comparison label="Posse de bola" values={stats.possession} percent/>
        <Comparison label="Finalizações" values={stats.shots}/>
        <Comparison label="Finalizações no gol" values={stats.onTarget}/>
        <Comparison label="Escanteios" values={stats.corners}/>
        <Comparison label="Faltas" values={stats.fouls}/>
      </section>

      <section className="match-card match-control-card">
        <div className="match-card-title"><h3>Destaques individuais</h3><span>Dados simulados</span></div>
        <div className="player-highlights">
          <PlayerHighlight club={club} player={homeStar} rating={(7.1+score.home*.3).toFixed(1)} primary={{label:'Finalizações',value:Math.max(1,stats.onTarget[0])}} secondary={{label:'Passes',value:18+Math.floor(second/420)}}/>
          <PlayerHighlight club={opponent} player={awayStar} rating={(6.7+score.away*.25).toFixed(1)} primary={{label:'Finalizações',value:Math.max(1,stats.onTarget[1])}} secondary={{label:'Passes',value:16+Math.floor(second/480)}}/>
        </div>

        <div className="simulation-controls">
          <h3>Controles da simulação</h3>
          <div className="control-row">
            <button onClick={()=>setPaused(v=>!v)} className="pause-control">{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Continuar':'Pausar'}</button>
            {[1,2,4].map(value=><button key={value} className={speed===value?'active':''} aria-pressed={speed===value} onClick={()=>setSpeed(value)}>{value}x</button>)}
            <button onClick={skipToNext} disabled={second>=FULL_TIME_SECOND}><FastForward size={15}/> Pular para o lance</button>
          </div>
          <div className="view-row">
            <button className={view==='tactical'?'active':''} onClick={()=>setView('tactical')}><Flag size={14}/> Visão tática</button>
            <button className={view==='tv'?'active':''} onClick={()=>setView('tv')}><Monitor size={14}/> Visão TV</button>
            <button className={view==='data'?'active':''} onClick={()=>setView('data')}><BarChart3 size={14}/> Dados</button>
          </div>
          <div className="live-note"><Activity size={15}/><span><strong>{paused?'Simulação pausada':'Simulação em andamento'}</strong><small>{next?`Próximo evento previsto após ${Math.floor(next.second/60)}'.`:'Sem novos lances programados.'}</small></span></div>
        </div>
      </section>
    </div>

    <div className="match-footnote"><Target size={15}/><p>Protótipo técnico: o gramado e os jogadores são uma composição vetorial estática. Apenas relógio, eventos, placar e números mudam, reduzindo bastante o custo de renderização em computadores modestos e celulares.</p></div>
  </div>;
}
