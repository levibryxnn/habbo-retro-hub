import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneForPosition } from '../src/league-model.js';

test('classification zones follow the configured Serie A layout', function(){
  assert.equal(zoneForPosition(1).id,'champion');
  assert.equal(zoneForPosition(4).id,'libertadores');
  assert.equal(zoneForPosition(5).id,'prelib');
  assert.equal(zoneForPosition(6).id,'sudamericana');
  assert.equal(zoneForPosition(11).id,'sudamericana');
  assert.equal(zoneForPosition(12).id,'neutral');
  assert.equal(zoneForPosition(16).id,'neutral');
  assert.equal(zoneForPosition(17).id,'relegation');
  assert.equal(zoneForPosition(20).id,'relegation');
});
