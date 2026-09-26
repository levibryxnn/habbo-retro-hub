import React,{useRef,useState} from 'react';
import {
  ArrowRight,BarChart3,BriefcaseBusiness,CloudUpload,Coins,FileUp,Footprints,
  Globe2,Home,Settings,Shield,Trophy,Users
} from 'lucide-react';
import { parseCareerSave } from './save-format.js';
import './landing.css';

const NavItem=({icon:Icon,label,active=false})=><span className={active?'active':''}><Icon size={15}/>{label}</span>;
const Feature=({icon:Icon,label})=><span><Icon size={18}/><b>{label}</b></span>;

export default function LandingScreen({onManager,onPlayer,onImport}){
  const input=useRef(null),[error,setError]=useState('');
  async function load(file){
    if(!file)return;
    try{setError('');const payload=parseCareerSave(await file.text());await onImport?.(payload);}
    catch(e){setError(e?.message||'Não foi possível carregar este save.');}
    if(input.current)input.current.value='';
  }
  return <main className="landing-screen">
    <div className="landing-stadium" aria-hidden="true"/>
    <div className="landing-halftone" aria-hidden="true"/>
    <header className="landing-hud">
      <div className="landing-hud-brand"><span className="landing-mini-mark">L<b>F</b></span><span><strong>LINHA<br/>DE FRENTE</strong><small>ARCADE FOOTBALL MANAGER</small></span></div>
      <nav className="landing-nav" aria-label="Áreas do jogo">
        <NavItem icon={Home} label="INÍCIO" active/>
        <NavItem icon={Shield} label="CLUBES"/>
        <NavItem icon={Trophy} label="COMPETIÇÕES"/>
        <NavItem icon={Coins} label="MERCADO"/>
        <NavItem icon={BarChart3} label="RANKINGS"/>
        <NavItem icon={Settings} label="OPÇÕES"/>
      </nav>
      <div className="landing-season"><span>🇧🇷</span><div><strong>TEMPORADA 2026</strong><small>BRASILEIRÃO SÉRIE A</small></div></div>
    </header>

    <section className="landing-content mode-landing">
      <div className="landing-stage-tag"><span>♛</span> BRASILEIRÃO · CARREIRA · TEMPORADAS</div>
      <div className="landing-mark"><span className="landing-symbol">L<b>F</b></span><div><strong>LINHA DE<br/><em>FRENTE</em></strong><small>ARCADE FOOTBALL MANAGER</small></div></div>
      <p>Escolha onde sua carreira começa.</p>

      <div className="landing-mode-grid">
        <button className="landing-mode-card manager" onClick={onManager}>
          <span className="landing-mode-icon"><BriefcaseBusiness size={28}/></span>
          <div className="landing-mode-copy"><small>MODO CARREIRA</small><strong>TREINADOR</strong><p>Assuma o comando, monte seu time, negocie, sobreviva à pressão e construa uma era no clube.</p></div>
          <span className="landing-card-arrow"><ArrowRight size={24}/></span>
          <div className="landing-card-features">
            <Feature icon={Users} label="ELENCO"/>
            <Feature icon={ArrowRight} label="TRANSFERÊNCIAS"/>
            <Feature icon={Coins} label="FINANÇAS"/>
            <Feature icon={Trophy} label="TÍTULOS"/>
          </div>
        </button>

        <button className="landing-mode-card player" onClick={onPlayer}>
          <span className="landing-mode-icon"><Footprints size={28}/></span>
          <div className="landing-mode-copy"><small>MODO CARREIRA</small><strong>JOGADOR</strong><p>Ganhe seu lugar. Peneira, banco, titularidade, contratos, dinheiro, mercado e carreira internacional.</p></div>
          <span className="landing-card-arrow"><ArrowRight size={24}/></span>
          <div className="landing-card-features">
            <Feature icon={BarChart3} label="EVOLUÇÃO"/>
            <Feature icon={Trophy} label="CONQUISTAS"/>
            <Feature icon={FileUp} label="CONTRATOS"/>
            <Feature icon={Globe2} label="SELEÇÃO"/>
          </div>
        </button>
      </div>

      <div className="landing-feature-strip" aria-label="Recursos do jogo">
        <span><Settings size={18}/><b>ENGINE DETERMINÍSTICA</b><small>Simulação realista e equilibrada.</small></span>
        <span><BarChart3 size={18}/><b>DECISÕES EM TEMPO REAL</b><small>Cada escolha faz diferença.</small></span>
        <span><CloudUpload size={18}/><b>SAVES PORTÁTEIS</b><small>Continue em qualquer dispositivo.</small></span>
      </div>

      <div className="landing-actions secondary-actions"><button className="landing-load" onClick={()=>input.current?.click()}><FileUp size={17}/> <span><b>IMPORTAR SAVE DE TREINADOR</b><small>Continue de onde parou.</small></span></button><input ref={input} type="file" accept=".ldf,application/json" hidden onChange={e=>load(e.target.files?.[0])}/></div>
      {error&&<span className="landing-error">{error}</span>}
    </section>

    <footer className="landing-foot"><span><b>LF</b> LINHA DE FRENTE <em>RC9</em></span><span>TREINADOR · JOGADOR · PARTIDAS · MERCADO · TEMPORADAS</span><span>MAIS QUE UM JOGO. É A SUA HISTÓRIA.</span></footer>
  </main>;
}