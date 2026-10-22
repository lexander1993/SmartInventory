import type {RequestHandler} from 'express';
// Keep the local workspace's browser origin and JSON checks without requiring accounts.
export const originGuard:RequestHandler=(q,r,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(q.method)){
  if(q.headers.origin && q.headers.origin!==(process.env.FRONTEND_URL || 'http://localhost:5173')){r.status(403).json({error:'Origin not allowed'});return;}
  if(q.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json'){r.status(415).json({error:'Use application/json'});return;}
 }next();
};
