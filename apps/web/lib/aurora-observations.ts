export type AuroraObservation={tx_hash:string;fromChain:string|null;destinationChain:string|null;asset_id:string|null;created_at:string;deposit_address:string;recipient:string};
export type AuroraObservationRoute={depositChain:"evm"|"btc"|"sol"|"tron"|"near"|"stellar";depositAddress:string;destinationChain:string;destinationAsset:string;recipientAddress:string;createdAt:Date};

const same=(left:string|null|undefined,right:string)=>Boolean(left)&&left!.toLowerCase()===right.toLowerCase();
export function observationBelongsToRoute(item:AuroraObservation,type:"received"|"success"|"failed",route:AuroraObservationRoute){
  const createdAt=Date.parse(item.created_at);
  if(!Number.isFinite(createdAt)||createdAt<route.createdAt.getTime())return false;
  if(!same(item.deposit_address,route.depositAddress)||!same(item.recipient,route.recipientAddress))return false;
  if(type==="received")return route.depositChain==="evm"||same(item.fromChain,route.depositChain);
  return same(item.destinationChain,route.destinationChain)&&same(item.asset_id,route.destinationAsset);
}
