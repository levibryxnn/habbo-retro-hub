import React from 'react';
import { ArrowRight } from 'lucide-react';
import './landing.css';

export default function LandingScreen({onPlay}){
  return <main className="landing-screen">
    <div className="landing-pitch" aria-hidden="true"><i className="pitch-half"/><i className="pitch-circle"/><i className="pitch-box top"/><i className="pitch-box bottom"/></div>
    <section className="landing-content">
      <div className="landing-mark"><span className="landing-symbol">L<b>F</b></span><div><strong>LINHA DE<br/>FRENTE</strong><small>FOOTBALL MANAGER</small></div></div>
      <p>Escolha um clube. Construa uma carreira que só existe no seu save.</p>
      <button onClick={onPlay}>Jogue agora <ArrowRight size={18}/></button>
    </section>
    <span className="landing-foot">Gestão · campo · mercado · história</span>
  </main>;
}
