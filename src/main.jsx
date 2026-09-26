import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, CircleHelp, CirclePlay, Flag, Handshake, LayoutDashboard, Medal, Search, Shield, Shuffle, SlidersHorizontal, Table2, Trophy, Users, X } from 'lucide-react';
import data from './data/serie-a-2026.json';
import '@fontsource-variable/dm-sans/index.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';









import LandingScreen from './LandingScreen';
import Crest from './Crest.jsx';
const Management=React.lazy(()=>import('./Management'));
const LeagueTable=React.lazy(()=>import('./LeagueTable'));
const MatchSimulation=React.lazy(()=>import('./MatchSimulation'));
const Legacy=React.lazy(()=>import('./Legacy'));
const TransferMarket=React.lazy(()=>import('./TransferMarket'));
const ClubDashboard=React.lazy(()=>import('./ClubDashboard'));
const SeasonReviewModal=React.lazy(()=>import('./SeasonReviewModal'));
const CompetitionHub=React.lazy(()=>import('./CompetitionHub'));
const RetirementModal=React.lazy(()=>import('./RetirementModal'));
const CareerCenter=React.lazy(()=>import('./CareerCenter'));
const PlayerCareer=React.lazy(()=>import('./PlayerCareer'));
const CareerMomentModal=React.lazy(()=>import('./CareerMomentModal'));



import { applyCareerRoster } from './transfer-engine.js';
import { clubThemeStyle, getClubWorld } from './club-world.js';
import { positionGroup } from './position-labels.js';
import { careerPlayerOverall, playerGameStats } from './player-engine.js';
import { initialTransferBudget } from './economy-engine.js';
import { MANAGER_PROFILES } from './career-dynamics.js';
import { CAREER_KEY, createCareer, sanitizeCareer, standingsFromResults } from './career-engine';
import { nextCareerEvent } from './competition-engine.js';
import { CAREER_CHALLENGES } from './challenge-engine.js';

const labels = { GOL: 'Goleiro', DEF: 'Defensor', MEI: 'Meio-campista', ATA: 'Atacante', NI: 'Não informada' };
const categories = [['Todos', 'Todo o elenco'], ['GOL', 'Goleiros'], ['DEF', 'Defensores'], ['MEI', 'Meias'], ['ATA', 'Atacantes']];
const locations = {'3458':'Curitiba, PR','7632':'Belo Horizonte, MG','9967':'Salvador, BA','6086':'Rio de Janeiro, RJ','9318':'Chapecó, SC','874':'São Paulo, SP','3456':'Curitiba, PR','2022':'Belo Horizonte, MG','819':'Rio de Janeiro, RJ','3445':'Rio de Janeiro, RJ','6273':'Porto Alegre, RS','1936':'Porto Alegre, RS','9169':'Mirassol, SP','2029':'São Paulo, SP','6079':'Bragança Paulista, SP','4936':'Belém, PA','2674':'Santos, SP','2026':'São Paulo, SP','3454':'Rio de Janeiro, RJ','3457':'Salvador, BA'};
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const position = p => positionGroup(p.position);
const snapshotDate = new Date(data.fetchedAt);
const displayDate = snapshotDate.toLocaleDateString('pt-BR', {timeZone:'UTC'});
const countryNames = new Intl.DisplayNames(['pt-BR'], { type:'region' });
const codes = {GHA:'GH',MOR:'MA',UKR:'UA',GUI:'GN',PAN:'PA',RDC:'CD',ENG:'GB',NED:'NL',CRO:'HR',SWE:'SE',CRM:'CM',ARG:'AR',BRA:'BR',URU:'UY',COL:'CO',PAR:'PY',CHI:'CL',CHL:'CL',ECU:'EC',VEN:'VE',PER:'PE',BOL:'BO',POR:'PT',PRT:'PT',ESP:'ES',FRA:'FR',ITA:'IT',USA:'US',MEX:'MX',SUI:'CH',CHE:'CH',GER:'DE',DEU:'DE',DEN:'DK',DNK:'DK',ANG:'AO',CMR:'CM',CPV:'CV'};
const country = p => codes[p.countryCode] ? countryNames.of(codes[p.countryCode]) : p.nationality || 'Não informada';
function clubChallenge(club) {
  const budget=initialTransferBudget(club.id)/1_000_000;
  if(budget>=65)return'Brigar pelo título';
  if(budget>=45)return'Buscar Libertadores';
  if(budget>=25)return'Projeto competitivo';
  return'Desafio de sobrevivência';
}
function age(p) { if(Number.isFinite(Number(p?._careerAge)))return Number(p._careerAge); if(!p.birthDate) return p.age ?? null; const dob=new Date(p.birthDate); if(Number.isNaN(dob.getTime())) return p.age ?? null; let a=snapshotDate.getUTCFullYear()-dob.getUTCFullYear(); if(snapshotDate.getUTCMonth()<dob.getUTCMonth() || (snapshotDate.getUTCMonth()===dob.getUTCMonth() && snapshotDate.getUTCDate()<dob.getUTCDate())) a--; return a; }
function readSaved() { try { const id=localStorage.getItem('ldf.club'); return data.clubs.some(c=>c.id===id)? id:null; } catch { return null; } }
function Modal({children,onClose,title}) { const ref=useRef(); useEffect(()=>{ const el=ref.current; el.showModal(); return ()=>el.close(); },[]); return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}} aria-label={title}><button className="close" onClick={onClose} aria-label="Fechar"><X size={20}/></button>{children}</dialog>; }
function loadCareers() { try { const raw=JSON.parse(localStorage.getItem(CAREER_KEY)); return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}; } catch { return {}; } }
function App() {
  const [landingOpen,setLandingOpen]=useState(true);
  const [gameMode,setGameMode]=useState(null);
  const [tab,setTab]=useState('dashboard');
  const [careers,setCareers]=useState(loadCareers);
  const [careerStorageError,setCareerStorageError]=useState(false);
  const [saved,setSaved]=useState(readSaved);
  const [selected,setSelected]=useState(()=>data.clubs[0]?.id||'2029');
  const [clubSearch,setClubSearch]=useState('');
  const [playerSearch,setPlayerSearch]=useState('');
  const [filter,setFilter]=useState('Todos');
  const [sort,setSort]=useState('position');
  const [dialog,setDialog]=useState(null);
  const [storageError,setStorageError]=useState(false);
  const [mobileSquad,setMobileSquad]=useState(false);
  const [clubBrowserOpen,setClubBrowserOpen]=useState(true);
  const [managerNameInput,setManagerNameInput]=useState('');
  const [managerProfileInput,setManagerProfileInput]=useState('strategist');
  const [careerChallengeInput,setCareerChallengeInput]=useState('normal');
  const clubMarketBudget=id=>Number(careers[String(id)]?.transferBudget??initialTransferBudget(String(id)));
  const careersRef=useRef(careers);
  const persistHandle=useRef(null);
  const persistKind=useRef(null);
  const persistenceReady=useRef(false);
  useEffect(()=>{
    if(!clubBrowserOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[clubBrowserOpen]);
  useEffect(()=>{
    careersRef.current=careers;
    if(!persistenceReady.current){persistenceReady.current=true;return;}
    const write=()=>{
      persistHandle.current=null;persistKind.current=null;
      try{localStorage.setItem(CAREER_KEY,JSON.stringify(careersRef.current));setCareerStorageError(false);}
      catch{setCareerStorageError(true);}
    };
    if(persistHandle.current!==null){
      if(persistKind.current==='idle'&&window.cancelIdleCallback)window.cancelIdleCallback(persistHandle.current);
      else clearTimeout(persistHandle.current);
    }
    if(window.requestIdleCallback){
      persistKind.current='idle';
      persistHandle.current=window.requestIdleCallback(write,{timeout:600});
    }else{
      persistKind.current='timeout';
      persistHandle.current=setTimeout(write,180);
    }
    return()=>{
      if(persistHandle.current!==null){
        if(persistKind.current==='idle'&&window.cancelIdleCallback)window.cancelIdleCallback(persistHandle.current);
        else clearTimeout(persistHandle.current);
        persistHandle.current=null;persistKind.current=null;
      }
    };
  },[careers]);
  useEffect(()=>{
    const flush=()=>{
      try{localStorage.setItem(CAREER_KEY,JSON.stringify(careersRef.current));}catch{}
    };
    window.addEventListener('pagehide',flush);
    return()=>{window.removeEventListener('pagehide',flush);flush();};
  },[]);
  const baseClub=data.clubs.find(c=>c.id===selected)||data.clubs[0];
  const rawCareer=careers[baseClub.id];
  const careerClubs=useMemo(()=>applyCareerRoster(data.clubs,rawCareer||{season:data.season,round:0}),[rawCareer,baseClub.id]);
  const club=careerClubs.find(c=>c.id===selected)||careerClubs[0];
  const savedClub=careerClubs.find(c=>c.id===saved);
  const savedManager=saved?String(careers[saved]?.managerName||''):'';
  const savedRound=saved?Number(careers[saved]?.round||0):0;
  const savedSeason=saved?Number(careers[saved]?.season||data.season):data.season;
  const selectedHasCareer=Boolean(careers[club.id]);
  const selectedDismissed=careers[club.id]?.managerStatus==='dismissed';
  const career=useMemo(()=>sanitizeCareer(rawCareer,careerClubs,club.id),[rawCareer,careerClubs,club.id]);
  useEffect(()=>{
    if(!rawCareer)return;
    const detailedResults=Array.isArray(rawCareer.results)&&rawCareer.results.some(result=>Array.isArray(result.events)||result.stats||result.homeLineup||result.awayLineup);
    const needsMigration=Number(rawCareer.version||0)<12||detailedResults||!rawCareer.seasonPerformance||!rawCareer.world||!rawCareer.systemsVersion;
    if(needsMigration)setCareers(current=>({...current,[club.id]:career}));
  },[club.id,rawCareer,career]);
  const careerActive=saved===club.id;
  const nextEvent=useMemo(()=>nextCareerEvent(career,careerClubs),[career,careerClubs]);
  const pendingRetirement=career.pendingRetirements?.[0]||null;
  const managerDismissed=career.managerStatus==='dismissed';
  const managerCanManage=careerActive&&!managerDismissed;
  const managerProfileLocked=selectedHasCareer&&((career.round||0)>0||(career.world?.history||[]).some(item=>String(item.homeId)===String(career.userClubId)||String(item.awayId)===String(career.userClubId)));
  const careerStandings=useMemo(()=>standingsFromResults(career.results,careerClubs),[career.results,careerClubs]);
  const clubs=careerClubs.filter(c=>normalize(c.name+' '+c.abbreviation).includes(normalize(clubSearch)));
  const counts=Object.fromEntries(['GOL','DEF','MEI','ATA','NI'].map(k=>[k,club.players.filter(p=>position(p)===k).length]));
  const ages=club.players.map(age).filter(a=>a!==null);
  const meanAge=ages.length ? (ages.reduce((a,b)=>a+b,0)/ages.length).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
  const players=useMemo(()=>club.players.filter(p=>(filter==='Todos'||position(p)===filter) && normalize(p.name).includes(normalize(playerSearch))).sort((a,b)=>{
    if(sort==='age') return (age(a)??999)-(age(b)??999)||a.name.localeCompare(b.name,'pt-BR');
    if(sort==='name') return a.name.localeCompare(b.name,'pt-BR');
    const order={GOL:0,DEF:1,MEI:2,ATA:3,NI:4}; return order[position(a)]-order[position(b)] || a.name.localeCompare(b.name,'pt-BR');
  }),[club,filter,playerSearch,sort]);
  function selectClub(id) {setSelected(id);setPlayerSearch('');setFilter('Todos');setDialog(null);setMobileSquad(true);}
  function openClubBrowser() {
    setClubBrowserOpen(true);
    setMobileSquad(false);
    setClubSearch('');
  }
  function closeClubBrowser() {
    setClubBrowserOpen(false);
    setClubSearch('');
    if(saved){setSelected(saved);setMobileSquad(true);}
  }
  function surpriseClub() {
    const pool=data.clubs.filter(item=>item.id!==club.id);
    let index=0;
    if(pool.length){
      if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);index=value[0]%pool.length;}
      else index=Date.now()%pool.length;
    }
    const picked=pool[index]||data.clubs[0];
    setClubSearch('');
    selectClub(picked.id);
  }
  function saveCareer(nextCareer) {
    const targetId=String(nextCareer?.userClubId||club.id),currentId=String(club.id);
    setCareers(current=>{
      if(targetId===currentId)return{...current,[currentId]:nextCareer};
      const moved={...current};delete moved[currentId];moved[targetId]=nextCareer;return moved;
    });
    if(targetId!==currentId){
      setSaved(targetId);setSelected(targetId);setClubBrowserOpen(false);setMobileSquad(true);setTab('dashboard');
      try{localStorage.setItem('ldf.club',targetId);}catch{}
    }
  }
  function openClubSetup() {
    setManagerNameInput(String(career.managerName||''));
    setManagerProfileInput(String(career.managerProfile||'strategist'));
    setCareerChallengeInput(String(career.careerChallenge||'normal'));
    setDialog('manager');
  }
  function confirmClub() {
    const managerName=managerNameInput.trim();
    if(!managerName)return;
    setSaved(club.id);
    const existing=careers[club.id];
    const source=existing?.managerStatus==='dismissed'?createCareer(careerClubs,club.id,data.season):(existing||createCareer(careerClubs,club.id));
    const current=sanitizeCareer(source,careerClubs,club.id);
    const configured={...current,managerName,managerProfile:managerProfileLocked?(current.managerProfile||'strategist'):managerProfileInput,careerChallenge:managerProfileLocked?(current.careerChallenge||'normal'):careerChallengeInput,challengeStartSeason:managerProfileLocked?(current.challengeStartSeason||current.season):current.season,managerStatus:'active',dismissal:null,boardPressureStreak:0,boardWarning:null};
    const next={...careers,[club.id]:configured};
    setCareers(next);
    try {
      localStorage.setItem('ldf.club',club.id);
      localStorage.setItem(CAREER_KEY,JSON.stringify(next));
      setStorageError(false);
      setCareerStorageError(false);
    } catch {setStorageError(true);setCareerStorageError(true);}
    setClubBrowserOpen(false);
    setTab('dashboard');
    setDialog('confirmed');
  }
  function leaveDismissedClub(){
    try{localStorage.removeItem('ldf.club');}catch{}
    setSaved(null);
    setClubBrowserOpen(true);
    setMobileSquad(false);
    setDialog(null);
  }
  async function importCareerPayload(payload){
    const clubId=String(payload?.career?.userClubId||payload?.club?.id||'');
    if(!data.clubs.some(item=>String(item.id)===clubId))throw new Error('O clube deste save não existe nesta versão.');
    const roster=applyCareerRoster(data.clubs,payload.career),restored=sanitizeCareer(payload.career,roster,clubId),next={...careers,[clubId]:restored};
    setCareers(next);setSaved(clubId);setSelected(clubId);setGameMode('manager');setLandingOpen(false);setClubBrowserOpen(false);setMobileSquad(true);setTab('central');
    try{localStorage.setItem('ldf.club',clubId);localStorage.setItem(CAREER_KEY,JSON.stringify(next));setCareerStorageError(false);}catch{setCareerStorageError(true);}
  }
  if(landingOpen)return <LandingScreen onManager={()=>{setGameMode('manager');setLandingOpen(false);}} onPlayer={()=>{setGameMode('player');setLandingOpen(false);}} onImport={async payload=>{setGameMode('manager');await importCareerPayload(payload);}}/>;
  if(gameMode==='player')return <PlayerCareer clubs={data.clubs} onExit={()=>{setGameMode(null);setLandingOpen(true);}}/>;
  if(clubBrowserOpen){
    return <div className="app-shell selector-only" style={clubThemeStyle(club.id)}>
    <section className="club-selector-overlay" aria-label="Seletor de clubes">
        <div className="club-selector-shell">
          <header className="club-selector-header">
            <div className="club-selector-title"><span className="eyebrow">BRASILEIRÃO SÉRIE A · 20 CLUBES</span><h2>Escolha o clube que você quer comandar.</h2><p>Compare elenco, estrutura e desafio. Sua carreira atual continua salva enquanto você explora outros clubes.</p></div>
            {saved?<button className="club-selector-return" onClick={()=>{closeClubBrowser();setTab('dashboard');}}><ArrowLeft size={16}/><span><small>RETOMAR CARREIRA</small><strong>{savedClub?.name||'Meu clube'}</strong></span></button>:<span className="club-selector-new"><small>NOVA CARREIRA</small><strong>Escolha seu primeiro projeto</strong></span>}
          </header>
          <div className="club-selector-toolbar">
            <label className="search-box"><Search size={17}/><input placeholder="Buscar clube..." aria-label="Buscar clube no seletor" value={clubSearch} onChange={e=>setClubSearch(e.target.value)}/>{clubSearch&&<button onClick={()=>setClubSearch('')} aria-label="Limpar busca"><X size={15}/></button>}</label>
            <button className="selector-surprise" onClick={surpriseClub}><Shuffle size={15}/> Clube surpresa</button>
          </div>
          <div className="club-selector-body">
            <div className="club-selector-grid">{clubs.map(c=>{const meta=getClubWorld(c.id);return <button key={'overlay-'+c.id} className={`club-selector-card ${c.id===club.id?'selected':''} ${c.id===saved?'career':''}`} onClick={()=>{setSelected(c.id);setPlayerSearch('');setFilter('Todos');}}>
              <div className="selector-card-head"><Crest club={c}/>{c.id===saved?<em>MINHA CARREIRA</em>:careers[c.id]?.managerStatus==='dismissed'?<em className="other-save">ENCERRADA</em>:careers[c.id]?<em className="other-save">SAVE</em>:null}</div>
              <strong>{c.name}</strong><small>{locations[c.id]||meta.city+', '+meta.state}</small>
              <div className="selector-card-meta"><span>{clubChallenge(c)}</span><b>R$ {Math.round(clubMarketBudget(c.id)/1_000_000)} mi</b></div>
            </button>;})}</div>
            {!clubs.length&&<div className="club-empty selector-empty">Nenhum clube encontrado.<button onClick={()=>setClubSearch('')}>Limpar busca</button></div>}
            <aside className="club-selector-preview">
              <div className="selector-preview-club"><Crest club={club} large/><span><small>CLUBE SELECIONADO</small><strong>{club.name}</strong><em>{locations[club.id]}</em></span></div>
              <div className="selector-preview-facts"><span><small>DESAFIO</small><strong>{clubChallenge(club)}</strong></span><span><small>ORÇAMENTO</small><strong>R$ {Math.round(clubMarketBudget(club.id)/1_000_000)} mi</strong></span><span><small>ESTÁDIO</small><strong>{getClubWorld(club.id).stadium}</strong></span><span><small>ELENCO</small><strong>{club.players.length} jogadores</strong></span></div>
              {club.id===saved?<button className="selector-primary" onClick={()=>{closeClubBrowser();setTab('dashboard');}}><CirclePlay size={16}/> Voltar ao meu clube</button>:<button className="selector-primary" onClick={()=>{setClubBrowserOpen(false);setMobileSquad(true);setTab('dashboard');}}>Conhecer este projeto <ArrowRight size={16}/></button>}
              {saved&&<button className="selector-secondary" onClick={()=>{closeClubBrowser();setTab('dashboard');}}>Cancelar e retomar carreira</button>}
            </aside>
          </div>
        </div>
    </section>
  </div>;
  }

  return <div className="app-shell" style={clubThemeStyle(club.id)}>
    <header className="topbar"><a href="#" className="brand" aria-label="Linha de Frente, abrir seletor de clubes" onClick={e=>{e.preventDefault();openClubBrowser();}}><span className="brand-symbol">L<span>F</span></span><span>LINHA DE<br/>FRENTE<span className="brand-small">FOOTBALL MANAGER</span></span></a><div className="top-context"><span className="top-divider"/><span>Brasileirão Série A · Arcade Career Manager</span></div><div className="top-right"><span className="version"><i/> 1.0 RC9</span><button className="help" onClick={()=>setDialog('data')} aria-label="Sobre os dados"><CircleHelp size={20}/></button></div></header>
    <main>
      {careerActive?<section className="career-strip"><div className="career-strip-club"><Crest club={club}/><span><small>MODO CARREIRA · TEMPORADA {career.season}</small><strong>{club.name}{career.managerName?' · '+career.managerName:''}</strong></span></div><div className="career-strip-meta"><span>{nextEvent?<><small className="career-next-label">{nextEvent.competitionName}</small><strong>{nextEvent.stage}</strong></>:<>Rodada <strong>{career.round}/38</strong></>}</span><button className="career-continue" onClick={()=>{setClubBrowserOpen(false);setTab(career.pendingRound?'match':nextEvent?.type==='world'?'competitions':career.round>=38?'competitions':'match');}}><CirclePlay size={14}/>{career.pendingRound?'Voltar ao jogo':nextEvent?.type==='world'?'Próximo compromisso':career.round>=38?'Fechar temporada':'Continuar'}</button><button className="career-explore" onClick={openClubBrowser}>Explorar clubes <ArrowRight size={14}/></button></div></section>:<section className="intro"><div><div className="eyebrow"><span>01 /</span> O PRIMEIRO PASSO</div><h1>Escolha um clube para começar.</h1><p>Compare elenco, orçamento e estrutura antes de assumir.</p></div><div className="competition"><span className="trophy-icon"><Trophy size={25}/></span><div><strong>BRASILEIRÃO</strong><span>Série A <b>·</b> Temporada {career.season}</span></div><span className="brazil-tag">BR</span></div></section>}
      {savedClub&&!careerActive&&<div className="saved-banner" role="status"><Check size={16}/><span><strong>{savedClub.name}</strong>{savedManager?' · Técnico '+savedManager:''}. {storageError?'Carreira ativa nesta sessão.':'Carreira salva neste navegador.'}</span><button onClick={()=>{selectClub(savedClub.id);setClubBrowserOpen(false);setTab('dashboard');}}>Continuar carreira <ArrowRight size={15}/></button></div>}
      <div className={`workspace single-club-workspace ${mobileSquad?'show-squad':''}`}>
        <section className="squad-panel" aria-label={`Painel do ${club.name}`}>
          <button className="mobile-back" onClick={()=>{setMobileSquad(false);setClubBrowserOpen(true);}}><ArrowLeft size={16}/> Voltar aos clubes</button>
          <div className="club-hero"><div className="hero-line"/><div className="hero-main"><Crest club={club} large/><div className="hero-title"><div className="eyebrow">{locations[club.id]}</div><h2>{club.name}</h2><span className="division"><span/> Brasileirão Série A · {career.season}</span>{career.managerName&&saved===club.id?<span className="manager-chip">Técnico {career.managerName}</span>:null}<div className="club-project-chips"><span>{clubChallenge(club)}</span><span>Orçamento R$ {Math.round(clubMarketBudget(club.id)/1_000_000)} mi</span><span>{club.players.length} jogadores</span></div></div></div><div className="hero-action"><span>{saved===club.id&&career.managerName?'Você está no comando deste projeto.':selectedHasCareer?'Uma carreira já existe neste clube.':'Nenhuma carreira iniciada neste clube.'}</span><button className="primary" onClick={openClubSetup}>{saved===club.id?'Editar técnico':selectedDismissed?'Recomeçar projeto':selectedHasCareer?'Retomar esta carreira':'Começar carreira'}{saved===club.id?<Check size={18}/>:<ArrowRight size={18}/>}</button></div><div className="pitch-art" aria-hidden="true"><i/><b/><em/></div></div>
          <nav className="club-navigation" aria-label="Áreas do clube">{[['dashboard','Painel',LayoutDashboard],['central','Bastidores',BookOpen],['competitions','Competições',CalendarDays],['match','Partida',CirclePlay],['roster','Elenco',Users],['standings','Classificação',Table2],['transfers','Transferências',ArrowLeftRight],['trophies','Troféus',Trophy],['sponsors','Patrocínios',Handshake],['legacy','História',Medal]].map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
          <div hidden={tab!=='roster'}>
          <div className="stats"><div><Users size={19}/><span><strong>{club.players.length}</strong><small>Jogadores na base</small></span></div><div><span className="stat-glyph">Ø</span><span><strong>{meanAge}<em> anos</em></strong><small>Idade média</small></span></div><div><Flag size={19}/><span><strong>{new Set(club.players.map(p=>p.nationality).filter(Boolean)).size}</strong><small>Nacionalidades</small></span></div><div className="snapshot-stat"><span className="status-dot"/><span><strong>Temporada {career.season}</strong><small>Base original consultada em {displayDate}</small></span></div></div>
          <div className="roster-content"><div className="roster-heading"><div><div className="eyebrow">DENTRO DAS QUATRO LINHAS</div><h2>Conheça o elenco<span>{club.players.length}</span></h2></div><label className="search-box player-search"><Search size={17}/><input placeholder="Buscar jogador..." aria-label="Buscar jogador" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}/>{playerSearch&&<button onClick={()=>setPlayerSearch('')} aria-label="Limpar busca de jogadores"><X size={15}/></button>}</label></div>
          <div className="toolbar"><div className="position-tabs" aria-label="Filtrar por posição">{categories.map(([key,label])=><button key={key} className={filter===key?'current':''} onClick={()=>setFilter(key)} aria-pressed={filter===key}>{label}<span>{key==='Todos'?club.players.length:counts[key]}</span></button>)}</div><label className="sort"><SlidersHorizontal size={15}/><select aria-label="Ordenar jogadores" value={sort} onChange={e=>setSort(e.target.value)}><option value="position">Posição</option><option value="name">Nome A–Z</option><option value="age">Mais jovens</option></select></label></div>
          <div className="table-scroll"><table><thead><tr><th className="number-col">Nº</th><th>JOGADOR <ArrowDown size={11}/></th><th>POSIÇÃO</th><th>IDADE</th><th>OVR</th><th className="nationality-col">NACIONALIDADE</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td className="number-col">{p.number || '—'}</td><td><button className="player-button" onClick={()=>setDialog(p)}><span className={`player-monogram ${position(p)}`}>{p.name.split(' ').filter(Boolean).map(w=>w[0]).filter((_,i,a)=>i===0||i===a.length-1).join('')}</span><span>{p.name}</span></button></td><td><span className={`position ${position(p)}`}>{position(p)}</span></td><td>{age(p)??'—'}<span className="age-unit">{age(p)!==null?' anos':''}</span></td><td><strong className="roster-overall">{careerPlayerOverall(p,career,club.id)}</strong></td><td className="nationality-col"><span className="country-code">{p.countryCode||'—'}</span>{country(p)}</td><td><button className="row-detail" aria-label={`Ver ficha de ${p.name}`} onClick={()=>setDialog(p)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table>{!players.length&&<div className="empty"><Search size={28}/><h3>Nenhum jogador encontrado</h3><p>Tente outro nome ou uma posição diferente.</p><button onClick={()=>{setPlayerSearch('');setFilter('Todos');}}>Limpar filtros</button></div>}</div><div className="table-footer"><span>Exibindo {players.length} de {club.players.length} jogadores</span><span>Clique no nome para ver a ficha <ChevronRight size={13}/></span></div>
          </div><div className="data-note"><Shield size={15}/><p>Elenco da temporada · Fonte: ESPN. A base pode incluir atletas transferidos.</p><button onClick={()=>setDialog('data')}>Sobre os dados <ArrowRight size={13}/></button></div>
          </div>
          {tab==='dashboard'&&<ClubDashboard career={career} club={club} clubs={careerClubs} Crest={Crest} onNavigate={setTab} canManage={managerCanManage} onChoose={openClubSetup}/>}
          {tab==='central'&&<CareerCenter career={career} club={club} clubs={careerClubs} Crest={Crest} onCareerChange={saveCareer} onImportCareer={importCareerPayload}/>}
          {tab==='competitions'&&<CompetitionHub career={career} clubs={careerClubs} onCareerChange={saveCareer} onNavigate={setTab}/>}
          <div hidden={tab!=='match'}><MatchSimulation key={club.id} isVisible={tab==='match'} club={club} clubs={careerClubs} Crest={Crest} career={career} onCareerChange={saveCareer} canManage={managerCanManage} onChoose={openClubSetup} onNavigate={setTab}/></div> {tab==='standings'&&<LeagueTable clubs={careerClubs} focusClubId={club.id} Crest={Crest} career={career}/>} {tab==='transfers'&&<TransferMarket career={career} onCareerChange={saveCareer} club={club} clubs={careerClubs} baseClubs={data.clubs} Crest={Crest} canManage={managerCanManage}/>} {(tab==='trophies'||tab==='sponsors')&&<Management key={club.id+'-'+tab} club={club} tab={tab} career={career} onCareerChange={saveCareer} canManage={managerCanManage} onChoose={openClubSetup} Modal={Modal} storageError={careerStorageError} standings={careerStandings}/>} {tab==='legacy'&&<Legacy club={club} clubs={careerClubs} career={career}/>}
        </section>
      </div><footer className="page-footer"><span>LINHA DE FRENTE <b>/</b> Simulação de carreira e gestão de clubes.</span><span>1.0 RC9 <span className="footer-dot">·</span> 2026</span></footer>
    </main>
    {careerActive&&managerDismissed&&<Modal title="Decisão da diretoria" onClose={()=>{}}><span className="modal-icon"><Shield/></span><div className="eyebrow">FIM DE CICLO</div><h2>A diretoria encerrou o seu trabalho.</h2><p>{career.dismissal?.reason||'A confiança da diretoria caiu a um nível crítico por várias rodadas consecutivas.'}</p><div className="next-step"><strong>Confiança final da diretoria: {Math.round(career.managerConfidence?.board||0)}%</strong><p>O save permanece registrado no clube, mas esta passagem chegou ao fim. Você pode escolher outro projeto ou recomeçar neste clube com uma nova carreira.</p></div><button className="primary manager-confirm" onClick={leaveDismissedClub}>Voltar ao seletor de clubes <ArrowRight size={18}/></button></Modal>}
    {careerActive&&pendingRetirement&&<RetirementModal retirement={pendingRetirement} onClose={()=>saveCareer({...career,pendingRetirements:(career.pendingRetirements||[]).slice(1)})}/>}
    {careerActive&&!pendingRetirement&&career.pendingCelebration&&<SeasonReviewModal career={career} club={club} Crest={Crest} mode="trophy" onClose={()=>saveCareer({...career,pendingCelebration:null})}/>}
        {careerActive&&!pendingRetirement&&!career.pendingCelebration&&career.pendingCinematic&&<CareerMomentModal moment={career.pendingCinematic} club={club} Crest={Crest} onClose={()=>saveCareer({...career,pendingCinematic:null})}/>}
    {careerActive&&!pendingRetirement&&!career.pendingCelebration&&career.seasonReview?.pending&&<SeasonReviewModal career={career} club={club} Crest={Crest} mode="season" onClose={()=>saveCareer({...career,seasonReview:{...career.seasonReview,pending:false}})} onContinue={()=>{saveCareer({...career,seasonReview:{...career.seasonReview,pending:false}});setTab('legacy');}}/>}
    {dialog==='data'&&<Modal title="Sobre os dados" onClose={()=>setDialog(null)}><span className="modal-icon"><Shield/></span><div className="eyebrow">TRANSPARÊNCIA</div><h2>Futebol real. Base consultável.</h2><p>Os 20 clubes e seus elencos vêm dos cadastros de temporada da ESPN, consultados em <strong>{displayDate}</strong>. A tela usa uma cópia local dessa consulta.</p><p>{data.note} Idades se referem à data da consulta. Dados ausentes aparecem como “—”.</p><p>Partidas, classificação, artilharia, caixa, patrocínios e transferências compartilham o mesmo save local. Receitas e valores de mercado usam referências públicas; orçamento disponível e negociações são modelagens de gameplay, não saldos contábeis oficiais.</p><a className="primary" href={club.sourcePage} target="_blank" rel="noreferrer">Consultar elenco na ESPN <ArrowRight size={17}/></a></Modal>}
    {dialog==='manager'&&<Modal title="Definir técnico" onClose={()=>setDialog(null)}><Crest club={club} large/><div className="eyebrow">COMANDO TÉCNICO</div><h2>Quem comandará o {club.name}?</h2><p>Seu perfil altera pequenas partes da gestão, do vestiário e das decisões sem substituir o peso do elenco ou dos resultados.</p><label className="manager-name-field"><span>Nome do técnico</span><input autoFocus maxLength="40" value={managerNameInput} onChange={e=>setManagerNameInput(e.target.value)} placeholder="Digite o nome do técnico"/></label><div className="manager-profile-picker">{MANAGER_PROFILES.map(item=><button type="button" key={item.id} disabled={managerProfileLocked} className={managerProfileInput===item.id?'selected':''} onClick={()=>setManagerProfileInput(item.id)}><strong>{item.name}</strong><span>{item.description}</span></button>)}</div><div className="manager-challenge-picker"><span><small>DESAFIO OPCIONAL</small><strong>Como você quer construir esta carreira?</strong></span><div>{CAREER_CHALLENGES.map(item=><button type="button" key={item.id} disabled={managerProfileLocked} className={careerChallengeInput===item.id?'selected':''} onClick={()=>setCareerChallengeInput(item.id)}><strong>{item.name}</strong><em>{item.description}</em></button>)}</div></div>{managerProfileLocked&&<p className="profile-lock-note">Perfil e desafio foram definidos no início desta carreira e não mudam depois da primeira partida oficial.</p>}<button className="primary manager-confirm" disabled={!managerNameInput.trim()} onClick={confirmClub}>{saved===club.id?'Salvar técnico':'Assumir o clube'} <ArrowRight size={18}/></button></Modal>}
    {dialog==='confirmed'&&<Modal title="Clube escolhido" onClose={()=>setDialog(null)}><Crest club={club} large/><div className="eyebrow">COMANDO DEFINIDO</div><h2>{managerNameInput.trim()}, você assume o {club.name}.</h2><p>{storageError?'A carreira está ativa nesta sessão.':'Clube e técnico foram salvos neste navegador.'}</p><div className="next-step"><strong>A temporada está pronta.</strong><p>Gerencie escalação, partidas, transferências, finanças e a história do clube.</p></div><button className="primary" onClick={()=>{setDialog(null);setTab('dashboard');}}>Ir para a temporada <ArrowRight size={18}/></button></Modal>}
    {dialog&&typeof dialog==='object'&&<Modal title={`Ficha de ${dialog.name}`} onClose={()=>setDialog(null)}><div className="player-modal-club"><Crest club={club}/><span>{club.name} · {career.season}</span></div><span className={`position ${position(dialog)}`}>{labels[position(dialog)]}</span><h2>{dialog.name}</h2><div className="player-facts"><div><small>Camisa</small><strong>{dialog.number||'—'}</strong></div><div><small>Idade na temporada</small><strong>{age(dialog)!==null?`${age(dialog)} anos`:'—'}</strong></div><div><small>Nacionalidade</small><strong>{country(dialog)}</strong></div><div><small>Altura</small><strong>{dialog.heightCm?`${dialog.heightCm} cm`:'—'}</strong></div><div><small>Overall</small><strong>{careerPlayerOverall(dialog,career,club.id)}</strong></div></div><p className="fineprint">Cadastro da ESPN · Consulta de {displayDate}. Vínculo atual sujeito à confirmação.</p><button className="primary" onClick={()=>setDialog(null)}>Voltar ao elenco <ArrowRight size={17}/></button></Modal>}
  </div>;
}
createRoot(document.getElementById('root')).render(<React.Suspense fallback={<div className="app-loading"><span className="brand-symbol">L<span>F</span></span><strong>Carregando...</strong></div>}><App/></React.Suspense>);
