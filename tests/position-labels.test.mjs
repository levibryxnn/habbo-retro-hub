import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionGroup, translatePosition } from '../src/position-labels.js';

test('football positions are localized to Brazilian Portuguese',function(){
  const cases={
    Goalkeeper:'Goleiro',
    Defender:'Defensor',
    'Centre-Back':'Zagueiro',
    'Right-Back':'Lateral Direito',
    'Left-Back':'Lateral Esquerdo',
    'Full-Back':'Lateral',
    'Right Wing-Back':'Ala Direito',
    'Left Wing-Back':'Ala Esquerdo',
    Midfielder:'Meio-campista',
    'Defensive Midfield':'Volante',
    'Central Midfield':'Meia Central',
    'Attacking Midfield':'Meia Ofensivo',
    'Right Winger':'Ponta Direita',
    'Left Winger':'Ponta Esquerda',
    'Second Striker':'Segundo Atacante',
    'Centre-Forward':'Centroavante',
    Forward:'Atacante',
  };
  for(const [input,expected] of Object.entries(cases)) assert.equal(translatePosition(input),expected,input);
});

test('detailed positions still feed the four simulation groups',function(){
  assert.equal(positionGroup('Goalkeeper'),'GOL');
  assert.equal(positionGroup('Right-Back'),'DEF');
  assert.equal(positionGroup('Left Wing-Back'),'DEF');
  assert.equal(positionGroup('Defensive Midfield'),'MEI');
  assert.equal(positionGroup('Attacking Midfield'),'MEI');
  assert.equal(positionGroup('Right Winger'),'ATA');
  assert.equal(positionGroup('Centre-Forward'),'ATA');
});
