import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('../src/',import.meta.url).pathname);
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}

test('every enabled JSX button has an explicit action or submit behavior',function(){
  const files=walk(root).filter(file=>file.endsWith('.jsx')),suspects=[];
  for(const file of files){
    const source=fs.readFileSync(file,'utf8');
    for(const match of source.matchAll(/<button\b[^>]*>/g)){
      const tag=match[0];
      if(!/onClick\s*=|type\s*=\s*["']submit["']|formAction\s*=|disabled\s*=/.test(tag))suspects.push(path.relative(root,file)+': '+tag.slice(0,180));
    }
  }
  assert.deepEqual(suspects,[],'buttons without explicit behavior:\n'+suspects.join('\n'));
});

test('gameplay engines remain deterministic and contain no unsafe runtime code execution',function(){
  const engineNames=['ldf-engine.js','career-engine.js','competition-engine.js','player-engine.js','development-engine.js','career-dynamics.js','career-life-engine.js','tactical-engine.js','transfer-engine.js','economy-engine.js','event-engine.js','scouting-engine.js','player-career-engine.js','player-career-intelligence.js','player-world-engine.js','player-life-engine.js','save-format.js','manager-confidence.js'];
  for(const name of engineNames){
    const source=fs.readFileSync(path.join(root,name),'utf8');
    assert.equal(/Math\.random\s*\(/.test(source),false,name+' contains non-seeded Math.random');
    assert.equal(/dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new Function\s*\(/.test(source),false,name+' contains unsafe runtime execution');
    assert.equal(/\bTODO\b|\bFIXME\b|em construção|será conectado|serão ativados|estrutura inicial/i.test(source),false,name+' contains unfinished placeholder text');
  }
});


test('visible source copy avoids generic motivational filler in career surfaces',function(){
  const names=['PlayerCareer.jsx','ClubDashboard.jsx','CareerCenter.jsx','main.jsx'];
  const banned=[/jornada lendária/i,/destino está em suas mãos/i,/conquiste seus sonhos/i,/incrível jornada/i,/história você quer conhecer/i];
  for(const name of names){
    const source=fs.readFileSync(path.join(root,name),'utf8');
    for(const pattern of banned)assert.equal(pattern.test(source),false,name+' contains generic filler: '+pattern);
  }
});
