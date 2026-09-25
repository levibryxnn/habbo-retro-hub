import React from 'react';
import { Award, BadgeDollarSign, BriefcaseBusiness, Footprints, House, Sparkles, Star, Trophy, Users, X } from 'lucide-react';

const ICONS={
  goal:Footprints,match:Footprints,promotion:Trophy,transfer:BriefcaseBusiness,'dream-club':Star,
  'national-team':Users,retirement:Trophy,finance:BadgeDollarSign,home:House,agent:BriefcaseBusiness,
  sponsor:Award,milestone:Sparkles,
};

export default function PlayerMomentModal({moment,onClose}) {
  if(!moment)return null;
  const Icon=ICONS[moment.type]||Sparkles;
  return <div className={'pc-moment-overlay '+String(moment.type||'milestone')} role="dialog" aria-modal="true" aria-label={moment.title} onClick={event=>{if(event.target===event.currentTarget)onClose?.();}}>
    <section className="pc-moment-card">
      <button className="pc-moment-close" onClick={onClose} aria-label="Fechar"><X size={17}/></button>
      <div className="pc-moment-art"><span/><i/><Icon size={46}/></div>
      <small className="pc-eyebrow">MOMENTO DA CARREIRA</small>
      <h2>{moment.title}</h2>
      {moment.subtitle&&<strong>{moment.subtitle}</strong>}
      <p>{moment.text}</p>
      <div className="pc-moment-meta"><span>Temporada {moment.season}</span><span>Dia {Number(moment.day||0)+1}</span></div>
      <button className="pc-primary" onClick={onClose}>Continuar a história</button>
    </section>
  </div>;
}
