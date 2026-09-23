import React, { useMemo } from 'react';
import { ArrowRight, BadgeDollarSign, CalendarDays, CircleDot, Flag, Handshake, ShieldCheck, ShoppingBag, Target, TrendingUp, Trophy, Users } from 'lucide-react';
import { standingsFromResults, topScorers, userMatchHistory } from './career-engine.js';
import { nextCareerEvent, worldClub } from './competition-engine.js';
import WorldCrest from './WorldCrest.jsx';
import { activeContracts } from './finance-model.js';
import { getClubWorld } from './club-world.js';
import { confidenceSnapshot } from './manager-confidence.js';
import './dashboard.css';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

function resultLetter(item){
  if(!item)return'-';
  if(item.points===3)return'V';
  if(item.points===1)return'E';
  return'D';
}

function objectiveFor(club){
  const budget=getClubWorld(club.id).gameBudgetM||0;
  if(budget>=100)return{label:'Brigar pelo título',target:'Top 2',maxPosition:2};
  if(budget>=55)return{label:'Classificar para a Libertadores',target:'G6',maxPosition:6};
  if(budget>=25)return{label:'Buscar competição continental',target:'Top 10',maxPosition:10};
  return{label:'Permanecer na Série A',target:'Fora do Z4',maxPosition:16};
}

export default function ClubDashboard({career,club,clubs,Crest,onNavigate,canManage,onChoose}){
  const table=useMemo(()=>standingsFromResults(career.results,clubs),[career.results,clubs]);
  if(!canManage)return <div className="dashboard-content"><section className="dashboard-takeover"><Crest club={club}/><span className="eyebrow">MODO CARREIRA</span><h2>Assuma o {club.name} para abrir o centro de comando.</h2><p>Defina o nome do técnico e passe a acompanhar objetivos, finanças, forma, próximo jogo e decisões da temporada em um único painel.</p><button onClick={onChoose}>Assumir este clube <ArrowRight size={15}/></button></section></div>;
  const row=table.find(item=>item.clubId===club.id)||table.find(item=>item.clubId===career.userClubId);
  const nextEvent=nextCareerEvent(career,clubs),next=nextEvent?.fixture||null;
  const home=next?worldClub(career,clubs,next.homeId):null;
  const away=next?worldClub(career,clubs,next.awayId):null;
  const opponent=next?(next.homeId===club.id?away:home):null;
  const venueMeta=nextEvent?.type==='brasileirao'&&next?getClubWorld(next.homeId):null;
  const crestFor=item=>item?.external?<WorldCrest club={item}/>:<Crest club={item}/>;
  const history=userMatchHistory(career).slice(0,5);
  const objective=objectiveFor(club);
  const objectiveOk=row?row.position<=objective.maxPosition:false;
  const scorer=topScorers(career.scorers,20).find(item=>item.clubId===club.id);
  const sponsors=activeContracts(career);
  const manager=career.managerName||'Técnico';
  const played=row?.played||0;
  const seasonProgress=Math.round((Math.min(career.round,38)/38)*100);
  const confidence=confidenceSnapshot(career);
  const confidenceEvents=(confidence.events||[]).slice(0,2);
  const deltaText=value=>value>0?'+'+Number(value).toFixed(1):Number(value).toFixed(1);
  const attentionItems=[
    nextEvent?{
      tag:'PARTIDA',
      title:(opponent?.name||'Próximo adversário')+' é o próximo teste',
      copy:(next?.homeId===club.id?'Em casa':'Fora')+' · '+nextEvent.competitionName+' · '+nextEvent.stage,
      action:nextEvent.type==='world'?'Abrir calendário':'Abrir partida',
      nav:nextEvent.type==='world'?'competitions':'match',
    }:{
      tag:'TEMPORADA',
      title:'A campanha terminou',
      copy:'Revise sua colocação, troféus e marcas antes de iniciar a próxima temporada.',
      action:'Ver legado',
      nav:'legacy',
    },
    confidence.board<30?{
      tag:confidence.board<15?'CARGO EM RISCO':'COBRANÇA',
      title:confidence.board<15?'A diretoria exige reação imediata':'A segurança do cargo caiu',
      copy:career.boardWarning?.text||'Resultados e decisões administrativas colocaram o trabalho sob pressão.',
      action:'Ver classificação',
      nav:'standings',
    }:null,
    sponsors.length<3?{
      tag:'FINANÇAS',
      title:'Há espaço comercial disponível',
      copy:(3-sponsors.length)+' cota'+(3-sponsors.length===1?'':'s')+' de patrocínio ainda pode'+(3-sponsors.length===1?'':'m')+' gerar receita para o clube.',
      action:'Ver propostas',
      nav:'sponsors',
    }:null,
    !objectiveOk?{
      tag:'DIRETORIA',
      title:'A meta da temporada está pressionada',
      copy:'Você está em '+(row?row.position+'º':'—')+'. A diretoria espera '+objective.target+'.',
      action:'Ver classificação',
      nav:'standings',
    }:{
      tag:'ELENCO',
      title:'Mantenha o grupo pronto para a sequência',
      copy:'Revise o elenco antes da próxima rodada e ajuste suas escolhas de titulares e banco.',
      action:'Abrir elenco',
      nav:'roster',
    },
  ].filter(Boolean).slice(0,3);

  return <div className="dashboard-content">
    <section className="dashboard-welcome">
      <div>
        <span className="eyebrow">CENTRO DE COMANDO</span>
        <h2>Bom trabalho, {manager}.</h2>
        <p>{!nextEvent?'Temporada encerrada. Revise o legado e prepare a próxima campanha.':nextEvent.competitionName+' · '+nextEvent.stage+' é o próximo compromisso.'}</p>
      </div>
      <div className="season-progress">
        <span><strong>{seasonProgress}%</strong> da temporada</span>
        <i><b style={{width:seasonProgress+'%'}}/></i>
      </div>
    </section>

    <section className="dashboard-kpis">
      <article><span><Trophy size={16}/></span><div><small>Posição</small><strong>{row?row.position+'º':'—'}</strong><em>{row?row.points+' pts':'0 pts'}</em></div></article>
      <article><span><TrendingUp size={16}/></span><div><small>Aproveitamento</small><strong>{row?row.efficiency+'%':'0%'}</strong><em>{played} jogos</em></div></article>
      <article><span><BadgeDollarSign size={16}/></span><div><small>Caixa</small><strong>{money.format(career.cash||0)}</strong><em>{sponsors.length} patrocinador{sponsors.length===1?'':'es'}</em></div></article>
      <article><span><Target size={16}/></span><div><small>Saldo de gols</small><strong>{row?(row.goalDifference>0?'+':'')+row.goalDifference:'0'}</strong><em>{row?row.goalsFor+' marcados':'0 marcados'}</em></div></article>
    </section>

    <section className="confidence-panel">
      <div className="confidence-card fan-confidence"><div className="confidence-copy"><span><Users size={17}/></span><div><small>CONFIANÇA DA TORCIDA</small><strong>{Math.round(confidence.fans)}%</strong><em>{confidence.fanLabel}</em></div><b className={(confidence.lastFanDelta||0)>=0?'positive':'negative'}>{deltaText(confidence.lastFanDelta||0)}</b></div><i className="confidence-track"><b style={{width:confidence.fans+'%'}}/></i></div>
      <div className="confidence-card board-confidence"><div className="confidence-copy"><span><ShieldCheck size={17}/></span><div><small>CONFIANÇA DA DIRETORIA</small><strong>{Math.round(confidence.board)}%</strong><em>{confidence.jobSecurity} · {confidence.boardLabel}</em></div><b className={(confidence.lastBoardDelta||0)>=0?'positive':'negative'}>{deltaText(confidence.lastBoardDelta||0)}</b></div><i className="confidence-track"><b style={{width:confidence.board+'%'}}/></i></div>
      <div className="confidence-pulse"><span className="eyebrow">PULSO DO CLUBE</span>{confidenceEvents.length?confidenceEvents.map(item=><p key={item.id}>{item.reason}</p>):<p>Você começou com 100% de confiança. Resultados e decisões administrativas passam a alterar esse ambiente.</p>}</div>
    </section>

    <div className="dashboard-main-grid">
      <section className="next-match-card">
        <div className="dash-section-title"><div><CalendarDays size={17}/><span><small>PRÓXIMO COMPROMISSO</small><strong>{nextEvent?nextEvent.stage:'Temporada encerrada'}</strong></span></div><span className="home-away-badge">{next?(next.homeId===club.id?'CASA':'FORA'):'FIM'}</span></div>
        {next&&home&&away?<div className="next-match-body">
          <div className="next-club">{crestFor(home)}<strong>{home.name}</strong></div>
          <div className="next-match-center"><b>×</b><span>{venueMeta?.stadium||nextEvent?.competitionName}</span><small>{nextEvent?.competitionName}</small></div>
          <div className="next-club">{crestFor(away)}<strong>{away.name}</strong></div>
        </div>:nextEvent?.type==='brasileirao'?<div className="season-finished-card"><CalendarDays size={29}/><strong>Rodada {nextEvent.roundNumber}</strong><span>Abra a partida para conhecer o adversário e preparar a escalação.</span></div>:<div className="season-finished-card"><Trophy size={29}/><strong>Calendário concluído</strong><span>Confira sua posição final, troféus e recordes.</span></div>}
        <button onClick={()=>onNavigate(nextEvent?nextEvent.type==='world'?'competitions':'match':'legacy')}>{nextEvent?nextEvent.type==='world'?'Abrir competição':'Preparar partida':'Ver história da temporada'} <ArrowRight size={15}/></button>
      </section>

      <section className="board-objective-card">
        <div className="dash-section-title"><div><ShieldCheck size={17}/><span><small>DIRETORIA</small><strong>Objetivo da temporada</strong></span></div><span className={objectiveOk?'objective-ok':'objective-watch'}>{objectiveOk?'NO CAMINHO':'ATENÇÃO'}</span></div>
        <div className="objective-copy"><strong>{objective.label}</strong><span>Meta: {objective.target}</span></div>
        <div className="objective-position"><span>Posição atual</span><strong>{row?row.position+'º':'—'}</strong></div>
        <p>{objectiveOk?'A campanha está dentro da meta definida para o tamanho e orçamento do clube.':'A posição atual está abaixo da meta. As próximas rodadas ganham peso para a temporada.'}</p>
      </section>
    </div>

    <section className="manager-inbox">
      <div className="dash-section-title manager-inbox-title"><div><Flag size={17}/><span><small>PRIORIDADES</small><strong>Agenda do treinador</strong></span></div><span>{attentionItems.length} ações agora</span></div>
      <div className="manager-inbox-grid">{attentionItems.map((item,index)=><article key={item.tag+'-'+index}>
        <div><span>{item.tag}</span><strong>{item.title}</strong><p>{item.copy}</p></div>
        <button onClick={()=>onNavigate(item.nav)}>{item.action}<ArrowRight size={14}/></button>
      </article>)}</div>
    </section>

    <div className="dashboard-secondary-grid">
      <section className="form-card">
        <div className="dash-section-title"><div><CircleDot size={17}/><span><small>MOMENTO</small><strong>Últimos jogos</strong></span></div><button onClick={()=>onNavigate('match')}>Histórico</button></div>
        {history.length?<div className="form-list">{history.map(item=>{
          const opp=clubs.find(c=>c.id===(item.homeId===club.id?item.awayId:item.homeId));
          const clubGoals=item.homeId===club.id?item.homeGoals:item.awayGoals;
          const oppGoals=item.homeId===club.id?item.awayGoals:item.homeGoals;
          return <article key={item.id}><span className={'form-letter result-'+item.points}>{resultLetter(item)}</span><Crest club={opp}/><div><strong>{opp?.name||'Adversário'}</strong><small>Rodada {item.roundNumber}</small></div><b>{clubGoals}–{oppGoals}</b></article>;
        })}</div>:<div className="dashboard-empty">Sua sequência de resultados aparecerá aqui após a primeira rodada.</div>}
      </section>

      <section className="spotlight-card">
        <div className="dash-section-title"><div><Target size={17}/><span><small>DESTAQUE</small><strong>Artilheiro do clube</strong></span></div></div>
        {scorer?<div className="scorer-spotlight"><span>{scorer.name.split(' ').map((x,i,a)=>i===0||i===a.length-1?x[0]:'').join('').slice(0,2)}</span><div><strong>{scorer.name}</strong><small>{club.abbreviation} · Brasileirão {career.season}</small></div><b>{scorer.goals}<small> gols</small></b></div>:<div className="dashboard-empty">O primeiro gol da temporada vai inaugurar este quadro.</div>}
      </section>
    </div>

    <section className="quick-actions">
      <div className="dash-section-title"><div><Flag size={17}/><span><small>ATALHOS</small><strong>Decisões do técnico</strong></span></div></div>
      <div>
        <button onClick={()=>onNavigate('competitions')}><span><CalendarDays size={18}/></span><div><strong>Competições</strong><small>Agenda e chaveamentos</small></div><ArrowRight size={14}/></button>
        <button onClick={()=>onNavigate('roster')}><span><Users size={18}/></span><div><strong>Elenco</strong><small>Escalação e jogadores</small></div><ArrowRight size={14}/></button>
        <button onClick={()=>onNavigate('transfers')}><span><ShoppingBag size={18}/></span><div><strong>Mercado</strong><small>Comprar e negociar</small></div><ArrowRight size={14}/></button>
        <button onClick={()=>onNavigate('sponsors')}><span><Handshake size={18}/></span><div><strong>Patrocínios</strong><small>Receitas e contratos</small></div><ArrowRight size={14}/></button>
        <button onClick={()=>onNavigate('standings')}><span><Trophy size={18}/></span><div><strong>Classificação</strong><small>Veja a corrida da Série A</small></div><ArrowRight size={14}/></button>
      </div>
    </section>
  </div>;
}
