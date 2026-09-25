import React from 'react';
import { Sparkles, Star, Trophy, X } from 'lucide-react';

export default function CareerMomentModal({moment,club,Crest,onClose}){
  if(!moment)return null;
  return <div className="career-moment-overlay" role="dialog" aria-modal="true" aria-label={moment.title} onClick={e=>{if(e.target===e.currentTarget)onClose?.();}}>
    <section className="career-moment-card">
      <button className="career-moment-close" onClick={onClose} aria-label="Fechar"><X size={18}/></button>
      <div className="career-moment-light" aria-hidden="true"/>
      <Sparkles className="career-moment-spark" size={34}/>
      <span className="eyebrow">MOMENTO HISTÓRICO</span>
      <h2>{moment.title}</h2><strong>{moment.subtitle}</strong>
      {club&&<div className="career-moment-club">{Crest&&<Crest club={club}/>}<span>{club.name}</span></div>}
      <p>{moment.text}</p>
      <div className="career-moment-meta"><span><Trophy size={14}/> Temporada {moment.season}</span>{moment.player&&<span><Star size={14}/> {moment.player}</span>}</div>
      <button className="career-moment-continue" onClick={onClose}>Guardar na memória da carreira</button>
    </section>
  </div>;
}
