import {readFile} from 'node:fs/promises';
import {db} from './db.js';
export async function migrate(){
 const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(872004)');
 await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 for(const name of ['001_init.sql','002_workspace.sql','003_ask_ai.sql']){
  if((await c.query('SELECT name FROM schema_migrations WHERE name=$1',[name])).rowCount)continue;
  await c.query(await readFile(new URL('../db/'+name,import.meta.url),'utf8'));
  await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
 }await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
