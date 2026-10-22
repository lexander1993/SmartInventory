import {db} from './db.js';
import {migrate} from './schema.js';
import {seedCleaningData} from './cleaning-data.js';
if(!process.argv.includes('--replace-all'))throw new Error('Pass --replace-all to delete all application records and load cleaning products.');
try{await migrate();console.log(await seedCleaningData(true));}finally{await db.end();}
