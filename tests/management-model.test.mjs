import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeState,emptyClub,signContract,contractTotals} from '../src/management-model.js';
test('one contract per slot, including repeated confirmation',()=>{
 let state=signContract(emptyClub(),'vertice');
 state=signContract(state,'vertice');state=signContract(state,'aurora');
 assert.deepEqual(state.contracts,['vertice']);
 state=signContract(state,'pulso');assert.deepEqual(state.contracts,['vertice','pulso']);
 assert.deepEqual(contractTotals(state),{monthly:780000,committed:9460000,bonus:100000});
});
test('load ignores unknown clubs, invalid offers, duplicate slots and simulated awards',()=>{
 const loaded=sanitizeState({'2029':{contracts:['invalid','aurora','vertice','nexo','nexo'],awards:['copa','copa','fake']},'819':{contracts:['orbe'],awards:[]},unknown:{contracts:['vertice']}},['2029','819']);
 assert.deepEqual(loaded['2029'],{contracts:['aurora','nexo'],awards:['copa']});
 assert.deepEqual(loaded['819'],{contracts:['orbe'],awards:[]});assert.equal(loaded.unknown,undefined);
 assert.deepEqual(sanitizeState(null,['2029']),{});
 assert.deepEqual(sanitizeState({'2029':{contracts:{},awards:'broken'}},['2029']),{'2029':emptyClub()});
});
test('projection includes each term and signing bonus without treating it as cash',()=>{
 const state=signContract(signContract(signContract(emptyClub(),'aurora'),'nexo'),'impulso');
 assert.deepEqual(contractTotals(state),{monthly:850000,committed:21600000,bonus:1200000});
 const ended={...state,contracts:state.contracts.filter(id=>id!=='aurora')};
 assert.deepEqual(contractTotals(ended),{monthly:350000,committed:8400000,bonus:0});
});
