import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OPTICAL_CREST_SCALE } from '../src/crest-config.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));

test('Serie A snapshot contains 20 unique clubs with usable rosters and crest files', function(){
  assert.equal(data.season,2026);
  assert.equal(data.clubs.length,20);
  assert.equal(new Set(data.clubs.map(function(club){return club.id;})).size,20);
  for(const club of data.clubs){
    assert.ok(club.name);
    assert.ok(club.abbreviation);
    assert.ok(Array.isArray(club.players) && club.players.length>0,club.name+' must have players');
    assert.equal(new Set(club.players.map(function(player){return String(player.id);})).size,club.players.length,club.name+' has duplicate player ids');
    assert.ok(club.logo && club.logo.startsWith('/crests/'),club.name+' must use a local crest');
    const crest=path.resolve(new URL('../public',import.meta.url).pathname,'.'+club.logo);
    assert.ok(fs.existsSync(crest),club.name+' crest file is missing');
  }
});


test('every Serie A crest has explicit optical tuning in the unified renderer',function(){
  const ids=data.clubs.map(club=>String(club.id)).sort();
  assert.deepEqual(Object.keys(OPTICAL_CREST_SCALE).sort(),ids);
  for(const club of data.clubs){
    const scale=OPTICAL_CREST_SCALE[String(club.id)];
    assert.ok(Number.isFinite(scale)&&scale>=.90&&scale<=1.12,club.name+' optical scale is outside safe visual bounds');
  }
});
