import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, Check, ChevronRight, CircleHelp, CirclePlay, Flag, Handshake, LayoutDashboard, Medal, Search, Shield, SlidersHorizontal, Table2, Trophy, Users, X } from 'lucide-react';
import data from './data/serie-a-2026.json';
import '@fontsource-variable/dm-sans/index.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import Management from './Management';
import LeagueTable from './LeagueTable';
import MatchSimulation from './MatchSimulation';
import Legacy from './Legacy';
import TransferMarket from './TransferMarket';
import ClubDashboard from './ClubDashboard';
import { applyCareerRoster } from './transfer-engine.js';
import { clubThemeStyle } from './club-world.js';
import { positionGroup } from './position-labels.js';
import { CAREER_KEY, createCareer, sanitizeCareer, standingsFromResults } from './career-engine';

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
function age(p) { if(!p.birthDate) return p.age ?? null; const dob=new Date(p.birthDate); if(Number.isNaN(dob.getTime())) return p.age ?? null; let a=snapshotDate.getUTCFullYear()-dob.getUTCFullYear(); if(snapshotDate.getUTCMonth()<dob.getUTCMonth() || (snapshotDate.getUTCMonth()===dob.getUTCMonth() && snapshotDate.getUTCDate()<dob.getUTCDate())) a--; return a; }
function readSaved() { try { const id=localStorage.getItem('ldf.club'); return data.clubs.some(c=>c.id===id)? id:null; } catch { return null; } }
function Crest({club, large=false}) { const [failed,setFailed]=useState(false); useEffect(()=>setFailed(false),[club.id]); const base=import.meta.env.BASE_URL.replace(/\/$/,''); return <span className={`crest ${large?'large':''}`}>{club.logo && !failed ? <img src={base+club.logo} alt={`Escudo do ${club.name}`} loading={large?'eager':'lazy'} decoding="async" fetchPriority={large?'high':'auto'} onError={()=>setFailed(true)}/> : <span className="crest-fallback">{club.abbreviation}</span>}</span>; }
function Modal({children,onClose,title}) { const ref=useRef(); useEffect(()=>{ const el=ref.current; el.showModal(); return ()=>el.close(); },[]); return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}} aria-label={title}><button className="close" onClick={onClose} aria-label="Fechar"><X size={20}/></button>{children}</dialog>; }
function loadCareers() { try { const raw=JSON.parse(localStorage.getItem(CAREER_KEY)); return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}; } catch { return {}; } }
function App() {
  const [tab,setTab]=useState(()=>readSaved()?'dashboard':'match');
  const [careers,setCareers]=useState(loadCareers);
  const [careerStorageError,setCareerStorageError]=useState(false);
  const [saved,setSaved]=useState(readSaved);
  const [selected,setSelected]=useState(()=>readSaved()||'2029');
  const [clubSearch,setClubSearch]=useState('');
  const [playerSearch,setPlayerSearch]=useState('');
  const [filter,setFilter]=useState('Todos');
  const [sort,setSort]=useState('position');
  const [dialog,setDialog]=useState(null);
  const [storageError,setStorageError]=useState(false);
  const [mobileSquad,setMobileSquad]=useState(false);
  const [managerNameInput,setManagerNameInput]=useState('');
  const baseClub=data.clubs.find(c=>c.id===selected)||data.clubs[0];
  const rawCareer=careers[baseClub.id];
  const careerClubs=useMemo(()=>applyCareerRoster(data.clubs,rawCareer||{season:data.season,round:0}),[rawCareer,baseClub.id]);
  const club=careerClubs.find(c=>c.id===selected)||careerClubs[0];
  const savedClub=careerClubs.find(c=>c.id===saved);
  const savedManager=saved?String(careers[saved]?.managerName||''):'';
  const career=useMemo(()=>sanitizeCareer(rawCareer,careerClubs,club.id),[rawCareer,careerClubs,club.id]);
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
  function saveCareer(nextCareer) {
    setCareers(current=>{
      const next={...current,[club.id]:nextCareer};
      try {localStorage.setItem(CAREER_KEY,JSON.stringify(next));setCareerStorageError(false);} catch {setCareerStorageError(true);}
      return next;
    });
  }
  function openClubSetup() {
    setManagerNameInput(String(career.managerName||''));
    setDialog('manager');
  }
  function confirmClub() {
    const managerName=managerNameInput.trim();
    if(!managerName)return;
    setSaved(club.id);
    const current=sanitizeCareer(careers[club.id]||createCareer(careerClubs,club.id),careerClubs,club.id);
    const configured={...current,managerName};
    const next={...careers,[club.id]:configured};
    setCareers(next);
    try {
      localStorage.setItem('ldf.club',club.id);
      localStorage.setItem(CAREER_KEY,JSON.stringify(next));
      setStorageError(false);
      setCareerStorageError(false);
    } catch {setStorageError(true);setCareerStorageError(true);}
    setTab('dashboard');
    setDialog('confirmed');
  }
  return <div className="app-shell" style={clubThemeStyle(club.id)}>
    <header className="topbar"><a href="#" className="brand" aria-label="Linha de Frente, início"><span className="brand-symbol">L<span>F</span></span><span>LINHA DE<br/>FRENTE<span className="brand-small">FOOTBALL MANAGER</span></span></a><div className="top-context"><span className="top-divider"/><span>Uma nova história começa aqui.</span></div><div className="top-right"><span className="version"><i/> beta00</span><button className="help" onClick={()=>setDialog('data')} aria-label="Sobre os dados"><CircleHelp size={20}/></button></div></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span>01 /</span> O PRIMEIRO PASSO</div><h1>Seu clube. Sua história.</h1><p>Escolha as cores que você vai defender. Conheça quem entra em campo.</p></div><div className="competition"><span className="trophy-icon"><Trophy size={25}/></span><div><strong>BRASILEIRÃO</strong><span>Série A <b>·</b> Temporada {career.season}</span></div><span className="brazil-tag">BR</span></div></section>
      {savedClub && <div className="saved-banner" role="status"><Check size={16}/><span><strong>{savedClub.name}</strong>{savedManager?' · Técnico '+savedManager:''}. {storageError?'Carreira ativa nesta sessão.':'Carreira salva neste navegador.'}</span><button onClick={()=>{selectClub(savedClub.id);setTab('dashboard');}}>Continuar carreira <ArrowRight size={15}/></button></div>}
      <div className={`workspace ${mobileSquad?'show-squad':''}`}>
        <aside className="club-panel"><div className="section-heading"><h2>Escolha seu clube</h2><span className="count">20</span></div><label className="search-box club-search"><Search size={17}/><input placeholder="Buscar clube..." aria-label="Buscar clube" value={clubSearch} onChange={e=>setClubSearch(e.target.value)}/>{clubSearch&&<button onClick={()=>setClubSearch('')} aria-label="Limpar busca de clubes"><X size={15}/></button>}</label><div className="club-grid">{clubs.map(c=><button key={c.id} className={`club-card ${c.id===club.id?'active':''}`} onClick={()=>selectClub(c.id)} aria-pressed={c.id===club.id}><Crest club={c}/><span>{c.name}</span>{c.id===club.id&&<span className="selected-dot"><Check size={10}/></span>}</button>)}</div>{!clubs.length&&<div className="club-empty">Nenhum clube encontrado.<button onClick={()=>setClubSearch('')}>Limpar busca</button></div>}<div className="league-footer"><Flag size={14}/><span>20 clubes. Infinitas possibilidades.</span></div></aside>
        <section className="squad-panel" aria-label={`Painel do ${club.name}`}>
          <button className="mobile-back" onClick={()=>setMobileSquad(false)}><ArrowLeft size={16}/> Trocar clube</button>
          <div className="club-hero"><div className="hero-line"/><div className="hero-main"><Crest club={club} large/><div className="hero-title"><div className="eyebrow">{locations[club.id]}</div><h2>{club.name}</h2><span className="division"><span/> Brasileirão Série A · {career.season}</span>{career.managerName&&saved===club.id?<span className="manager-chip">Técnico {career.managerName}</span>:null}</div></div><div className="hero-action"><span>{saved===club.id&&career.managerName?'Comando definido para '+career.managerName:'Defina quem comandará o clube.'}</span><button className="primary" onClick={openClubSetup}>{saved===club.id?'Editar técnico':'Escolher este clube'}{saved===club.id?<Check size={18}/>:<ArrowRight size={18}/>}</button></div><div className="pitch-art" aria-hidden="true"><i/><b/><em/></div></div>
          <nav className="club-navigation" aria-label="Áreas do clube">{[['dashboard','Painel',LayoutDashboard],['match','Partida',CirclePlay],['roster','Elenco',Users],['standings','Classificação',Table2],['transfers','Transferências',ArrowLeftRight],['trophies','Troféus',Trophy],['sponsors','Patrocínios',Handshake],['legacy','História',Medal]].map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
          <div hidden={tab!=='roster'}>
          <div className="stats"><div><Users size={19}/><span><strong>{club.players.length}</strong><small>Jogadores na base</small></span></div><div><span className="stat-glyph">Ø</span><span><strong>{meanAge}<em> anos</em></strong><small>Idade média</small></span></div><div><Flag size={19}/><span><strong>{new Set(club.players.map(p=>p.nationality).filter(Boolean)).size}</strong><small>Nacionalidades</small></span></div><div className="snapshot-stat"><span className="status-dot"/><span><strong>Temporada 2026</strong><small>Base consultada em {displayDate}</small></span></div></div>
          <div className="roster-content"><div className="roster-heading"><div><div className="eyebrow">DENTRO DAS QUATRO LINHAS</div><h2>Conheça o elenco<span>{club.players.length}</span></h2></div><label className="search-box player-search"><Search size={17}/><input placeholder="Buscar jogador..." aria-label="Buscar jogador" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}/>{playerSearch&&<button onClick={()=>setPlayerSearch('')} aria-label="Limpar busca de jogadores"><X size={15}/></button>}</label></div>
          <div className="toolbar"><div className="position-tabs" aria-label="Filtrar por posição">{categories.map(([key,label])=><button key={key} className={filter===key?'current':''} onClick={()=>setFilter(key)} aria-pressed={filter===key}>{label}<span>{key==='Todos'?club.players.length:counts[key]}</span></button>)}</div><label className="sort"><SlidersHorizontal size={15}/><select aria-label="Ordenar jogadores" value={sort} onChange={e=>setSort(e.target.value)}><option value="position">Posição</option><option value="name">Nome A–Z</option><option value="age">Mais jovens</option></select></label></div>
          <div className="table-scroll"><table><thead><tr><th className="number-col">Nº</th><th>JOGADOR <ArrowDown size={11}/></th><th>POSIÇÃO</th><th>IDADE</th><th className="nationality-col">NACIONALIDADE</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td className="number-col">{p.number || '—'}</td><td><button className="player-button" onClick={()=>setDialog(p)}><span className={`player-monogram ${position(p)}`}>{p.name.split(' ').filter(Boolean).map(w=>w[0]).filter((_,i,a)=>i===0||i===a.length-1).join('')}</span><span>{p.name}</span></button></td><td><span className={`position ${position(p)}`}>{position(p)}</span></td><td>{age(p)??'—'}<span className="age-unit">{age(p)!==null?' anos':''}</span></td><td className="nationality-col"><span className="country-code">{p.countryCode||'—'}</span>{country(p)}</td><td><button className="row-detail" aria-label={`Ver ficha de ${p.name}`} onClick={()=>setDialog(p)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table>{!players.length&&<div className="empty"><Search size={28}/><h3>Nenhum jogador encontrado</h3><p>Tente outro nome ou uma posição diferente.</p><button onClick={()=>{setPlayerSearch('');setFilter('Todos');}}>Limpar filtros</button></div>}</div><div className="table-footer"><span>Exibindo {players.length} de {club.players.length} jogadores</span><span>Clique no nome para ver a ficha <ChevronRight size={13}/></span></div>
          </div><div className="data-note"><Shield size={15}/><p>Elenco da temporada · Fonte: ESPN. A base pode incluir atletas transferidos.</p><button onClick={()=>setDialog('data')}>Sobre os dados <ArrowRight size={13}/></button></div>
          </div>
          {tab==='dashboard'&&<ClubDashboard career={career} club={club} clubs={careerClubs} Crest={Crest} onNavigate={setTab} canManage={saved===club.id} onChoose={openClubSetup}/>}
          <div hidden={tab!=='match'}><MatchSimulation key={club.id} isVisible={tab==='match'} club={club} clubs={careerClubs} Crest={Crest} career={career} onCareerChange={saveCareer} canManage={saved===club.id} onChoose={openClubSetup}/></div> {tab==='standings'&&<LeagueTable clubs={careerClubs} focusClubId={club.id} Crest={Crest} career={career}/>} {tab==='transfers'&&<TransferMarket career={career} onCareerChange={saveCareer} club={club} clubs={careerClubs} baseClubs={data.clubs} Crest={Crest} canManage={saved===club.id}/>} {(tab==='trophies'||tab==='sponsors')&&<Management key={club.id+'-'+tab} club={club} tab={tab} career={career} onCareerChange={saveCareer} canManage={saved===club.id} onChoose={openClubSetup} Modal={Modal} storageError={careerStorageError} standings={careerStandings}/>} {tab==='legacy'&&<Legacy club={club} clubs={careerClubs} career={career}/>}
        </section>
      </div><footer className="page-footer"><span>LINHA DE FRENTE <b>/</b> O futebol começa nas suas decisões.</span><span>beta00 <span className="footer-dot">·</span> 2026</span></footer>
    </main>
    {dialog==='data'&&<Modal title="Sobre os dados" onClose={()=>setDialog(null)}><span className="modal-icon"><Shield/></span><div className="eyebrow">TRANSPARÊNCIA</div><h2>Futebol real. Base consultável.</h2><p>Os 20 clubes e seus elencos vêm dos cadastros de temporada da ESPN, consultados em <strong>{displayDate}</strong>. A tela usa uma cópia local dessa consulta.</p><p>{data.note} Idades se referem à data da consulta. Dados ausentes aparecem como “—”.</p><p>Partidas, classificação, artilharia, caixa, patrocínios e transferências compartilham o mesmo save local. Receitas e valores de mercado usam referências públicas; orçamento disponível e negociações são modelagens de gameplay, não saldos contábeis oficiais.</p><a className="primary" href={club.sourcePage} target="_blank" rel="noreferrer">Consultar elenco na ESPN <ArrowRight size={17}/></a></Modal>}
    {dialog==='manager'&&<Modal title="Definir técnico" onClose={()=>setDialog(null)}><Crest club={club} large/><div className="eyebrow">COMANDO TÉCNICO</div><h2>Quem comandará o {club.name}?</h2><p>Esse nome ficará vinculado à carreira deste clube no seu navegador.</p><label className="manager-name-field"><span>Nome do técnico</span><input autoFocus maxLength="40" value={managerNameInput} onChange={e=>setManagerNameInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&managerNameInput.trim())confirmClub();}} placeholder="Digite o nome do técnico"/></label><button className="primary manager-confirm" disabled={!managerNameInput.trim()} onClick={confirmClub}>{saved===club.id?'Salvar técnico':'Assumir o clube'} <ArrowRight size={18}/></button></Modal>}
    {dialog==='confirmed'&&<Modal title="Clube escolhido" onClose={()=>setDialog(null)}><Crest club={club} large/><div className="eyebrow">COMANDO DEFINIDO</div><h2>{managerNameInput.trim()}, você assume o {club.name}.</h2><p>{storageError?'A carreira está ativa nesta sessão.':'Clube e técnico foram salvos neste navegador.'}</p><div className="next-step"><strong>A temporada está pronta.</strong><p>Gerencie escalação, partidas, transferências, finanças e a história do clube.</p></div><button className="primary" onClick={()=>{setDialog(null);setTab('dashboard');}}>Ir para a temporada <ArrowRight size={18}/></button></Modal>}
    {dialog&&typeof dialog==='object'&&<Modal title={`Ficha de ${dialog.name}`} onClose={()=>setDialog(null)}><div className="player-modal-club"><Crest club={club}/><span>{club.name} · 2026</span></div><span className={`position ${position(dialog)}`}>{labels[position(dialog)]}</span><h2>{dialog.name}</h2><div className="player-facts"><div><small>Camisa</small><strong>{dialog.number||'—'}</strong></div><div><small>Idade na consulta</small><strong>{age(dialog)!==null?`${age(dialog)} anos`:'—'}</strong></div><div><small>Nacionalidade</small><strong>{country(dialog)}</strong></div><div><small>Altura</small><strong>{dialog.heightCm?`${dialog.heightCm} cm`:'—'}</strong></div></div><p className="fineprint">Cadastro da ESPN · Consulta de {displayDate}. Vínculo atual sujeito à confirmação.</p><button className="primary" onClick={()=>setDialog(null)}>Voltar ao elenco <ArrowRight size={17}/></button></Modal>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
