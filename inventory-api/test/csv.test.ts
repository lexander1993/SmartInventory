import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,csvContents} from '../../inventory-frontend/src/csv.ts';
test('CSV preserves leading zeroes, escaped quotes, commas, and multiline fields',()=>{
 const rows=[{sku:'0001',name:'Tea, "green"\nLarge bag',cost:3.5}];
 assert.deepEqual(parseCsv(csvContents(['sku','name','cost'],rows)),[{sku:'0001',name:'Tea, "green"\nLarge bag',cost:'3.5'}]);
});
test('CSV export neutralizes formula prefixes in text while keeping negative quantities numeric',()=>{
 const rows=parseCsv(csvContents(['name','sku','quantity'],[{name:'=HYPERLINK("example")',sku:' @test',quantity:-2}]));
 assert.equal(rows[0].name,"'=HYPERLINK(\"example\")");assert.equal(rows[0].sku,"' @test");assert.equal(rows[0].quantity,'-2');
});
test('CSV rejects malformed quotes, duplicate columns, and mismatched rows',()=>{
 assert.throws(()=>parseCsv('sku,name\n1,"Unclosed'),/Unclosed/);
 assert.throws(()=>parseCsv('sku,sku\n1,2'),/Duplicate/);
 assert.throws(()=>parseCsv('sku,name\n1,2,3'),/fields/);
});
