import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
  Activity,ArrowLeft,ArrowRight,BadgeDollarSign,Briefcase,CalendarDays,ChevronRight,
  Download,Dumbbell,FileUp,Footprints,HeartPulse,History,Play,RotateCcw,Shield,
  Sparkles,Star,Target,Trophy,UserRound,Users,WalletCards
} from 'lucide-react';
import {
  PLAYER_ARCHETYPES,PLAYER_CAREER_KEY,PLAYER_MATCH_APPROACHES,PLAYER_POSITIONS,PLAYER_TRAINING,
  TRIAL_DRILLS,acknowledgePlayerMoment,answerTrialDrill,completeTrial,createPlayerCareer,
  negotiatePlayerContractOffer,nextPlayerMatchPreview,parsePlayerCareer,playerAgendaSnapshot,
  playerCalendarLabel,playerCareerOverall,playerObjectiveSnapshot,playerSquadCompetitionSnapshot,
  respondPlayerContractOffer,respondPlayerOffer,sanitizePlayerCareer,serializePlayerCareer,
  setPlayerContractPreference,setPlayerMatchApproach,setPlayerTraining,simulatePlayerDay,
  simulatePlayerUntilNextMatch,simulatePlayerWeek,trialScore
} from './player-career-engine.js';
import {
  PLAYER_AGENTS,PLAYER_ASSETS,PLAYER_BOOTS,PLAYER_HOMES,PLAYER_PHYSIOS,PLAYER_SERVICES,
  acceptPlayerSponsor,declinePlayerSponsor,playerFinancialSnapshot,purchasePlayerLifeItem,
  refreshPlayerSponsorOffers
} from './player-life-engine.js';
import {
  PLAYER_PERSONALITIES,PLAYER_WORLD_MARKETS,personalityDef,playerCareerClubPool
} from './player-world-engine.js';
import { POSITION_METRIC_LABELS } from './player-career-intelligence.js';
import PlayerLifeVisual from './PlayerLifeVisual.jsx';
import PlayerMomentModal from './PlayerMomentModal.jsx';
import './player-career.css';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const WEEK_DAYS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const positionLabel=id=>PLAYER_POSITIONS.find(item=>item.id===id)?.label||id;
const clubById=(clubs,id)=>clubs.find(club=>String(club.id)===String(id))||null;
const pct=value=>Math.round(Math.max(0,Math.min(1,Number(value)||0))*100);
const statLabel={finishing:'Finalização',passing:'Passe',defending:'Defesa',pace:'Velocidade',physical:'Físico',technique:'Técnica',goalkeeping:'Goleiro'};
function initials(name){return String(name||'LF').split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();}
function PlayerMark({name,position,large=false}){return <span className={'pc-player-mark '+(large?'large':'')} aria-label={'Identificador de '+name}><b>{initials(name)}</b><small>{position||'LF'}</small></span>;}

function Creator({clubs,onCreate}){
  const [form,setForm]=useState({name:'',position:'MEI',foot:'right',archetype:'technical',personalityId:'professional',dreamClubId:clubs[0]?.id||''});
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <section className="pc-creator">
    <div className="pc-creator-intro"><span className="pc-eyebrow">MODO CARREIRA JOGADOR · RC7</span><h1>Comece aos 16. Conquiste seu espaço.</h1><p>A criação facial foi retirada desta versão. O foco agora é futebol, decisões e evolução de carreira.</p></div>
    <div className="pc-creator-layout">
      <aside className="pc-identity-preview"><PlayerMark name={form.name||'Seu jogador'} position={form.position} large/><div><strong>{form.name||'Seu jogador'}</strong><span>16 anos · {positionLabel(form.position)}</span><small>{personalityDef(form.personalityId).name} · {PLAYER_ARCHETYPES.find(item=>item.id===form.archetype)?.label}</small></div></aside>
      <div className="pc-form">
        <label className="pc-name-field"><span>Nome do jogador</span><input autoFocus maxLength="40" value={form.name} onChange={event=>update('name',event.target.value)} placeholder="Digite o nome"/></label>
        <div><span className="pc-field-label">Posição</span><div className="pc-choice-grid four">{PLAYER_POSITIONS.map(item=><button type="button" key={item.id} className={form.position===item.id?'selected':''} onClick={()=>update('position',item.id)}><strong>{item.label}</strong><small>{item.id}</small></button>)}</div></div>
        <div><span className="pc-field-label">Estilo em campo</span><div className="pc-choice-grid">{PLAYER_ARCHETYPES.map(item=><button type="button" key={item.id} className={form.archetype===item.id?'selected':''} onClick={()=>update('archetype',item.id)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></div>
        <div><span className="pc-field-label">Personalidade</span><div className="pc-personality-grid">{PLAYER_PERSONALITIES.map(item=><button type="button" key={item.id} className={form.personalityId===item.id?'selected':''} onClick={()=>update('personalityId',item.id)}><strong>{item.name}</strong><small>{item.description}</small></button>)}</div></div>
        <div className="pc-inline-fields"><label><span>Pé dominante</span><select value={form.foot} onChange={event=>update('foot',event.target.value)}><option value="right">Direito</option><option value="left">Esquerdo</option></select></label><label><span>Clube dos sonhos</span><select value={form.dreamClubId} onChange={event=>update('dreamClubId',event.target.value)}>{clubs.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(club=><option key={club.id} value={club.id}>{club.name}</option>)}</select><small>É uma meta. A peneira define onde você começa.</small></label></div>
        <div className="pc-rule-note"><Shield size={18}/><span><strong>Sem escolha direta do primeiro clube.</strong><small>Seu desempenho na peneira define a base compatível. Empresário, reputação e desempenho abrem outros mercados depois.</small></span></div>
        <button className="pc-primary" disabled={!form.name.trim()} onClick={()=>onCreate(createPlayerCareer(form))}>Ir para a peneira <ArrowRight size={17}/></button>
      </div>
    </div>
  </section>;
}

function Trial({career,clubs,onChange}){
  const answers=career.trial?.answers||{},answered=Object.keys(answers).length,next=TRIAL_DRILLS.find(drill=>!answers[drill.id]),score=trialScore(career);
  if(!next){
    const dream=clubById(clubs,career.dreamClubId);
    return <section className="pc-trial pc-trial-finish"><Target size={35}/><span className="pc-eyebrow">PENEIRA CONCLUÍDA</span><h2>Relatório da comissão</h2><p>Os cinco testes foram avaliados pela mesma engine de atributos, risco e execução.</p><div className="pc-trial-meter"><i style={{width:(score||0)+'%'}}/><b>{score}/100</b></div><small>Clube dos sonhos: {dream?.name||'—'}</small><button className="pc-primary" onClick={()=>onChange(completeTrial(career,clubs))}>Ver onde fui aprovado <ArrowRight size={17}/></button></section>;
  }
  return <section className="pc-trial"><header><span className="pc-eyebrow">PENEIRA · TESTE {answered+1}/{TRIAL_DRILLS.length}</span><h2>{next.title}</h2><p>{next.copy}</p></header><div className="pc-trial-progress">{TRIAL_DRILLS.map((drill,index)=><i key={drill.id} className={answers[drill.id]?'done':index===answered?'current':''}/>)}</div><div className="pc-trial-choices">{next.choices.map(choice=><button key={choice.id} onClick={()=>onChange(answerTrialDrill(career,next.id,choice.id))}><span>{choice.label}</span><ChevronRight size={17}/></button>)}</div><div className="pc-trial-tip"><Star size={15}/> O risco da escolha altera a variância; não existe resposta perfeita.</div></section>;
}

function StatusHero({career,club}){
  const p=career.player,competition=career.stage==='free-agent'?null:career.lastMatch?.status;
  return <section className="pc-status-hero">
    <div className="pc-status-identity"><PlayerMark name={p.name} position={p.position}/><div><small>{career.stage==='academy'?'CATEGORIAS DE BASE':career.stage==='free-agent'?'SEM CLUBE':career.stage==='retired'?'CARREIRA ENCERRADA':'ELENCO PROFISSIONAL'}</small><h2>{p.name}</h2><span>{career.age} anos · {positionLabel(p.position)} · {club?.name||'Mercado de jogadores'}</span></div></div>
    <strong className="pc-ovr">{playerCareerOverall(career)}<small>OVR</small></strong>
    <div className="pc-hero-vitals"><span><small>Condição</small><b>{Math.round(p.condition)}%</b></span><span><small>Moral</small><b>{Math.round(p.morale)}%</b></span><span><small>Confiança</small><b>{Math.round(p.coachTrust)}%</b></span><span><small>Status</small><b>{competition||career.contract?.role||'Em avaliação'}</b></span></div>
    {p.injury&&<div className="pc-injury"><HeartPulse size={17}/><span><strong>{p.injury.label}</strong><small>{p.injury.daysRemaining} dia(s) para retorno · risco de sequela {Math.round(Number(p.injury.permanentLossRisk||0)*100)}%</small></span></div>}
  </section>;
}

function CareerOffer({career,clubs,onChange}){
  const offer=career.pendingOffer;if(!offer)return null;
  return <section className={'pc-offer '+(offer.dreamClub?'dream-offer':'')}><Briefcase size={21}/><div><small>{offer.dreamClub?'CLUBE DOS SONHOS · PROPOSTA':'PROPOSTA DE TRANSFERÊNCIA'}</small><strong>{offer.clubName}</strong><p>{offer.league||'Liga nacional'} · {offer.role} · {offer.years} anos · {money.format(offer.salaryMonthly||0)}/mês · luvas {money.format(offer.signingBonus||0)}.</p></div><div><button onClick={()=>onChange(respondPlayerOffer(career,clubs,false))}>Recusar</button><button className="accept" onClick={()=>onChange(respondPlayerOffer(career,clubs,true))}>Aceitar</button></div></section>;
}

function ContractOffer({career,onChange}){
  const offer=career.pendingContractOffer;if(!offer)return null;
  return <section className="pc-offer pc-contract-offer"><Briefcase size={21}/><div><small>RENOVAÇÃO DE CONTRATO</small><strong>{offer.clubName}</strong><p>{offer.role} · {offer.years} anos · {money.format(offer.salaryMonthly||0)}/mês · luvas {money.format(offer.signingBonus||0)} · resposta até o dia {Number(offer.expiresDay||0)+1}.</p>{offer.negotiated&&<em>{offer.negotiationResult==='accepted'?'O clube aceitou a contraproposta.':'O clube manteve os termos atuais.'}</em>}</div><div className="pc-offer-actions">{!offer.negotiated&&<><button onClick={()=>onChange(negotiatePlayerContractOffer(career,'salary'))}>Pedir salário</button><button onClick={()=>onChange(negotiatePlayerContractOffer(career,'role'))}>Pedir titularidade</button><button onClick={()=>onChange(negotiatePlayerContractOffer(career,'bonus'))}>Pedir luvas</button></>}<button onClick={()=>onChange(respondPlayerContractOffer(career,false))}>Recusar</button><button className="accept" onClick={()=>onChange(respondPlayerContractOffer(career,true))}>Renovar</button></div></section>;
}

function AgendaPanel({career,clubs,onChange}){
  const agenda=playerAgendaSnapshot(career),preview=nextPlayerMatchPreview(career,clubs),last=career.lastDay;
  return <section className="pc-panel pc-agenda-panel"><div className="pc-panel-head"><div><small className="pc-eyebrow">AGENDA</small><h3>{playerCalendarLabel(career)} · Semana {career.week+1}</h3></div><CalendarDays size={18}/></div>
    <div className="pc-agenda-strip">{agenda.map((item,index)=><article key={index} className={'pc-agenda-day '+item.type+(index===0?' today':'')}><small>{WEEK_DAYS[(Number(career.dayOfWeek||0)+index)%7]}</small><strong>{index===0?'Hoje':item.label}</strong><span>{item.detail}</span></article>)}</div>
    {last&&<div className="pc-last-day"><Activity size={16}/><span><strong>{last.title}</strong><small>{last.text}</small></span></div>}
    <div className="pc-advance-actions"><button className="pc-secondary" onClick={()=>onChange(simulatePlayerDay(career,clubs))}><Play size={15}/> 1 dia</button><button className="pc-secondary" onClick={()=>onChange(simulatePlayerUntilNextMatch(career,clubs))}><Target size={15}/> Até o próximo jogo</button><button className="pc-primary" onClick={()=>onChange(simulatePlayerWeek(career,clubs))}><Play size={15}/> 7 dias</button></div>
    {preview&&<small className="pc-engine-note">Próximo jogo em {preview.daysUntil} dia(s). Treino, recuperação, contratos, mercado e finanças só avançam com o calendário.</small>}
  </section>;
}

function PreMatchPanel({career,clubs,onChange}){
  const preview=nextPlayerMatchPreview(career,clubs);if(!preview)return <section className="pc-panel"><h3>Próximo jogo</h3><p className="pc-empty">Sem partida marcada neste momento.</p></section>;
  const b=preview.briefing;
  return <section className="pc-panel pc-prematch"><div className="pc-panel-head"><div><small className="pc-eyebrow">{preview.competition}</small><h3>{preview.opponentName}</h3></div><Target size={18}/></div>
    <div className="pc-prematch-grid"><span><small>Status projetado</small><b>{b.role}</b></span><span><small>Chance de iniciar</small><b>{b.selectionChance}%</b></span><span><small>Dificuldade</small><b>{b.difficulty}</b></span><span><small>Treinador</small><b>{b.coachName}</b></span></div>
    <div className="pc-coach-message"><strong>Pedido do treinador</strong><p>{b.expectation}</p><small>Objetivo individual: {b.objective}</small></div>
    <span className="pc-subheading">COMPORTAMENTO EM JOGO</span><div className="pc-approach-compact">{PLAYER_MATCH_APPROACHES.map(item=><button key={item.id} className={career.matchApproach===item.id?'active':''} onClick={()=>onChange(setPlayerMatchApproach(career,item.id))}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>
  </section>;
}

function LastMatch({career}){
  const last=career.lastMatch;if(!last)return <section className="pc-panel"><h3>Última partida</h3><p className="pc-empty">Sua primeira partida ainda não foi simulada.</p></section>;
  const performance=last.performance,labels=POSITION_METRIC_LABELS[career.player.position]||{};
  return <section className="pc-panel pc-postmatch"><div className="pc-panel-head"><div><small className="pc-eyebrow">PÓS-JOGO</small><h3>{last.resultLabel} · {last.opponentName}</h3></div><b className="pc-score">{last.goalsFor} × {last.goalsAgainst}</b></div>
    {!last.selected?<div className="pc-match-result muted"><strong>{last.injured?'Em recuperação':'Sem minutos'}</strong><span>Chance de iniciar calculada em {Math.round((last.selectionChance||0)*100)}%.</span></div>:<>
      <div className="pc-match-rating"><strong>{performance.rating.toFixed(1)}</strong><span>{last.started?'Titular':'Entrou do banco'}</span><span>{performance.minutes}'</span><span>Energia final {last.energyEnd}%</span><span>{performance.goals} gol(s)</span><span>{performance.assists} assistência(s)</span></div>
      {performance.metrics&&<div className="pc-role-metrics">{Object.entries(performance.metrics).map(([key,value])=><span key={key}><small>{labels[key]||key}</small><b>{typeof value==='number'&&!Number.isInteger(value)?value.toFixed(2):value}</b></span>)}</div>}
    </>}
    {last.coachReview&&<div className={'pc-review '+last.coachReview.tone}><strong>{last.coachReview.title}</strong><p>{last.coachReview.text}</p><small>Impacto na confiança: {last.coachReview.trustDelta>=0?'+':''}{last.coachReview.trustDelta}</small></div>}
    {last.timeline?.length>0&&<div className="pc-match-timeline"><span className="pc-subheading">EVENTOS DA PARTIDA</span>{last.timeline.map((event,index)=><div key={index}><b>{event.minute}'</b><span>{event.text}</span></div>)}</div>}
  </section>;
}

function CompetitionPanel({career,clubs}){
  const snapshot=playerSquadCompetitionSnapshot(career,clubs);if(!snapshot)return null;
  const p=career.player;
  return <section className="pc-panel pc-competition-panel"><div className="pc-panel-head"><div><small className="pc-eyebrow">HIERARQUIA DO ELENCO</small><h3>{snapshot.status}</h3></div><Users size={18}/></div>
    <div className="pc-selection-meter"><span><strong>Sua chance de titularidade</strong><b>{pct(snapshot.starterChance)}%</b></span><i><em style={{width:pct(snapshot.starterChance)+'%'}}/></i><small>Qualidade, forma, condição, encaixe, confiança, desempenho recente, concorrência e disciplina entram no cálculo.</small></div>
    <div className="pc-coach-card"><div><small>TREINADOR</small><strong>{snapshot.coach.name}</strong><span>{snapshot.coach.profileName}</span></div><p>{snapshot.coach.description}</p><dl><span><dt>Encaixe tático</dt><dd>{snapshot.tacticalCompatibility}%</dd></span><span><dt>Disciplina</dt><dd>{snapshot.discipline}%</dd></span></dl></div>
    <span className="pc-subheading">CONCORRÊNCIA NA POSIÇÃO</span><div className="pc-rivals">{snapshot.rivals.map((rival,index)=><article key={rival.id} className={index===0?'main-rival':''}><PlayerMark name={rival.name} position={rival.position}/><div><strong>{rival.name}</strong><small>{rival.age} anos · {rival.matches} jogo(s)</small></div><b>{rival.overall}<small>OVR</small></b><span className={rival.form>=0?'positive':'negative'}>{rival.form>=0?'+':''}{rival.form}</span></article>)}</div>
  </section>;
}

function TrainingPanel({career,onChange}){
  const personality=personalityDef(career.player.personalityId);
  return <section className="pc-panel pc-development-plan"><div className="pc-panel-head"><div><small className="pc-eyebrow">DESENVOLVIMENTO</small><h3>Plano de treino</h3></div><Dumbbell size={18}/></div><div className="pc-training-list">{PLAYER_TRAINING.map(item=><button key={item.id} className={career.trainingFocus===item.id?'active':''} onClick={()=>onChange(setPlayerTraining(career,item.id))}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><div className="pc-personality-summary"><Star size={17}/><span><strong>{personality.name}</strong><small>{personality.description}</small></span></div></section>;
}

function ObjectivesPanel({career}){
  const objectives=playerObjectiveSnapshot(career);
  return <section className="pc-panel pc-objectives"><div className="pc-panel-head"><h3>Objetivos individuais</h3><Target size={17}/></div><div>{objectives.map(item=><article key={item.id} className={item.completed?'done':''}><span><strong>{item.label}</strong><small>{Number(item.value).toFixed(item.metric==='averageRating'?1:0)} / {item.target}</small></span><i><b style={{width:Math.round(item.progress*100)+'%'}}/></i></article>)}</div><small>Objetivos cumpridos alimentam confiança, reputação, contrato e mercado.</small></section>;
}

function AttributesPanel({career}){
  const snapshot=playerFinancialSnapshot(career),bonus=snapshot.boots?.bonuses||{};
  return <section className="pc-panel"><div className="pc-panel-head"><h3>Atributos</h3><Footprints size={17}/></div><div className="pc-attributes">{Object.entries(career.player.attributes).filter(([key])=>key!=='goalkeeping'||career.player.position==='GOL').map(([key,value])=>{const extra=Number(bonus[key]||0);return <span key={key}><small>{statLabel[key]||key}</small><b>{Math.round(Number(value)+extra)}{extra>0?<em>+{extra}</em>:null}</b><i><em style={{width:Math.min(100,Number(value)+extra)+'%'}}/></i></span>;})}</div></section>;
}

function StatsPanel({career}){
  const s=career.seasonStats||{},avg=s.matches?s.totalRating/s.matches:0,t=career.teamSeason||{};
  return <section className="pc-panel"><div className="pc-panel-head"><h3>Temporada {career.season}</h3><Trophy size={17}/></div><div className="pc-stat-grid"><span><b>{s.matches||0}</b><small>Jogos</small></span><span><b>{s.starts||0}</b><small>Titular</small></span><span><b>{s.goals||0}</b><small>Gols</small></span><span><b>{s.assists||0}</b><small>Assist.</small></span><span><b>{s.minutes||0}</b><small>Minutos</small></span><span><b>{avg?avg.toFixed(1):'—'}</b><small>Média</small></span></div><div className="pc-team-record"><span><small>Campanha</small><b>{t.wins||0}V · {t.draws||0}E · {t.losses||0}D</b></span><span><small>Pontos</small><b>{t.points||0}</b></span></div></section>;
}

function ContractHub({career,clubs,onChange}){
  const contract=career.contract,finance=playerFinancialSnapshot(career),currentClub=clubById(playerCareerClubPool(clubs),career.clubId),currentMarket=PLAYER_WORLD_MARKETS.find(item=>item.id===(currentClub?.country||'BRA')),accessible=new Set(finance.agent.markets||['BRA']);
  return <div className="pc-contract-hub">
    <section className="pc-panel pc-contract-main"><div className="pc-panel-head"><div><small className="pc-eyebrow">CONTRATO</small><h3>{contract?.clubName||'Sem vínculo'}</h3></div><Briefcase size={18}/></div>{contract?<div className="pc-contract-facts"><span><small>Salário</small><b>{money.format(contract.salaryMonthly)}/mês</b></span><span><small>Vínculo</small><b>até {contract.expirySeason}</b></span><span><small>Papel</small><b>{contract.role}</b></span><span><small>Satisfação</small><b>{Math.round(career.player.contractSatisfaction)}%</b></span><span><small>Valor de mercado</small><b>{money.format(career.player.marketValue||0)}</b></span><span><small>Liga atual</small><b>{currentMarket?.league||currentClub?.league||'—'}</b></span></div>:<p className="pc-empty">Seu empresário está procurando propostas compatíveis com reputação, nível e alcance.</p>}
      {contract&&<><span className="pc-subheading">SUA POSIÇÃO SOBRE O FUTURO</span><div className="pc-contract-preferences">{[['renew','Quero renovar'],['open','Aberto a propostas'],['leave','Quero sair'],['starter','Quero ser titular']].map(([id,label])=><button key={id} className={career.contractPreference===id?'active':''} onClick={()=>onChange(setPlayerContractPreference(career,id))}>{label}</button>)}</div></>}
    </section>
    <section className="pc-panel"><div className="pc-panel-head"><h3>Alcance do empresário</h3><Briefcase size={17}/></div><p>{finance.agent.name} · comissão {Math.round(finance.agent.commission*100)}% · bônus de negociação {finance.agent.negotiation||0}.</p><div className="pc-market-access">{PLAYER_WORLD_MARKETS.map(market=><span key={market.id} className={accessible.has(market.id)?'open':'locked'}><strong>{market.name}</strong><small>{market.league}</small><em>{accessible.has(market.id)?'Mercado acessível':'Exige empresário melhor'}</em></span>)}</div></section>
  </div>;
}

function LifeOption({type,item,active,owned,onChoose}){
  const service=type==='service',asset=type==='asset';
  const label=service&&active?'Desativar':asset&&owned?'Adquirido':active?'Ativo':owned?'Equipar':item.cost===0?'Selecionar':'Adquirir';
  return <article className={'pc-life-option '+(active?'active':'')}><div><strong>{item.name}</strong><p>{item.description}</p></div><span>{item.cost?money.format(item.cost):'Sem custo'}{item.monthly?<> · {money.format(item.monthly)}/mês</>:null}</span><button disabled={(active&&!service)||(asset&&owned)} onClick={()=>onChoose(type,item.id)}>{label}</button></article>;
}

function LifeHub({career,onChange,onNotice}){
  const snapshot=playerFinancialSnapshot(career),finance=career.finance||{},sponsor=finance.sponsorship,offers=finance.sponsorOffers||[];
  function choose(type,id){const result=purchasePlayerLifeItem(career,type,id);if(result.error){onNotice(result.error);return;}onChange(result.career);onNotice(result.deactivated?'Serviço desativado.':result.equipped?'Configuração atualizada.':'Decisão financeira concluída.');}
  function searchSponsors(){const next=refreshPlayerSponsorOffers(career);onChange(next);onNotice(next.finance?.sponsorOffers?.length?'Novas propostas chegaram.':'Nenhuma marca fez proposta agora.');}
  function acceptSponsor(id){const result=acceptPlayerSponsor(career,id);if(result.error){onNotice(result.error);return;}onChange(result.career);onNotice('Patrocínio assinado.');}
  return <div className="pc-life-hub">
    <section className="pc-finance-hero"><div><small className="pc-eyebrow">FINANÇAS PESSOAIS</small><h2>{money.format(snapshot.cash)}</h2><p>Dinheiro pessoal é separado do caixa do clube. Serviços precisam justificar seu custo dentro da engine.</p></div><WalletCards size={38}/><div className="pc-finance-metrics"><span><small>Entrada mensal</small><b>{money.format(snapshot.grossMonthly)}</b></span><span><small>Custos mensais</small><b>{money.format(snapshot.projectedExpenses)}</b></span><span><small>Líquido projetado</small><b>{money.format(snapshot.projectedNet)}</b></span><span><small>Renda patrimonial</small><b>{money.format(snapshot.assetIncome||0)}</b></span></div></section>
    <section className="pc-life-category"><PlayerLifeVisual type="agent" subtitle="REPRESENTAÇÃO" title={snapshot.agent.name}/><div className="pc-life-category-copy"><h3>Empresário</h3><p>Controla mercados acessíveis, negociação de salário, papel, luvas, patrocínios e frequência de propostas.</p></div><div className="pc-life-options">{PLAYER_AGENTS.map(item=><LifeOption key={item.id} type="agent" item={item} active={snapshot.agentId===item.id} onChoose={choose}/>)}</div></section>
    <section className="pc-life-category"><PlayerLifeVisual type="boots" subtitle="EQUIPAMENTO" title={snapshot.boots.name}/><div className="pc-life-category-copy"><h3>Chuteiras</h3><p>Bônus temporários entram nos atributos efetivos sem alterar permanentemente a base.</p></div><div className="pc-life-options">{PLAYER_BOOTS.filter(item=>career.player.position==='GOL'||item.id!=='keeper').map(item=><LifeOption key={item.id} type="boots" item={item} active={snapshot.bootsId===item.id} owned={snapshot.ownedBoots.includes(item.id)} onChoose={choose}/>)}</div></section>
    <section className="pc-life-category"><PlayerLifeVisual type="physio" subtitle="SAÚDE" title={snapshot.physio.name}/><div className="pc-life-category-copy"><h3>Fisioterapia</h3><p>Reduz risco, melhora recuperação diária e encurta tempo de lesão.</p></div><div className="pc-life-options">{PLAYER_PHYSIOS.map(item=><LifeOption key={item.id} type="physio" item={item} active={snapshot.physioId===item.id} onChoose={choose}/>)}</div></section>
    <section className="pc-life-category"><PlayerLifeVisual type="service" subtitle="EQUIPE PESSOAL" title={(snapshot.services||[]).length+' serviço(s) ativo(s)'}/><div className="pc-life-category-copy"><h3>Equipe de performance</h3><p>Nutrição, treino físico, técnica, finalização e psicologia alteram recuperação, treino e atributos efetivos.</p></div><div className="pc-life-options">{PLAYER_SERVICES.filter(item=>career.player.position!=='GOL'||item.id!=='finishing-coach').map(item=><LifeOption key={item.id} type="service" item={item} active={snapshot.serviceIds.includes(item.id)} onChoose={choose}/>)}</div></section>
    <section className="pc-life-category"><PlayerLifeVisual type="home" subtitle="MORADIA" title={snapshot.home.name}/><div className="pc-life-category-copy"><h3>Casa</h3><p>Conforto influencia recuperação, moral e imagem, com manutenção mensal.</p></div><div className="pc-life-options">{PLAYER_HOMES.map(item=><LifeOption key={item.id} type="home" item={item} active={snapshot.homeId===item.id} owned={snapshot.ownedHomes.includes(item.id)} onChoose={choose}/>)}</div></section>
    <section className="pc-life-category"><PlayerLifeVisual type="asset" subtitle="PATRIMÔNIO" title={(snapshot.assets||[]).length+' ativo(s)'}/><div className="pc-life-category-copy"><h3>Patrimônio & projetos</h3><p>Carro, investimentos, instituto social e imóveis possuem efeitos financeiros ou de reputação mensuráveis.</p></div><div className="pc-life-options">{PLAYER_ASSETS.map(item=><LifeOption key={item.id} type="asset" item={item} owned={snapshot.ownedAssets.includes(item.id)} onChoose={choose}/>)}</div></section>
    <section className="pc-life-category pc-sponsor-market"><PlayerLifeVisual type="sponsor" subtitle="IMAGEM" title={sponsor?.name||'Sem patrocinador'}/><div className="pc-life-category-copy"><h3>Patrocínios</h3><p>Reputação, desempenho, personalidade e empresário definem acesso e valores.</p></div>{sponsor?<div className="pc-active-sponsor"><BadgeDollarSign size={18}/><div><strong>{sponsor.name}</strong><small>{money.format(sponsor.monthly)}/mês · {sponsor.monthsRemaining} mês(es) · bônus {money.format(sponsor.performanceBonus||0)} se média ≥ {Number(sponsor.targetAverage||0).toFixed(2)}</small></div></div>:<button className="pc-secondary pc-sponsor-search" onClick={searchSponsors}><Sparkles size={15}/> Consultar mercado</button>}{!sponsor&&offers.length>0&&<div className="pc-sponsor-offers">{offers.map(offer=><article key={offer.id}><div><strong>{offer.name}</strong><p>{offer.description}</p><small>Luvas {money.format(offer.signing)} · {money.format(offer.monthly)}/mês · {offer.months} meses.</small></div><div><button onClick={()=>onChange(declinePlayerSponsor(career,offer.id))}>Recusar</button><button className="accept" onClick={()=>acceptSponsor(offer.id)}>Assinar</button></div></article>)}</div>}</section>
    <section className="pc-panel pc-transactions"><div className="pc-panel-head"><h3>Extrato</h3><History size={17}/></div>{snapshot.transactions.length?<div>{snapshot.transactions.slice(0,14).map(item=><article key={item.id}><span><strong>{item.label}</strong><small>Temporada {item.season} · dia {Number(item.day||0)+1}</small></span><b className={item.amount>=0?'positive':'negative'}>{item.amount>=0?'+':''}{money.format(item.amount)}</b></article>)}</div>:<p className="pc-empty">As movimentações aparecem após pagamentos ou compras.</p>}</section>
  </div>;
}

function DevelopmentHub({career,clubs,onChange}){return <div className="pc-development-hub"><CompetitionPanel career={career} clubs={clubs}/><TrainingPanel career={career} onChange={onChange}/><ObjectivesPanel career={career}/><AttributesPanel career={career}/><StatsPanel career={career}/></div>;}

function HistoryHub({career}){
  return <div className="pc-history-hub"><section className="pc-panel pc-news-panel"><div className="pc-panel-head"><h3>Notícias</h3><Star size={17}/></div>{career.news?.length?<div>{career.news.slice(0,16).map(item=><article key={item.id}><small>{item.season} · S{item.week??0}</small><strong>{item.title}</strong><p>{item.text}</p></article>)}</div>:<p className="pc-empty">As notícias surgem conforme a carreira avança.</p>}</section><section className="pc-timeline"><div className="pc-panel-head"><h3>Linha do tempo</h3><UserRound size={17}/></div>{career.timeline.slice(0,30).map(item=><article key={item.id}><b>{item.season}<small>D{Number(item.day??item.week*7??0)+1}</small></b><div><strong>{item.title}</strong><p>{item.text}</p></div></article>)}</section><section className="pc-panel"><div className="pc-panel-head"><h3>Prêmios & marcos</h3><Trophy size={17}/></div><div className="pc-awards-grid">{career.awards?.length?career.awards.map(item=><article key={item.id}><Trophy size={16}/><strong>{item.title}</strong><small>{item.season}</small></article>):<p className="pc-empty">Ainda não há prêmios individuais.</p>}</div></section></div>;
}

function TodayHub({career,clubs,onChange}){return <div className="pc-today-grid"><AgendaPanel career={career} clubs={clubs} onChange={onChange}/><PreMatchPanel career={career} clubs={clubs} onChange={onChange}/><LastMatch career={career}/></div>;}

function Dashboard({career,clubs,onChange,onReset,onNotice}){
  const [view,setView]=useState('today'),pool=useMemo(()=>playerCareerClubPool(clubs),[clubs]),club=clubById(pool,career.clubId);
  return <div className="pc-dashboard"><StatusHero career={career} club={club}/><CareerOffer career={career} clubs={clubs} onChange={onChange}/><ContractOffer career={career} onChange={onChange}/>
    <nav className="pc-mode-tabs" aria-label="Áreas da carreira do jogador"><button className={view==='today'?'active':''} onClick={()=>setView('today')}><CalendarDays size={16}/> Hoje</button><button className={view==='development'?'active':''} onClick={()=>setView('development')}><Dumbbell size={16}/> Desenvolvimento</button><button className={view==='contract'?'active':''} onClick={()=>setView('contract')}><Briefcase size={16}/> Contrato & mercado</button><button className={view==='life'?'active':''} onClick={()=>setView('life')}><WalletCards size={16}/> Finanças</button><button className={view==='history'?'active':''} onClick={()=>setView('history')}><History size={16}/> História</button></nav>
    {view==='today'&&<TodayHub career={career} clubs={clubs} onChange={onChange}/>}
    {view==='development'&&<DevelopmentHub career={career} clubs={clubs} onChange={onChange}/>}
    {view==='contract'&&<ContractHub career={career} clubs={clubs} onChange={onChange}/>}
    {view==='life'&&<LifeHub career={career} onChange={onChange} onNotice={onNotice}/>}
    {view==='history'&&<HistoryHub career={career}/>}
    <button className="pc-reset" onClick={onReset}><RotateCcw size={14}/> Nova carreira de jogador</button>
  </div>;
}

export default function PlayerCareer({clubs,onExit}){
  const fileInput=useRef(null),pool=useMemo(()=>playerCareerClubPool(clubs),[clubs]);
  const [career,setCareer]=useState(()=>{try{return sanitizePlayerCareer(JSON.parse(localStorage.getItem(PLAYER_CAREER_KEY)||'null'),clubs);}catch{return null;}});
  const [notice,setNotice]=useState('');
  useEffect(()=>{try{if(career)localStorage.setItem(PLAYER_CAREER_KEY,JSON.stringify(career));else localStorage.removeItem(PLAYER_CAREER_KEY);}catch{setNotice('O navegador bloqueou o autosave. Exporte um backup se continuar jogando.');}},[career]);
  const club=useMemo(()=>clubById(pool,career?.clubId),[pool,career?.clubId]);
  function download(){if(!career)return;const blob=new Blob([serializePlayerCareer(career)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='linha-de-frente-jogador-'+career.player.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.ldfp';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
  async function load(file){if(!file)return;try{setCareer(parsePlayerCareer(await file.text(),clubs));setNotice('Carreira de jogador carregada.');}catch(error){setNotice(error.message||'Arquivo inválido.');}if(fileInput.current)fileInput.current.value='';}
  function reset(){if(confirm('Criar uma nova carreira de jogador? O autosave atual será substituído.'))setCareer(null);}
  return <main className="player-career-shell"><header className="pc-topbar"><button onClick={onExit}><ArrowLeft size={16}/> Menu</button><div><span className="pc-brand">L<span>F</span></span><strong>CARREIRA JOGADOR</strong></div><div className="pc-save-actions">{career&&<button onClick={download}><Download size={15}/> Backup</button>}<button onClick={()=>fileInput.current?.click()}><FileUp size={15}/> Importar</button><input ref={fileInput} hidden type="file" accept=".ldfp,application/json" onChange={event=>load(event.target.files?.[0])}/></div></header>{notice&&<div className="pc-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}<div className="pc-body">{!career?<Creator clubs={clubs} onCreate={setCareer}/>:career.stage==='trial'?<Trial career={career} clubs={clubs} onChange={setCareer}/>:<Dashboard career={career} clubs={clubs} onChange={setCareer} onReset={reset} onNotice={setNotice}/>}</div>{career?.pendingMoment&&<PlayerMomentModal moment={career.pendingMoment} onClose={()=>setCareer(acknowledgePlayerMoment(career))}/>}<footer className="pc-footer"><span>LINHA DE FRENTE · RC7</span><span>{club?club.name:career?.stage==='free-agent'?'Sem clube':'Peneira'}</span></footer></main>;
}
