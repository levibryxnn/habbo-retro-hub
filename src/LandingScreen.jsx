import React,{useRef,useState} from 'react';
import { ArrowRight, FileUp } from 'lucide-react';
import { parseCareerSave } from './save-format.js';
import './landing.css';

export default function LandingScreen({onPlay,onImport}){
  const input=useRef(null),[error,setError]=useState('');
  async function load(file){
    if(!file)return;
    try{setError('');const payload=parseCareerSave(await file.text());await onImport?.(payload);}
    catch(e){setError(e?.message||'Não foi possível carregar este save.');}
    if(input.current)input.current.value='';
  }
  return <main className="landing-screen">
    <div className="landing-pitch" aria-hidden="true"><i className="pitch-half"/><i className="pitch-circle"/><i className="pitch-box top"/><i className="pitch-box bottom"/></div>
    <section className="landing-content">
      <div className="landing-mark"><span className="landing-symbol">L<b>F</b></span><div><strong>LINHA DE<br/>FRENTE</strong><small>FOOTBALL MANAGER</small></div></div>
      <p>Escolha um clube. Construa uma carreira que só existe no seu save.</p>
      <div className="landing-actions"><button className="landing-play" onClick={onPlay}>Jogue agora <ArrowRight size={18}/></button><button className="landing-load" onClick={()=>input.current?.click()}><FileUp size={16}/> Carregar save</button><input ref={input} type="file" accept=".ldf,application/json" hidden onChange={e=>load(e.target.files?.[0])}/></div>
      {error&&<span className="landing-error">{error}</span>}
    </section>
    <span className="landing-foot">Gestão · campo · mercado · história</span>
  </main>;
}
