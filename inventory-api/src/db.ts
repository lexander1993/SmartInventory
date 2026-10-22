import 'dotenv/config';
import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy .env.example to .env.');
export const actorContext = new AsyncLocalStorage<string>();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
export const db = {
 async connect(){
  const client=await pool.connect();
  try{await client.query("SELECT set_config('TimeZone',$1,false)",[process.env.TZ || 'Australia/Sydney']);}
  catch(e){client.release();throw e;}
  return {release:()=>client.release(),async query(sql:string,args?:unknown[]){
   const result=await client.query(sql,args);
   if(/^BEGIN\b/i.test(sql))await client.query("SELECT set_config('app.actor',$1,true)",[actorContext.getStore() || 'system']);
   return result;
  }};
 },
 async query(sql:string,args?:unknown[]){
  const client=await this.connect();
  try{await client.query('BEGIN');const result=await client.query(sql,args);await client.query('COMMIT');return result;}
  catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 },
 end:()=>pool.end()
};
