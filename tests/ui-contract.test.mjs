import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const leagueCss=fs.readFileSync(new URL('../src/league.css',import.meta.url),'utf8');
const match=fs.readFileSync(new URL('../src/MatchSimulation.jsx',import.meta.url),'utf8');

test('every stage two area is present in navigation and has a renderer', function(){
  const tabs=['match','roster','standings','trophies','sponsors','legacy'];
  for(const tab of tabs){
    assert.ok(main.includes("['"+tab+"'"),tab+' is missing from navigation');
    if(tab==='roster'||tab==='match') assert.ok(main.includes("hidden={tab!=='"+tab+"'}"),tab+' persistent renderer is missing');
    else assert.ok(main.includes("tab==='"+tab+"'"),tab+' has no renderer');
  }
});

test('match engine stays mounted while the user navigates to other pages', function(){
  assert.ok(main.includes("<div hidden={tab!=='match'}><MatchSimulation"));
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
