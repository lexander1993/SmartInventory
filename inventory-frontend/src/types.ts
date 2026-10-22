export type Product={id:number;name:string;sku:string;barcode:string;category:string;cost:number|string;price:number|string;stock:number;min_stock:number;supplier_id:number|null;supplier_name?:string};
export type Supplier={id:number;name:string;email:string;phone:string;lead_days:number};
export type Recommendation=Product & {dailyDemand:number;reorderPoint:number;recommendedQuantity:number;onOrder:number;daysOfCover:number|null};
export type Order={id:number;product_id:number;supplier_id:number;name:string;supplier_name:string;quantity:number;received_quantity:number;expected_date:string|null;status:string};
export type Movement={id:number;product_id:number;order_id:number|null;name:string;kind:string;quantity:number;note:string;created_at:string};
export type Run=(fn:()=>Promise<unknown>,message:string)=>Promise<void>;
export const money=(v:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(v);
