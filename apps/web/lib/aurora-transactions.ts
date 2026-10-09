import type { AuroraDepositChain, AuroraTransaction } from "./server/aurora-intents";

export type AuroraHistoryRoute={depositChain:AuroraDepositChain;depositAddress:string;depositMemo?:string|null;destinationAsset:string;recipientAddress:string;createdAt:Date};

const same=(left:string|null|undefined,right:string|null|undefined)=>Boolean(left&&right)&&left!.toLowerCase()===right!.toLowerCase();

export function chainFamily(chain:string|null|undefined):AuroraDepositChain|null{
  const value=chain?.toLowerCase();
  if(!value)return null;
  if(["eth","ethereum","arb","arbitrum","base","op","optimism","pol","polygon","bsc","avax","avalanche","gnosis","bera","berachain","monad","plasma","scroll","xlayer","adi","aurora","evm"].includes(value))return "evm";
  if(value==="solana"||value==="sol")return "sol";
  if(value==="bitcoin"||value==="btc")return "btc";
  if(value==="stellar"||value==="xlm")return "stellar";
  if(value==="near")return "near";
  if(value==="tron"||value==="trx")return "tron";
  return null;
}

export function transactionBelongsToRoute(item:AuroraTransaction,route:AuroraHistoryRoute,originBlockchain:string|null|undefined){
  const createdAt=Date.parse(item.createdAt);
  if(!Number.isFinite(createdAt)||createdAt<route.createdAt.getTime())return false;
  if(!same(item.recipient,route.recipientAddress)||!same(item.destinationAsset,route.destinationAsset))return false;
  if(chainFamily(originBlockchain)!==route.depositChain)return false;
  // Some Aurora history records expose the public deposit address and memo.
  // Prefer that exact proof when present. Current Intents-backed records may
  // instead expose an internal deposit identifier, so callers must perform the
  // database-level ambiguity check before accepting a family-only match.
  if(same(item.depositAddress,route.depositAddress))return same(item.depositMemo??"",route.depositMemo??"");
  return true;
}
