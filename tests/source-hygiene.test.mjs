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
function normalize(file){return path.relative(root,file).replaceAll('\\','/');}
function resolveRelative(from,spec,files){
  const base=path.resolve(path.dirname(from),spec);
  const candidates=[base,base+'.js',base+'.jsx',base+'.mjs',path.join(base,'index.js'),path.join(base,'index.jsx')];
  return candidates.find(item=>files.has(path.resolve(item)))||null;
}

test('every runtime JS module under src is reachable from main.jsx',function(){
  const sourceFiles=walk(root).filter(file=>/\.(js|jsx|mjs)$/.test(file)),set=new Set(sourceFiles.map(file=>path.resolve(file))),entry=path.resolve(root,'main.jsx'),seen=new Set(),stack=[entry];
  while(stack.length){
    const file=stack.pop();if(seen.has(file)||!set.has(file))continue;seen.add(file);
    const source=fs.readFileSync(file,'utf8');
    for(const match of source.matchAll(/(?:import\s+(?:[^'"]+?\s+from\s+)?|import\()['"]([^'"]+)['"]/g)){
      const spec=match[1];if(!spec.startsWith('.'))continue;
      const target=resolveRelative(file,spec,set);if(target)stack.push(target);
    }
  }
  const orphan=sourceFiles.filter(file=>!seen.has(path.resolve(file))).map(normalize).sort();
  assert.deepEqual(orphan,[],'orphan runtime modules: '+orphan.join(', '));
});

test('release source contains no legacy prototype or generated-product labels',function(){
  const source=walk(root).filter(file=>/\.(js|jsx|css)$/.test(file)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
  for(const phrase of ['Lovable','IA adaptativa','beta00','SaaS genérico'])assert.equal(source.includes(phrase),false,'legacy label found: '+phrase);
});
