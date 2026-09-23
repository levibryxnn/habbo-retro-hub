import React, { useMemo, useState } from 'react';
import { ArrowRight, Award, BadgeCheck, Check, CircleDollarSign, Handshake, LockKeyhole, Shield, Trophy, Wallet } from 'lucide-react';
import { HONOUR_FILTERS, historicalTitleTotal, honoursWithCareer } from './club-honours.js';
import { activeContracts, endSponsor, offers, projectedOfferValue, requirementStatus, signSponsor, slots, sponsorContext, sponsorshipTotals } from './finance-model';
import Trophy3D from './Trophy3D.jsx';
import './management.css';

const money = function(value) {
  return new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL', maximumFractionDigits:0 }).format(value || 0);
};

function Cup({id,shape,won}) {
  return <Trophy3D id={id} shape={shape} className={won?'won':''}/>;
}

function SponsorMark({offer,small=false}) {
  return <span className={'sponsor-mark '+(small?'small':'')} style={{'--sponsor-color':offer.color}}>
    <b>{offer.symbol||offer.name.slice(0,1)}</b>
  </span>;
}

function requirementText(offer) {
  return (offer.requirements||[]).map(function(req){return req.label;}).join(' · ') || 'Sem requisito adicional';
}

function paymentText(offer) {
  if (offer.payment.type === 'upfront') return money(offer.payment.amount) + ' pagos de uma vez';
  if (offer.payment.type === 'monthly') return money(offer.payment.amount) + ' por parcela mensal';
  if (offer.payment.type === 'quarterly') return money(offer.payment.amount) + ' por parcela trimestral';
  if (offer.payment.type === 'per_match') return money(offer.payment.amount) + ' por rodada disputada';
  return money(offer.payment.amount) + ' por rodada + ' + money(offer.payment.winBonus) + ' por vitória';
}

export default function Management({club,tab,career,onCareerChange,canManage,onChoose,Modal,storageError,standings}) {
  const [filter,setFilter]=useState('Todos');
  const [pending,setPending]=useState(null);
  const [notice,setNotice]=useState('');
  const totals=sponsorshipTotals(career);
  const active=activeContracts(career);
  const context=useMemo(function(){ return sponsorContext(career,club,standings); },[career,club,standings]);

  function sign(item) {
    if(!canManage) return;
    const result=signSponsor(career,item.id,club,standings);
    if(result.error){ setNotice(result.error); setPending(null); return; }
    onCareerChange(result.career);
    setNotice('Contrato com ' + item.name + ' assinado. O fluxo de pagamentos já está ativo.');
    setPending(null);
  }

  function finish(item) {
    if(!canManage) return;
    onCareerChange(endSponsor(career,item.id));
    setNotice('Contrato com ' + item.name + ' encerrado. Novos pagamentos foram interrompidos.');
    setPending(null);
  }

  if(tab==='trophies'){
    const earned=career.trophies||[];
    const honours=honoursWithCareer(club.id,career);
    const historicalTotal=historicalTitleTotal(club.id);
    const careerTotal=earned.length;
    const visibleHonours=honours.filter(function(trophy){return filter==='Todos'||filter===trophy.kind;});
    return <div className="management-content">
      <div className="management-heading"><div><div className="eyebrow">O PESO DA SUA CAMISA</div><h2>Galeria de troféus</h2><p>A história oficial do {club.name} e as novas conquistas da sua carreira.</p></div><span className="stage-two-badge"><Trophy size={13}/> Sala de troféus</span></div>
      <div className="trophy-overview"><div className="laurel"><Trophy size={32}/></div><div><span className="eyebrow">PATRIMÔNIO ESPORTIVO</span><h3>{historicalTotal+careerTotal} títulos registrados</h3><p>{careerTotal?careerTotal+' conquistado'+(careerTotal>1?'s':'')+' durante a sua gestão.':'A partir daqui, cada nova conquista também entra para a história do clube.'}</p></div><div className="trophy-count"><strong>{String(careerTotal).padStart(2,'0')}</strong><span>na sua gestão</span></div></div>
      <div className="gallery-toolbar"><div className="position-tabs" aria-label="Filtrar troféus">{HONOUR_FILTERS.map(function(item){return <button key={item} aria-pressed={filter===item} className={filter===item?'current':''} onClick={function(){setFilter(item);}}>{item==='Todos'?'Todas as taças':item}</button>;})}</div><span>Histórico até 2026 + carreira atual</span></div>
      <div className="trophy-grid">{visibleHonours.map(function(trophy){
        const careerWins=earned.filter(function(item){return item.id===trophy.id;});
        const years=[...(trophy.years||[]),...careerWins.map(function(item){return item.season;})];
        return <article key={trophy.id} className={'trophy-card earned historical-trophy'}>
          <div className="trophy-card-top"><span>{trophy.kind}</span>{careerWins.length>0?<span className="won-badge"><BadgeCheck size={12}/> +{careerWins.length} na gestão</span>:<BadgeCheck size={13}/>}</div>
          <div className="trophy-art-wrap"><span className="trophy-number-pop" aria-label={trophy.count+' títulos'}>{trophy.count}</span><Cup id={trophy.id} shape={trophy.shape} won/></div>
          <h3>{trophy.name}</h3><p>{trophy.count===1?'1 conquista oficial':trophy.count+' conquistas oficiais'}</p>
          <span className="trophy-state">{years.length&&years.length<=12?years.join(' · '):careerWins.length?'Histórico do clube · sua gestão: '+careerWins.map(function(item){return item.season;}).join(', '):'Histórico oficial do clube'}</span>
        </article>;
      })}</div>
      <div className="module-footnote"><Trophy size={15}/><p>A galeria parte do histórico oficial do futebol masculino principal de cada clube e soma automaticamente os títulos conquistados no seu save.</p></div>
    </div>;
  }

  return <div className="management-content">
    <div className="management-heading"><div><div className="eyebrow">FORA DAS QUATRO LINHAS</div><h2>Patrocínios & caixa</h2><p>Contratos agora têm requisitos, calendário e forma própria de pagamento.</p></div><span className="stage-two-badge"><CircleDollarSign size={13}/> Economia ativa</span></div>
    {storageError&&<p className="management-alert" role="alert">O navegador não permitiu salvar. As alterações ficam disponíveis apenas nesta sessão.</p>}
    {!canManage&&<div className="choose-notice"><Shield size={19}/><p>Escolha o {club.name} para gerenciar contratos e caixa.</p><button onClick={onChoose}>Escolher clube <ArrowRight size={15}/></button></div>}
    {notice&&<div className="management-notice" role="status"><Check size={15}/>{notice}</div>}
    <div className="finance-summary">
      <div><Wallet size={18}/><small>Saldo do clube</small><strong>{money(career.cash)}</strong></div>
      <div><Handshake size={18}/><small>Contratos ativos</small><strong>{active.length}<em> / 3 espaços</em></strong></div>
      <div><Award size={18}/><small>Já recebido em patrocínios</small><strong>{money(totals.received)}</strong></div>
    </div>

    <div className="subheading"><h3>Parceiros do clube</h3><span>Rodada {career.round} · Temporada {career.season}</span></div>
    <div className="sponsor-slots">{Object.entries(slots).map(function(entry){
      const key=entry[0],label=entry[1];
      const contract=active.find(function(item){return item.offer.slot===key;});
      return <article className={'sponsor-slot ' + (contract?'filled':'')} key={key}>
        <span className="slot-name">{label}</span>
        {contract?<><div className="active-sponsor-brand"><SponsorMark offer={contract.offer} small/><strong style={{color:contract.offer.color}}>{contract.offer.name}</strong></div><span>{contract.offer.payment.label} · recebido {money(contract.totalReceived)}</span><small>{paymentText(contract.offer)}</small><button disabled={!canManage} onClick={function(){setPending({type:'end',item:contract.offer});}}>Encerrar contrato</button></>:<><div className="vacant-slot">+</div><span>Espaço disponível</span><small>Escolha uma proposta abaixo</small></>}
      </article>;
    })}</div>

    <div className="subheading offers-heading"><h3>Propostas disponíveis</h3><span>Quanto maior o pagamento, mais exigente é a marca</span></div>
    <div className="offers-grid">{offers.map(function(offer){
      const signed=active.some(function(item){return item.offerId===offer.id;});
      const occupied=active.some(function(item){return item.offer.slot===offer.slot;});
      const req=requirementStatus(offer,context);
      const disabled=occupied||!canManage||!req.ok;
      return <article className={'offer-card ' + (disabled?'unavailable':'')} key={offer.id}>
        <div className="offer-top"><span className="sponsor-brand-lockup"><SponsorMark offer={offer}/><span className="sponsor-wordmark" style={{color:offer.color}}>{offer.name}<small>Nível {offer.tier||1}</small></span></span><span>{slots[offer.slot]}</span></div>
        <p>{offer.sector} · {offer.tagline}</p>
        <div className="offer-price">{paymentText(offer)}</div>
        <dl>
          <div><dt>Modelo</dt><dd>{offer.payment.label}</dd></div>
          <div><dt>Bônus na assinatura</dt><dd>{money(offer.payment.signingBonus)}</dd></div>
          <div><dt>Projeção mínima restante</dt><dd>{money(projectedOfferValue(offer,career.round))}</dd></div>
          <div className="requirements-row"><dt>Requisitos</dt><dd className={req.ok?'requirement-ok':'requirement-blocked'}>{(req.details||[]).map(function(detail,index){return <span key={index}>{detail.ok?'✓ ':'✕ '}{detail.label}</span>;})}</dd></div>
        </dl>
        <button className="proposal-button" disabled={disabled} onClick={function(){setPending({type:'sign',item:offer});}}>{signed?'Contrato ativo':occupied?'Espaço ocupado':req.ok?'Analisar proposta':'Requisito pendente'}<ArrowRight size={15}/></button>
      </article>;
    })}</div>

    <div className="cash-ledger">
      <div className="subheading"><h3>Últimas movimentações</h3><span>Pagamentos entram automaticamente ao simular rodadas</span></div>
      {(career.transactions||[]).length?<div className="transaction-list">{career.transactions.slice(0,8).map(function(item){return <div key={item.id}><span>Rod. {item.round}</span><strong>{item.label}</strong><b className={item.amount>=0?'income':'expense'}>{item.amount>=0?'+ ':'− '}{money(Math.abs(item.amount))}</b></div>;})}</div>:<p className="no-transactions">Nenhuma movimentação de patrocínio ainda.</p>}
    </div>

    {pending&&<Modal title={pending.type==='sign'?'Assinar patrocínio':'Encerrar contrato'} onClose={function(){setPending(null);}}>
      <span className="modal-icon"><Handshake/></span>
      <div className="eyebrow">{club.name} · CONTRATO COMERCIAL</div>
      <h2>{pending.type==='sign'?'Contrato com '+pending.item.name:'Encerrar com '+pending.item.name+'?'}</h2>
      {pending.type==='sign'?<><p>{paymentText(pending.item)}. O dinheiro será lançado no caixa conforme as regras do contrato e a passagem das rodadas.</p><dl className="proposal-details"><div><dt>Espaço</dt><dd>{slots[pending.item.slot]}</dd></div><div><dt>Forma de pagamento</dt><dd>{pending.item.payment.label}</dd></div><div><dt>Pagamento imediato</dt><dd>{money((pending.item.payment.signingBonus||0)+(pending.item.payment.type==='upfront'?pending.item.payment.amount:0))}</dd></div><div><dt>Requisitos</dt><dd>{requirementText(pending.item)}</dd></div></dl></>:<p>O patrocinador deixará de fazer novos pagamentos a partir da rodada atual. O que já entrou no caixa permanece registrado.</p>}
      <div className="modal-actions"><button className="secondary" onClick={function(){setPending(null);}}>Cancelar</button><button className="primary" onClick={function(){pending.type==='sign'?sign(pending.item):finish(pending.item);}}>{pending.type==='sign'?'Assinar contrato':'Confirmar encerramento'}</button></div>
    </Modal>}
  </div>;
}
