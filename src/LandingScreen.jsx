import React,{useRef,useState} from 'react';
import { ArrowRight, BriefcaseBusiness, FileUp, Footprints } from 'lucide-react';
import { parseCareerSave } from './save-format.js';
import './landing.css';

export default function LandingScreen({onManager,onPlayer,onImport}){
  const input=useRef(null),[error,setError]=useState('');
  async function load(file){
    if(!file)return;
    try{setError('');const payload=parseCareerSave(await file.text());await onImport?.(payload);}
    catch(e){setError(e?.message||'Não foi possível carregar este save.');}
    if(input.current)input.current.value='';
  }
  return <main className="landing-screen">
    <div className="landing-pitch" aria-hidden="true"><i className="pitch-half"/><i className="pitch-circle"/><i className="pitch-box top"/><i className="pitch-box bottom"/></div>
    <section className="landing-content mode-landing">
      <div className="landing-mark"><span className="landing-symbol">L<b>F</b></span><div><strong>LINHA DE<br/>FRENTE</strong><small>CARREIRAS DE FUTEBOL</small></div></div>
      <p>Escolha de que lado da história você quer viver.</p>
      <div className="landing-mode-grid">
        <button className="landing-mode-card manager" onClick={onManager}><span><BriefcaseBusiness size={23}/></span><div><small>MODO CARREIRA TREINADOR</small><strong>Comande o projeto inteiro.</strong><p>Tática, elenco, mercado, diretoria, títulos e uma carreira que pode mudar de clube.</p></div><ArrowRight size={18}/></button>
        <button className="landing-mode-card player" onClick={onPlayer}><span><Footprints size={23}/></span><div><small>MODO CARREIRA JOGADOR</small><strong>Comece aos 16 anos.</strong><p>Crie seu rosto, encare a peneira e conquiste cada minuto até virar profissional.</p></div><ArrowRight size={18}/></button>
      </div>
      <div className="landing-actions secondary-actions"><button className="landing-load" onClick={()=>input.current?.click()}><FileUp size={16}/> Importar save de treinador</button><input ref={input} type="file" accept=".ldf,application/json" hidden onChange={e=>load(e.target.files?.[0])}/></div>
      {error&&<span className="landing-error">{error}</span>}
    </section>
    <span className="landing-foot">Treinador · jogador · campo · mercado · história</span>
  </main>;
}