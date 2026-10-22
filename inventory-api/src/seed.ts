import {db} from './db.js';
import {migrate} from './schema.js';
import {seedCleaningData} from './cleaning-data.js';
try{await migrate();console.log(await seedCleaningData());}finally{await db.end();}
