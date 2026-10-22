export function recommend(stock:number, daily:number, lead:number, minimum:number, onOrder=0) {
 const reorderPoint=Math.max(minimum,Math.ceil(daily*lead));
 const target=Math.max(minimum,Math.ceil(daily*(lead+14)));
 return {dailyDemand:Number(daily.toFixed(2)),reorderPoint,onOrder,
  recommendedQuantity:stock+onOrder<=reorderPoint?Math.max(0,target-stock-onOrder):0,
  daysOfCover:daily>0?Number((stock/daily).toFixed(1)):null};
}
