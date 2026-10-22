import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const pg=new PGlite();
await pg.exec(await readFile(new URL('../db/001_init.sql',import.meta.url),'utf8'));
await pg.exec("INSERT INTO suppliers(name) VALUES('Legacy supplier'); INSERT INTO products(name,sku,barcode,cost,price,stock,supplier_id) VALUES('Legacy product','OLD','00001',2,5,10,1); INSERT INTO purchase_orders(product_id,supplier_id,quantity,status) VALUES(1,1,10,'received'); INSERT INTO movements(product_id,kind,quantity,unit_price,note) VALUES(1,'receipt',10,5,'Purchase order #1');");
process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
const {db}=await import('../src/db.ts');
const query=async(sql,args)=>{
 if(sql.includes('CREATE TABLE IF NOT EXISTS suppliers') || sql.includes('ALTER TABLE purchase_orders ADD COLUMN') || sql.includes('CREATE TABLE IF NOT EXISTS ai_actions')){await pg.exec(sql);return {rows:[],rowCount:0};}
 const result=await pg.query(sql,args);return {...result,rowCount:result.rows.length || result.affectedRows || 0};
};
db.connect=async()=>({query,release(){}});
const {migrate}=await import('../src/schema.ts');await migrate();await migrate();
assert.equal((await query('SELECT stock FROM products')).rows[0].stock,10);
assert.equal((await query('SELECT received_quantity FROM purchase_orders')).rows[0].received_quantity,10);
assert.equal((await query('SELECT order_id FROM movements')).rows[0].order_id,1);
assert.equal((await query('SELECT unit_cost FROM movements')).rows[0].unit_cost,null);
assert.equal((await query('SELECT COUNT(*)::int n FROM schema_migrations')).rows[0].n,3);
assert.equal((await query('SELECT COUNT(*)::int n FROM movements')).rows[0].n,1);
await pg.close();await db.end();console.log('PASS: legacy upgrade preserves balances and history, links receipts, and applies once');
