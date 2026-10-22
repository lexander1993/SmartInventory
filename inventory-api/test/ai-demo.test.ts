import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DemoAssistant} from '../../inventory-frontend/src/ai-demo.ts';
test('demo confirms sample receipts once, without any API calls or shared inventory',()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Demo must not call APIs');};
 try{
  const demo=new DemoAssistant();const reply=demo.ask('Add 10 units of Multipurpose Cleaner');
  assert.equal(reply.demo,true);assert.match(reply.answer,/DEMO/);assert.equal(reply.actions[0].payload.product.stock,8);
  assert.ok(reply.actions[0].id.startsWith('demo-'));
  assert.equal(demo.ask('Show multipurpose stock').tables[0].rows[0].stock,8);
  const actionId=reply.actions[0].id;assert.equal(demo.resolve(actionId,'confirm').result?.stock_after,18);
  assert.equal(demo.resolve(actionId,'confirm').result?.stock_after,18);
  assert.equal(demo.ask('Show multipurpose stock').tables[0].rows[0].stock,18);
  assert.equal(new DemoAssistant().ask('Show multipurpose stock').tables[0].rows[0].stock,8);
 }finally{globalThis.fetch=originalFetch;}
});
test('demo supports sales and signed adjustments and rejects overselling and ambiguity',()=>{
 const demo=new DemoAssistant();let reply=demo.ask('Record a sale of 2 Glass Cleaner');
 assert.equal(reply.actions[0].payload.request.kind,'sale');demo.resolve(reply.actions[0].id,'confirm');
 assert.equal(demo.ask('Show glass stock').tables[0].rows[0].stock,18);
 reply=demo.ask('Adjust Glass Cleaner by -3');demo.resolve(reply.actions[0].id,'confirm');
 assert.equal(demo.ask('Show glass stock').tables[0].rows[0].stock,15);
 assert.equal(demo.ask('Sell 99 Glass Cleaner').actions.length,0);
 assert.equal(demo.ask('Add 10 multipurpose and glass').actions.length,0);
 assert.equal(demo.ask('Add multipurpose').actions.length,0);
 assert.equal(demo.ask('Add 1.5 multipurpose').actions.length,0);
 assert.equal(demo.ask('Add -2 multipurpose').actions.length,0);
 assert.equal(demo.ask('Add 2 to SKU MPC-01').actions.length,1);
});
test('demo cancellation, stale balances, expiration, and reset preserve expected state',()=>{
 const demo=new DemoAssistant();let a=demo.ask('Add 2 multipurpose').actions[0];demo.resolve(a.id,'cancel');assert.throws(()=>demo.resolve(a.id,'confirm'),/cancelled/);
 a=demo.ask('Add 2 multipurpose').actions[0];const other=demo.ask('Add 3 multipurpose').actions[0];demo.resolve(other.id,'confirm');assert.throws(()=>demo.resolve(a.id,'confirm'),/changed/);
 const expired=demo.ask('Add 1 glass').actions[0];expired.expires_at=new Date(0).toISOString();assert.throws(()=>demo.resolve(expired.id,'confirm'),/expired/);
 demo.reset();assert.equal(demo.ask('Show multipurpose stock').tables[0].rows[0].stock,8);assert.throws(()=>demo.resolve(other.id,'confirm'),/not found/);
});
test('demo order simulations change only sample orders and sample recommendations',()=>{
 const demo=new DemoAssistant();const before=demo.ask('What needs reordering?').tables[0].rows;assert.equal(before.find(p=>p.sku==='BLH-01')?.suggested_units,15);
 const action=demo.ask('Prepare an order for 20 Thick Bleach').actions[0];assert.equal(action.kind,'purchase_order');demo.resolve(action.id,'confirm');
 assert.equal(demo.ask('Show outstanding purchase orders').tables[0].rows.length,2);
 assert.equal(demo.ask('Show Thick Bleach stock').tables[0].rows[0].stock,0);
 assert.equal(demo.ask('What needs reordering?').tables[0].rows.some(p=>p.sku==='BLH-01'),false);
});
test('demo reports explicitly identify fixed illustrative data and keep totals consistent',()=>{
 const reply=new DemoAssistant().ask('Give me a sales report for this month');const totals=reply.tables[0].rows[0],rows=reply.tables[1].rows;
 assert.equal(reply.demo,true);assert.match(reply.answer,/Dates in your prompt are not applied/);
 assert.ok(reply.tables.every(t=>t.title.startsWith('DEMO')));
 for(const key of ['units','revenue','cost','profit'])assert.equal(totals[key],rows.reduce((sum,row)=>sum+Number(row[key]),0));
});
