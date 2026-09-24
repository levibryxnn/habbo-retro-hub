import React,{useMemo,useRef,useState}from'react';
import { Archive, ArrowRight, BookOpen, Download, FileUp, Landmark, Newspaper, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';
import { careerNews, difficultyProfile, dynamicRivalries, managerCareerSummary, managerProfile, promoteAcademyProspect, resolvePressConference } from './career-dynamics.js';
import { financeHealth } from './economy-engine.js';
import { worldClub, worldCompetitionList } from './competition-engine.js';
import { parseCareerSave, saveFileName, serializeCareerSave } from './save-format.js';
import WorldCrest from './WorldCrest.jsx';
import './career-center.css';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

function SavePanel({career,club,onImportCareer}){
  const input=useRef(null),[notice,setNotice]=useState('');
  function download(){
    try{
      const blob=new Blob([serializeCareerSave(career,club)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=saveFileName(career,club);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Backup criado. Guarde o arquivo .ldf onde preferir.');
    }catch{setNotice('Não foi possível criar o arquivo neste navegador.');}
  }
  async function load(file){
    if(!file)return;
    try{const payload=parseCareerSave(await file.text());await onImportCareer?.(payload);setNotice('Save carregado com sucesso.');}
    catch(error){setNotice(error?.message||'Não foi possível carregar este save.');}
    if(input.current)input.current.value='';
  }
  return <section className="center-save">
    <div className="center-section-head"><div><Archive size={18}/><span><small>BACKUP PORTÁTIL</small><strong>Seu save pertence a você</strong></span></div></div>
    <p>O autosave continua no navegador. O arquivo <b>.ldf</b> é uma cópia pequena da carreira: você pode guardar, transferir para outro navegador e restaurar mesmo depois de limpar o histórico.</p>
    <div className="save-actions"><button onClick={download}><Download size={16}/> Baixar save .ldf</button><button className="secondary-save" onClick={()=>input.current?.click()}><FileUp size={16}/> Carregar save</button><input ref={input} type="file" accept=".ldf,application/json" hidden onChange={e=>load(e.target.files?.[0])}/></div>
    {notice&&<span className="save-notice">{notice}</span>}
  </section>;
}

export default function CareerCenter({career,club,clubs,Crest,onCareerChange,onImportCareer}){
  const [tab,setTab]=useState('news'),crestFor=item=>item?.external?<WorldCrest club={item} size="mini"/>:<Crest club={item}/>;
  const news=useMemo(()=>careerNews(career),[career]),summary=useMemo(()=>managerCareerSummary(career),[career]),rivalries=useMemo(()=>dynamicRivalries(career,clubs).slice(0,8),[career,clubs]),competitions=useMemo(()=>worldCompetitionList(career,clubs),[career,clubs]),finance=financeHealth(career),difficulty=difficultyProfile(career,club),profile=managerProfile(career.managerProfile),room=career.dressingRoom||{},president=career.presidentProfile||{},dna=career.clubDNA||{},academy=career.youthAcademy||{prospects:[]};
  const tabs=[['news','Notícias',Newspaper],['club','Clube',ShieldCheck],['academy','Base',Users],['universe','Universo',Landmark],['legacy','Carreira',Trophy],['save','Save',Archive]];
  function promote(id){onCareerChange(promoteAcademyProspect(career,club,id));}
  function press(choice){onCareerChange(resolvePressConference(career,choice));}
  return <div className="career-center">
    <header className="center-heading"><div><span className="eyebrow">BASTIDORES DA CARREIRA</span><h2>Central do clube</h2><p>O que acontece no campo, no mercado e no vestiário deixa consequências no seu universo.</p></div><span className="center-reputation">Reputação <strong>{summary.reputation}</strong></span></header>
    <nav className="center-tabs">{tabs.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={15}/>{label}</button>)}</nav>

    {career.pressConference&&<section className="press-card"><div><span className="eyebrow">IMPRENSA</span><h3>Uma resposta pode mudar o ambiente.</h3><p>{career.pressConference.reason==='clássico'?'A rivalidade elevou o tom antes do próximo capítulo.':career.pressConference.reason==='decisão'?'A decisão aumentou a pressão externa.':'A sequência recente colocou o trabalho em debate.'}</p></div><div className="press-choices">{career.pressConference.choices.map(choice=><button key={choice.id} onClick={()=>press(choice.id)}><strong>{choice.label}</strong><span>{choice.copy}</span></button>)}</div></section>}

    {tab==='news'&&<section className="news-feed"><div className="center-section-head"><div><Newspaper size={18}/><span><small>REDAÇÃO DO SAVE</small><strong>Notícias do seu universo</strong></span></div><em>{news.length} registros</em></div>{news.length?<div className="news-list">{news.slice(0,30).map(item=><article key={item.id} className={'news-item importance-'+(item.importance||1)}><span>{item.type==='title'?<Trophy size={17}/>:item.type==='injury'?<ShieldCheck size={17}/>:<BookOpen size={17}/>}</span><div><small>{String(item.type||'clube').toUpperCase()} · {item.timestamp||('Rodada '+item.round)}</small><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>:<p className="center-empty">A redação começa a acompanhar a carreira assim que a bola rolar.</p>}</section>}

    {tab==='club'&&<div className="center-club-grid">
      <section className="manager-identity"><div className="center-section-head"><div><ShieldCheck size={18}/><span><small>SEU PERFIL</small><strong>{profile.name}</strong></span></div></div><p>{profile.description}</p><dl><div><dt>Reputação</dt><dd>{summary.reputation}/100</dd></div><div><dt>Dificuldade orgânica</dt><dd>{difficulty.label}</dd></div><div><dt>Torcida</dt><dd>{Math.round(career.managerConfidence?.fans||0)}%</dd></div><div><dt>Diretoria</dt><dd>{Math.round(career.managerConfidence?.board||0)}%</dd></div></dl></section>
      <section className="manager-identity"><div className="center-section-head"><div><Users size={18}/><span><small>VESTIÁRIO</small><strong>Ambiente do grupo</strong></span></div></div><div className="room-bars"><span>Ânimo <b>{Math.round(room.morale||0)}%</b><i><em style={{width:(room.morale||0)+'%'}}/></i></span><span>União <b>{Math.round(room.unity||0)}%</b><i><em style={{width:(room.unity||0)+'%'}}/></i></span></div>{Object.values(room.playerMood||{}).filter(x=>x.unhappy).slice(0,3).map(item=><p className="room-alert" key={item.name}>{item.name} está incomodado com a sequência no banco.</p>)}</section>
      <section className="manager-identity"><div className="center-section-head"><div><Landmark size={18}/><span><small>DIRETORIA</small><strong>{president.name||'Diretoria do clube'}</strong></span></div></div><p>{president.description}</p><div className="dna-tags">{(dna.labels||[]).map(item=><span key={item}>{item}</span>)}</div></section>
      <section className="manager-identity finance-health-card"><div className="center-section-head"><div><Archive size={18}/><span><small>ESTRUTURA FINANCEIRA</small><strong>{finance.label}</strong></span></div></div><dl><div><dt>Orçamento de mercado</dt><dd>{money.format(finance.budget)}</dd></div><div><dt>Espaço salarial</dt><dd>{money.format(finance.wageRoom)}/mês</dd></div><div><dt>Reinvestimento</dt><dd>{Math.round(finance.reinvestmentRate*100)}%</dd></div><div><dt>Caixa</dt><dd>{money.format(finance.cash)}</dd></div></dl></section>
    </div>}

    {tab==='academy'&&<section className="academy-panel"><div className="center-section-head"><div><Users size={18}/><span><small>CATEGORIAS DE BASE</small><strong>Geração {academy.lastIntakeSeason||career.season}</strong></span></div><em>Nível {academy.level||1}</em></div><p className="academy-intro">Cada geração é diferente. Alguns jovens têm teto alto, outros podem nunca se firmar. A avaliação não mostra o potencial exato.</p><div className="academy-grid">{(academy.prospects||[]).map(p=>{const projection=p.potential>=86?'Potencial especial':p.potential>=78?'Boa projeção':p.potential>=70?'Pode evoluir':'Em observação';return <article key={p.id} className={p.status==='promoted'?'promoted':''}><span className="academy-monogram">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><h3>{p.name}</h3><p>{p.age} anos · {p.position} · OVR atual {p.overall}</p><small>{projection}</small></div>{p.status==='academy'?<button onClick={()=>promote(p.id)}>Subir ao profissional <ArrowRight size={14}/></button>:<b>Promovido</b>}</article>})}</div></section>}

    {tab==='universe'&&<div className="universe-grid"><section><div className="center-section-head"><div><Landmark size={18}/><span><small>COMPETIÇÕES</small><strong>Universo do save</strong></span></div></div><div className="universe-competitions">{competitions.map(comp=>{const champion=comp.championId?worldClub(career,clubs,comp.championId):null;return <article key={comp.key}><div><strong>{comp.name}</strong><small>{comp.stage||'Em andamento'} · {comp.edition}</small></div>{champion?<span>{crestFor(champion)}{champion.name}</span>:<em>em disputa</em>}</article>})}</div></section><section><div className="center-section-head"><div><Sparkles size={18}/><span><small>RIVALIDADES</small><strong>Histórias que surgiram no save</strong></span></div></div>{rivalries.length?<div className="rivalry-list">{rivalries.map(item=><article key={item.clubId}><strong>{item.name}</strong><span>{item.label}</span><i><b style={{width:item.score+'%'}}/></i><small>{item.meetings} encontros · {item.userWins} vitórias suas · {item.opponentWins} do rival</small></article>)}</div>:<p className="center-empty">Rivalidades emergentes aparecerão conforme confrontos se repetirem e ganharem importância.</p>}</section></div>}

    {tab==='legacy'&&<div className="legacy-center"><section className="manager-career-card"><Crest club={club}/><span><small>CARREIRA DE {career.managerName||'TÉCNICO'}</small><strong>{summary.reputation} de reputação</strong></span><dl><div><dt>Jogos</dt><dd>{summary.matches}</dd></div><div><dt>Vitórias</dt><dd>{summary.wins}</dd></div><div><dt>Títulos</dt><dd>{summary.titles}</dd></div><div><dt>Temporadas</dt><dd>{summary.seasons}</dd></div></dl></section><section><div className="center-section-head"><div><Trophy size={18}/><span><small>HALL DA FAMA DO SAVE</small><strong>Quem marcou a sua história</strong></span></div></div>{career.hallOfFame?.players?.length?<div className="hof-list">{career.hallOfFame.players.map(item=><article key={item.name+'-'+item.season}><strong>{item.name}</strong><span>{item.reason} · {item.season}</span><b>{item.rating?.toFixed?.(2)||item.rating}</b></article>)}</div>:<p className="center-empty">O Hall da Fama começa a ganhar nomes após temporadas completas.</p>}{career.hallOfFame?.moments?.slice(0,8).map(item=><p className="historic-moment" key={item.id}><b>{item.title}</b> · {item.text}</p>)}</section></div>}

    {tab==='save'&&<SavePanel career={career} club={club} onImportCareer={onImportCareer}/>}
  </div>;
}
