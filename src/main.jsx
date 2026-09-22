import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Flag, Handshake, Search, Shield, SlidersHorizontal, Trophy, Users, X } from 'lucide-react';
import data from './data/serie-a-2026.json';
import '@fontsource-variable/dm-sans/index.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import Management from './Management';
import { STORAGE_KEY, emptyClub, sanitizeState } from './management-model';

const groups = { Goalkeeper: 'GOL', Defender: 'DEF', Midfielder: 'MEI', Forward: 'ATA', Attacker: 'ATA' };
const labels = { GOL: 'Goleiro', DEF: 'Defensor', MEI: 'Meio-campista', ATA: 'Atacante', NI: 'Não informada' };
const categories = [['Todos', 'Todo o elenco'], ['GOL', 'Goleiros'], ['DEF', 'Defensores'], ['MEI', 'Meias'], ['ATA', 'Atacantes']];
const locations = {'3458':'Curitiba, PR','7632':'Belo Horizonte, MG','9967':'Salvador, BA','6086':'Rio de Janeiro, RJ','9318':'Chapecó, SC','874':'São Paulo, SP','3456':'Curitiba, PR','2022':'Belo Horizonte, MG','819':'Rio de Janeiro, RJ','3445':'Rio de Janeiro, RJ','6273':'Porto Alegre, RS','1936':'Porto Alegre, RS','9169':'Mirassol, SP','2029':'São Paulo, SP','6079':'Bragança Paulista, SP','4936':'Belém, PA','2674':'Santos, SP','2026':'São Paulo, SP','3454':'Rio de Janeiro, RJ','3457':'Salvador, BA'};
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const position = p => groups[p.position] || 'NI';
const snapshotDate = new Date(data.fetchedAt);
const displayDate = snapshotDate.toLocaleDateString('pt-BR', {timeZone:'UTC'});
const countryNames = new Intl.DisplayNames(['pt-BR'], { type:'region' });
const codes = {GHA:'GH',MOR:'MA',UKR:'UA',GUI:'GN',PAN:'PA',RDC:'CD',ENG:'GB',NED:'NL',CRO:'HR',SWE:'SE',CRM:'CM',ARG:'AR',BRA:'BR',URU:'UY',COL:'CO',PAR:'PY',CHI:'CL',CHL:'CL',ECU:'EC',VEN:'VE',PER:'PE',BOL:'BO',POR:'PT',PRT:'PT',ESP:'ES',FRA:'FR',ITA:'IT',USA:'US',MEX:'MX',SUI:'CH',CHE:'CH',GER:'DE',DEU:'DE',DEN:'DK',DNK:'DK',ANG:'AO',CMR:'CM',CPV:'CV'};
const country = p => codes[p.countryCode] ? countryNames.of(codes[p.countryCode]) : p.nationality || 'Não informada';
function age(p) { if(!p.birthDate) return p.age ?? null; const dob=new Date(p.birthDate); if(Number.isNaN(dob.getTime())) return p.age ?? null; let a=snapshotDate.getUTCFullYear()-dob.getUTCFullYear(); if(snapshotDate.getUTCMonth()<dob.getUTCMonth() || (snapshotDate.getUTCMonth()===dob.getUTCMonth() && snapshotDate.getUTCDate()<dob.getUTCDate())) a--; return a; }
function readSaved() { try { const id=localStorage.getItem('ldf.club'); return data.clubs.some(c=>c.id===id)? id:null; } catch { return null; } }
function Crest({club, large=false}) { const [failed,setFailed]=useState(false); useEffect(()=>setFailed(false),[club.id]); return <span className={`crest ${large?'large':''}`}>{club.logo && !failed ? <img src={club.logo} alt={`Escudo do ${club.name}`} onError={()=>setFailed(true)}/> : <span className="crest-fallback">{club.abbreviation}</span>}</span>; }
function Modal({children,onClose,title}) { const ref=useRef(); useEffect(()=>{ const el=ref.current; el.showModal(); return ()=>el.close(); },[]); return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}} aria-label={title}><button className="close" onClick={onClose} aria-label="Fechar"><X size={20}/></button>{children}</dialog>; }
function loadManagement() { try { return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)), data.clubs.map(c=>c.id)); } catch { return {}; } }
function App() {
  const [tab,setTab]=useState('roster');
  const [management,setManagement]=useState(loadManagement);
  const [managementStorageError,setManagementStorageError]=useState(false);
  const [saved,setSaved]=useState(readSaved);
  const [selected,setSelected]=useState(()=>readSaved()||'2029');
  const [clubSearch,setClubSearch]=useState('');
  const [playerSearch,setPlayerSearch]=useState('');
  const [filter,setFilter]=useState('Todos');
  const [sort,setSort]=useState('position');
  const [dialog,setDialog]=useState(null);
  const [storageError,setStorageError]=useState(false);
  const [mobileSquad,setMobileSquad]=useState(false);
  const club=data.clubs.find(c=>c.id===selected)||data.clubs[0];
  const savedClub=data.clubs.find(c=>c.id===saved);
  const clubs=data.clubs.filter(c=>normalize(c.name+' '+c.abbreviation).includes(normalize(clubSearch)));
  const counts=Object.fromEntries(['GOL','DEF','MEI','ATA','NI'].map(k=>[k,club.players.filter(p=>position(p)===k).length]));
  const ages=club.players.map(age).filter(a=>a!==null);
  const meanAge=ages.length ? (ages.reduce((a,b)=>a+b,0)/ages.length).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
  const players=useMemo(()=>club.players.filter(p=>(filter==='Todos'||position(p)===filter) && normalize(p.name).includes(normalize(playerSearch))).sort((a,b)=>{
    if(sort==='age') return (age(a)??999)-(age(b)??999)||a.name.localeCompare(b.name,'pt-BR');
    if(sort==='name') return a.name.localeCompare(b.name,'pt-BR');
    const order={GOL:0,DEF:1,MEI:2,ATA:3,NI:4}; return order[position(a)]-order[position(b)] || a.name.localeCompare(b.name,'pt-BR');
  }),[club,filter,playerSearch,sort]);
  function selectClub(id) {setSelected(id);setPlayerSearch('');setFilter('Todos');setDialog(null);setMobileSquad(true);}
  function updateManagement(transform) {
    const next={...management,[club.id]:transform(management[club.id]||emptyClub())};
    setManagement(next);
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setManagementStorageError(false); } catch {setManagementStorageError(true);}
  }
  function confirmClub() {setSaved(club.id);try{localStorage.setItem('ldf.club',club.id);setStorageError(false);}catch{setStorageError(true);}setDialog('confirmed');}
  return <>
    <header className="topbar"><a href="#" className="brand" aria-label="Linha de Frente, início"><span className="brand-symbol">L<span>F</span></span><span>LINHA DE<br/>FRENTE<span className="brand-small">FOOTBALL MANAGER</span></span></a><div className="top-context"><span className="top-divider"/><span>Uma nova história começa aqui.</span></div><div className="top-right"><span className="version"><i/> PRÉ-TEMPORADA · v0.2</span><button className="help" onClick={()=>setDialog('data')} aria-label="Sobre os dados"><CircleHelp size={20}/></button></div></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span>01 /</span> O PRIMEIRO PASSO</div><h1>Seu clube. Sua história.</h1><p>Escolha as cores que você vai defender. Conheça quem entra em campo.</p></div><div className="competition"><span className="trophy-icon"><Trophy size={25}/></span><div><strong>BRASILEIRÃO</strong><span>Série A <b>·</b> Temporada {data.season}</span></div><span className="brazil-tag">BR</span></div></section>
      {savedClub && <div className="saved-banner" role="status"><Check size={16}/><span>Seu clube: <strong>{savedClub.name}</strong>. {storageError?'Escolha válida nesta sessão.':'Escolha salva neste navegador.'}</span><button onClick={()=>{selectClub(savedClub.id);setTab('roster');}}>Ver elenco <ArrowRight size={15}/></button></div>}
      <div className={`workspace ${mobileSquad?'show-squad':''}`}>
        <aside className="club-panel"><div className="section-heading"><h2>Escolha seu clube</h2><span className="count">20</span></div><label className="search-box club-search"><Search size={17}/><input placeholder="Buscar clube..." aria-label="Buscar clube" value={clubSearch} onChange={e=>setClubSearch(e.target.value)}/>{clubSearch&&<button onClick={()=>setClubSearch('')} aria-label="Limpar busca de clubes"><X size={15}/></button>}</label><div className="club-grid">{clubs.map(c=><button key={c.id} className={`club-card ${c.id===club.id?'active':''}`} onClick={()=>selectClub(c.id)} aria-pressed={c.id===club.id}><Crest club={c}/><span>{c.name}</span>{c.id===club.id&&<span className="selected-dot"><Check size={10}/></span>}</button>)}</div>{!clubs.length&&<div className="club-empty">Nenhum clube encontrado.<button onClick={()=>setClubSearch('')}>Limpar busca</button></div>}<div className="league-footer"><Flag size={14}/><span>20 clubes. Infinitas possibilidades.</span></div></aside>
        <section className="squad-panel" aria-label={`Painel do ${club.name}`}>
          <button className="mobile-back" onClick={()=>setMobileSquad(false)}><ArrowLeft size={16}/> Trocar clube</button>
          <div className="club-hero"><div className="hero-line"/><div className="hero-main"><Crest club={club} large/><div className="hero-title"><div className="eyebrow">{locations[club.id]}</div><h2>{club.name}</h2><span className="division"><span/> Brasileirão Série A · 2026</span></div></div><div className="hero-action"><span>O próximo capítulo pode ser seu.</span><button className="primary" onClick={confirmClub}>{saved===club.id?'Clube escolhido':'Escolher este clube'}{saved===club.id?<Check size={18}/>:<ArrowRight size={18}/>}</button></div><div className="pitch-art" aria-hidden="true"><i/><b/><em/></div></div>
          <nav className="club-navigation" aria-label="Áreas do clube">{[['roster','Elenco',Users],['trophies','Troféus',Trophy],['sponsors','Patrocínios',Handshake]].map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
          <div hidden={tab!=='roster'}>
          <div className="stats"><div><Users size={19}/><span><strong>{club.players.length}</strong><small>Jogadores na base</small></span></div><div><span className="stat-glyph">Ø</span><span><strong>{meanAge}<em> anos</em></strong><small>Idade média</small></span></div><div><Flag size={19}/><span><strong>{new Set(club.players.map(p=>p.nationality).filter(Boolean)).size}</strong><small>Nacionalidades</small></span></div><div className="snapshot-stat"><span className="status-dot"/><span><strong>Temporada 2026</strong><small>Base consultada em {displayDate}</small></span></div></div>
          <div className="roster-content"><div className="roster-heading"><div><div className="eyebrow">DENTRO DAS QUATRO LINHAS</div><h2>Conheça o elenco<span>{club.players.length}</span></h2></div><label className="search-box player-search"><Search size={17}/><input placeholder="Buscar jogador..." aria-label="Buscar jogador" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}/>{playerSearch&&<button onClick={()=>setPlayerSearch('')} aria-label="Limpar busca de jogadores"><X size={15}/></button>}</label></div>
          <div className="toolbar"><div className="position-tabs" aria-label="Filtrar por posição">{categories.map(([key,label])=><button key={key} className={filter===key?'current':''} onClick={()=>setFilter(key)} aria-pressed={filter===key}>{label}<span>{key==='Todos'?club.players.length:counts[key]}</span></button>)}</div><label className="sort"><SlidersHorizontal size={15}/><select aria-label="Ordenar jogadores" value={sort} onChange={e=>setSort(e.target.value)}><option value="position">Posição</option><option value="name">Nome A–Z</option><option value="age">Mais jovens</option></select></label></div>
          <div className="table-scroll"><table><thead><tr><th className="number-col">Nº</th><th>JOGADOR <ArrowDown size={11}/></th><th>POSIÇÃO</th><th>IDADE</th><th className="nationality-col">NACIONALIDADE</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td className="number-col">{p.number || '—'}</td><td><button className="player-button" onClick={()=>setDialog(p)}><span className={`player-monogram ${position(p)}`}>{p.name.split(' ').filter(Boolean).map(w=>w[0]).filter((_,i,a)=>i===0||i===a.length-1).join('')}</span><span>{p.name}</span></button></td><td><span className={`position ${position(p)}`}>{position(p)}</span></td><td>{age(p)??'—'}<span className="age-unit">{age(p)!==null?' anos':''}</span></td><td className="nationality-col"><span className="country-code">{p.countryCode||'—'}</span>{country(p)}</td><td><button className="row-detail" aria-label={`Ver ficha de ${p.name}`} onClick={()=>setDialog(p)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table>{!players.length&&<div className="empty"><Search size={28}/><h3>Nenhum jogador encontrado</h3><p>Tente outro nome ou uma posição diferente.</p><button onClick={()=>{setPlayerSearch('');setFilter('Todos');}}>Limpar filtros</button></div>}</div><div className="table-footer"><span>Exibindo {players.length} de {club.players.length} jogadores</span><span>Clique no nome para ver a ficha <ChevronRight size={13}/></span></div>
          </div><div className="data-note"><Shield size={15}/><p>Elenco da temporada · Fonte: ESPN. A base pode incluir atletas transferidos.</p><button onClick={()=>setDialog('data')}>Sobre os dados <ArrowRight size={13}/></button></div>
          </div>
          {tab!=='roster'&&<Management key={`${club.id}-${tab}`} club={club} tab={tab} state={management[club.id]||emptyClub()} update={updateManagement} canManage={saved===club.id} onChoose={confirmClub} Modal={Modal} storageError={managementStorageError}/>}
        </section>
      </div><footer className="page-footer"><span>LINHA DE FRENTE <b>/</b> O futebol começa nas suas decisões.</span><span>Protótipo de gestão de clubes <span className="footer-dot">·</span> 2026</span></footer>
    </main>
    {dialog==='data'&&<Modal title="Sobre os dados" onClose={()=>setDialog(null)}><span className="modal-icon"><Shield/></span><div className="eyebrow">TRANSPARÊNCIA</div><h2>Futebol real. Base consultável.</h2><p>Os 20 clubes e seus elencos vêm dos cadastros de temporada da ESPN, consultados em <strong>{displayDate}</strong>. A tela usa uma cópia local dessa consulta.</p><p>{data.note} Idades se referem à data da consulta. Dados ausentes aparecem como “—”.</p><p>Esta etapa permite consultar jogadores, testar a galeria de troféus e assinar patrocínios fictícios. Conquistas de teste não representam o histórico real dos clubes. Partidas, mercado e investimentos ainda não estão disponíveis.</p><a className="primary" href={club.sourcePage} target="_blank" rel="noreferrer">Consultar elenco na ESPN <ArrowRight size={17}/></a></Modal>}
    {dialog==='confirmed'&&<Modal title="Clube escolhido" onClose={()=>setDialog(null)}><Crest club={club} large/><div className="eyebrow">AS SUAS CORES ESTÃO DEFINIDAS</div><h2>Você escolheu o {club.name}.</h2><p>{storageError?'Seu clube foi escolhido nesta sessão. O navegador não permitiu salvar a preferência.':'Sua escolha foi salva neste navegador. Você pode trocar de clube a qualquer momento.'}</p><div className="next-step"><strong>Primeira etapa: conhecer a equipe.</strong><p>Explore o elenco, a galeria de troféus e as propostas de patrocínio. Partidas e movimentação de caixa ainda não estão disponíveis.</p></div><button className="primary" onClick={()=>setDialog(null)}>Explorar elenco <ArrowRight size={18}/></button></Modal>}
    {dialog&&typeof dialog==='object'&&<Modal title={`Ficha de ${dialog.name}`} onClose={()=>setDialog(null)}><div className="player-modal-club"><Crest club={club}/><span>{club.name} · 2026</span></div><span className={`position ${position(dialog)}`}>{labels[position(dialog)]}</span><h2>{dialog.name}</h2><div className="player-facts"><div><small>Camisa</small><strong>{dialog.number||'—'}</strong></div><div><small>Idade na consulta</small><strong>{age(dialog)!==null?`${age(dialog)} anos`:'—'}</strong></div><div><small>Nacionalidade</small><strong>{country(dialog)}</strong></div><div><small>Altura</small><strong>{dialog.heightCm?`${dialog.heightCm} cm`:'—'}</strong></div></div><p className="fineprint">Cadastro da ESPN · Consulta de {displayDate}. Vínculo atual sujeito à confirmação.</p><button className="primary" onClick={()=>setDialog(null)}>Voltar ao elenco <ArrowRight size={17}/></button></Modal>}
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
