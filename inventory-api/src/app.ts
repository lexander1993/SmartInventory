import express, {type ErrorRequestHandler} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {z} from 'zod';
import {db,actorContext} from './db.js';
import {refreshAlerts} from './jobs.js';
import {recommend} from './forecast.js';
import {originGuard} from './security.js';
import {workspace} from './workspace.js';
import {ai} from './ai.js';
export const app=express();
app.use(helmet());app.use(cors({origin:process.env.FRONTEND_URL || 'http://localhost:5173',credentials:true}));app.use(express.json({limit:'2mb'}));
app.use('/api',originGuard);
app.use('/api',(_q,_r,next)=>actorContext.run('Local workspace',()=>next()));
app.use('/api',workspace);
app.use('/api/ai',ai);
const id=z.coerce.number().int().positive();
const text=z.string().trim().min(1).max(150);
const product=z.object({sku:text,barcode:text,name:text,category:text,cost:z.number().min(0).max(1e8),price:z.number().min(0).max(1e8),min_stock:z.number().int().min(0).max(1e7),supplier_id:id.nullable()});
const supplier=z.object({name:text,email:z.union([z.email(),z.literal('')]),phone:z.string().max(80),lead_days:z.number().int().min(0).max(365)});
app.get('/api/health',async(_q,r)=>{await db.query('SELECT 1');r.json({status:'ok'});});
app.get('/api/products',async(_q,r)=>r.json((await db.query(`SELECT p.*,s.name supplier_name FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.name`)).rows));
app.post('/api/products',async(q,r)=>{const p=product.parse(q.body);const result=await db.query(`INSERT INTO products(sku,barcode,name,category,cost,price,min_stock,supplier_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[p.sku,p.barcode,p.name,p.category,p.cost,p.price,p.min_stock,p.supplier_id]);r.status(201).json(result.rows[0]);});
app.put('/api/products/:id',async(q,r)=>{const p=product.parse(q.body);const result=await db.query(`UPDATE products SET sku=$1,barcode=$2,name=$3,category=$4,cost=$5,price=$6,min_stock=$7,supplier_id=$8 WHERE id=$9 RETURNING *`,[p.sku,p.barcode,p.name,p.category,p.cost,p.price,p.min_stock,p.supplier_id,id.parse(q.params.id)]);if(!result.rowCount){r.status(404).json({error:'Product not found'});return;}r.json(result.rows[0]);});
app.get('/api/barcodes/:barcode',async(q,r)=>{const result=await db.query('SELECT * FROM products WHERE barcode=$1',[q.params.barcode]);if(!result.rowCount){r.status(404).json({error:'Barcode not found'});return;}r.json(result.rows[0]);});
app.get('/api/suppliers',async(_q,r)=>r.json((await db.query('SELECT * FROM suppliers ORDER BY name')).rows));
app.post('/api/suppliers',async(q,r)=>{const s=supplier.parse(q.body);r.status(201).json((await db.query('INSERT INTO suppliers(name,email,phone,lead_days) VALUES($1,$2,$3,$4) RETURNING *',[s.name,s.email,s.phone,s.lead_days])).rows[0]);});
app.put('/api/suppliers/:id',async(q,r)=>{const s=supplier.parse(q.body);const result=await db.query('UPDATE suppliers SET name=$1,email=$2,phone=$3,lead_days=$4 WHERE id=$5 RETURNING *',[s.name,s.email,s.phone,s.lead_days,id.parse(q.params.id)]);if(!result.rowCount){r.status(404).json({error:'Supplier not found'});return;}r.json(result.rows[0]);});
app.post('/api/movements',async(q,r)=>{
 const m=z.object({product_id:id,kind:z.enum(['sale','receipt','adjustment']),quantity:z.number().int().min(-1e7).max(1e7).refine(n=>n!==0),note:z.string().max(500).default('')}).parse(q.body);
 if(m.kind!=='adjustment' && m.quantity<0){r.status(400).json({error:'Sales and receipts require positive quantities'});return;}
 const delta=m.kind==='sale'?-m.quantity:m.quantity;
 const c=await db.connect();
 try {await c.query('BEGIN');const result=await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[m.product_id]);const p=result.rows[0];
 if(!p){await c.query('ROLLBACK');r.status(404).json({error:'Product not found'});return;}
 if(p.stock+delta<0){await c.query('ROLLBACK');r.status(409).json({error:'Insufficient stock'});return;}
 await c.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[delta,p.id]);
 await c.query('INSERT INTO movements(product_id,kind,quantity,unit_price,note,unit_cost) VALUES($1,$2,$3,$4,$5,$6)',[p.id,m.kind,delta,p.price,m.note,p.cost]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 r.status(201).json({ok:true});
});
app.get('/api/movements',async(_q,r)=>r.json((await db.query('SELECT m.*,p.name FROM movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC,m.id DESC LIMIT 100')).rows));
app.get('/api/alerts',async(_q,r)=>{await refreshAlerts();r.json((await db.query('SELECT * FROM alerts ORDER BY product_id')).rows);});
app.post('/api/jobs/alerts',async(_q,r)=>{await refreshAlerts();r.json({ok:true});});
app.get('/api/recommendations',async(_q,r)=>{
 const rows=(await db.query(`SELECT p.*,COALESCE(s.lead_days,7) lead_days,s.name supplier_name,
 COALESCE((SELECT -SUM(quantity) FROM movements WHERE product_id=p.id AND kind='sale' AND created_at>=CURRENT_DATE-27 AND created_at<CURRENT_DATE+1),0)::float8/28 daily,
 COALESCE((SELECT SUM(quantity-received_quantity) FROM purchase_orders WHERE product_id=p.id AND status='ordered'),0)::int on_order FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.name`)).rows;
 r.json(rows.map(p=>({...p,...recommend(p.stock,p.daily,p.lead_days,p.min_stock,p.on_order)})));
});
app.get('/api/forecast',async(q,r)=>{
 const productId=id.parse(q.query.product_id);
 const rows=(await db.query(`SELECT to_char(d,'YYYY-MM-DD') date,COALESCE(-SUM(m.quantity),0)::int units FROM generate_series(CURRENT_DATE-27,CURRENT_DATE,'1 day') d LEFT JOIN movements m ON m.product_id=$1 AND m.kind='sale' AND m.created_at>=d AND m.created_at<d+interval '1 day' GROUP BY d ORDER BY d`,[productId])).rows;
 const mean=rows.reduce((sum,p)=>sum+p.units,0)/28;
 r.json({history:rows,forecast:Array.from({length:14},(_,i)=>({date:new Date(Date.parse(rows[27].date+'T00:00:00Z')+(i+1)*86400000).toISOString().slice(0,10),forecast:Number(mean.toFixed(2))})),method:'28-day daily average, including zero-sale days; 14-day horizon'});
});
app.get('/api/orders',async(_q,r)=>r.json((await db.query("SELECT o.*,to_char(o.expected_date,'YYYY-MM-DD') expected_date,p.name,s.name supplier_name FROM purchase_orders o JOIN products p ON p.id=o.product_id JOIN suppliers s ON s.id=o.supplier_id ORDER BY o.id DESC")).rows));
// Corrections apply the difference to the balance in the same transaction.
app.put('/api/movements/:id',async(q,r)=>{
 const m=z.object({product_id:id,kind:z.enum(['sale','receipt','adjustment']),quantity:z.number().int().min(-1e7).max(1e7).refine(n=>n!==0),note:z.string().max(500).default('')}).parse(q.body);
 if(m.kind!=='adjustment' && m.quantity<0){r.status(400).json({error:'Sales and receipts require positive quantities'});return;}
 await correctMovement(id.parse(q.params.id),m,r);
});
app.delete('/api/movements/:id',async(q,r)=>{await correctMovement(id.parse(q.params.id),null,r);});
async function correctMovement(movementId:number,m:{product_id:number;kind:string;quantity:number;note:string}|null,r:express.Response){
 const c=await db.connect();try{await c.query('BEGIN');
 const old=(await c.query('SELECT * FROM movements WHERE id=$1 FOR UPDATE',[movementId])).rows[0];
 if(!old){await c.query('ROLLBACK');r.status(404).json({error:'Movement not found'});return;}
 if(old.order_id){await c.query('ROLLBACK');r.status(409).json({error:'Edit or delete the received purchase order to correct its receipt'});return;}
 const ids=[...new Set([old.product_id,...(m?[m.product_id]:[])])].sort((a,b)=>a-b);
 const products=(await c.query('SELECT * FROM products WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE',[ids])).rows;
 if(products.length!==ids.length){await c.query('ROLLBACK');r.status(404).json({error:'Product not found'});return;}
 const delta=m?(m.kind==='sale'?-m.quantity:m.quantity):0;
 for(const p of products){const change=(p.id===old.product_id?-old.quantity:0)+(m && p.id===m.product_id?delta:0);if(p.stock+change<0){await c.query('ROLLBACK');r.status(409).json({error:'Correction would make stock negative'});return;}}
 for(const p of products){const change=(p.id===old.product_id?-old.quantity:0)+(m && p.id===m.product_id?delta:0);await c.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[change,p.id]);}
 if(m)await c.query('UPDATE movements SET product_id=$1,kind=$2,quantity=$3,note=$4,unit_price=$5,unit_cost=$7 WHERE id=$6',[m.product_id,m.kind,delta,m.note,m.product_id===old.product_id?old.unit_price:products.find(p=>p.id===m.product_id).price,movementId,m.product_id===old.product_id?old.unit_cost:products.find(p=>p.id===m.product_id).cost]);
 else await c.query('DELETE FROM movements WHERE id=$1',[movementId]);
 await c.query('COMMIT');r.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
app.delete('/api/products/:id',async(q,r)=>{const productId=id.parse(q.params.id);const c=await db.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[productId])).rows[0];
 if(!p){await c.query('ROLLBACK');r.status(404).json({error:'Product not found'});return;}
 if(p.stock!==0 || (await c.query('SELECT id FROM movements WHERE product_id=$1 UNION ALL SELECT id FROM purchase_orders WHERE product_id=$1',[productId])).rowCount){await c.query('ROLLBACK');r.status(409).json({error:'Delete linked movements and purchase orders and clear stock before deleting this product'});return;}
 await c.query('DELETE FROM alerts WHERE product_id=$1',[productId]);await c.query('DELETE FROM products WHERE id=$1',[productId]);await c.query('COMMIT');r.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}});
app.delete('/api/suppliers/:id',async(q,r)=>{const result=await db.query('DELETE FROM suppliers WHERE id=$1 RETURNING id',[id.parse(q.params.id)]);if(!result.rowCount){r.status(404).json({error:'Supplier not found'});return;}r.json({ok:true});});

app.use((_q,r)=>{r.status(404).json({error:'Route not found'});});
const errors:ErrorRequestHandler=(e,_q,r,_next)=>{if(e instanceof z.ZodError){r.status(400).json({error:e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return;}
 if(e.code==='23505'){r.status(409).json({error:'SKU or barcode already exists'});return;}
 if(e.code==='23503'){r.status(400).json({error:'Record is missing or still linked to other records'});return;}
 if(e.type==='entity.parse.failed'){r.status(400).json({error:'Invalid JSON'});return;}
 console.error(e);r.status(500).json({error:'Internal server error'});};app.use(errors);
