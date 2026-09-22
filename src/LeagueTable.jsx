import React, {useMemo} from 'react';
import { FlaskConical, Info, ShieldAlert, Trophy } from 'lucide-react';
import {buildDemoStandings, leagueRules} from './league-model';
import './league.css';

function signed(n){ return n>0?`+${n}`:String(n); }

export default function LeagueTable({clubs,focusClubId,Crest}) {
  const rows=useMemo(()=>buildDemoStandings(clubs),[clubs]);
  return <div className="league-content">
    <div className="league-heading">
      <div>
        <div className="eyebrow">A CORRIDA PELO TÍTULO</div>
        <h2>Classificação do Brasileirão</h2>
        <p>20 clubes, 38 rodadas e cada ponto muda a temporada.</p>
      </div>
      <span className="lab-badge"><FlaskConical size={13}/> Laboratório</span>
    </div>

    <section className="league-overview" aria-label="Resumo da competição">
      <div className="league-trophy"><Trophy size={27}/></div>
      <div>
        <span className="eyebrow">BRASILEIRÃO SÉRIE A · 2026</span>
        <h3>Tabela pronta para receber a engine.</h3>
        <p>Os números abaixo são uma simulação visual de 12 rodadas para testar classificação, zonas e desempates.</p>
      </div>
      <div className="league-round"><strong>12</strong><span>/ 38 rodadas</span></div>
    </section>

    <div className="league-rules" aria-label="Zonas da classificação">
      {leagueRules.map(rule=><div className={`rule-chip ${rule.tone}`} key={rule.id}><i/><span><strong>{rule.range}</strong>{rule.label.replace(/^.*?·\s*/,'')}</span></div>)}
    </div>

    <div className="league-table-wrap">
      <table className="league-table">
        <thead><tr><th>POS</th><th>CLUBE</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>%</th><th>FAIXA</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.club.id} className={`zone-${row.zone.id} ${row.club.id===focusClubId?'focus-club':''}`}>
          <td className="league-position"><span className="zone-line"/><strong>{row.position}</strong></td>
          <td><div className="league-club"><Crest club={row.club}/><span>{row.club.name}</span>{row.club.id===focusClubId&&<small>em foco</small>}</div></td>
          <td className="points"><strong>{row.points}</strong></td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td className={row.goalDifference>0?'positive':row.goalDifference<0?'negative':''}>{signed(row.goalDifference)}</td><td>{row.efficiency}</td>
          <td><span className={`zone-badge ${row.zone.id}`} title={row.zone.detail}>{row.zone.short}</span></td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="league-footnotes">
      <div><Info size={15}/><p><strong>Regra-base de 2026:</strong> 1º a 4º vão à fase de grupos da Libertadores; o 5º vai à fase preliminar. A Sul-Americana recebe os seis melhores que não estiverem classificados à Libertadores, por isso a faixa exibida como 6º–11º pode se deslocar conforme Copa do Brasil e títulos continentais.</p></div>
      <div><ShieldAlert size={15}/><p><strong>Protótipo:</strong> esta tabela ainda não representa partidas jogadas no save. A ordem e os números são dados fictícios para validação visual; a próxima engine poderá entregar resultados e recalcular tudo automaticamente.</p></div>
    </div>
  </div>;
}
