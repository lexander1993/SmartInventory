import {app} from './app.js';
import {db} from './db.js';
import {refreshAlerts,startJobs} from './jobs.js';
import {migrate} from './schema.js';
await migrate();
await db.query('SELECT 1 FROM products LIMIT 1');
await refreshAlerts();const job=startJobs();
const server=app.listen(Number(process.env.PORT || 3001),'127.0.0.1',()=>console.log('Inventory API: http://localhost:'+ (process.env.PORT || 3001)));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{job?.stop();server.close(()=>{void db.end().then(()=>process.exit(0));});});
