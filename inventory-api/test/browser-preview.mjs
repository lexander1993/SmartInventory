// Disposable browser QA server. All records live in memory and disappear on exit.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const pg=new PGlite();
for(const file of ['001_init.sql','002_workspace.sql','003_ask_ai.sql'])await pg.exec(await readFile(new URL('../db/'+file,import.meta.url),'utf8'));
process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
process.env.FRONTEND_URL='http://localhost:5174';
const {db,actorContext}=await import('../src/db.ts');
const query=async(sql,args)=>{const r=await pg.query(sql,args);if(/^BEGIN\b/i.test(sql))await pg.query("SELECT set_config('app.actor',$1,true)",[actorContext.getStore()||'system']);return {...r,rowCount:r.rows.length||r.affectedRows||0};};
db.query=async(sql,args)=>{await query('BEGIN');try{const r=await query(sql,args);await query('COMMIT');return r;}catch(e){await query('ROLLBACK');throw e;}};
// PGlite has a single connection: serialize full HTTP requests during browser QA.
db.connect=async()=>({query,release(){}});
await query("INSERT INTO suppliers(name,email,lead_days) VALUES('Everyday Wholesale','orders@example.com',5)");
await query("INSERT INTO products(name,sku,barcode,category,cost,price,stock,min_stock,supplier_id) VALUES('House Blend Coffee','COF-01','930000000001','Pantry',12,22,8,12,1),('Green Tea','TEA-01','930000000002','Pantry',4,9,45,10,1)");
const {app}=await import('../src/app.ts');
// A queue around app.handle makes each simulated connection independent.
const {createServer}=await import('node:http');
let pending=Promise.resolve();
const server=createServer((req,res)=>{pending=pending.then(()=>new Promise(resolve=>{res.once('finish',resolve);app(req,res);}));});
server.listen(3002,'127.0.0.1',()=>console.log('Disposable QA API listening on http://localhost:3002'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{void pg.close().then(()=>process.exit(0));}));
