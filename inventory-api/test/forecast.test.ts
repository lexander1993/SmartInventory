import {test} from 'node:test';import assert from 'node:assert/strict';import {recommend} from '../src/forecast.js';
test('lead-time demand triggers reorder',()=>assert.equal(recommend(8,2,5,5).recommendedQuantity,30));
test('incoming orders prevent duplicate recommendation',()=>assert.equal(recommend(8,2,5,5,40).recommendedQuantity,0));
test('zero sales respects minimum and has no finite cover',()=>{const r=recommend(0,0,7,5);assert.equal(r.recommendedQuantity,5);assert.equal(r.daysOfCover,null);});
test('sufficient stock needs no reorder',()=>assert.equal(recommend(100,2,5,5).recommendedQuantity,0));
