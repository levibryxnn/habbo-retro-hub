import React,{useMemo,useState}from'react';
import{CalendarDays,ChevronRight,Globe2,Play,Shield,Trophy}from'lucide-react';
import WorldCrest from './WorldCrest.jsx';
import{competitionTable,nextCareerEvent,pendingSeasonFixtures,playNextWorldFixture,worldClub,worldCompetitionList}from'./competition-engine.js';
import'./competition.css';

const fmtDate=value=>{try{return new Date(value+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');}catch{return value;}};
function statusFor(comp,user){
  const id=String(user);
  if(comp.championId===id)return'Campeão';
  if(comp.eliminated?.includes(id))return'Eliminado';
  if(comp.teams?.includes(id))return comp.stage||'Em disputa';
  return'Acompanhamento';
}
function scoreLine(result,clubs,career){
  if(!result)return'';
  const h=worldClub(career,clubs,result.homeId),a=worldClub(career,clubs,result.awayId);
  return h.abbreviation+' '+result.homeGoals+' × '+result.awayGoals+' '+a.abbreviation;
}
export default function CompetitionHub({career,clubs,onCareerChange,onNavigate}){
  const comps=useMemo(()=>worldCompetitionList(career,clubs),[career,clubs]),next=useMemo(()=>nextCareerEvent(career,clubs),[career,clubs]);
  const [selected,setSelected]=useState(()=>comps.find(c=>c.teams?.includes(String(career.userClubId)))?.key||comps[0]?.key);
  const comp=comps.find(c=>c.key===selected)||comps[0],remaining=pendingSeasonFixtures(career,clubs);
  const table=comp&&['league','group'].includes(comp.stage)||comp?.format==='ucl-league'?competitionTable(comp):[];
  const userId=String(career.userClubId),last=career.world?.lastUserMatch;
  function playNext(){
    if(next?.type==='brasileirao'){onNavigate?.('match');return;}
    if(next?.type==='world')onCareerChange(playNextWorldFixture(career,clubs));
  }
  return <div className="competition-hub">
    <header className="competition-heading"><div><span className="eyebrow">CALENDÁRIO INTEGRADO</span><h2>A temporada inteira em um só lugar</h2><p>Estadual, Brasileirão, Copa do Brasil e torneios continentais avançam no mesmo calendário. A Europa roda em segundo plano para alimentar o Mundial.</p></div><span className="competition-season"><CalendarDays size={15}/> {career.season}</span></header>

    <section className="next-event-card">
      <div className="next-event-icon"><Play size={19}/></div><div className="next-event-copy"><small>PRÓXIMO COMPROMISSO</small><strong>{next?next.competitionName:'Temporada concluída'}</strong><span>{next?fmtDate(next.date)+' · '+next.stage:'Nenhuma partida pendente neste ano.'}</span></div>
      {next&&<button onClick={playNext}>{next.type==='brasileirao'?'Abrir partida':'Simular compromisso'}<ChevronRight size={16}/></button>}
    </section>

    {last&&<section className="competition-last"><small>ÚLTIMO JOGO FORA DO BRASILEIRÃO</small><strong>{last.competitionName} · {last.stage}</strong><span>{scoreLine(last,clubs,career)}</span></section>}

    <div className="competition-layout">
      <aside className="competition-list">{comps.map(item=>{
        const st=statusFor(item,userId),champ=item.championId?worldClub(career,clubs,item.championId):null;
        return <button key={item.key} className={item.key===comp?.key?'active':''} onClick={()=>setSelected(item.key)}>
          <span className="competition-list-icon">{item.type==='world'?<Globe2 size={16}/>:item.championId?<Trophy size={16}/>:<Shield size={16}/>}</span>
          <span><strong>{item.name}</strong><small>{item.edition}{item.id==='champions-league'?'/'+String(item.edition+1).slice(-2):''} · {st}</small></span>
          {champ&&<WorldCrest club={champ} size="mini"/>}
        </button>;
      })}</aside>
      {comp&&<main className="competition-detail">
        <div className="competition-detail-head"><div><span className="eyebrow">{comp.type==='state'?'ESTADUAL':comp.type==='continental'?'CONMEBOL':comp.type==='europe'?'EUROPA':comp.type==='world'?'MUNDIAL':'NACIONAL'}</span><h3>{comp.name}</h3><p>{comp.stage==='Encerrada'?'Competição encerrada.':comp.stage||'Em andamento'} · {comp.teams.length} clubes</p></div><strong className={'competition-status '+statusFor(comp,userId).toLowerCase().replace(/\s/g,'-')}>{statusFor(comp,userId)}</strong></div>

        {comp.championId&&<div className="competition-champion"><Trophy size={19}/><WorldCrest club={worldClub(career,clubs,comp.championId)}/><span><small>CAMPEÃO</small><strong>{worldClub(career,clubs,comp.championId).name}</strong></span></div>}

        {table.length>0&&<div className="competition-table-wrap"><table className="competition-mini-table"><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>SG</th></tr></thead><tbody>{table.map(row=>{const c=worldClub(career,clubs,row.clubId);return <tr key={row.clubId} className={row.clubId===userId?'user-row':''}><td>{row.position}</td><td><WorldCrest club={c} size="mini"/><span>{c.name}</span></td><td><strong>{row.points}</strong></td><td>{row.played}</td><td>{row.goalDifference>0?'+':''}{row.goalDifference}</td></tr>;})}</tbody></table></div>}

        <section className="competition-fixtures"><div className="competition-subhead"><strong>Partidas e chaveamento</strong><span>{comp.results.length} resultados</span></div>{comp.fixtures.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-20).map(game=>{
          const h=worldClub(career,clubs,game.homeId),a=worldClub(career,clubs,game.awayId),result=comp.results.find(r=>r.fixtureId===game.id);
          return <article key={game.id} className={(game.homeId===userId||game.awayId===userId)?'user-fixture':''}><time>{fmtDate(game.date)}</time><small>{game.stage}</small><div><span><WorldCrest club={h} size="mini"/>{h.abbreviation}</span><strong>{result?result.homeGoals:'–'} × {result?result.awayGoals:'–'}</strong><span>{a.abbreviation}<WorldCrest club={a} size="mini"/></span></div></article>;
        })}</section>
      </main>}
    </div>
    {career.round>=38&&remaining.length>0&&<div className="season-open-note"><CalendarDays size={16}/><span><strong>O Brasileirão terminou, mas a temporada ainda não.</strong><small>Você ainda tem {remaining.length} compromisso{remaining.length===1?'':'s'} antes do relatório final.</small></span></div>}
  </div>;
}
