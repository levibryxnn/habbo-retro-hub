import React from 'react';
import { ArrowRight, Crown, ShieldCheck, Star, Target, Trophy, X } from 'lucide-react';
import Trophy3D from './Trophy3D.jsx';
import './season-review.css';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

function initials(name){return String(name||'').split(' ').filter(Boolean).map((part,index,array)=>index===0||index===array.length-1?part[0]:'').join('').slice(0,2);}

export default function SeasonReviewModal({career,club,mode,onClose,onContinue,Crest}) {
  const review=career.seasonReview||{};
  const celebration=career.pendingCelebration,seasonClosed=Boolean(review?.pending);
  if(mode==='trophy'&&celebration){
    const trophy=celebration.trophy||{};
    return <div className="season-modal-backdrop" role="dialog" aria-modal="true" aria-label="Celebração de título">
      <section className="season-modal celebration-modal">
        <button className="season-modal-close" onClick={onClose}><X size={19}/></button>
        <div className="celebration-stage">
          <div className="confetti" aria-hidden="true">{Array.from({length:18}).map((_,i)=><i key={i}/>)}</div>
          <span className="season-eyebrow">NOITE DE TAÇA</span>
          <div className="celebration-clubline">{Crest?<Crest club={club}/>:<b>{club.abbreviation}</b>}<span>{club.name} · temporada {career.season}</span></div>
          <Trophy3D id={trophy.id} shape={trophy.shape} className="celebration-trophy"/>
          <h2>Parabéns, campeão!</h2>
          <p>{club.name} conquistou {trophy.name||'um novo título'} na temporada {career.season}. A torcida transformou a noite em festa, a galeria foi atualizada e a conquista agora faz parte da memória do clube.</p>
          <div className="players-celebration" aria-label="Jogadores celebrando a conquista">
            <span className="celebration-player left"><b>{initials(review.bestPlayer?.name||review.topScorer?.name||club.abbreviation)}</b></span>
            <span className="raised-cup"><Trophy3D id={trophy.id} shape={trophy.shape}/></span>
            <span className="celebration-player right"><b>{initials(review.topScorer?.name||review.bestPlayer?.name||club.abbreviation)}</b></span>
          </div>
          <div className="celebration-badges"><span><Crown size={14}/>{trophy.name||'Título'}</span><span><Star size={14}/>Temporada {career.season}</span><span><Trophy size={14}/>Galeria atualizada</span></div>
        </div>
        <button className="season-primary" onClick={onClose}>{seasonClosed?'Ver resumo da temporada':'Continuar temporada'} <ArrowRight size={16}/></button>
      </section>
    </div>;
  }
  if(mode!=='season'||!review?.pending)return null;
  return <div className="season-modal-backdrop" role="dialog" aria-modal="true" aria-label="Resumo da temporada">
    <section className="season-modal">
      <button className="season-modal-close" onClick={onClose}><X size={19}/></button>
      <span className="season-eyebrow">RELATÓRIO FINAL · TEMPORADA {review.season}</span>
      <h2>A temporada terminou.</h2>
      <p className="season-intro">38 rodadas concluídas. Este é o retrato completo do trabalho de {career.managerName||'seu técnico'} à frente do {club.name}.</p>
      <div className="season-summary-grid">
        <article><Trophy size={18}/><small>Classificação</small><strong>{review.position}º</strong><span>{review.points} pontos</span></article>
        <article><Target size={18}/><small>Campanha</small><strong>{review.wins}V · {review.draws}E</strong><span>{review.losses} derrotas · saldo {review.goalDifference>0?'+':''}{review.goalDifference}</span></article>
        <article><Star size={18}/><small>Artilheiro</small><strong>{review.topScorer?.name||'—'}</strong><span>{review.topScorer?.goals||0} gols</span></article>
        <article><ShieldCheck size={18}/><small>Melhor desempenho</small><strong>{review.bestPlayer?.name||'—'}</strong><span>{review.bestPlayer?.averageRating?review.bestPlayer.averageRating.toFixed(1)+' de média':'Sem nota'}</span></article>
      </div>
      <div className="season-review-columns">
        <section><h3>Títulos</h3>{review.titles?.length?<div className="season-title-list">{review.titles.map(item=><article key={item.id+'-'+item.season}><Trophy3D id={item.id} shape={item.shape}/><div><strong>{item.name}</strong><span>Conquistado na temporada {item.season}</span></div></article>)}</div>:<p className="season-empty">Nenhuma taça nesta temporada. O próximo ano já começa com novas metas.</p>}</section>
        <section><h3>Ambiente do clube</h3><div className="season-confidence-line"><span>Torcida</span><strong>{review.fanConfidence}%</strong></div><div className="season-meter"><i style={{width:review.fanConfidence+'%'}}/></div><div className="season-confidence-line"><span>Diretoria</span><strong>{review.boardConfidence}%</strong></div><div className="season-meter"><i style={{width:review.boardConfidence+'%'}}/></div><div className="season-cash"><small>Caixa final</small><strong>{money.format(review.cash||0)}</strong></div></section>
      </div>
      <button className="season-primary" onClick={onContinue||onClose}>Continuar carreira <ArrowRight size={16}/></button>
    </section>
  </div>;
}
