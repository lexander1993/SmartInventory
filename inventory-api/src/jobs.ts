import cron from 'node-cron';
import {db} from './db.js';
export async function refreshAlerts() {
 const c=await db.connect();
 try {
  await c.query('BEGIN');
  await c.query(`SELECT pg_advisory_xact_lock(872001)`);
  await c.query(`DELETE FROM alerts WHERE product_id IN (SELECT id FROM products WHERE stock>min_stock)`);
  await c.query(`INSERT INTO alerts(product_id,message) SELECT id, name || ': ' || stock || ' units remaining (minimum ' || min_stock || ')' FROM products WHERE stock<=min_stock ON CONFLICT(product_id) DO UPDATE SET message=EXCLUDED.message,updated_at=now()`);
  await c.query('COMMIT');
 } catch(e) {await c.query('ROLLBACK');throw e;} finally {c.release();}
}
export function startJobs() {
 if(process.env.JOBS_ENABLED==='false') return;
 const expression=process.env.ALERT_CRON || '*/15 * * * *';
 if(!cron.validate(expression)) throw new Error('Invalid ALERT_CRON');
 return cron.schedule(expression,()=>{void refreshAlerts().catch(console.error);},{noOverlap:true});
}
