import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const leagueCss=fs.readFileSync(new URL('../src/league.css',import.meta.url),'utf8');
const match=fs.readFileSync(new URL('../src/MatchSimulation.jsx',import.meta.url),'utf8');
const transfer=fs.readFileSync(new URL('../src/TransferMarket.jsx',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('every stage two area is present in navigation and has a renderer', function(){
  const tabs=['match','roster','standings','transfers','trophies','sponsors','legacy'];
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

test('mobile navigation exposes all tabs in a grid instead of hidden horizontal overflow', function(){
  assert.match(leagueCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(leagueCss,/overflow:visible!important/);
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

test('transfer market limits initial DOM size and loads more on demand', function(){
  assert.ok(transfer.includes('useState(36)'));
  assert.ok(transfer.includes('marketAll.slice(0,visibleCount)'));
  assert.ok(transfer.includes('Carregar mais jogadores'));
});

test('club-specific colors are scoped to the club hero rather than the whole interface', function(){
  assert.ok(styles.includes('.app-shell .club-hero{background:linear-gradient'));
  assert.ok(!styles.includes('.app-shell .topbar{background:linear-gradient'));
  assert.ok(!styles.includes('.app-shell .match-stat-track i{background:var(--club-primary)'));
});
