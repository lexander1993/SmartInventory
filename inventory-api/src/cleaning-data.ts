import {db,actorContext} from './db.js';
import {cleaningProducts} from './cleaning-catalog.js';

export async function seedCleaningData(replaceAll=false){
 return actorContext.run('Inventory setup',async()=>{
  const c=await db.connect();
  try{
   await c.query('BEGIN');
   await c.query('SELECT pg_advisory_xact_lock(872002)');
   if(replaceAll){
    await c.query('TRUNCATE sessions, users, ai_actions, alerts, movements, purchase_orders, products, suppliers, audit_log RESTART IDENTITY');
   }else if(Number((await c.query('SELECT count(*) FROM products')).rows[0].count)>0){
    await c.query('COMMIT');return {created:0,skipped:true};
   }
   const supplier=(await c.query("INSERT INTO suppliers(name,lead_days) VALUES('CleanCare Wholesale',5) RETURNING id")).rows[0].id;
   for(const item of cleaningProducts){
    const id=(await c.query(`INSERT INTO products(sku,barcode,name,category,cost,price,stock,min_stock,supplier_id,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE-35) RETURNING id`,[item.sku,item.barcode,item.name,item.category,item.cost,item.price,item.stock,item.min_stock,supplier])).rows[0].id;
    await c.query(`INSERT INTO movements(product_id,kind,quantity,unit_price,unit_cost,note,created_at)
     VALUES($1,'receipt',$2,$3,$4,'Opening stock delivery',CURRENT_DATE-28+interval '8 hours')`,[id,item.stock+item.sold,item.price,item.cost]);
    // Keep every sale in the current month for the default report.
    for(let part=0;part<4;part++){
     const quantity=Math.floor(item.sold/4)+(part<item.sold%4?1:0);
     await c.query(`INSERT INTO movements(product_id,kind,quantity,unit_price,unit_cost,note,created_at)
      VALUES($1,'sale',$2,$3,$4,'Counter sale',CURRENT_DATE-LEAST($5::int,EXTRACT(DAY FROM CURRENT_DATE)::int-1)+interval '9 hours')`,[id,-quantity,item.price,item.cost,part*5]);
    }
   }
   await c.query(`INSERT INTO purchase_orders(product_id,supplier_id,quantity,status,expected_date)
    SELECT id,supplier_id,24,'ordered',CURRENT_DATE+3 FROM products WHERE sku='MPC-01'`);
   await c.query(`INSERT INTO alerts(product_id,message) SELECT id,name || ' is below minimum stock' FROM products WHERE stock<min_stock`);
   await c.query('COMMIT');return {created:cleaningProducts.length,skipped:false};
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 });
}
