import React, { useMemo } from 'react';
import { Info, Trophy } from 'lucide-react';
import { leagueRules, zoneForPosition } from './league-model';
import { standingsFromResults, topScorers } from './career-engine';
import './league.css';

function signed(value){ return value>0 ? '+'+value : String(value); }

export default function LeagueTable({clubs,focusClubId,Crest,career}) {
  const rows=useMemo(function(){
    return standingsFromResults(career.results,clubs).map(function(row){
      return { ...row, zone:zoneForPosition(row.position), club:clubs.find(function(club){return club.id===row.clubId;}) };
    });
  },[career.results,clubs]);
  const leaders=topScorers(career.scorers,5);
  const finished=career.round>=38;
  const champion=finished?rows[0]?.club:null;

  return <div className="league-content">
    <div className="league-heading">
      <div>
        <div className="eyebrow">A CORRIDA PELO TÍTULO</div>
        <h2>Classificação do Brasileirão</h2>
        <p>A tabela agora é alimentada pelas partidas simuladas do seu save.</p>
      </div>
      <span className="stage-two-badge"><Trophy size={13}/> Temporada {career.season}</span>
    </div>

    <section className="league-overview" aria-label="Resumo da competição">
      <div className="league-trophy"><Trophy size={27}/></div>
      <div>
        <span className="eyebrow">BRASILEIRÃO SÉRIE A · {career.season}</span>
        <h3>{finished ? champion?.name+' é o campeão.' : 'Cada rodada muda a história.'}</h3>
        <p>{finished ? 'Temporada encerrada após 38 rodadas. O campeão já recebeu sua conquista no sistema.' : 'Todos contra todos em turno e returno. Resultados, gols e pontuação são calculados pela engine.'}</p>
      </div>
      <div className="league-round"><strong>{career.round}</strong><span>/ 38 rodadas</span></div>
    </section>

    <div className="league-rules" aria-label="Zonas da classificação">
      {leagueRules.map(function(rule){return <div className={'rule-chip '+rule.tone} key={rule.id}><i/><span><strong>{rule.range}</strong>{rule.label.replace(/^.*?·\s*/,'')}</span></div>;})}
    </div>

    <div className="league-table-wrap">
      <table className="league-table">
        <thead><tr><th>POS</th><th>CLUBE</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>%</th><th>FAIXA</th></tr></thead>
        <tbody>{rows.map(function(row){return <tr key={row.clubId} className={'zone-'+row.zone.id+' '+(row.clubId===focusClubId?'focus-club':'')}>
          <td className="league-position"><span className="zone-line"/><strong>{row.position}</strong></td>
          <td><div className="league-club"><Crest club={row.club}/><span>{row.club.name}</span>{row.clubId===focusClubId&&<small>seu clube</small>}</div></td>
          <td className="points"><strong>{row.points}</strong></td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td className={row.goalDifference>0?'positive':row.goalDifference<0?'negative':''}>{signed(row.goalDifference)}</td><td>{row.efficiency}</td>
          <td><span className={'zone-badge '+row.zone.id} title={row.zone.detail}>{row.zone.short}</span></td>
        </tr>;})}</tbody>
      </table>
    </div>

    <section className="league-scorers-strip">
      <div><strong>Artilharia</strong><span>{leaders.length?'Top 5 da temporada':'Ainda sem gols'}</span></div>
      {leaders.map(function(player,index){
        const club=clubs.find(function(item){return item.id===player.clubId;});
        return <article key={player.clubId+':'+player.playerId}><b>{index+1}</b><span>{player.name}<small>{club?.abbreviation||''}</small></span><strong>{player.goals}</strong></article>;
      })}
    </section>

    <div className="league-footnotes">
      <div><Info size={15}/><p><strong>Critérios:</strong> pontos, vitórias, saldo de gols e gols marcados são usados na ordenação desta versão. As zonas seguem a configuração-base do protótipo e podem ser ajustadas quando outras competições estiverem integradas.</p></div>
    </div>
  </div>;
}
