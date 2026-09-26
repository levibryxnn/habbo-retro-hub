import React from 'react';
import { BadgeDollarSign, BriefcaseBusiness, Dumbbell, Footprints, HeartPulse, House, Landmark, Sparkles } from 'lucide-react';

const ICONS={agent:BriefcaseBusiness,boots:Footprints,physio:HeartPulse,service:Dumbbell,home:House,asset:Landmark,sponsor:BadgeDollarSign};

export default function PlayerLifeVisual({type='agent',title='',subtitle=''}) {
  const Icon=ICONS[type]||Sparkles;
  return <div className={'pc-life-visual '+type} aria-hidden="true">
    <span className="pc-life-orb one"/><span className="pc-life-orb two"/>
    <div className="pc-life-visual-mark"><Icon size={34}/></div>
    <div className="pc-life-visual-copy"><small>{subtitle}</small><strong>{title}</strong></div>
    <i className="pc-life-ground"/>
  </div>;
}
