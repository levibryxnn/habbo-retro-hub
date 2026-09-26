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
      <div className="landing-stage-tag"><span/> BRASILEIRÃO · CARREIRA · TEMPORADAS</div>
      <div className="landing-mark"><span className="landing-symbol">L<b>F</b></span><div><strong>LINHA DE<br/>FRENTE</strong><small>ARCADE FOOTBALL MANAGER</small></div></div>
      <p>Escolha onde sua carreira começa.</p>
      <div className="landing-mode-grid">
        <button className="landing-mode-card manager" onClick={onManager}><b className="landing-mode-number">01</b><span><BriefcaseBusiness size={24}/></span><div><small>MODO CARREIRA TREINADOR</small><strong>Assuma o comando.</strong><p>Monte o time, negocie, sobreviva à pressão e construa uma era no clube.</p></div><ArrowRight size={20}/></button>
        <button className="landing-mode-card player" onClick={onPlayer}><b className="landing-mode-number">02</b><span><Footprints size={24}/></span><div><small>MODO CARREIRA JOGADOR</small><strong>Ganhe seu lugar.</strong><p>Peneira, banco, titularidade, contratos, dinheiro, mercado e carreira internacional.</p></div><ArrowRight size={20}/></button>
      </div>
      <div className="landing-feature-strip" aria-label="Recursos do jogo"><span>ENGINE DETERMINÍSTICA</span><span>DECISÕES EM TEMPO REAL</span><span>SAVES PORTÁTEIS</span></div>
      <div className="landing-actions secondary-actions"><button className="landing-load" onClick={()=>input.current?.click()}><FileUp size={16}/> Importar save de treinador</button><input ref={input} type="file" accept=".ldf,application/json" hidden onChange={e=>load(e.target.files?.[0])}/></div>
      {error&&<span className="landing-error">{error}</span>}
    </section>
    <span className="landing-foot">Treinador · jogador · partidas · mercado · temporadas</span>
  </main>;
}