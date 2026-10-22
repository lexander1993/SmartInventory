import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const pg=new PGlite();for(const file of ['001_init.sql','002_workspace.sql','003_ask_ai.sql'])await pg.exec(await readFile(new URL('../db/'+file,import.meta.url),'utf8'));
process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
const {db}=await import('../src/db.ts');
const query=async(sql,args)=>{const result=await pg.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};};
db.query=query;db.connect=async()=>({query,release(){}});
const {cleaningProducts}=await import('../src/cleaning-catalog.ts');
const {seedCleaningData}=await import('../src/cleaning-data.ts');
const {salesReport}=await import('../src/reports.ts');
const {DemoAssistant}=await import('../../inventory-frontend/src/ai-demo.ts');
await query("INSERT INTO products(sku,barcode,name,cost,price,stock) VALUES('OLD','000-old','Old product',7,11,9)");
assert.deepEqual(await seedCleaningData(),{created:0,skipped:true});
assert.deepEqual(await seedCleaningData(true),{created:14,skipped:false});
assert.equal((await query("SELECT COUNT(*)::int n FROM products WHERE sku='OLD'")).rows[0].n,0);
assert.equal((await query("SELECT COUNT(*)::int n FROM audit_log WHERE after_data->>'sku'='OLD'")).rows[0].n,0);
assert.equal((await query('SELECT COUNT(*)::int n FROM products')).rows[0].n,14);
for(const p of (await query('SELECT * FROM products')).rows){
 const expected=cleaningProducts.find(s=>s.sku===p.sku);
 assert.equal(p.stock,expected.stock);
 assert.equal(Number((await query('SELECT SUM(quantity) balance FROM movements WHERE product_id=$1',[p.id])).rows[0].balance),p.stock);
 assert.equal((await query('SELECT COUNT(*)::int n FROM movements WHERE product_id=$1 AND unit_cost IS NULL',[p.id])).rows[0].n,0);
 assert.ok(!/sample/i.test(p.name));
}
const dates=(await query("SELECT date_trunc('month',CURRENT_DATE)::date::text start,CURRENT_DATE::text today")).rows[0];
const report=await salesReport({from:dates.start,to:dates.today});assert.equal(report.rows.length,14);assert.equal(report.totals.unknown_cost_units,0);
const expectedCost=cleaningProducts.reduce((sum,s)=>sum+s.cost*s.sold,0),expectedProfit=cleaningProducts.reduce((sum,s)=>sum+(s.price-s.cost)*s.sold,0);
assert.ok(Math.abs(report.totals.cost-expectedCost)<0.001);assert.ok(Math.abs(report.totals.profit-expectedProfit)<0.001);
const demo=new DemoAssistant().ask('Give me a sales report').tables[1].rows;
for(const s of cleaningProducts){const row=demo.find(p=>p.sku===s.sku);assert.equal(row.units,s.sold);assert.ok(Math.abs(row.cost-s.cost*s.sold)<0.001);}
await seedCleaningData(true);assert.equal((await query('SELECT COUNT(*)::int n FROM products')).rows[0].n,14);
await pg.close();await db.end();console.log('PASS: cleaning inventory replacement, cost snapshots, balanced ledger, report totals and demo agreement');
