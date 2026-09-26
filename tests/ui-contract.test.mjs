import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const leagueCss=fs.readFileSync(new URL('../src/league.css',import.meta.url),'utf8');
const match=fs.readFileSync(new URL('../src/MatchSimulation.jsx',import.meta.url),'utf8');
const transfer=fs.readFileSync(new URL('../src/TransferMarket.jsx',import.meta.url),'utf8');
const management=fs.readFileSync(new URL('../src/Management.jsx',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../src/ClubDashboard.jsx',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const competition=fs.readFileSync(new URL('../src/CompetitionHub.jsx',import.meta.url),'utf8');
const celebration=fs.readFileSync(new URL('../src/SeasonReviewModal.jsx',import.meta.url),'utf8');
const trophy=fs.readFileSync(new URL('../src/Trophy3D.jsx',import.meta.url),'utf8');
const worldCrest=fs.readFileSync(new URL('../src/WorldCrest.jsx',import.meta.url),'utf8');
const crest=fs.readFileSync(new URL('../src/Crest.jsx',import.meta.url),'utf8');
const playerCareer=fs.readFileSync(new URL('../src/PlayerCareer.jsx',import.meta.url),'utf8');
const playerLife=fs.readFileSync(new URL('../src/player-life-engine.js',import.meta.url),'utf8');
const playerWorld=fs.readFileSync(new URL('../src/player-world-engine.js',import.meta.url),'utf8');

test('every career area is present in navigation and has a renderer', function(){
  const tabs=['dashboard','central','competitions','match','roster','standings','transfers','trophies','sponsors','legacy'];
  for(const tab of tabs){
    assert.ok(main.includes("['"+tab+"'"),tab+' is missing from navigation');
    if(tab==='roster'||tab==='match') assert.ok(main.includes("hidden={tab!=='"+tab+"'}"),tab+' persistent renderer is missing');
    else assert.ok(main.includes("tab==='"+tab+"'"),tab+' has no renderer');
  }
});

test('match engine stays mounted while the user navigates to other pages', function(){
  assert.ok(main.includes("<div hidden={tab!=='match'}><MatchSimulation"));
  assert.ok(main.includes("isVisible={tab==='match'}"));
});

test('mobile navigation is a compact sticky horizontal career bar', function(){
  assert.match(leagueCss,/position:sticky/);
  assert.match(leagueCss,/overflow-x:auto!important/);
  assert.match(leagueCss,/min-width:max-content!important/);
});

test('match screen exposes Normal Fast and Instant simulation modes', function(){
  assert.ok(match.includes("Normal"));
  assert.ok(match.includes("Rápido"));
  assert.ok(match.includes("Instantânea"));
  assert.ok(match.includes("Histórico de partidas"));
  assert.ok(match.includes("Rodada sincronizada"));
});


test('transfer market renderer and club theme are connected to the app shell', function(){
  assert.ok(main.includes("tab==='transfers'&&<TransferMarket"));
  assert.ok(main.includes("style={clubThemeStyle(club.id)}"));
  assert.ok(main.includes("clubs={careerClubs}"));
});


test('match background uses dedicated responsive stadium images instead of the old SVG scene', function(){
  assert.ok(match.includes('stadium-sideline-desktop.webp'));
  assert.ok(match.includes('stadium-sideline-mobile.webp'));
  assert.ok(match.includes('<picture className="sideline-picture"'));
  assert.ok(!match.includes('<svg className="sideline-field"'));
  assert.ok(!match.includes('function PlayerDot'));
});

test('transfer market is filter-driven and renders no external player list before search', function(){
  assert.ok(transfer.includes("const [appliedFilters,setAppliedFilters]=useState(null)"));
  assert.ok(transfer.includes("if(!appliedFilters)return []"));
  assert.ok(transfer.includes("Nome"));
  assert.ok(transfer.includes("Posição"));
  assert.ok(transfer.includes("Nacionalidade"));
  assert.ok(transfer.includes("Clube"));
  assert.ok(transfer.includes("type=\"submit\""));
  assert.ok(transfer.includes("Todas as posições"));
  assert.ok(transfer.includes("Todas as nacionalidades"));
  assert.ok(transfer.includes("Todos os clubes"));
  assert.ok(transfer.includes("marketAll.slice(0,visibleCount)"));
  assert.ok(transfer.includes("Carregar mais jogadores"));
});

test('club-specific colors are scoped to the club hero rather than the whole interface', function(){
  assert.ok(styles.includes('.app-shell .club-hero{background:linear-gradient'));
  assert.ok(!styles.includes('.app-shell .topbar{background:linear-gradient'));
  assert.ok(!styles.includes('.app-shell .match-stat-track i{background:var(--club-primary)'));
});


test('RC8 asks for a manager name when taking control of a club', function(){
  assert.ok(main.includes("Nome do técnico"));
  assert.ok(main.includes("managerName"));
  assert.ok(main.includes("1.0 RC8"));
  assert.ok(!main.includes("Protótipo de gestão"));
  assert.ok(!main.includes("ETAPA 2 ·"));
});

test('match controls no longer expose inactive tactical TV or data views', function(){
  assert.ok(!match.includes("Visão tática"));
  assert.ok(!match.includes("Visão TV"));
  assert.ok(!match.includes(">Dados<"));
  assert.ok(!match.includes("Engine v3"));
  assert.ok(!match.includes("IA v3"));
  assert.ok(match.includes("realElapsed"));
  assert.ok(match.includes("realDurationSeconds"));
});

test('historical trophy gallery exposes count bubbles instead of future placeholders', function(){
  assert.ok(management.includes("honoursWithCareer"));
  assert.ok(management.includes("trophy-number-pop"));
  assert.ok(!management.includes("Competição preparada para fases futuras"));
  assert.ok(!management.includes("Na Etapa 2"));
});


test('manager dashboard surfaces the next match finances objective form and quick actions', function(){
  assert.ok(main.includes("['dashboard','Painel'"));
  assert.ok(main.includes("<ClubDashboard"));
  assert.ok(dashboard.includes("CENTRO DE COMANDO"));
  assert.ok(dashboard.includes("PRÓXIMO COMPROMISSO"));
  assert.ok(dashboard.includes("Objetivo da temporada"));
  assert.ok(dashboard.includes("Mercado"));
  assert.ok(dashboard.includes("Últimos jogos"));
  assert.ok(dashboard.includes("Artilheiro do clube"));
  assert.ok(dashboard.includes("Decisões do técnico"));
});


test('app boots into the launch screen and then the canonical club selector', function(){
  assert.ok(main.includes("const [tab,setTab]=useState('dashboard')"));
  assert.ok(main.includes("const [clubBrowserOpen,setClubBrowserOpen]=useState(true)"));
  assert.ok(main.includes("const [selected,setSelected]=useState(()=>data.clubs[0]?.id||'2029')"));
  assert.ok(main.includes("if(landingOpen)return <LandingScreen"));
  assert.ok(main.includes("if(clubBrowserOpen){"));
  assert.ok(main.includes('<section className="club-selector-overlay" aria-label="Seletor de clubes">'));
  assert.ok(main.includes('Escolha o clube que você quer comandar.'));
  assert.ok(main.includes('single-club-workspace'));
  assert.ok(!main.includes('<aside className="club-panel">'));
  assert.ok(!main.includes("useState(()=>!readSaved())"));
  assert.ok(!main.includes("useState(()=>readSaved()||'2029')"));
});


test('release UI exposes confidence tactical reading and season review', function(){
  assert.ok(dashboard.includes('CONFIANÇA DA TORCIDA'));
  assert.ok(dashboard.includes('CONFIANÇA DA DIRETORIA'));
  assert.ok(match.includes('Leitura tática'));
  assert.ok(!match.includes('IA adaptativa'));
  assert.ok(main.includes('<SeasonReviewModal'));
  assert.ok(management.includes('<Trophy3D'));
});


test('portable crest data URLs bypass the relative Vite base prefix', function(){
  assert.ok(crest.includes("if(/^(data:|blob:|https?:\\/\\/)/i.test(source))return source"));
  assert.ok(crest.includes("function assetUrl"));
});

test('finished match UI does not keep presenting the previous round as live', function(){
  assert.ok(match.includes("live={Boolean(activeRound)}"));
  assert.ok(match.includes("ENCERRADA"));
  assert.ok(match.includes("userMatchFinished?Math.floor(userDuration/60)"));
});


test('V4 RC exposes the full-season competition hub and retirement flow', function(){
  assert.ok(main.includes("['competitions','Competições'"));
  assert.ok(main.includes("<CompetitionHub"));
  assert.ok(main.includes("<RetirementModal"));
  assert.ok(match.includes("competition-gate"));
});


test('all managed competitions route through the same match screen and expose all speed modes', function(){
  assert.ok(match.includes("startWorldFixture"));
  assert.ok(match.includes("finishPendingWorldFixture"));
  assert.ok(match.includes("WorldCrest"));
  assert.ok(match.includes("world-match-stage"));
  assert.ok(match.includes("selectedMode==='normal'"));
  assert.ok(match.includes("selectedMode==='fast'"));
  assert.ok(match.includes("selectedMode==='instant'"));
  assert.ok(competition.includes("onNavigate?.('match')"));
  assert.ok(!competition.includes("playNextWorldFixture"));
});

test('champion celebration does not pretend an early title ended the season', function(){
  assert.ok(celebration.includes("seasonClosed?'Ver resumo da temporada':'Continuar temporada'"));
  assert.ok(celebration.includes("NOITE DE TAÇA"));
  assert.ok(celebration.includes("Galeria atualizada"));
});

test('major trophies have dedicated lightweight 3D vector families', function(){
  for(const id of ['brasileirao','libertadores','sulamericana','champions-league','paulista','supercopa','mundial']){
    assert.ok(trophy.includes(id),id+' trophy mapping is missing');
  }
});


test('external crest loader is centralized and never uses open search results or stale cache keys', function(){
  assert.ok(worldCrest.includes("import Crest from './Crest.jsx'"));
  assert.ok(crest.includes("CACHE_PREFIX='ldf.crest.v4.'"));
  assert.ok(crest.includes("action=query&titles="));
  assert.ok(!crest.includes("generator=search"));
  assert.ok(crest.includes("club?.country==='BRA'?'pt.wikipedia.org':'en.wikipedia.org'"));
});

test('match history merges competitions and exposes mobile-friendly filters', function(){
  assert.ok(match.includes("unifiedUserMatchHistory"));
  assert.ok(match.includes("history-filters"));
  assert.ok(match.includes("Mostrar mais"));
  assert.ok(match.includes("WorldCrest"));
});

test('world pre-match screen exposes decision context before kickoff', function(){
  assert.ok(match.includes("PESO DO JOGO"));
  assert.ok(match.includes("TORCIDA"));
  assert.ok(match.includes("DIRETORIA"));
  assert.ok(match.includes("FORÇA PROJETADA"));
});


test('release candidate exposes landing central portable saves and manager identity', function(){
  assert.ok(main.includes("<LandingScreen"));
  assert.ok(main.includes("['central','Bastidores'"));
  assert.ok(main.includes("<CareerCenter"));
  assert.ok(main.includes("MANAGER_PROFILES"));
  assert.ok(main.includes("managerProfileInput"));
  assert.ok(main.includes("importCareerPayload"));
  assert.ok(main.includes("onManager="));
  assert.ok(main.includes("onPlayer="));
  assert.ok(main.includes("<PlayerCareer"));
});

test('transfer UI separates market budget wage room and operating cash', function(){
  assert.ok(transfer.includes("Orçamento de transferências"));
  assert.ok(transfer.includes("Espaço salarial para reforços"));
  assert.ok(transfer.includes("Caixa operacional"));
  assert.ok(transfer.includes("scoutRange"));
  assert.ok(transfer.includes("Observar"));
  assert.ok(!transfer.includes("ai-response"));
});


test('RC5 landing exposes separate manager and player careers without mixing saves', function(){
  const landing=fs.readFileSync(new URL('../src/LandingScreen.jsx',import.meta.url),'utf8');
  const playerCareer=fs.readFileSync(new URL('../src/PlayerCareer.jsx',import.meta.url),'utf8');
  assert.ok(landing.includes('MODO CARREIRA TREINADOR'));
  assert.ok(landing.includes('MODO CARREIRA JOGADOR'));
  assert.ok(playerCareer.includes('PLAYER_CAREER_KEY'));
  assert.ok(main.includes("gameMode==='player'"));
  assert.ok(main.includes("gameMode('manager')")||main.includes("setGameMode('manager')"));
});

test('RC5 preserves full tactical controls scouting promises hall and cinematics', function(){
  const center=fs.readFileSync(new URL('../src/CareerCenter.jsx',import.meta.url),'utf8');
  const legacy=fs.readFileSync(new URL('../src/Legacy.jsx',import.meta.url),'utf8');
  assert.ok(center.includes('TACTICAL_DECISIONS'));
  assert.ok(center.includes('counterAttack'));
  assert.ok(center.includes('penaltyTakerId'));
  assert.ok(match.includes('opponentScoutingReport'));
  assert.ok(match.includes('changeUserMatchTacticalState'));
  assert.ok(center.includes('PROMISE_TYPES'));
  assert.ok(legacy.includes('Temporadas comparáveis do save'));
  assert.ok(main.includes('<CareerMomentModal'));
});

test('RC7 player career exposes calendar controls and separated football finance areas',function(){
  assert.ok(playerCareer.includes('1 dia'));
  assert.ok(playerCareer.includes('Até o próximo jogo'));
  assert.ok(playerCareer.includes('7 dias'));
  assert.ok(playerCareer.includes('Desenvolvimento'));
  assert.ok(playerCareer.includes('Contrato & mercado'));
  assert.ok(playerCareer.includes('Finanças'));
  assert.ok(playerCareer.includes('Empresário'));
  assert.ok(playerCareer.includes('Chuteiras'));
  assert.ok(playerCareer.includes('Fisioterapia'));
  assert.ok(playerCareer.includes('Equipe de performance'));
  assert.ok(playerCareer.includes('Patrimônio & projetos'));
  assert.ok(playerCareer.includes('Patrocínios'));
  assert.ok(playerCareer.includes('<PlayerMomentModal'));
  assert.ok(playerCareer.includes('<PlayerLifeVisual'));
});

test('RC5 player lifestyle visuals are local vector UI rather than fragile remote PNG dependencies',function(){
  const visual=fs.readFileSync(new URL('../src/PlayerLifeVisual.jsx',import.meta.url),'utf8');
  const moment=fs.readFileSync(new URL('../src/PlayerMomentModal.jsx',import.meta.url),'utf8');
  assert.ok(visual.includes('pc-life-visual'));
  assert.ok(moment.includes('pc-moment-art'));
  assert.equal(/https?:\/\//.test(visual),false);
  assert.equal(/https?:\/\//.test(moment),false);
});

test('RC5 personal economy is connected to salary representation equipment health property and sponsors',function(){
  for(const token of ['PLAYER_AGENTS','PLAYER_BOOTS','PLAYER_PHYSIOS','PLAYER_HOMES','PLAYER_SPONSOR_BRANDS','settlePlayerMonth','purchasePlayerLifeItem','performanceBonus'])assert.ok(playerLife.includes(token),token+' missing from player-life engine');
});


test('RC7 player HUD exposes gameplay-critical football information at 100 percent zoom',function(){
  for(const text of ['Condição','Moral','Confiança','Status','AGENDA','PÓS-JOGO','HIERARQUIA DO ELENCO','CONCORRÊNCIA NA POSIÇÃO','Objetivos individuais','SUA POSIÇÃO SOBRE O FUTURO']){
    assert.ok(playerCareer.includes(text),text+' is missing from player career UI');
  }
  assert.ok(playerCareer.includes('POSITION_METRIC_LABELS'));
  assert.ok(playerCareer.includes('playerSquadCompetitionSnapshot'));
  assert.ok(playerCareer.includes('negotiatePlayerContractOffer'));
  assert.ok(playerCareer.includes('simulatePlayerUntilNextMatch'));
});

test('RC6 uses one crest renderer for local and world clubs with professional fallback',function(){
  assert.ok(main.includes("import Crest from './Crest.jsx'"));
  assert.ok(worldCrest.includes("import Crest from './Crest.jsx'"));
  assert.ok(crest.includes('OPTICAL_CREST_SCALE'));
  assert.ok(crest.includes('crest-fallback'));
  assert.ok(crest.includes('onError'));
});


test('RC8 keeps facial creation removed while preserving a neutral player identifier',function(){
  assert.equal(playerCareer.includes('pc-face-controls'),false);
  assert.equal(playerCareer.includes('function Face('),false);
  assert.ok(playerCareer.includes('PlayerMark'));
  assert.ok(playerCareer.includes('MODO CARREIRA JOGADOR · RC8'));
  assert.ok(playerCareer.includes('Dos 16 ao topo.'));
});

test('RC7 player mode surfaces coach rivalry personality and international market systems',function(){
  for(const token of ['Personalidade','Sua chance de titularidade','Treinador','Mercado acessível'])assert.ok(playerCareer.includes(token),token+' missing from RC7 player UI');
  assert.ok(playerCareer.includes('PLAYER_WORLD_MARKETS'));
  for(const token of ['Argentina','Portugal','Espanha'])assert.ok(playerWorld.includes(token),token+' missing from RC7 world market engine');
});


test('RC7 player career exposes a real interactive match layer instead of post-match replay only',function(){
  for(const text of ['NOTA AO VIVO','ENERGIA','Avançar 15 min','Simular até o fim','COMPORTAMENTO DURANTE A PARTIDA']){
    assert.ok(playerCareer.includes(text),text+' is missing from interactive player match UI');
  }
  assert.ok(playerCareer.includes('advancePlayerLiveMatch'));
  assert.ok(playerCareer.includes('setPlayerLiveApproach'));
  assert.ok(playerCareer.includes('simulatePlayerLiveMatchToEnd'));
});
