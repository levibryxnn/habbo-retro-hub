import React from 'react';
import { Award, Crown, History, LockKeyhole, Medal, Sparkles, Star, Trophy, Users } from 'lucide-react';
import { topScorers } from './career-engine';
import { brasileiraoHistoricalScorers, historicalWorldTitles, realWorldRecords } from './records-data';
import './legacy.css';

function clubName(clubs,id) {
  return clubs.find(function(club){ return club.id === id; })?.name || 'Clube';
}

function Ranking({title,items,clubs,empty}) {
  return <section className="legacy-card">
    <div className="legacy-card-title"><h3>{title}</h3><span>{items.length}</span></div>
    {items.length ? <div className="legacy-ranking">{items.map(function(item,index){
      return <div className="legacy-rank-row" key={(item.playerId || item.name) + '-' + index}>
        <strong>{index+1}</strong>
        <div><b>{item.name}</b><small>{item.clubId ? clubName(clubs,item.clubId) : item.subtitle || ''}</small></div>
        <span>{item.goals}<small> gols</small></span>
      </div>;
    })}</div> : <p className="legacy-empty">{empty}</p>}
  </section>;
}

export default function Legacy({career,club,clubs}) {
  const seasonScorers=topScorers(career.scorers,10);
  const allTime=topScorers(career.allTimeScorers,10);
  const historicalWorld=historicalWorldTitles(club.name);
  const managedWorld=(career.trophies||[]).filter(function(trophy){return trophy.id==='world';}).length;
  const managedBrazil=(career.trophies||[]).filter(function(trophy){return trophy.id==='brasileirao';}).length;

  return <div className="legacy-content">
    <div className="legacy-heading">
      <div><div className="eyebrow">A HISTÓRIA CONTINUA</div><h2>Recordes & Hall da Fama</h2><p>O que acontece no seu save passa a fazer parte da memória do clube.</p></div>
      <span className="stage-two-badge"><History size={13}/> História da carreira</span>
    </div>

    {(career.messages||[]).length>0 && <section className="legacy-messages">
      {(career.messages||[]).slice(0,4).map(function(message){
        return <article key={message.id}><Sparkles size={18}/><div><strong>{message.title}</strong><p>{message.text}</p></div></article>;
      })}
    </section>}

    <div className="record-grid">
      <article className="record-card"><Crown size={21}/><small>Referência mundial</small><strong>{realWorldRecords.worldClub.value}</strong><span>{realWorldRecords.worldClub.holder}</span><p>Recorde de títulos mundiais usado pelo sistema de marcos.</p></article>
      <article className="record-card"><Trophy size={21}/><small>Brasileirão</small><strong>{realWorldRecords.brasileiraoClub.value}</strong><span>{realWorldRecords.brasileiraoClub.holder}</span><p>Referência real de maior campeão carregada no jogo.</p></article>
      <article className="record-card"><Star size={21}/><small>Artilharia histórica</small><strong>{realWorldRecords.brasileiraoScorer.value}</strong><span>{realWorldRecords.brasileiraoScorer.holder}</span><p>Maior goleador histórico do Campeonato Brasileiro.</p></article>
      <article className="record-card personal"><Medal size={21}/><small>{club.name}</small><strong>{historicalWorld===null?'—':historicalWorld+managedWorld}</strong><span>Títulos mundiais</span><p>{historicalWorld===null?'Base histórica mundial ainda não cadastrada para este clube.':historicalWorld+' históricos + '+managedWorld+' na sua gestão.'}</p></article>
    </div>

    <div className="legacy-rankings-grid">
      <Ranking title={'Artilharia · Brasileirão ' + career.season} items={seasonScorers} clubs={clubs} empty="A temporada ainda não tem gols simulados."/>
      <Ranking title="Maiores artilheiros do seu save" items={allTime} clubs={clubs} empty="Simule partidas para começar a construir este ranking."/>
    </div>

    <section className="legacy-card historical-scorers">
      <div className="legacy-card-title"><h3>Referência real · artilheiros do Brasileirão</h3><span>CBF · 18/08/2026</span></div>
      <div className="historical-grid">{brasileiraoHistoricalScorers.map(function(player,index){
        return <div key={player.name}><strong>{index+1}</strong><span>{player.name}</span><b>{player.goals}</b></div>;
      })}</div>
    </section>

    <div className="hall-heading"><div><div className="eyebrow">EM CONSTRUÇÃO</div><h3>Hall da Fama</h3></div><span>Estrutura inicial</span></div>
    <div className="hall-grid">
      <article><span className="hall-icon"><Users/></span><h3>Jogadores</h3><p>Ídolos do seu save, artilheiros, recordistas de jogos e protagonistas de títulos.</p><div className="hall-lock"><LockKeyhole size={13}/> Critérios serão ativados nas próximas competições.</div></article>
      <article><span className="hall-icon"><Award/></span><h3>Clubes</h3><p>Dinastias, sequências de títulos, temporadas históricas e recordes nacionais.</p><div className="hall-lock"><LockKeyhole size={13}/> {managedBrazil} Brasileirão(ões) na sua gestão.</div></article>
      <article><span className="hall-icon"><Medal/></span><h3>Técnicos</h3><p>Carreiras longevas, aproveitamento, títulos e marcas quebradas ao longo dos anos.</p><div className="hall-lock"><LockKeyhole size={13}/> Perfil do treinador será conectado depois.</div></article>
    </div>

    <div className="legacy-source-note">As referências reais desta tela são dados históricos de contexto; resultados, artilharia e conquistas do save são gerados pela sua carreira.</div>
  </div>;
}
