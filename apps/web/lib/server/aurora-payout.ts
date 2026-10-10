import "server-only";
import type {PayoutAssetOption} from "../pact-types";
import {requestAurora} from "../aurora-http";
import {filterSupportedPayoutAssets} from "../aurora-payout-options";

const swapBase=process.env.AURORA_INTENTS_BASE_URL??"https://intents-api.aurora.dev";

export function auroraPayoutAvailability(){const enabled=process.env.AURORA_PAYOUTS_ENABLED?.toLowerCase()==="true",key=Boolean(process.env.AURORA_INTENTS_API_KEY),origin=Boolean(process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID),chainId=Number(process.env.MONAD_CHAIN_ID),destinationChainId=Number(process.env.AURORA_DESTINATION_CHAIN_ID),token=process.env.PACT_SETTLEMENT_TOKEN_ADDRESS?.toLowerCase(),destinationToken=process.env.AURORA_DESTINATION_TOKEN_ADDRESS?.toLowerCase(),networkMatches=Number.isSafeInteger(chainId)&&chainId===destinationChainId,tokenMatches=Boolean(token&&destinationToken&&token===destinationToken);return{enabled:enabled&&key&&origin&&networkMatches&&tokenMatches,reason:!enabled?"Cross-chain payouts are not enabled":!key?"Aurora API key is missing":!origin?"Monad USDC is not configured as an Aurora origin asset":!networkMatches?"Aurora is configured for a different network":!tokenMatches?"Aurora is configured for a different settlement token":undefined};}

export async function listAuroraPayoutAssets(fetcher:typeof fetch=fetch):Promise<PayoutAssetOption[]>{const key=process.env.AURORA_INTENTS_API_KEY;if(!key)throw new Error("Aurora API key is missing");const body=await requestAurora<{tokens:PayoutAssetOption[]}>({url:`${swapBase}/api/tokens/${encodeURIComponent(key)}`,fetcher,timeoutMs:10_000});return body.tokens.filter(item=>item.assetId&&item.blockchain&&item.symbol&&Number.isInteger(item.decimals));}

export async function listSupportedPayoutAssets(fetcher:typeof fetch=fetch):Promise<PayoutAssetOption[]>{
  return filterSupportedPayoutAssets(await listAuroraPayoutAssets(fetcher),process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID);
}

export async function findSupportedPayoutAsset(assetId:string,fetcher:typeof fetch=fetch){
  return (await listSupportedPayoutAssets(fetcher)).find(asset=>asset.assetId===assetId)??null;
}

export type AuroraPayoutQuote={timestamp:string;signature:string;correlationId?:string;quote:{depositAddress:string;deadline:string;timeWhenInactive:string;amountIn:string;amountOut:string;amountOutFormatted:string;minAmountOut:string;minAmountOutFormatted?:string;minimumAmountOutFormatted?:string};quoteRequest:Record<string,unknown>};

async function api<T>(path:string,init?:RequestInit,fetcher:typeof fetch=fetch){const key=process.env.AURORA_INTENTS_API_KEY;if(!key)throw new Error("Aurora API key is missing");return requestAurora<T>({url:`${swapBase}${path.replace("{apiKey}",encodeURIComponent(key))}`,init:{...init,headers:{"content-type":"application/json",...init?.headers}},fetcher,timeoutMs:15_000});}

export async function createAuroraPayoutQuote(input:{amountAtomic:string;vaultAddress:string;destinationAsset:string;recipient:string},fetcher?:typeof fetch){const available=auroraPayoutAvailability();if(!available.enabled)throw new Error(available.reason);const deadline=new Date(Date.now()+15*60*1000).toISOString();return api<AuroraPayoutQuote>("/api/quote/{apiKey}",{method:"POST",body:JSON.stringify({dry:false,swapType:"EXACT_INPUT",depositType:"ORIGIN_CHAIN",amount:input.amountAtomic,originAsset:process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID,destinationAsset:input.destinationAsset,slippageTolerance:Number(process.env.AURORA_PAYOUT_SLIPPAGE_BPS??100),refundTo:input.vaultAddress,refundType:"ORIGIN_CHAIN",recipient:input.recipient,recipientType:"DESTINATION_CHAIN",deadline})},fetcher);}

export async function submitAuroraPayoutDeposit(txHash:string,depositAddress:string,quoteResponse:AuroraPayoutQuote,fetcher?:typeof fetch){return api("/api/deposit/submit/{apiKey}",{method:"POST",body:JSON.stringify({txHash,depositAddress,quoteResponse})},fetcher);}

export async function getAuroraPayoutStatus(depositAddress:string,fetcher?:typeof fetch){return api<{status:"KNOWN_DEPOSIT_TX"|"PENDING_DEPOSIT"|"INCOMPLETE_DEPOSIT"|"PROCESSING"|"SUCCESS"|"REFUNDED"|"FAILED";swapDetails?:{amountOut?:string;amountOutFormatted?:string;destinationChainTxHashes?:Array<{hash:string;explorerUrl:string}>;refundReason?:string}}>(`/api/status/{apiKey}?depositAddress=${encodeURIComponent(depositAddress)}`,undefined,fetcher);}
