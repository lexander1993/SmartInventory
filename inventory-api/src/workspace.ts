import {Router} from 'express';
import {z} from 'zod';
import {db} from './db.js';
import {salesRange,salesReport} from './reports.js';
export const workspace=Router();
const id=z.coerce.number().int().positive();
const quantity=z.number().int().positive().max(1e7);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v,'Invalid date');
const order=z.object({product_id:id,supplier_id:id,quantity,expected_date:date.nullable().default(null)});
workspace.post('/orders',async(q,r)=>{
 const o=order.parse(q.body);const supplierId=o.supplier_id;
 r.status(201).json((await db.query('INSERT INTO purchase_orders(product_id,supplier_id,quantity,expected_date) VALUES($1,$2,$3,$4) RETURNING *',[o.product_id,supplierId,o.quantity,o.expected_date])).rows[0]);
});
workspace.post('/orders/:id/receive',async(q,r)=>{
 const orderId=id.parse(q.params.id);const input=z.object({quantity:quantity.optional()}).parse(q.body || {});const c=await db.connect();
 try{await c.query('BEGIN');const o=(await c.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
 if(!o || o.status==='received'){await c.query('ROLLBACK');r.status(409).json({error:'Order missing or already received'});return;}
 const units=input.quantity ?? o.quantity-o.received_quantity;
 if(units>o.quantity-o.received_quantity){await c.query('ROLLBACK');r.status(409).json({error:'Receipt exceeds the remaining order quantity'});return;}
 const p=(await c.query('UPDATE products SET stock=stock+$1 WHERE id=$2 RETURNING price,cost',[units,o.product_id])).rows[0];
 await c.query("INSERT INTO movements(product_id,kind,quantity,unit_price,unit_cost,note,order_id) VALUES($1,'receipt',$2,$3,$4,$5,$6)",[o.product_id,units,p.price,p.cost,'Purchase order #'+orderId,orderId]);
 const received=o.received_quantity+units;
 await c.query("UPDATE purchase_orders SET received_quantity=$1,status=$2,received_at=CASE WHEN $2='received' THEN now() ELSE NULL END WHERE id=$3",[received,received===o.quantity?'received':'ordered',orderId]);
 await c.query('COMMIT');r.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
workspace.put('/orders/:id',async(q,r)=>{
 const orderId=id.parse(q.params.id);const input=order.partial().parse(q.body);const c=await db.connect();
 try{await c.query('BEGIN');const o=(await c.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
 if(!o){await c.query('ROLLBACK');r.status(404).json({error:'Order not found'});return;}
 const next={...o,...input};
 if(o.received_quantity>0 && (next.product_id!==o.product_id || next.supplier_id!==o.supplier_id)){await c.query('ROLLBACK');r.status(409).json({error:'Product and supplier cannot change after receiving stock'});return;}
 if(next.quantity<o.received_quantity){await c.query('ROLLBACK');r.status(409).json({error:'Quantity cannot be below units already received. Correct the receipt first.'});return;}
 await c.query("UPDATE purchase_orders SET product_id=$1,supplier_id=$2,quantity=$3,expected_date=$4,status=$5,received_at=CASE WHEN $5='received' THEN COALESCE(received_at,now()) ELSE NULL END WHERE id=$6",[next.product_id,next.supplier_id,next.quantity,next.expected_date,next.quantity===o.received_quantity?'received':'ordered',orderId]);
 await c.query('COMMIT');r.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
// Correct an individual delivery, with the order lock taken before the movement lock.
workspace.put('/orders/:id/receipts/:receiptId',async(q,r)=>{
 const orderId=id.parse(q.params.id),receiptId=id.parse(q.params.receiptId);const units=z.number().int().min(0).max(1e7).parse(q.body.quantity);const c=await db.connect();
 try{await c.query('BEGIN');const o=(await c.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];const m=(await c.query('SELECT * FROM movements WHERE id=$1 AND order_id=$2 FOR UPDATE',[receiptId,orderId])).rows[0];
 if(!o || !m){await c.query('ROLLBACK');r.status(404).json({error:'Order receipt not found'});return;}
 const received=o.received_quantity-m.quantity+units;
 const p=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[o.product_id])).rows[0];
 if(received>o.quantity || p.stock+units-m.quantity<0){await c.query('ROLLBACK');r.status(409).json({error:'Correction exceeds ordered units or would make stock negative'});return;}
 await c.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[units-m.quantity,o.product_id]);
 if(units)await c.query('UPDATE movements SET quantity=$1 WHERE id=$2',[units,receiptId]);else await c.query('DELETE FROM movements WHERE id=$1',[receiptId]);
 await c.query("UPDATE purchase_orders SET received_quantity=$1,status=$2,received_at=CASE WHEN $2='received' THEN COALESCE(received_at,now()) ELSE NULL END WHERE id=$3",[received,received===o.quantity?'received':'ordered',orderId]);
 await c.query('COMMIT');r.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
workspace.get('/orders/:id/receipts',async(q,r)=>r.json((await db.query('SELECT * FROM movements WHERE order_id=$1 ORDER BY created_at,id',[id.parse(q.params.id)])).rows));
workspace.delete('/orders/:id',async(q,r)=>{
 const orderId=id.parse(q.params.id);const c=await db.connect();try{await c.query('BEGIN');const o=(await c.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
 if(!o){await c.query('ROLLBACK');r.status(404).json({error:'Order not found'});return;}
 const receipts=(await c.query('SELECT * FROM movements WHERE order_id=$1 FOR UPDATE',[orderId])).rows;
 const total=receipts.reduce((sum,m)=>sum+m.quantity,0);
 const p=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[o.product_id])).rows[0];
 if(total!==o.received_quantity || p.stock<total){await c.query('ROLLBACK');r.status(409).json({error:'Receipts do not match or reversing this order would make stock negative'});return;}
 await c.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[total,o.product_id]);await c.query('DELETE FROM movements WHERE order_id=$1',[orderId]);await c.query('DELETE FROM purchase_orders WHERE id=$1',[orderId]);await c.query('COMMIT');r.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
workspace.post('/stocktakes',async(q,r)=>{
 const input=z.object({note:z.string().trim().min(1).max(400),items:z.array(z.object({product_id:id,expected_stock:z.number().int().min(0),counted:z.number().int().min(0).max(1e7)})).min(1).max(1000)}).parse(q.body);
 if(new Set(input.items.map(p=>p.product_id)).size!==input.items.length){r.status(400).json({error:'Each product may appear once'});return;}
 const c=await db.connect();try{await c.query('BEGIN');const products=(await c.query('SELECT * FROM products WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE',[input.items.map(p=>p.product_id)])).rows;
 if(products.length!==input.items.length || input.items.some(i=>products.find(p=>p.id===i.product_id)?.stock!==i.expected_stock)){await c.query('ROLLBACK');r.status(409).json({error:'Stock changed since this count started. Refresh and recount before saving.'});return;}
 let adjustments=0;
 for(const item of input.items){const p=products.find(p=>p.id===item.product_id)!;const delta=item.counted-p.stock;if(!delta)continue;await c.query('UPDATE products SET stock=$1 WHERE id=$2',[item.counted,p.id]);await c.query("INSERT INTO movements(product_id,kind,quantity,unit_price,unit_cost,note) VALUES($1,'adjustment',$2,$3,$4,$5)",[p.id,delta,p.price,p.cost,'Stocktake: '+input.note]);adjustments++;}
 await c.query('COMMIT');r.status(201).json({adjustments});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
workspace.get('/reports/sales',async(q,r)=>r.json(await salesReport(salesRange.parse(q.query))));
workspace.get('/history',async(q,r)=>{const offset=z.coerce.number().int().min(0).default(0).parse(q.query.offset);const entity=z.enum(['products','suppliers','movements','purchase_orders','users']).optional().parse(q.query.entity);const rows=(await db.query('SELECT * FROM audit_log WHERE ($1::text IS NULL OR entity=$1) ORDER BY id DESC LIMIT 51 OFFSET $2',[entity ?? null,offset])).rows;r.json({rows:rows.slice(0,50),hasMore:rows.length>50});});
const importProduct=z.object({name:z.string().trim().min(1).max(150),sku:z.string().trim().min(1).max(150),barcode:z.string().trim().min(1).max(150),category:z.string().trim().min(1).max(150),cost:z.number().min(0).max(1e8),price:z.number().min(0).max(1e8),min_stock:z.number().int().min(0).max(1e7),supplier_id:id.nullable()});
workspace.post('/products/import',async(q,r)=>{
 const rows=z.array(importProduct).min(1).max(1000).parse(q.body.products);const c=await db.connect();try{await c.query('BEGIN');let created=0,updated=0;
 if(new Set(rows.map(p=>p.sku)).size!==rows.length || new Set(rows.map(p=>p.barcode)).size!==rows.length){await c.query('ROLLBACK');r.status(400).json({error:'Duplicate SKU or barcode in the file'});return;}
 for(const p of rows){const result=await c.query(`INSERT INTO products(name,sku,barcode,category,cost,price,min_stock,supplier_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
 ON CONFLICT(sku) DO UPDATE SET name=EXCLUDED.name,barcode=EXCLUDED.barcode,category=EXCLUDED.category,cost=EXCLUDED.cost,price=EXCLUDED.price,min_stock=EXCLUDED.min_stock,supplier_id=EXCLUDED.supplier_id RETURNING (xmax=0) inserted`,[p.name,p.sku,p.barcode,p.category,p.cost,p.price,p.min_stock,p.supplier_id]);if(result.rows[0].inserted)created++;else updated++;}
 await c.query('COMMIT');r.json({created,updated});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
workspace.get('/export/movements',async(_q,r)=>r.json((await db.query('SELECT m.*,p.name,p.sku FROM movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC,m.id DESC')).rows));
