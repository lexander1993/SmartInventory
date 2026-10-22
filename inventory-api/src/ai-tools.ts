import {z} from 'zod';
import {db} from './db.js';
import {recommend} from './forecast.js';
import {salesRange,salesReport,calendarDate} from './reports.js';
import {prepareOrder,prepareStockChange,type AiAction,AiActionError} from './ai-actions.js';
export type DataTable={title:string;columns:string[];rows:Record<string,unknown>[];note?:string};
export type ToolContext={actions:AiAction[];tables:DataTable[];used:Set<string>};
function definition(name:string,description:string,schema:z.ZodObject){
 const {$schema,...parameters}=z.toJSONSchema(schema);return {type:'function',name,description,strict:true,parameters:{...parameters,required:Object.keys(parameters.properties || {})}};
}
const search=z.object({query:z.string().max(150),stock_status:z.enum(['all','low','out']),offset:z.number().int().min(0).max(100000)}).strict();
const movements=z.object({product_id:z.number().int().positive().nullable(),limit:z.number().int().min(1).max(100)}).strict();
const stock=z.object({product_id:z.number().int().positive(),kind:z.enum(['receipt','sale','adjustment']),quantity:z.number().int().min(-1e7).max(1e7),note:z.string().min(1).max(400)}).strict();
const order=z.object({product_id:z.number().int().positive(),supplier_id:z.number().int().positive(),quantity:z.number().int().min(1).max(1e7),expected_date:calendarDate.nullable()}).strict();
const dates=z.object({from:calendarDate,to:calendarDate}).strict();
const none=z.object({}).strict();
export const tools=[
 definition('inventory_summary','Get complete inventory totals and the database calendar date. Use live figures before answering inventory questions.',none),
 definition('search_products','Find products by name, SKU, barcode or category. Empty query matches all. Low means at/below minimum. Returns at most 100; use offset to page. Resolve identifiers before preparing any change.',search),
 definition('sales_report','Calculate revenue, recorded cost, known-cost gross profit, units sold and top products between inclusive calendar dates, at most 367 days. Never invent costs for older sales.',dates),
 definition('reorder_analysis','Get products needing replenishment using 28-day demand, supplier lead time and outstanding order units. Returns first 100 needing action.',none),
 definition('recent_movements','Get up to 100 recent sales, receipts and adjustments. Pass null product_id for all products.',movements),
 definition('list_suppliers','List supplier IDs, names and lead days, without contact details. Returns first 100.',none),
 definition('list_orders','List the latest 100 purchase orders including received and remaining units and expected dates.',none),
 definition('prepare_stock_change','Prepare, but DO NOT APPLY, a user-requested receipt, sale or signed adjustment. Ask for missing quantities, ambiguous products or unclear intent first. User must confirm the returned action card.',stock),
 definition('prepare_purchase_order','Prepare an internal purchase order, without sending it to any supplier. Only when user requests it and specifies/accepts a quantity. User must confirm the returned action card.',order)
];
export async function runTool(name:string,input:unknown,context:ToolContext):Promise<unknown>{
 context.used.add(name);
 switch(name){
  case 'inventory_summary':{
   none.parse(input);const totals=(await db.query(`SELECT COUNT(*)::int products,COALESCE(SUM(stock),0)::float8 units,
   COALESCE(SUM(stock*cost),0)::float8 stock_value,COUNT(*) FILTER(WHERE stock<=min_stock)::int low_stock,
   COUNT(*) FILTER(WHERE stock=0)::int out_of_stock,CURRENT_DATE::text today FROM products`)).rows[0];
   const purchasing=(await db.query("SELECT COUNT(*)::int open_orders,COALESCE(SUM(quantity-received_quantity),0)::float8 outstanding_units FROM purchase_orders WHERE status='ordered'")).rows[0];
   const result={...totals,...purchasing,currency:'AUD'};context.tables.push({title:'Inventory snapshot',columns:Object.keys(result),rows:[result]});return result;
  }
  case 'search_products':{
   const s=search.parse(input);const rows=(await db.query(`SELECT p.id,p.name,p.sku,p.barcode,p.category,p.stock,p.min_stock,p.cost,p.price,p.supplier_id,s.name supplier_name
   FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
   WHERE (p.name ILIKE $1 OR p.sku ILIKE $1 OR p.barcode ILIKE $1 OR p.category ILIKE $1)
   AND ($2='all' OR ($2='low' AND p.stock<=p.min_stock) OR ($2='out' AND p.stock=0)) ORDER BY p.name,p.id LIMIT 101 OFFSET $3`,['%'+s.query+'%',s.stock_status,s.offset])).rows;
   const result={rows:rows.slice(0,100),hasMore:rows.length>100,offset:s.offset};context.tables.push({title:'Products'+(s.query?' matching '+s.query:''),columns:['id','name','sku','stock','min_stock','cost','price','supplier_name'],rows:result.rows,note:result.hasMore?'Showing 100 matches. More products are available.':undefined});return result;
  }
  case 'sales_report':{
   const range=salesRange.parse(dates.parse(input));const report=await salesReport(range);
   context.tables.push({title:'Sales totals · '+range.from+' to '+range.to,columns:Object.keys(report.totals),rows:[report.totals],note:'AUD. Gross profit covers known-cost units only; unknown-cost units are excluded from cost and profit.'});
   context.tables.push({title:'Sales by product · '+range.from+' to '+range.to,columns:['name','sku','units','revenue','cost','profit','unknown_cost_units'],rows:report.rows.slice(0,100),note:report.rows.length>100?'Top 100 products by units. Totals include all products.':undefined});
   return {...report,rows:report.rows.slice(0,100),total_products:report.rows.length};
  }
  case 'reorder_analysis':{
   none.parse(input);const rows=(await db.query(`SELECT p.id,p.name,p.sku,p.stock,p.min_stock,p.supplier_id,s.name supplier_name,COALESCE(s.lead_days,7) lead_days,
   COALESCE((SELECT -SUM(quantity) FROM movements WHERE product_id=p.id AND kind='sale' AND created_at>=CURRENT_DATE-27 AND created_at<CURRENT_DATE+1),0)::float8/28 daily,
   COALESCE((SELECT SUM(quantity-received_quantity) FROM purchase_orders WHERE product_id=p.id AND status='ordered'),0)::int on_order
   FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.name`)).rows;
   const recommended=rows.map(p=>({...p,...recommend(p.stock,p.daily,p.lead_days,p.min_stock,p.on_order)})).filter(p=>p.recommendedQuantity>0);
   context.tables.push({title:'Replenishment recommendations',columns:['id','name','stock','supplier_name','dailyDemand','onOrder','recommendedQuantity'],rows:recommended.slice(0,100),note:recommended.length>100?'Showing first 100 recommendations.':undefined});
   return {rows:recommended.slice(0,100),total:recommended.length,method:'28-day daily average; lead time plus 14 days; subtract outstanding orders.'};
  }
  case 'recent_movements':{
   const m=movements.parse(input);const rows=(await db.query(`SELECT m.id,p.name,p.sku,m.kind,m.quantity,m.unit_price,m.unit_cost,m.created_at,m.order_id
   FROM movements m JOIN products p ON p.id=m.product_id WHERE ($1::int IS NULL OR m.product_id=$1) ORDER BY m.created_at DESC,m.id DESC LIMIT $2`,[m.product_id,m.limit])).rows;
   context.tables.push({title:'Recent stock movements',columns:['id','name','sku','kind','quantity','created_at','order_id'],rows,note:'Most recent '+m.limit+' entries; not a complete date-range report.'});return {rows};
  }
  case 'list_suppliers':{
   none.parse(input);const rows=(await db.query('SELECT id,name,lead_days FROM suppliers ORDER BY name,id LIMIT 100')).rows;
   context.tables.push({title:'Suppliers',columns:['id','name','lead_days'],rows,note:'Up to 100 suppliers.'});return {rows};
  }
  case 'list_orders':{
   none.parse(input);const rows=(await db.query(`SELECT o.id,p.name,p.sku,s.name supplier_name,o.quantity,o.received_quantity,o.quantity-o.received_quantity remaining,o.status,to_char(o.expected_date,'YYYY-MM-DD') expected_date
   FROM purchase_orders o JOIN products p ON p.id=o.product_id JOIN suppliers s ON s.id=o.supplier_id ORDER BY o.id DESC LIMIT 100`)).rows;
   context.tables.push({title:'Recent purchase orders',columns:['id','name','supplier_name','quantity','received_quantity','remaining','status','expected_date'],rows,note:'Latest 100 orders.'});return {rows};
  }
  case 'prepare_stock_change':
  case 'prepare_purchase_order':{
   if(context.actions.length>=5)throw new AiActionError(400,'Prepare at most five changes at a time.');
   // Identical tool calls in one response reuse the same proposal.
   const request=name==='prepare_stock_change'?stock.parse(input):order.parse(input);
   const duplicate=context.actions.find(a=>JSON.stringify(a.payload.request)===JSON.stringify(request));
   const action=duplicate || await (name==='prepare_stock_change'?prepareStockChange(request):prepareOrder(request));
   if(!duplicate)context.actions.push(action);
   return {action_id:action.id,status:'pending_user_confirmation',description:action.payload,expires_at:action.expires_at,warning:'No stock or order has changed. The user must click Confirm in the app.'};
  }
  default:throw new AiActionError(400,'Unsupported inventory tool.');
 }
}
