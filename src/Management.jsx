import React, { useMemo, useState } from 'react';
import { ArrowRight, Award, BadgeCheck, Check, CircleDollarSign, Handshake, LockKeyhole, Shield, Trophy, Wallet } from 'lucide-react';
import { trophies } from './management-model';
import { activeContracts, endSponsor, offers, projectedOfferValue, requirementStatus, signSponsor, slots, sponsorContext, sponsorshipTotals } from './finance-model';
import './management.css';

const money = function(value) {
  return new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL', maximumFractionDigits:0 }).format(value || 0);
};

function Cup({shape,won}) {
  return <svg className={'cup-art ' + (won ? 'won' : '')} viewBox="0 0 120 140" fill="none" aria-hidden="true">
    <ellipse cx="60" cy="131" rx="39" ry="5" fill="currentColor" opacity=".12"/>
    {shape==='league'?<><path d="M30 22h60L77 83H43Z" fill="currentColor" opacity=".3"/><path d="M30 22h60L77 83H43Z M36 22l14 61m-3-61 8 61m18-61-8 61m19-61L70 83M60 22v61" stroke="currentColor" strokeWidth="3"/><path d="M43 18h34v8H43zM48 83h24v9H48zM55 92h10v24H55zM39 117h42v10H39z" fill="currentColor"/></>:shape==='cup'?<><path d="M36 26H18v16c0 19 17 29 31 29M84 26h18v16c0 19-17 29-31 29" stroke="currentColor" strokeWidth="5"/><path d="M31 18h58l-6 40c-2 14-12 25-23 25S39 72 37 58Z" fill="currentColor" opacity=".65"/><path d="M60 81v31M41 120h38" stroke="currentColor" strokeWidth="8"/><path d="M37 17h46" stroke="currentColor" strokeWidth="5"/></>:shape==='globe'?<><circle cx="60" cy="34" r="22" fill="currentColor" opacity=".6"/><ellipse cx="60" cy="34" rx="10" ry="22" stroke="currentColor" strokeWidth="2"/><path d="M38 34h44M60 57v43M39 105h42v20H39z" stroke="currentColor" strokeWidth="6"/><path d="M49 62h22l7 40H42z" fill="currentColor" opacity=".35"/></>:<><path d="M60 13 38 83l22 26 22-26Z" fill="currentColor" opacity=".55"/><path d="M60 13v96M38 83h44M47 59h26" stroke="currentColor" strokeWidth="3"/><path d="M55 106h10v11H55zM39 117h42v10H39z" fill="currentColor"/></>}
  </svg>;
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
    return <div className="management-content">
      <div className="management-heading"><div><div className="eyebrow">O PESO DA SUA CAMISA</div><h2>Galeria de troféus</h2><p>Conquistas oficiais do seu save com o {club.name}.</p></div><span className="stage-two-badge"><Trophy size={13}/> Automática</span></div>
      <div className="trophy-overview"><div className="laurel"><Trophy size={32}/></div><div><span className="eyebrow">SUA SALA DE CONQUISTAS</span><h3>{earned.length ? 'A história já começou.' : 'O próximo troféu pode ser seu.'}</h3><p>{earned.length ? 'Os títulos são registrados pela engine ao fim das competições.' : 'Ganhe uma competição para preencher esta galeria.'}</p></div><div className="trophy-count"><strong>{String(earned.length).padStart(2,'0')}</strong><span>títulos na gestão</span></div></div>
      <div className="gallery-toolbar"><div className="position-tabs" aria-label="Filtrar troféus">{['Todos','Nacional','Continental','Mundial'].map(function(item){return <button key={item} aria-pressed={filter===item} className={filter===item?'current':''} onClick={function(){setFilter(item);}}>{item==='Todos'?'Todas as taças':item}</button>;})}</div><span>Carreira iniciada em 2026</span></div>
      <div className="trophy-grid">{trophies.filter(function(trophy){return filter==='Todos'||filter===trophy.kind;}).map(function(trophy){
        const wins=earned.filter(function(item){return item.id===trophy.id;});
        const won=wins.length>0;
        return <article key={trophy.id} className={'trophy-card ' + (won?'earned':'')}>
          <div className="trophy-card-top"><span>{trophy.kind}</span>{won?<span className="won-badge"><BadgeCheck size={12}/> {wins.length} conquista{wins.length>1?'s':''}</span>:<LockKeyhole size={13}/>}</div>
          <Cup shape={trophy.shape} won={won}/>
          <h3>{trophy.name}</h3><p>{trophy.label}</p>
          <span className="trophy-state">{won?wins.map(function(item){return item.season;}).join(' · '):trophy.id==='brasileirao'?'Conquiste a Série A para liberar':'Competição preparada para fases futuras'}</span>
        </article>;
      })}</div>
      <div className="module-footnote"><Trophy size={15}/><p>Na Etapa 2 não existe mais botão para inventar taças. O Brasileirão é adicionado automaticamente ao campeão após a 38ª rodada. Libertadores, Sul-Americana, Copa do Brasil e Mundial já têm espaço reservado para as próximas engines.</p></div>
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
        {contract?<><strong style={{color:contract.offer.color}}>{contract.offer.name}</strong><span>{contract.offer.payment.label} · recebido {money(contract.totalReceived)}</span><small>{paymentText(contract.offer)}</small><button disabled={!canManage} onClick={function(){setPending({type:'end',item:contract.offer});}}>Encerrar contrato</button></>:<><div className="vacant-slot">+</div><span>Espaço disponível</span><small>Escolha uma proposta abaixo</small></>}
      </article>;
    })}</div>

    <div className="subheading offers-heading"><h3>Propostas disponíveis</h3><span>Valores fictícios para balanceamento do jogo</span></div>
    <div className="offers-grid">{offers.map(function(offer){
      const signed=active.some(function(item){return item.offerId===offer.id;});
      const occupied=active.some(function(item){return item.offer.slot===offer.slot;});
      const req=requirementStatus(offer,context);
      const disabled=occupied||!canManage||!req.ok;
      return <article className={'offer-card ' + (disabled?'unavailable':'')} key={offer.id}>
        <div className="offer-top"><span className="sponsor-wordmark" style={{color:offer.color}}>{offer.name}</span><span>{slots[offer.slot]}</span></div>
        <p>{offer.sector} · {offer.tagline}</p>
        <div className="offer-price">{paymentText(offer)}</div>
        <dl>
          <div><dt>Modelo</dt><dd>{offer.payment.label}</dd></div>
          <div><dt>Bônus na assinatura</dt><dd>{money(offer.payment.signingBonus)}</dd></div>
          <div><dt>Projeção mínima restante</dt><dd>{money(projectedOfferValue(offer,career.round))}</dd></div>
          <div><dt>Requisito</dt><dd className={req.ok?'requirement-ok':'requirement-blocked'}>{req.ok?'✓ ':'✕ '}{req.label}</dd></div>
        </dl>
        <button className="proposal-button" disabled={disabled} onClick={function(){setPending({type:'sign',item:offer});}}>{signed?'Contrato ativo':occupied?'Espaço ocupado':req.ok?'Analisar proposta':'Requisito pendente'}<ArrowRight size={15}/></button>
      </article>;
    })}</div>

    <div className="cash-ledger">
      <div className="subheading"><h3>Últimas movimentações</h3><span>Pagamentos entram automaticamente ao simular rodadas</span></div>
      {(career.transactions||[]).length?<div className="transaction-list">{career.transactions.slice(0,8).map(function(item){return <div key={item.id}><span>Rod. {item.round}</span><strong>{item.label}</strong><b>+ {money(item.amount)}</b></div>;})}</div>:<p className="no-transactions">Nenhuma movimentação de patrocínio ainda.</p>}
    </div>

    {pending&&<Modal title={pending.type==='sign'?'Assinar patrocínio':'Encerrar contrato'} onClose={function(){setPending(null);}}>
      <span className="modal-icon"><Handshake/></span>
      <div className="eyebrow">{club.name} · ETAPA 2</div>
      <h2>{pending.type==='sign'?'Contrato com '+pending.item.name:'Encerrar com '+pending.item.name+'?'}</h2>
      {pending.type==='sign'?<><p>{paymentText(pending.item)}. O dinheiro será lançado no caixa conforme as regras do contrato e a passagem das rodadas.</p><dl className="proposal-details"><div><dt>Espaço</dt><dd>{slots[pending.item.slot]}</dd></div><div><dt>Forma de pagamento</dt><dd>{pending.item.payment.label}</dd></div><div><dt>Pagamento imediato</dt><dd>{money((pending.item.payment.signingBonus||0)+(pending.item.payment.type==='upfront'?pending.item.payment.amount:0))}</dd></div><div><dt>Requisito</dt><dd>{pending.item.requirement.label}</dd></div></dl></>:<p>O patrocinador deixará de fazer novos pagamentos a partir da rodada atual. O que já entrou no caixa permanece registrado.</p>}
      <div className="modal-actions"><button className="secondary" onClick={function(){setPending(null);}}>Cancelar</button><button className="primary" onClick={function(){pending.type==='sign'?sign(pending.item):finish(pending.item);}}>{pending.type==='sign'?'Assinar contrato':'Confirmar encerramento'}</button></div>
    </Modal>}
  </div>;
}
