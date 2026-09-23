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

test('every career area is present in navigation and has a renderer', function(){
  const tabs=['dashboard','match','roster','standings','transfers','trophies','sponsors','legacy'];
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


test('beta00 asks for a manager name when taking control of a club', function(){
  assert.ok(main.includes("Nome do técnico"));
  assert.ok(main.includes("managerName"));
  assert.ok(main.includes("beta00"));
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
  assert.ok(dashboard.includes("Caixa"));
  assert.ok(dashboard.includes("Últimos jogos"));
  assert.ok(dashboard.includes("Artilheiro do clube"));
  assert.ok(dashboard.includes("Decisões do técnico"));
});
