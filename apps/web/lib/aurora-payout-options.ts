import type {PayoutAssetOption} from "./pact-types";

export function filterSupportedPayoutAssets(tokens:PayoutAssetOption[],originAssetId?:string){
  const seen=new Set<string>();
  return tokens
    .filter(token=>token.symbol.toUpperCase()==="USDC"&&token.assetId!==originAssetId)
    .filter(token=>{if(seen.has(token.assetId))return false;seen.add(token.assetId);return true;})
    .sort((a,b)=>a.blockchain.localeCompare(b.blockchain)||a.symbol.localeCompare(b.symbol));
}
