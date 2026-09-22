import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trophies } from '../src/management-model.js';

test('career trophy catalogue has unique ids and required competitions', function(){
  const ids=trophies.map(function(trophy){return trophy.id;});
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.includes('brasileirao'));
  assert.ok(ids.includes('libertadores'));
  assert.ok(ids.includes('world'));
  assert.ok(trophies.every(function(trophy){
    return trophy.name && trophy.kind && trophy.label && trophy.shape;
  }));
});
