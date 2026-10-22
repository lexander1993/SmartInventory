export type Proposal={id:string;kind:'stock_movement'|'purchase_order';status:'pending'|'applied'|'cancelled';expires_at:string;payload:{type:string;product:{name:string;sku:string;stock:number};supplier_name?:string;request:{product_id:number;kind?:'receipt'|'sale'|'adjustment';quantity:number;note?:string;supplier_id?:number;expected_date?:string|null}}};
export type Table={title:string;columns:string[];rows:Record<string,unknown>[];note?:string};
export type Reply={answer:string;actions:Proposal[];tables:Table[];sources:string[];generated_at:string;demo?:boolean};
export type ActionResult={status:'applied'|'cancelled';result?:{stock_before?:number;stock_after?:number;order_id?:number}};
