import React,{useEffect,useMemo,useState}from'react';
import{ArrowLeftRight,BadgeDollarSign,Handshake,Search,ShieldAlert,Users,X}from'lucide-react';
import{getClubWorld,rivalryLevel}from'./club-world.js';
import{estimatedMonthlySalary,evaluateTransferOffer,executeTransfer,findCareerPlayer,formatMarketEUR,formatMoneyBRL,negotiationPreset,playerKey,playerMarketValueEUR}from'./transfer-engine.js';
import{playerGameStats}from'./player-engine.js';
import{translatePosition}from'./position-labels.js';
import'./transfers.css';

function MarketValue({player,originClub}){
  const eur=playerMarketValueEUR(player,originClub);
  return <span className="market-value"><strong>{formatMarketEUR(eur.value)}</strong><small>{eur.source}</small></span>;
}
function DealModal({deal,setDeal,career,club,clubs,baseClubs,onCareerChange,onClose}){
  const item=findCareerPlayer(baseClubs,deal.playerKey);
  const [result,setResult]=useState(null);
  const [message,setMessage]=useState('');
  if(!item)return null;
  const player=item.player,originClub=item.originClub;
  const fromClub=clubs.find(c=>c.id===String(deal.fromClubId));
  const toClub=clubs.find(c=>c.id===String(deal.toClubId));
  const preset=negotiationPreset(player,originClub,toClub||club);
  const ownPlayers=club.players.filter(p=>(p._playerKey||playerKey(p._originClubId||club.id,p.id))!==deal.playerKey);
  function update(field,value){setDeal({...deal,[field]:value});setResult(null);setMessage('');}
  function negotiate(){
    const response=evaluateTransferOffer(career,baseClubs,deal);setResult(response);setMessage(response.reason||'');
  }
  function acceptCounter(){
    const next={...deal};
    if(result.counterAmount!==undefined)next.amount=result.counterAmount;
    if(result.counterLoanFee!==undefined)next.loanFee=result.counterLoanFee;
    if(result.counterSalaryShare!==undefined)next.salaryShare=result.counterSalaryShare;
    if(result.buyOption!==undefined)next.buyOption=result.buyOption;
    setDeal(next);setResult(null);setMessage('Contraproposta aplicada. Envie novamente para a diretoria.');
  }
  function conclude(){
    const done=executeTransfer(career,baseClubs,deal,result);
    if(done.error){setMessage(done.error);return;}
    onCareerChange(done.career);onClose();
  }
  const typeLabel={buy:'Compra',sell:'Oferecer jogador','loan-in':'Pegar emprestado','loan-out':'Emprestar jogador',swap:'Troca'}[deal.type]||'Negociação';
  return <div className="transfer-backdrop"><div className="transfer-modal">
    <button className="transfer-close" onClick={onClose}><X size={18}/></button>
    <div className="transfer-kicker">MERCADO · NEGOCIAÇÃO COM DIRETORIA</div><h2>{typeLabel}: {player.name}</h2>
    <div className="deal-player-summary"><div><strong>{fromClub?.name||originClub.name}</strong><span>→</span><strong>{toClub?.name||club.name}</strong></div><MarketValue player={player} originClub={originClub}/></div>
    {deal.type==='buy'&&<div className="deal-fields"><label>Oferta em dinheiro<input type="number" min="0" step="100000" value={deal.amount||0} onChange={e=>update('amount',Number(e.target.value))}/><small>Sugestão inicial: {formatMoneyBRL(preset.suggestedBid)}</small></label><label>Salário mensal estimado<input value={formatMoneyBRL(estimatedMonthlySalary(player,originClub))} disabled/></label></div>}
    {['loan-in','loan-out'].includes(deal.type)&&<div className="deal-fields"><label>Taxa do empréstimo<input type="number" min="0" step="100000" value={deal.loanFee||0} onChange={e=>update('loanFee',Number(e.target.value))}/></label><label>Salário pago pelo clube recebedor (%)<input type="number" min="0" max="100" step="10" value={deal.salaryShare||0} onChange={e=>update('salaryShare',Number(e.target.value))}/></label><label>Opção de compra<input type="number" min="0" step="100000" value={deal.buyOption||0} onChange={e=>update('buyOption',Number(e.target.value))}/></label><label>Duração<input value="Até o fim da temporada" disabled/></label></div>}
    {['sell','loan-out'].includes(deal.type)&&<label className="club-target-label">Clube interessado<select value={deal.toClubId} onChange={e=>update('toClubId',e.target.value)}>{clubs.filter(c=>c.id!==club.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    {deal.type==='swap'&&<div className="deal-fields"><label>Jogador oferecido<select value={deal.swapPlayerKey||''} onChange={e=>update('swapPlayerKey',e.target.value)}><option value="">Selecione...</option>{ownPlayers.map(p=>{const key=p._playerKey||playerKey(p._originClubId||club.id,p.id);return <option key={key} value={key}>{p.name}</option>;})}</select></label><label>Compensação em dinheiro<input type="number" min="0" step="100000" value={deal.amount||0} onChange={e=>update('amount',Number(e.target.value))}/></label></div>}
    <div className="deal-difficulty"><ShieldAlert size={15}/><span>{preset.rivalry===2?'Rival histórico: negociação muito mais difícil.':preset.rivalry===1?'Clubes do mesmo estado: resistência maior.':'Relação normal entre os clubes.'}</span></div>
    {message&&<div className={'ai-response '+(result?.status||'') }><strong>{result?.status==='accepted'?'PROPOSTA ACEITA':result?.status==='counter'?'CONTRAPROPOSTA':result?.status==='rejected'?'RECUSADA':'DIRETORIA DO CLUBE'}</strong><p>{message}</p>{result?.counterAmount!==undefined&&<span>Valor pedido: {formatMoneyBRL(result.counterAmount)}</span>}{result?.counterLoanFee!==undefined&&<span>Taxa pedida: {formatMoneyBRL(result.counterLoanFee)} · salário {result.counterSalaryShare}%</span>}</div>}
    <div className="transfer-actions"><button className="secondary-transfer" onClick={onClose}>Cancelar</button>{result?.status==='counter'&&<button className="counter-transfer" onClick={acceptCounter}>Aplicar contraproposta</button>}{result?.status==='accepted'?<button className="primary-transfer" onClick={conclude}>Concluir negócio</button>:<button className="primary-transfer" onClick={negotiate}>Enviar proposta</button>}</div>
  </div></div>;
}

export default function TransferMarket({career,onCareerChange,club,clubs,baseClubs,Crest,canManage}){
  const emptyFilters={name:'',position:'all',nationality:'all',club:'all'};
  const [view,setView]=useState('market');
  const [filters,setFilters]=useState(emptyFilters);
  const [appliedFilters,setAppliedFilters]=useState(null);
  const [deal,setDeal]=useState(null);
  const [visibleCount,setVisibleCount]=useState(24);
  const world=getClubWorld(club.id);

  const normalizeText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const countryNames=useMemo(()=>new Intl.DisplayNames(['pt-BR'],{type:'region'}),[]);
  const countryCodes={GHA:'GH',MOR:'MA',UKR:'UA',GUI:'GN',PAN:'PA',RDC:'CD',ENG:'GB',NED:'NL',CRO:'HR',SWE:'SE',CRM:'CM',CMR:'CM',ARG:'AR',BRA:'BR',URU:'UY',COL:'CO',PAR:'PY',CHI:'CL',CHL:'CL',ECU:'EC',VEN:'VE',PER:'PE',BOL:'BO',POR:'PT',PRT:'PT',ESP:'ES',FRA:'FR',ITA:'IT',USA:'US',MEX:'MX',SUI:'CH',CHE:'CH',GER:'DE',DEU:'DE',DEN:'DK',DNK:'DK',ANG:'AO',CPV:'CV'};
  const nationalityLabel=player=>{
    const region=countryCodes[player.countryCode];
    if(region){try{return countryNames.of(region)||player.nationality||'Não informada';}catch{}}
    return player.nationality||'Não informada';
  };
  const nationalityKey=player=>String(player.countryCode||player.nationality||'NI');

  const searchablePlayers=useMemo(()=>clubs
    .filter(owner=>owner.id!==club.id)
    .flatMap(owner=>owner.players.map(player=>({player,owner}))),[clubs,club.id]);

  const positionOptions=useMemo(()=>Array.from(new Set(searchablePlayers.map(({player})=>translatePosition(player.position)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR')),[searchablePlayers]);
  const nationalityOptions=useMemo(()=>{
    const byKey=new Map();
    for(const {player} of searchablePlayers)byKey.set(nationalityKey(player),nationalityLabel(player));
    return Array.from(byKey.entries()).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
  },[searchablePlayers,countryNames]);

  const marketAll=useMemo(()=>{
    if(!appliedFilters)return [];
    const name=normalizeText(appliedFilters.name);
    return searchablePlayers.filter(({player,owner})=>{
      if(name&&!normalizeText(player.name).includes(name))return false;
      if(appliedFilters.position!=='all'&&translatePosition(player.position)!==appliedFilters.position)return false;
      if(appliedFilters.nationality!=='all'&&nationalityKey(player)!==appliedFilters.nationality)return false;
      if(appliedFilters.club!=='all'&&owner.id!==appliedFilters.club)return false;
      return true;
    }).sort((a,b)=>{
      const ao=baseClubs.find(c=>c.id===String(a.player._originClubId||a.owner.id))||a.owner;
      const bo=baseClubs.find(c=>c.id===String(b.player._originClubId||b.owner.id))||b.owner;
      return playerMarketValueEUR(b.player,bo).value-playerMarketValueEUR(a.player,ao).value;
    });
  },[appliedFilters,searchablePlayers,baseClubs]);

  const market=marketAll.slice(0,visibleCount);
  useEffect(()=>setVisibleCount(24),[appliedFilters,view,club.id]);
  useEffect(()=>{setFilters(emptyFilters);setAppliedFilters(null);setVisibleCount(24);},[club.id]);

  const own=club.players.slice().sort((a,b)=>playerGameStats(b).overall-playerGameStats(a).overall);

  function submitSearch(event){
    event?.preventDefault();
    setAppliedFilters({...filters,name:filters.name.trim()});
    setVisibleCount(24);
  }
  function clearSearch(){
    setFilters(emptyFilters);
    setAppliedFilters(null);
    setVisibleCount(24);
  }
  function updateFilter(field,value){setFilters(current=>({...current,[field]:value}));}

  function openDeal(type,player,owner){
    if(!canManage||career.pendingRound)return;
    const originClub=baseClubs.find(c=>c.id===String(player._originClubId||owner.id))||owner,key=player._playerKey||playerKey(originClub.id,player.id),to=type==='sell'||type==='loan-out'?(clubs.find(c=>c.id!==club.id)?.id||''):club.id,from=type==='sell'||type==='loan-out'?club.id:owner.id,preset=negotiationPreset(player,originClub,clubs.find(c=>c.id===to)||club);
    setDeal({type,playerKey:key,fromClubId:from,toClubId:to,amount:preset.suggestedBid,loanFee:preset.loanFee,salaryShare:preset.salaryShare,buyOption:preset.buyOption,swapPlayerKey:''});
  }

  return <div className="transfer-content">
    <div className="transfer-heading"><div><div className="eyebrow">BASTIDORES DO FUTEBOL</div><h2>Mercado de transferências</h2><p>Pesquise apenas quem você quer analisar. Os filtros evitam carregar centenas de jogadores de uma vez e deixam o mercado mais rápido em qualquer aparelho.</p></div><span className="transfer-stage"><ArrowLeftRight size={14}/> Mercado aberto</span></div>
    <div className="transfer-finance-row"><article><BadgeDollarSign size={18}/><span><small>Caixa disponível</small><strong>{formatMoneyBRL(career.cash)}</strong></span></article><article><Handshake size={18}/><span><small>Orçamento salarial mensal</small><strong>{formatMoneyBRL(world.wageBudgetMonthlyM*1_000_000)}</strong></span></article><article><Users size={18}/><span><small>Elenco atual</small><strong>{club.players.length} jogadores</strong></span></article></div>
    {career.pendingRound&&<div className="transfer-lock"><ShieldAlert size={17}/><span>O mercado fica bloqueado enquanto uma rodada está em andamento.</span></div>}
    <div className="transfer-tabs"><button className={view==='market'?'active':''} onClick={()=>setView('market')}>Comprar / pegar emprestado</button><button className={view==='squad'?'active':''} onClick={()=>setView('squad')}>Oferecer / emprestar</button><button className={view==='history'?'active':''} onClick={()=>setView('history')}>Negócios concluídos</button></div>

    {view==='market'&&<>
      <form className="transfer-search-panel" onSubmit={submitSearch}>
        <div className="transfer-search-title"><div><Search size={17}/><span><strong>Buscar jogador</strong><small>Use um filtro ou combine vários para refinar o mercado.</small></span></div>{appliedFilters&&<button type="button" className="clear-market-search" onClick={clearSearch}><X size={14}/> Limpar</button>}</div>
        <div className="transfer-filter-grid">
          <label><span>Nome</span><input value={filters.name} onChange={e=>updateFilter('name',e.target.value)} placeholder="Ex.: Gabriel, Neymar..."/></label>
          <label><span>Posição</span><select value={filters.position} onChange={e=>updateFilter('position',e.target.value)}><option value="all">Todas as posições</option>{positionOptions.map(position=><option key={position} value={position}>{position}</option>)}</select></label>
          <label><span>Nacionalidade</span><select value={filters.nationality} onChange={e=>updateFilter('nationality',e.target.value)}><option value="all">Todas as nacionalidades</option>{nationalityOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label><span>Clube</span><select value={filters.club} onChange={e=>updateFilter('club',e.target.value)}><option value="all">Todos os clubes</option>{clubs.filter(c=>c.id!==club.id).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <div className="transfer-search-actions"><span>Todos os campos são opcionais. A busca só carrega os resultados depois da confirmação.</span><button type="submit"><Search size={15}/> Buscar</button></div>
      </form>

      {!appliedFilters&&<div className="market-search-empty"><Search size={26}/><strong>O mercado está pronto para sua busca</strong><p>Escolha apenas os filtros que desejar. Por exemplo, selecione somente uma posição para encontrar todos os jogadores daquela posição.</p></div>}

      {appliedFilters&&<div className="market-search-summary"><span><strong>{marketAll.length}</strong> {marketAll.length===1?'jogador encontrado':'jogadores encontrados'}</span><small>{marketAll.length>visibleCount?`Exibindo ${Math.min(visibleCount,marketAll.length)} por enquanto para manter a página leve.`:'Todos os resultados estão exibidos.'}</small></div>}

      {appliedFilters&&marketAll.length===0&&<div className="market-search-empty no-results"><Search size={24}/><strong>Nenhum jogador encontrado</strong><p>Tente remover um dos filtros ou buscar por parte do nome.</p></div>}

      {appliedFilters&&marketAll.length>0&&<><div className="market-grid">{market.map(({player,owner})=>{const origin=baseClubs.find(c=>c.id===String(player._originClubId||owner.id))||owner,stats=playerGameStats(player),rival=rivalryLevel(owner.id,club.id);return <article className="market-player-card" key={(player._playerKey||owner.id+':'+player.id)}><div className="market-club"><Crest club={owner}/><span>{owner.name}{rival===2&&<small>RIVAL</small>}</span></div><h3>{player.name}</h3><p>{translatePosition(player.position)} · {nationalityLabel(player)} · {player.age??'—'} anos · OVR {stats.overall}</p><MarketValue player={player} originClub={origin}/><div className="market-actions"><button disabled={!canManage||Boolean(career.pendingRound)} onClick={()=>openDeal('buy',player,owner)}>Negociar compra</button><button disabled={!canManage||Boolean(career.pendingRound)} onClick={()=>openDeal('loan-in',player,owner)}>Empréstimo</button><button disabled={!canManage||Boolean(career.pendingRound)} onClick={()=>openDeal('swap',player,owner)}>Troca</button></div></article>;})}</div>{market.length<marketAll.length&&<div className="market-load-more"><button onClick={()=>setVisibleCount(value=>Math.min(value+24,marketAll.length))}>Carregar mais jogadores ({marketAll.length-market.length} restantes)</button></div>}</>}
    </>}

    {view==='squad'&&<div className="market-grid">{own.map(player=>{const origin=baseClubs.find(c=>c.id===String(player._originClubId||club.id))||club,stats=playerGameStats(player);return <article className="market-player-card own-market-card" key={player._playerKey||club.id+':'+player.id}><div className="market-club"><Crest club={club}/><span>Seu elenco</span></div><h3>{player.name}</h3><p>{translatePosition(player.position)} · {player.age??'—'} anos · OVR {stats.overall}</p><MarketValue player={player} originClub={origin}/><div className="market-actions"><button disabled={!canManage||Boolean(career.pendingRound)} onClick={()=>openDeal('sell',player,club)}>Oferecer</button><button disabled={!canManage||Boolean(career.pendingRound)} onClick={()=>openDeal('loan-out',player,club)}>Emprestar</button></div></article>;})}</div>}
    {view==='history'&&<div className="transfer-history">{(career.transferHistory||[]).length?(career.transferHistory||[]).slice().reverse().map(item=><article key={item.id}><strong>{item.player}</strong><span>{clubs.find(c=>c.id===item.fromClubId)?.abbreviation||item.fromClubId} → {clubs.find(c=>c.id===item.toClubId)?.abbreviation||item.toClubId}</span><b>{item.type.includes('loan')?'Empréstimo':formatMoneyBRL(item.amount)}</b><small>Rodada {item.round} · {item.season}</small></article>):<p>Nenhum negócio concluído nesta carreira.</p>}</div>}
    <div className="transfer-source-note">Valores em euro usam referência de mercado Transfermarkt 2026. Quando não há correspondência individual no snapshot carregado, o jogo distribui o valor real estimado do elenco entre os atletas por idade, posição e rating interno. O euro do save usa câmbio de referência fixo para estabilidade do balanceamento.</div>
    {deal&&<DealModal deal={deal} setDeal={setDeal} career={career} club={club} clubs={clubs} baseClubs={baseClubs} onCareerChange={onCareerChange} onClose={()=>setDeal(null)}/>}
  </div>;
}
