import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
  Activity,ArrowLeft,ArrowRight,BadgeDollarSign,Briefcase,CalendarDays,ChevronRight,
  Download,Dumbbell,FileUp,Footprints,HeartPulse,History,Home,Play,RotateCcw,
  Shield,ShoppingBag,Sparkles,Star,Target,Trophy,UserRound,Users,WalletCards
} from 'lucide-react';
import {
  PLAYER_ARCHETYPES,PLAYER_CAREER_KEY,PLAYER_MATCH_APPROACHES,PLAYER_POSITIONS,PLAYER_TRAINING,
  TRIAL_DRILLS,acknowledgePlayerMoment,answerTrialDrill,completeTrial,createPlayerCareer,
  parsePlayerCareer,playerCalendarLabel,playerCareerOverall,respondPlayerOffer,sanitizePlayerCareer,
  serializePlayerCareer,setPlayerMatchApproach,setPlayerTraining,simulatePlayerDay,simulatePlayerWeek,trialScore
} from './player-career-engine.js';
import {
  PLAYER_AGENTS,PLAYER_BOOTS,PLAYER_HOMES,PLAYER_PHYSIOS,acceptPlayerSponsor,declinePlayerSponsor,
  playerFinancialSnapshot,purchasePlayerLifeItem,refreshPlayerSponsorOffers
} from './player-life-engine.js';
import PlayerLifeVisual from './PlayerLifeVisual.jsx';
import PlayerMomentModal from './PlayerMomentModal.jsx';
import './player-career.css';

const positionLabel=id=>PLAYER_POSITIONS.find(item=>item.id===id)?.label||id;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const WEEK_DAYS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

function initials(name){
  return String(name||'LF').split(' ').filter(Boolean).map((part,index,array)=>index===0||index===array.length-1?part[0]:'').join('').slice(0,2).toUpperCase();
}
function clubById(clubs,id){return clubs.find(club=>String(club.id)===String(id))||null;}
function clampUi(value){return Math.max(0,Math.min(100,Number(value)||0));}
function dayKind(index,injured=false){
  if(injured)return{label:'Recuperação',kind:'recovery'};
  if(index===5)return{label:'Jogo',kind:'match'};
  if([1,2,3,4].includes(index))return{label:'Treino',kind:'training'};
  return{label:'Recuperação',kind:'recovery'};
}

function Face({face={},name='',large=false}){
  return <div className={'pc-face '+(large?'large ':'')+'skin-'+(face.skin??0)+' hair-'+(face.hair??0)+' haircolor-'+(face.hairColor??0)+' shape-'+(face.shape??0)} aria-label={'Retrato criado de '+name}>
    <i className="pc-hair"/><span className="pc-ear left"/><span className="pc-ear right"/><span className="pc-eye left"/><span className="pc-eye right"/>
    <span className="pc-brow left"/><span className="pc-brow right"/><span className="pc-nose"/><span className="pc-mouth"/><b>{initials(name)}</b>
  </div>;
}

function Creator({clubs,onCreate}){
  const [form,setForm]=useState({name:'',position:'MEI',foot:'right',archetype:'technical',dreamClubId:clubs[0]?.id||'',face:{skin:1,hair:1,hairColor:0,eyes:0,shape:0}});
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const updateFace=(key,value)=>setForm(current=>({...current,face:{...current.face,[key]:Number(value)}}));
  return <section className="pc-creator">
    <div className="pc-creator-intro"><span className="pc-eyebrow">MODO CARREIRA JOGADOR</span><h1>Todo mundo começa com 16.</h1><p>Você cria a identidade. O clube precisa ser conquistado na peneira.</p></div>
    <div className="pc-creator-layout">
      <aside className="pc-face-editor">
        <Face face={form.face} name={form.name||'Você'} large/>
        <strong>{form.name||'Seu jogador'}</strong><small>16 anos · {positionLabel(form.position)}</small>
        <div className="pc-face-controls">
          <label>Pele<select value={form.face.skin} onChange={event=>updateFace('skin',event.target.value)}>{[0,1,2,3,4].map(value=><option value={value} key={value}>Tom {value+1}</option>)}</select></label>
          <label>Cabelo<select value={form.face.hair} onChange={event=>updateFace('hair',event.target.value)}>{[0,1,2,3,4,5].map(value=><option value={value} key={value}>Estilo {value+1}</option>)}</select></label>
          <label>Cor<select value={form.face.hairColor} onChange={event=>updateFace('hairColor',event.target.value)}>{[0,1,2,3,4].map(value=><option value={value} key={value}>Cor {value+1}</option>)}</select></label>
          <label>Rosto<select value={form.face.shape} onChange={event=>updateFace('shape',event.target.value)}>{[0,1,2,3].map(value=><option value={value} key={value}>Formato {value+1}</option>)}</select></label>
        </div>
      </aside>
      <div className="pc-form">
        <label className="pc-name-field"><span>Nome do jogador</span><input autoFocus maxLength="40" value={form.name} onChange={event=>update('name',event.target.value)} placeholder="Digite o nome"/></label>
        <div><span className="pc-field-label">Posição</span><div className="pc-choice-grid four">{PLAYER_POSITIONS.map(item=><button key={item.id} className={form.position===item.id?'selected':''} onClick={()=>update('position',item.id)}><strong>{item.label}</strong><small>{item.id}</small></button>)}</div></div>
        <div><span className="pc-field-label">Seu estilo</span><div className="pc-choice-grid">{PLAYER_ARCHETYPES.map(item=><button key={item.id} className={form.archetype===item.id?'selected':''} onClick={()=>update('archetype',item.id)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></div>
        <div className="pc-inline-fields">
          <label><span>Pé dominante</span><select value={form.foot} onChange={event=>update('foot',event.target.value)}><option value="right">Direito</option><option value="left">Esquerdo</option></select></label>
          <label><span>Clube dos sonhos</span><select value={form.dreamClubId} onChange={event=>update('dreamClubId',event.target.value)}>{clubs.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(club=><option key={club.id} value={club.id}>{club.name}</option>)}</select><small>É uma meta, não uma escolha de clube.</small></label>
        </div>
        <div className="pc-rule-note"><Shield size={17}/><span><strong>Sem atalho para clube.</strong><small>A nota da peneira determina onde você começa. Uma grande atuação pode abrir a base do clube dos sonhos.</small></span></div>
        <button className="pc-primary" disabled={!form.name.trim()} onClick={()=>onCreate(createPlayerCareer(form))}>Ir para a peneira <ArrowRight size={17}/></button>
      </div>
    </div>
  </section>;
}

function Trial({career,clubs,onChange}){
  const answers=career.trial?.answers||{},answered=Object.keys(answers).length,next=TRIAL_DRILLS.find(drill=>!answers[drill.id]),score=trialScore(career);
  if(!next){
    const dream=clubById(clubs,career.dreamClubId);
    return <section className="pc-trial pc-trial-finish"><Target size={35}/><span className="pc-eyebrow">PENEIRA CONCLUÍDA</span><h2>A comissão está fechando o relatório.</h2><p>Foram cinco testes. A nota será comparada ao nível de exigência das categorias de base.</p><div className="pc-trial-meter"><i style={{width:(score||0)+'%'}}/><b>{score}/100</b></div><small>Sonho declarado: {dream?.name||'—'}</small><button className="pc-primary" onClick={()=>onChange(completeTrial(career,clubs))}>Ver onde fui aprovado <ArrowRight size={17}/></button></section>;
  }
  return <section className="pc-trial"><header><span className="pc-eyebrow">PENEIRA · TESTE {answered+1}/{TRIAL_DRILLS.length}</span><h2>{next.title}</h2><p>{next.copy}</p></header><div className="pc-trial-progress">{TRIAL_DRILLS.map((drill,index)=><i key={drill.id} className={answers[drill.id]?'done':index===answered?'current':''}/>)}</div><div className="pc-trial-choices">{next.choices.map(choice=><button key={choice.id} onClick={()=>onChange(answerTrialDrill(career,next.id,choice.id))}><span>{choice.label}</span><ChevronRight size={17}/></button>)}</div><div className="pc-trial-tip"><Star size={15}/> Não existe resposta perfeita: ousadia aumenta teto de pontuação e também a variância.</div></section>;
}

function StatusCard({career,club}){
  const player=career.player,average=career.seasonStats.matches?career.seasonStats.totalRating/career.seasonStats.matches:0,finance=playerFinancialSnapshot(career);
  return <section className="pc-status-card">
    <div className="pc-player-head"><Face face={player.face} name={player.name}/><div><small>{career.stage==='academy'?'CATEGORIAS DE BASE':career.stage==='retired'?'CARREIRA ENCERRADA':'ELENCO PROFISSIONAL'}</small><h2>{player.name}</h2><span>{career.age} anos · {positionLabel(player.position)} · {club?.name||'Sem clube'}</span></div><strong className="pc-ovr">{playerCareerOverall(career)}<small>OVR</small></strong></div>
    <div className="pc-status-metrics"><span><small>Condição</small><b>{Math.round(player.condition)}%</b></span><span><small>Moral</small><b>{Math.round(player.morale)}%</b></span><span><small>Confiança técnico</small><b>{Math.round(player.coachTrust)}%</b></span><span><small>Forma</small><b>{player.form>=0?'+':''}{Number(player.form).toFixed(1)}</b></span><span><small>Saldo pessoal</small><b>{money.format(finance.cash)}</b></span></div>
    {player.injury&&<div className="pc-injury"><HeartPulse size={16}/><span><strong>{player.injury.label}</strong><small>{player.injury.daysRemaining} dia(s) estimados para retorno</small></span></div>}
  </section>;
}

function TrialResult({career,club}){
  const report=career.trial?.report;if(!report)return null;
  return <section className={'pc-story-card '+(report.dreamSuccess?'dream-success':'')}><Target size={20}/><div><small>{report.dreamSuccess?'CLUBE DOS SONHOS':'PRIMEIRO CLUBE'}</small><strong>{club?.name||report.clubName}</strong><p>{report.reason}</p></div><b>{career.trial.score}/100</b></section>;
}

function CareerOffer({career,clubs,onChange}){
  const offer=career.pendingOffer;if(!offer)return null;
  return <section className={'pc-offer '+(offer.dreamClub?'dream-offer':'')}><Briefcase size={21}/><div><small>{offer.dreamClub?'CLUBE DOS SONHOS · PROPOSTA':'PROPOSTA DE CARREIRA'}</small><strong>{offer.clubName}</strong><p>{offer.role} · {offer.years} anos · {money.format(offer.salaryMonthly||0)}/mês. A oferta vence na semana {offer.expiresWeek}.</p></div><div><button onClick={()=>onChange(respondPlayerOffer(career,clubs,false))}>Ficar</button><button className="accept" onClick={()=>onChange(respondPlayerOffer(career,clubs,true))}>Aceitar</button></div></section>;
}

function CalendarPanel({career,clubs,onChange}){
  const injured=Boolean(career.player.injury),today=Number(career.dayOfWeek||0),last=career.lastDay;
  const days=Array.from({length:7},(_,offset)=>{const index=(today+offset)%7,kind=dayKind(index,injured);return{offset,index,...kind};});
  return <section className="pc-panel pc-calendar-panel">
    <div className="pc-panel-head"><div><small className="pc-eyebrow">CALENDÁRIO</small><h3>{playerCalendarLabel(career)} · Semana {career.week+1}</h3></div><CalendarDays size={18}/></div>
    <div className="pc-calendar-strip">{days.map(item=><span key={item.offset} className={(item.offset===0?'today ':'')+item.kind}><small>{WEEK_DAYS[item.index]}</small><b>{item.offset===0?'Hoje':item.label}</b><i/></span>)}</div>
    {last&&<div className="pc-last-day"><Activity size={15}/><span><strong>{last.title}</strong><small>{last.text}</small></span></div>}
    <div className="pc-advance-actions"><button className="pc-secondary" onClick={()=>onChange(simulatePlayerDay(career,clubs))}><Play size={15}/> Avançar 1 dia</button><button className="pc-primary" onClick={()=>onChange(simulatePlayerWeek(career,clubs))}><Play size={15}/> Avançar 7 dias</button></div>
    <small className="pc-engine-note">A engine só calcula quando o calendário avança: treino, recuperação, partida, salário, patrocínio, lesão, mercado e evolução são consequências do estado atual.</small>
  </section>;
}

function LastMatch({career}){
  const last=career.lastMatch;if(!last)return <section className="pc-panel"><h3>Último compromisso</h3><p className="pc-empty">Sua primeira partida ainda não foi simulada.</p></section>;
  const score=<b>{last.goalsFor} × {last.goalsAgainst}</b>;
  if(last.injured)return <section className="pc-panel"><div className="pc-panel-head"><h3>Última partida</h3>{score}</div><div className="pc-match-result muted"><strong>Em recuperação</strong><span>Você não esteve disponível contra {last.opponentName}.</span></div></section>;
  if(!last.selected)return <section className="pc-panel"><div className="pc-panel-head"><h3>Última partida</h3>{score}</div><div className="pc-match-result muted"><strong>Fora da relação</strong><span>{last.resultLabel} contra {last.opponentName}. Chance calculada de ser relacionado: {Math.round((last.selectionChance||0)*100)}%.</span></div><small>xG {last.xg?.[0]?.toFixed?.(2)??'—'} × {last.xg?.[1]?.toFixed?.(2)??'—'}</small></section>;
  const performance=last.performance;
  return <section className="pc-panel"><div className="pc-panel-head"><div><h3>{last.resultLabel} · {last.opponentName}</h3><span>{last.isHome?'Casa':'Fora'}</span></div>{score}</div><div className="pc-match-rating"><strong>{performance.rating.toFixed(1)}</strong><span>{last.started?'Titular':'Banco'}</span><span>{performance.minutes}'</span><span>{performance.goals} gol(s)</span><span>{performance.assists} assistência(s)</span>{performance.cleanSheet&&<span>sem sofrer gol</span>}</div><small>xG da equipe: {last.xg?.[0]?.toFixed?.(2)??'—'} · xG adversário: {last.xg?.[1]?.toFixed?.(2)??'—'}. Seu impacto altera a força coletiva antes da geração de gols.</small></section>;
}

function PlanPanel({career,onChange,retired}){
  const focus=PLAYER_TRAINING.find(item=>item.id===career.trainingFocus)||PLAYER_TRAINING[0],approach=PLAYER_MATCH_APPROACHES.find(item=>item.id===career.matchApproach)||PLAYER_MATCH_APPROACHES[1];
  return <section className="pc-panel player-week-plan"><div className="pc-panel-head"><h3>{retired?'Carreira concluída':'Plano de desenvolvimento'}</h3><Dumbbell size={17}/></div>{retired?<><p>A trajetória terminou, mas estatísticas, patrimônio, prêmios e linha do tempo permanecem neste save.</p><div className="pc-retired-summary"><Trophy size={19}/><span><strong>{career.careerStats.matches} jogos · {career.careerStats.goals} gols</strong><small>{career.awards?.length||0} prêmio(s) · {career.age} anos no encerramento</small></span></div></>:<><p>Treino e postura são decisões persistentes. A engine reaplica seus efeitos em desenvolvimento, fadiga, seleção e desempenho.</p><small className="pc-subheading">TREINO</small><div className="pc-training-list">{PLAYER_TRAINING.map(item=><button key={item.id} className={career.trainingFocus===item.id?'active':''} onClick={()=>onChange(setPlayerTraining(career,item.id))}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><small className="pc-subheading">POSTURA EM JOGO</small><div className="pc-approach-list">{PLAYER_MATCH_APPROACHES.map(item=><button key={item.id} className={career.matchApproach===item.id?'active':''} onClick={()=>onChange(setPlayerMatchApproach(career,item.id))}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><div className="pc-current-focus">Treino: <b>{focus.label}</b> · Postura: <b>{approach.label}</b></div></>}</section>;
}

function StatsPanel({career}){
  const average=career.careerStats.matches?career.careerStats.totalRating/career.careerStats.matches:0;
  return <section className="pc-panel"><div className="pc-panel-head"><h3>Temporada {career.season}</h3><Trophy size={17}/></div><div className="pc-stat-grid"><span><b>{career.seasonStats.matches}</b><small>Jogos</small></span><span><b>{career.seasonStats.starts}</b><small>Titular</small></span><span><b>{career.seasonStats.goals}</b><small>Gols</small></span><span><b>{career.seasonStats.assists}</b><small>Assist.</small></span><span><b>{career.seasonStats.minutes}</b><small>Minutos</small></span><span><b>{average?average.toFixed(1):'—'}</b><small>Média carreira</small></span></div></section>;
}

function AttributesPanel({career}){
  const player=career.player,bonus=playerFinancialSnapshot(career).boots?.bonuses||{};
  return <section className="pc-panel"><div className="pc-panel-head"><h3>Atributos</h3><Footprints size={17}/></div><div className="pc-attributes">{Object.entries(player.attributes).filter(([key])=>key!=='goalkeeping'||player.position==='GOL').map(([key,value])=>{const add=Number(bonus[key]||0);return <span key={key}><small>{{finishing:'Finalização',passing:'Passe',defending:'Defesa',pace:'Velocidade',physical:'Físico',technique:'Técnica',goalkeeping:'Goleiro'}[key]||key}</small><b>{Math.round(Number(value)+add)}{add>0?<em>+{add}</em>:null}</b><i><em style={{width:clampUi(Number(value)+add)+'%'}}/></i></span>;})}</div></section>;
}

function ContractPanel({career}){
  const player=career.player,contract=career.contract;
  return <section className="pc-panel pc-contract-panel"><div className="pc-panel-head"><h3>Contrato & carreira</h3><Briefcase size={17}/></div>{contract?<dl><div><dt>Clube</dt><dd>{contract.clubName}</dd></div><div><dt>Salário</dt><dd>{money.format(contract.salaryMonthly)}/mês</dd></div><div><dt>Vínculo</dt><dd>até {contract.expirySeason}</dd></div><div><dt>Papel</dt><dd>{contract.role}</dd></div></dl>:<p className="pc-empty">O primeiro vínculo aparece depois da aprovação na peneira.</p>}<div className="pc-career-flags"><span><small>Reputação</small><b>{Math.round(player.reputation||0)}/100</b></span><span><small>Seleção</small><b>{career.nationalTeamStatus==='called-up'?'Convocado':'Ainda não'}</b></span><span><small>Prêmios</small><b>{career.awards?.length||0}</b></span></div></section>;
}

function CareerOverview({career,clubs,onChange}){
  const retired=career.stage==='retired';
  return <><div className="pc-dashboard-grid">{!retired&&<CalendarPanel career={career} clubs={clubs} onChange={onChange}/>}<LastMatch career={career}/><PlanPanel career={career} onChange={onChange} retired={retired}/><StatsPanel career={career}/><AttributesPanel career={career}/><ContractPanel career={career}/></div></>;
}

function LifeOption({type,item,current,owned,onChoose}){
  const active=current===item.id,label=active?'Ativo':owned?'Equipar':item.cost===0?'Selecionar':'Adquirir';
  return <article className={'pc-life-option '+(active?'active':'')}><div><strong>{item.name}</strong><p>{item.description}</p></div><span>{item.cost?money.format(item.cost):'Sem custo'}</span><button disabled={active} onClick={()=>onChoose(type,item.id)}>{label}</button></article>;
}

function LifeHub({career,onChange,onNotice}){
  const snapshot=playerFinancialSnapshot(career),finance=career.finance||{},sponsor=finance.sponsorship,offers=finance.sponsorOffers||[];
  function choose(type,id){
    const result=purchasePlayerLifeItem(career,type,id);
    if(result.error){onNotice(result.error);return;}
    onNotice(result.equipped?'Item equipado.':'Decisão financeira concluída.');
    onChange(result.career);
  }
  function searchSponsors(){const next=refreshPlayerSponsorOffers(career);onChange(next);onNotice(next.finance?.sponsorOffers?.length?'Novas propostas de imagem chegaram.':'Nenhuma marca fez proposta neste momento.');}
  function acceptSponsor(id){const result=acceptPlayerSponsor(career,id);if(result.error){onNotice(result.error);return;}onChange(result.career);onNotice('Contrato de patrocínio assinado.');}
  return <div className="pc-life-hub">
    <section className="pc-finance-hero"><div><small className="pc-eyebrow">FINANÇAS PESSOAIS</small><h2>{money.format(snapshot.cash)}</h2><p>Seu dinheiro é separado do caixa do clube. Salário, patrocínio, comissão, saúde e patrimônio fecham a cada 28 dias.</p></div><WalletCards size={38}/><div className="pc-finance-metrics"><span><small>Entrada mensal projetada</small><b>{money.format(snapshot.grossMonthly)}</b></span><span><small>Custos mensais</small><b>{money.format(snapshot.projectedExpenses)}</b></span><span><small>Líquido projetado</small><b>{money.format(snapshot.projectedNet)}</b></span><span><small>Receita da carreira</small><b>{money.format(snapshot.careerIncome)}</b></span></div></section>

    <section className="pc-life-category">
      <PlayerLifeVisual type="agent" subtitle="REPRESENTAÇÃO" title={snapshot.agent.name}/>
      <div className="pc-life-category-copy"><h3>Empresário</h3><p>Quanto melhor a representação, maiores as chances de proposta e melhores salários e patrocínios — em troca de comissão.</p></div>
      <div className="pc-life-options">{PLAYER_AGENTS.map(item=><LifeOption key={item.id} type="agent" item={item} current={snapshot.agentId} onChoose={choose}/>)}</div>
    </section>

    <section className="pc-life-category">
      <PlayerLifeVisual type="boots" subtitle="EQUIPAMENTO" title={snapshot.boots.name}/>
      <div className="pc-life-category-copy"><h3>Chuteiras</h3><p>Bônus são aplicados no OVR efetivo e nas probabilidades do jogo sem alterar permanentemente o atributo-base.</p></div>
      <div className="pc-life-options">{PLAYER_BOOTS.filter(item=>career.player.position==='GOL'||item.id!=='keeper').map(item=><LifeOption key={item.id} type="boots" item={item} current={snapshot.bootsId} owned={snapshot.ownedBoots.includes(item.id)} onChoose={choose}/>)}</div>
    </section>

    <section className="pc-life-category">
      <PlayerLifeVisual type="physio" subtitle="PERFORMANCE" title={snapshot.physio.name}/>
      <div className="pc-life-category-copy"><h3>Saúde & fisioterapia</h3><p>Reduz risco de lesão, acelera os dias de recuperação e melhora a condição entre partidas.</p></div>
      <div className="pc-life-options">{PLAYER_PHYSIOS.map(item=><LifeOption key={item.id} type="physio" item={item} current={snapshot.physioId} onChoose={choose}/>)}</div>
    </section>

    <section className="pc-life-category">
      <PlayerLifeVisual type="home" subtitle="PATRIMÔNIO" title={snapshot.home.name}/>
      <div className="pc-life-category-copy"><h3>Casa & patrimônio</h3><p>Conforto custa dinheiro, mas sustenta moral, recuperação e imagem pública. Imóveis comprados permanecem no patrimônio.</p></div>
      <div className="pc-life-options">{PLAYER_HOMES.map(item=><LifeOption key={item.id} type="home" item={item} current={snapshot.homeId} owned={snapshot.ownedHomes.includes(item.id)} onChoose={choose}/>)}</div>
    </section>

    <section className="pc-life-category pc-sponsor-market">
      <PlayerLifeVisual type="sponsor" subtitle="IMAGEM" title={sponsor?.name||'Sem patrocinador'}/>
      <div className="pc-life-category-copy"><h3>Patrocínios pessoais</h3><p>Reputação, média, gols e empresário definem quais marcas aparecem e quanto elas oferecem.</p></div>
      {sponsor?<div className="pc-active-sponsor"><BadgeDollarSign size={18}/><div><strong>{sponsor.name}</strong><small>{money.format(sponsor.monthly)}/mês · {sponsor.monthsRemaining} mês(es) restantes · bônus {money.format(sponsor.performanceBonus||0)} se média ≥ {Number(sponsor.targetAverage||0).toFixed(2)}</small></div></div>:<button className="pc-secondary pc-sponsor-search" onClick={searchSponsors}><Sparkles size={15}/> Consultar mercado de imagem</button>}
      {!sponsor&&offers.length>0&&<div className="pc-sponsor-offers">{offers.map(offer=><article key={offer.id}><div><strong>{offer.name}</strong><p>{offer.description}</p><small>Luvas {money.format(offer.signing)} · {money.format(offer.monthly)}/mês · {offer.months} meses · bônus {money.format(offer.performanceBonus||0)} se média ≥ {Number(offer.targetAverage||0).toFixed(2)}</small></div><div><button onClick={()=>onChange(declinePlayerSponsor(career,offer.id))}>Recusar</button><button className="accept" onClick={()=>acceptSponsor(offer.id)}>Assinar</button></div></article>)}</div>}
    </section>

    <section className="pc-panel pc-transactions"><div className="pc-panel-head"><h3>Extrato</h3><History size={17}/></div>{snapshot.transactions.length?<div>{snapshot.transactions.slice(0,12).map(item=><article key={item.id}><span><strong>{item.label}</strong><small>Temporada {item.season} · dia {Number(item.day||0)+1}</small></span><b className={item.amount>=0?'positive':'negative'}>{item.amount>=0?'+':''}{money.format(item.amount)}</b></article>)}</div>:<p className="pc-empty">As movimentações pessoais aparecerão aqui depois do primeiro pagamento ou compra.</p>}</section>
  </div>;
}

function HistoryHub({career}){
  return <div className="pc-history-hub">
    <section className="pc-panel pc-news-panel"><div className="pc-panel-head"><h3>Notícias da carreira</h3><Star size={17}/></div>{career.news?.length?<div>{career.news.slice(0,12).map(item=><article key={item.id}><small>{item.season} · S{item.week??0}</small><strong>{item.title}</strong><p>{item.text}</p></article>)}</div>:<p className="pc-empty">As primeiras notícias surgem conforme a carreira avança.</p>}</section>
    <section className="pc-timeline"><div className="pc-panel-head"><h3>Linha do tempo</h3><UserRound size={17}/></div>{career.timeline.slice(0,24).map(item=><article key={item.id}><b>{item.season}<small>D{Number(item.day??item.week*7??0)+1}</small></b><div><strong>{item.title}</strong><p>{item.text}</p></div></article>)}</section>
    <section className="pc-panel"><div className="pc-panel-head"><h3>Prêmios & marcos</h3><Trophy size={17}/></div><div className="pc-awards-grid">{career.awards?.length?career.awards.map(item=><article key={item.id}><Trophy size={16}/><strong>{item.title}</strong><small>{item.season}</small></article>):<p className="pc-empty">Ainda não há prêmios individuais registrados.</p>}</div></section>
  </div>;
}

function Dashboard({career,clubs,onChange,onReset,onNotice}){
  const [view,setView]=useState('career'),club=clubById(clubs,career.clubId);
  return <div className="pc-dashboard">
    <StatusCard career={career} club={club}/><TrialResult career={career} club={club}/><CareerOffer career={career} clubs={clubs} onChange={onChange}/>
    <nav className="pc-mode-tabs" aria-label="Áreas da carreira do jogador">
      <button className={view==='career'?'active':''} onClick={()=>setView('career')}><Activity size={15}/> Carreira</button>
      <button className={view==='life'?'active':''} onClick={()=>setView('life')}><WalletCards size={15}/> Vida & finanças</button>
      <button className={view==='history'?'active':''} onClick={()=>setView('history')}><History size={15}/> História</button>
    </nav>
    {view==='career'&&<CareerOverview career={career} clubs={clubs} onChange={onChange}/>}
    {view==='life'&&<LifeHub career={career} onChange={onChange} onNotice={onNotice}/>}
    {view==='history'&&<HistoryHub career={career}/>}
    <button className="pc-reset" onClick={onReset}><RotateCcw size={14}/> Criar outra carreira de jogador</button>
  </div>;
}

export default function PlayerCareer({clubs,onExit}){
  const fileInput=useRef(null);
  const [career,setCareer]=useState(()=>{try{return sanitizePlayerCareer(JSON.parse(localStorage.getItem(PLAYER_CAREER_KEY)||'null'),clubs);}catch{return null;}});
  const [notice,setNotice]=useState('');
  useEffect(()=>{try{if(career)localStorage.setItem(PLAYER_CAREER_KEY,JSON.stringify(career));else localStorage.removeItem(PLAYER_CAREER_KEY);}catch{setNotice('O navegador bloqueou o autosave. Exporte um backup se continuar jogando.');}},[career]);
  const club=useMemo(()=>clubById(clubs,career?.clubId),[clubs,career?.clubId]);
  function download(){
    if(!career)return;
    const blob=new Blob([serializePlayerCareer(career)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='linha-de-frente-jogador-'+career.player.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.ldfp';
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  async function load(file){
    if(!file)return;
    try{setCareer(parsePlayerCareer(await file.text(),clubs));setNotice('Carreira de jogador carregada.');}
    catch(error){setNotice(error.message||'Arquivo inválido.');}
    if(fileInput.current)fileInput.current.value='';
  }
  function reset(){if(confirm('Criar uma nova carreira de jogador? O autosave atual será substituído.'))setCareer(null);}
  function closeMoment(){if(career)setCareer(acknowledgePlayerMoment(career));}
  return <main className="player-career-shell">
    <header className="pc-topbar"><button onClick={onExit}><ArrowLeft size={16}/> Menu</button><div><span className="pc-brand">L<span>F</span></span><strong>CARREIRA JOGADOR</strong></div><div className="pc-save-actions">{career&&<button onClick={download}><Download size={15}/> Backup</button>}<button onClick={()=>fileInput.current?.click()}><FileUp size={15}/> Importar</button><input ref={fileInput} hidden type="file" accept=".ldfp,application/json" onChange={event=>load(event.target.files?.[0])}/></div></header>
    {notice&&<div className="pc-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    <div className="pc-body">{!career?<Creator clubs={clubs} onCreate={setCareer}/>:career.stage==='trial'?<Trial career={career} clubs={clubs} onChange={setCareer}/>:<Dashboard career={career} clubs={clubs} onChange={setCareer} onReset={reset} onNotice={setNotice}/>}</div>
    {career?.pendingMoment&&<PlayerMomentModal moment={career.pendingMoment} onClose={closeMoment}/>}
    <footer className="pc-footer"><span>LINHA DE FRENTE · RC5</span><span>{club?club.name:'A jornada começa na peneira'}</span></footer>
  </main>;
}
