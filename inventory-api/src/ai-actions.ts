import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,actorContext} from './db.js';
import {calendarDate} from './reports.js';
const productId=z.number().int().positive();
export const stockRequest=z.object({product_id:productId,kind:z.enum(['receipt','sale','adjustment']),quantity:z.number().int().min(-1e7).max(1e7).refine(n=>n!==0),note:z.string().trim().min(1).max(400)}).strict().refine(v=>v.kind==='adjustment'||v.quantity>0,'Sales and receipts require positive units');
export const orderRequest=z.object({product_id:productId,supplier_id:productId,quantity:z.number().int().min(1).max(1e7),expected_date:calendarDate.nullable()}).strict();
const snapshot=z.object({name:z.string(),sku:z.string(),stock:z.number().int().min(0)});
const storedPayload=z.discriminatedUnion('type',[
 z.object({type:z.literal('stock_movement'),request:stockRequest,product:snapshot}),
 z.object({type:z.literal('purchase_order'),request:orderRequest,product:snapshot,supplier_name:z.string()})
]);
export type AiAction={id:string;kind:string;payload:z.infer<typeof storedPayload>;status:'pending'|'applied'|'cancelled';expires_at:string;result?:unknown};
export class AiActionError extends Error{constructor(public status:number,message:string){super(message);}}
export async function prepareStockChange(input:unknown):Promise<AiAction>{
 const request=stockRequest.parse(input);const p=(await db.query('SELECT id,name,sku,stock FROM products WHERE id=$1',[request.product_id])).rows[0];
 if(!p)throw new AiActionError(404,'Product not found. Search for the product first.');
 const delta=request.kind==='sale'?-request.quantity:request.quantity;
 if(p.stock+delta<0)throw new AiActionError(409,'This change would make stock negative.');
 return saveAction({type:'stock_movement',request,product:{name:p.name,sku:p.sku,stock:p.stock}});
}
export async function prepareOrder(input:unknown):Promise<AiAction>{
 const request=orderRequest.parse(input);const p=(await db.query('SELECT id,name,sku,stock FROM products WHERE id=$1',[request.product_id])).rows[0];
 const supplier=(await db.query('SELECT id,name FROM suppliers WHERE id=$1',[request.supplier_id])).rows[0];
 if(!p || !supplier)throw new AiActionError(404,'Product or supplier not found. Search before preparing an order.');
 return saveAction({type:'purchase_order',request,product:{name:p.name,sku:p.sku,stock:p.stock},supplier_name:supplier.name});
}
async function saveAction(payload:z.infer<typeof storedPayload>):Promise<AiAction>{
 return (await db.query('INSERT INTO ai_actions(id,kind,payload) VALUES($1,$2,$3) RETURNING id,kind,payload,status,expires_at',[randomUUID(),payload.type,payload])).rows[0];
}
export async function confirmAction(actionId:string){
 return actorContext.run('Ask AI · confirmed by user',async()=>{
 const c=await db.connect();try{await c.query('BEGIN');const action=(await c.query('SELECT * FROM ai_actions WHERE id=$1 FOR UPDATE',[actionId])).rows[0];
 if(!action)throw new AiActionError(404,'This proposal was not found.');
 if(action.status==='applied'){await c.query('COMMIT');return {status:'applied',result:action.result};}
 if(action.status!=='pending')throw new AiActionError(409,'This proposal has been cancelled.');
 if(new Date(action.expires_at).getTime()<=Date.now())throw new AiActionError(409,'This proposal expired. Ask AI to prepare it again.');
 const payload=storedPayload.parse(action.payload);
 const p=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[payload.request.product_id])).rows[0];
 if(!p || p.stock!==payload.product.stock || p.sku!==payload.product.sku || p.name!==payload.product.name)throw new AiActionError(409,'This product changed after the proposal was prepared. Ask AI to prepare it again.');
 let result:Record<string,unknown>;
 if(payload.type==='stock_movement'){
  const m=payload.request;const delta=m.kind==='sale'?-m.quantity:m.quantity;
  if(p.stock+delta<0)throw new AiActionError(409,'Insufficient stock for this change.');
  await c.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[delta,p.id]);
  const movement=(await c.query('INSERT INTO movements(product_id,kind,quantity,unit_price,unit_cost,note) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[p.id,m.kind,delta,p.price,p.cost,'Ask AI: '+m.note])).rows[0];
  result={movement_id:movement.id,product:p.name,stock_before:p.stock,stock_after:p.stock+delta};
 }else{
  const o=payload.request;const supplier=(await c.query('SELECT name FROM suppliers WHERE id=$1 FOR SHARE',[o.supplier_id])).rows[0];
  if(!supplier || supplier.name!==payload.supplier_name)throw new AiActionError(409,'The supplier changed. Ask AI to prepare the order again.');
  const order=(await c.query('INSERT INTO purchase_orders(product_id,supplier_id,quantity,expected_date) VALUES($1,$2,$3,$4) RETURNING id',[p.id,o.supplier_id,o.quantity,o.expected_date])).rows[0];
  result={order_id:order.id,product:p.name,quantity:o.quantity,supplier:payload.supplier_name};
 }
 await c.query("UPDATE ai_actions SET status='applied',result=$1,applied_at=now() WHERE id=$2",[result,actionId]);await c.query('COMMIT');return {status:'applied',result};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
}
