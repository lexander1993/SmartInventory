import {z} from 'zod';
import {db} from './db.js';
export const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v,'Invalid date');
export const salesRange=z.object({from:calendarDate,to:calendarDate}).refine(v=>{
 const days=(Date.parse(v.to)-Date.parse(v.from))/86400000;return days>=0 && days<=366;
},'Choose a date range of up to 367 days');
export async function salesReport(range:{from:string;to:string}){
 salesRange.parse(range);
 const rows=(await db.query(`SELECT p.id,p.name,p.sku,SUM(-m.quantity)::int units,
 SUM(-m.quantity*m.unit_price)::float8 revenue,
 COALESCE(SUM(-m.quantity*m.unit_cost) FILTER(WHERE m.unit_cost IS NOT NULL),0)::float8 cost,
 COALESCE(SUM(-m.quantity*(m.unit_price-m.unit_cost)) FILTER(WHERE m.unit_cost IS NOT NULL),0)::float8 profit,
 COALESCE(SUM(-m.quantity) FILTER(WHERE m.unit_cost IS NULL),0)::int unknown_cost_units
 FROM movements m JOIN products p ON p.id=m.product_id WHERE m.kind='sale' AND m.created_at >= $1::date AND m.created_at < $2::date+1 GROUP BY p.id,p.name,p.sku ORDER BY units DESC,p.name`,[range.from,range.to])).rows;
 return {from:range.from,to:range.to,rows,totals:rows.reduce((t,p)=>({units:t.units+p.units,revenue:t.revenue+p.revenue,cost:t.cost+p.cost,profit:t.profit+p.profit,unknown_cost_units:t.unknown_cost_units+p.unknown_cost_units}),{units:0,revenue:0,cost:0,profit:0,unknown_cost_units:0})};
}
