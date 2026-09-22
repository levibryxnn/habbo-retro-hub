import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const leagueCss=fs.readFileSync(new URL('../src/league.css',import.meta.url),'utf8');

test('every stage two area is present in navigation and has a renderer', function(){
  const tabs=['match','roster','standings','trophies','sponsors','legacy'];
  for(const tab of tabs){
    assert.ok(main.includes("['"+tab+"'"),tab+' is missing from navigation');
    if(tab==='roster') assert.ok(main.includes("hidden={tab!=='roster'}"));
    else assert.ok(main.includes("tab==='"+tab+"'"),tab+' has no renderer');
  }
});

test('mobile navigation exposes all tabs in a grid instead of hidden horizontal overflow', function(){
  assert.match(leagueCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(leagueCss,/overflow:visible!important/);
});
