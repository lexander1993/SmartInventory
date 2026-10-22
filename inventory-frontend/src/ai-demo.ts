import type {Proposal,Reply,Table,ActionResult} from './ask-ai-types';
type Product={id:number;name:string;sku:string;stock:number;min_stock:number;cost:number;price:number;supplier_name:string};
const demos:Product[]=[
 {
  "id": 1,
  "name": "Multipurpose Cleaner",
  "sku": "MPC-01",
  "stock": 8,
  "min_stock": 12,
  "cost": 3.2,
  "price": 6.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 2,
  "name": "Glass Cleaner",
  "sku": "GLS-01",
  "stock": 20,
  "min_stock": 10,
  "cost": 2.4,
  "price": 5.5,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 3,
  "name": "Thick Bleach",
  "sku": "BLH-01",
  "stock": 0,
  "min_stock": 15,
  "cost": 1.8,
  "price": 4.2,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 4,
  "name": "Dishwashing Liquid",
  "sku": "DSH-01",
  "stock": 28,
  "min_stock": 8,
  "cost": 2.7,
  "price": 5.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 5,
  "name": "Lemon Floor Cleaner",
  "sku": "FLR-01",
  "stock": 40,
  "min_stock": 10,
  "cost": 4.2,
  "price": 8.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 6,
  "name": "Toilet Cleaner",
  "sku": "TOL-01",
  "stock": 35,
  "min_stock": 12,
  "cost": 2.1,
  "price": 4.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 7,
  "name": "Hospital Grade Disinfectant",
  "sku": "DSF-01",
  "stock": 14,
  "min_stock": 6,
  "cost": 6.5,
  "price": 13.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 8,
  "name": "Heavy Duty Degreaser",
  "sku": "DGR-01",
  "stock": 22,
  "min_stock": 8,
  "cost": 5.2,
  "price": 11.5,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 9,
  "name": "Laundry Liquid",
  "sku": "LND-01",
  "stock": 18,
  "min_stock": 8,
  "cost": 7.8,
  "price": 16.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 10,
  "name": "Antibacterial Hand Wash",
  "sku": "HND-01",
  "stock": 30,
  "min_stock": 10,
  "cost": 2.8,
  "price": 6.5,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 11,
  "name": "Microfibre Cloth Pack",
  "sku": "MCF-01",
  "stock": 36,
  "min_stock": 12,
  "cost": 3.4,
  "price": 7.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 12,
  "name": "Scouring Sponge Pack",
  "sku": "SCR-01",
  "stock": 15,
  "min_stock": 6,
  "cost": 1.6,
  "price": 3.9,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 13,
  "name": "Heavy Duty Bin Liners",
  "sku": "BAG-01",
  "stock": 24,
  "min_stock": 10,
  "cost": 4.5,
  "price": 9.5,
  "supplier_name": "CleanCare Wholesale"
 },
 {
  "id": 14,
  "name": "Cotton Mop Refill",
  "sku": "MOP-01",
  "stock": 28,
  "min_stock": 8,
  "cost": 5.8,
  "price": 12.5,
  "supplier_name": "CleanCare Wholesale"
 }
];
export class DemoAssistant{
 private products=demos.map(p=>({...p}));
 private orders=[{id:1,name:'Glass Cleaner',product_id:2,supplier_name:'CleanCare Wholesale',quantity:20,received_quantity:5,remaining:15,status:'ordered'}];
 private actions=new Map<string,Proposal>();
 private results=new Map<string,ActionResult>();
 private sequence=0;
 private lastProduct:number|null=null;
 private movements:Record<string,unknown>[]=[];
 reset(){this.products=demos.map(p=>({...p}));this.orders=[{id:1,name:'Glass Cleaner',product_id:2,supplier_name:'CleanCare Wholesale',quantity:20,received_quantity:5,remaining:15,status:'ordered'}];this.actions.clear();this.results.clear();this.movements=[];this.lastProduct=null;}
 private reply(answer:string,tables:Table[]=[],actions:Proposal[]=[]):Reply{return {answer:'DEMO — '+answer,tables,actions,sources:['demo_cleaning_data'],generated_at:new Date().toISOString(),demo:true};}
 ask(message:string):Reply{
  const text=message.trim().toLowerCase();
  const matches=this.products.filter(p=>text.includes(p.name.toLowerCase().replace(/^demo · /,'')) || text.includes(p.sku.toLowerCase()) || (p.id===1&&/\bmultipurpose\b/.test(text)) || (p.id===2&&/\bglass\b/.test(text)) || (p.id===3&&/\bbleach\b/.test(text)) || (p.id===4&&/\bdishwashing\b/.test(text)));
  let product=matches.length===1?matches[0]:undefined;
  if(!matches.length && /\b(it|same product)\b/.test(text))product=this.products.find(p=>p.id===this.lastProduct);
  if(product)this.lastProduct=product.id;
  const changing=/\b(add|receive|record|sell|sold|adjust|remove|prepare|create|order)\b/.test(text) && !/\b(report|analy[sz]e|show|which|what|outstanding|reorder|orders)\b/.test(text);
  if(changing){
   if(!product)return this.reply('Choose one demo product and specify a quantity. Available products: '+this.products.map(p=>p.name+' ('+p.sku+')').join(', ')+'.');
   const quantities=message.match(/(?<![\w-])[+-]?\d+(?:\.\d+)?(?![\w-])/g) || [];
   if(quantities.length!==1)return this.reply('Please specify one whole-number quantity, for example: “Add 10 units of '+product.name+'.”');
   const quantity=Number(quantities[0]);const adjustment=/\b(adjust|remove)\b/.test(text);
   if(!Number.isInteger(quantity) || quantity===0 || Math.abs(quantity)>1e7 || (!adjustment && quantity<0))return this.reply('Use a positive whole number for a receipt, sale, or order. Adjustments can use a signed nonzero whole number.');
   if(/\b(count|counted|set|balance)\b/.test(text))return this.reply('Demo adjustments are changes to stock, not replacement counts. Try “Adjust '+product.name+' by -2.”');
   const purchase=/\b(order|purchase)\b/.test(text);
   const kind=adjustment?'adjustment':/\b(sell|sold|sale)\b/.test(text)?'sale':'receipt';
   const units=/\bremove\b/.test(text)?-Math.abs(quantity):quantity;
   const delta=kind==='sale'?-units:units;
   if(!purchase&&product.stock+delta<0)return this.reply('That would make the demo stock negative. '+product.name+' currently has '+product.stock+' units.');
   const proposal:Proposal={id:'demo-'+(++this.sequence),kind:purchase?'purchase_order':'stock_movement',status:'pending',expires_at:new Date(Date.now()+15*60000).toISOString(),payload:{type:purchase?'purchase_order':'stock_movement',product:{name:product.name,sku:product.sku,stock:product.stock},supplier_name:purchase?product.supplier_name:undefined,request:{product_id:product.id,quantity:purchase?quantity:units,...(purchase?{supplier_id:1,expected_date:null}:{kind,note:'Demo transaction — demo only'})}}};
   this.actions.set(proposal.id,proposal);
   return this.reply('Prepared a demo '+(purchase?'purchase order':'stock change')+' for '+product.name+'. Use Simulate confirmation below. Only demo data will change.',[],[proposal]);
  }
  if(/\b(sales|profit|revenue|report|best.sell|best-selling|top products)\b/.test(text)){
   const sold=[42,30,18,12,24,32,18,16,20,14,28,10,22,26];const rows=this.products.map((p,i)=>({name:p.name,sku:p.sku,units:sold[i],revenue:Number((sold[i]*p.price).toFixed(2)),cost:Number((sold[i]*p.cost).toFixed(2)),profit:Number((sold[i]*(p.price-p.cost)).toFixed(2))})).sort((a,b)=>b.units-a.units);
   const totals=rows.reduce((t,p)=>({units:t.units+p.units,revenue:t.revenue+p.revenue,cost:t.cost+p.cost,profit:t.profit+p.profit}),{units:0,revenue:0,cost:0,profit:0});
   return this.reply('This illustrative 28-day demo has AUD '+totals.revenue.toFixed(2)+' revenue, AUD '+totals.cost.toFixed(2)+' known cost and AUD '+totals.profit.toFixed(2)+' known-cost profit across 14 products. Multipurpose Cleaner is the best seller with 42 units. Dates in your prompt are not applied in demo mode. Demo stock simulations do not change these fixed report figures.',[{title:'DEMO · Illustrative 28-day totals',columns:Object.keys(totals),rows:[totals],note:'Known cost is recorded cost of sold units. Known-cost profit is their revenue minus that cost. All demo sales have known costs. Figures are in AUD, not your real sales or a selected date range.'},{title:'DEMO · best sellers',columns:['name','sku','units','revenue','cost','profit'],rows,note:'Illustrative demo sales with known cost and known-cost profit, excluding expenses and taxes.'}]);
  }
  if(/\b(reorder|reordering|replenish|low.stock)\b/.test(text)){
   const rows=this.products.map(p=>{const on_order=this.orders.filter(o=>o.product_id===p.id).reduce((sum,o)=>sum+o.remaining,0);return {name:p.name,sku:p.sku,stock:p.stock,min_stock:p.min_stock,on_order,suggested_units:Math.max(0,p.min_stock-p.stock-on_order)};}).filter(p=>p.suggested_units>0);
   return this.reply(rows.length?'These demo products are below their minimum after outstanding orders. Demo suggestions fill to minimum stock; they are not demand forecasts.':'No demo replenishment is needed after outstanding orders.',[{title:'DEMO · reorder suggestions',columns:['name','sku','stock','min_stock','on_order','suggested_units'],rows,note:'Demo minimum-stock calculation only; not the live 28-day demand model.'}]);
  }
  if(/\b(order|orders|outstanding|supplier|suppliers)\b/.test(text))return this.reply('Here are the demo internal purchase orders. No supplier messages are sent.',[{title:'DEMO · purchase orders',columns:['id','name','supplier_name','quantity','received_quantity','remaining','status'],rows:this.orders.map(o=>({...o}))}]);
  if(/\b(movements|activity|transactions)\b/.test(text))return this.reply('These are the changes simulated in this demo session.',[{title:'DEMO · Simulated movements',columns:['name','kind','quantity','stock_after'],rows:this.movements.map(m=>({...m}))}]);
  if(/\b(stock|inventory|products|multipurpose|glass|bleach|dishwashing)\b/.test(text)){
   const rows=(product?[product]:this.products).filter(p=>!/out of stock/.test(text)||p.stock===0);
   return this.reply('Here is the current demo inventory. Confirmed simulations are reflected here until you reset the demo.',[{title:'DEMO · inventory',columns:['name','sku','stock','min_stock','cost','price'],rows:rows.map(p=>({...p})),note:'All products and balances shown here are demonstration data.'}]);
  }
  return this.reply('This is a simulated assistant, not a live AI model. Try “Add 10 units of Multipurpose Cleaner”, “Record a sale of 2 Glass Cleaner”, “Prepare an order for 20 Thick Bleach”, “What needs reordering?”, or “Give me a sales report”. No API credits or real inventory are used.');
 }
 resolve(id:string,operation:'confirm'|'cancel'):ActionResult{
  const action=this.actions.get(id);if(!action)throw new Error('Demo proposal not found.');
  if(action.status==='applied')return this.results.get(id)!;
  if(action.status==='cancelled')throw new Error('This demo proposal was cancelled.');
  if(operation==='cancel'){action.status='cancelled';return {status:'cancelled'};}
  if(new Date(action.expires_at).getTime()<=Date.now())throw new Error('This demo proposal expired. Ask for it again.');
  const p=this.products.find(p=>p.id===action.payload.request.product_id)!;
  if(p.stock!==action.payload.product.stock)throw new Error('Demo stock changed. Prepare a new demo proposal.');
  let response:ActionResult;
  if(action.kind==='purchase_order'){
   const orderId=this.orders.length+1;const quantity=action.payload.request.quantity;
   this.orders.push({id:orderId,name:p.name,product_id:p.id,supplier_name:p.supplier_name,quantity,received_quantity:0,remaining:quantity,status:'ordered'});
   response={status:'applied',result:{order_id:orderId}};
  }else{
   const request=action.payload.request,delta=request.kind==='sale'?-request.quantity:request.quantity;
   if(p.stock+delta<0)throw new Error('Demo stock cannot become negative.');
   const before=p.stock;p.stock+=delta;this.movements.push({name:p.name,kind:request.kind,quantity:delta,stock_after:p.stock});
   response={status:'applied',result:{stock_before:before,stock_after:p.stock}};
  }
  action.status='applied';this.results.set(id,response);return response;
 }
}
