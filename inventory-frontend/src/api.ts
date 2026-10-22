const base=import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw new Error(data.error || 'Request failed');return data;
}
