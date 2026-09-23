import React from 'react';
import{ArrowRight,Heart,Star,X}from'lucide-react';
import'./retirement.css';

export default function RetirementModal({retirement,onClose}){
  if(!retirement)return null;
  return <div className="retirement-backdrop" role="dialog" aria-modal="true" aria-label="Despedida do jogador">
    <section className="retirement-modal">
      <button className="retirement-close" onClick={onClose} aria-label="Fechar"><X size={18}/></button>
      <div className="farewell-art" aria-hidden="true">
        <div className="farewell-lights"/><div className="farewell-crowd"/>
        <div className="farewell-player"><i/><b/><em/></div>
        <div className="farewell-applause left">👏 👏 👏</div><div className="farewell-applause right">👏 👏</div>
        <div className="farewell-tunnel"/>
      </div>
      <div className="retirement-copy"><span className="eyebrow">FIM DE UMA CARREIRA</span><h2>Obrigado, {retirement.name}.</h2><p>Aos {retirement.age} anos, ele deixa os gramados. A torcida reconhece tudo o que foi construído com esta camisa e o clube abre espaço para a próxima geração.</p>
        <div className="retirement-legacy"><Heart size={17}/><span><small>LEGADO</small><strong>{retirement.successorName} chega à base com 16 anos</strong></span></div>
        <div className="retirement-prospect"><Star size={15}/><span>OVR inicial {retirement.successorOverall} · potencial oculto será desenvolvido ao longo das temporadas</span></div>
        <button onClick={onClose}>Seguir a temporada <ArrowRight size={16}/></button>
      </div>
    </section>
  </div>;
}
