import {db} from './db.js';
import {migrate} from './schema.js';
try {await migrate();console.log('Schema ready');}
finally { await db.end(); }
