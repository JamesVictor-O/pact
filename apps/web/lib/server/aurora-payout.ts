import "server-only";
import type {PayoutAssetOption} from "../pact-types";

const connectBase=process.env.AURORA_CONNECT_BASE_URL??"https://intents-connect-api.aurora.dev";
const swapBase=process.env.AURORA_INTENTS_BASE_URL??"https://intents-api.aurora.dev";

export function auroraPayoutAvailability(){const enabled=process.env.AURORA_PAYOUTS_ENABLED?.toLowerCase()==="true",key=Boolean(process.env.AURORA_INTENTS_API_KEY),origin=Boolean(process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID);return{enabled:enabled&&key&&origin,reason:!enabled?"Cross-chain payouts will activate with the Monad mainnet deployment":!key?"Aurora API key is missing":!origin?"Monad USDC is not configured as an Aurora origin asset":undefined};}

export async function listAuroraPayoutAssets(fetcher:typeof fetch=fetch):Promise<PayoutAssetOption[]>{const response=await fetcher(`${connectBase}/api/v1/supported_tokens`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(10_000)});if(!response.ok)throw new Error("Aurora payout assets are unavailable");const body=await response.json() as PayoutAssetOption[];return body.filter(item=>item.assetId&&item.blockchain&&item.symbol&&Number.isInteger(item.decimals));}

export type AuroraPayoutQuote={timestamp:string;signature:string;correlationId?:string;quote:{depositAddress:string;deadline:string;timeWhenInactive:string;amountIn:string;amountOut:string;amountOutFormatted:string;minAmountOut:string;minAmountOutFormatted?:string;minimumAmountOutFormatted?:string};quoteRequest:Record<string,unknown>};

async function api<T>(path:string,init?:RequestInit,fetcher:typeof fetch=fetch){const key=process.env.AURORA_INTENTS_API_KEY;if(!key)throw new Error("Aurora API key is missing");const response=await fetcher(`${swapBase}${path.replace("{apiKey}",encodeURIComponent(key))}`,{...init,headers:{accept:"application/json","content-type":"application/json",...init?.headers},signal:AbortSignal.timeout(15_000)});const body=await response.json().catch(()=>({})) as T&{message?:string};if(!response.ok)throw new Error(body.message??`Aurora payout request failed (${response.status})`);return body;}

export async function createAuroraPayoutQuote(input:{amountAtomic:string;vaultAddress:string;destinationAsset:string;recipient:string},fetcher?:typeof fetch){const available=auroraPayoutAvailability();if(!available.enabled)throw new Error(available.reason);const deadline=new Date(Date.now()+15*60*1000).toISOString();return api<AuroraPayoutQuote>("/api/quote/{apiKey}",{method:"POST",body:JSON.stringify({dry:false,swapType:"EXACT_INPUT",depositType:"ORIGIN_CHAIN",amount:input.amountAtomic,originAsset:process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID,destinationAsset:input.destinationAsset,slippageTolerance:Number(process.env.AURORA_PAYOUT_SLIPPAGE_BPS??100),refundTo:input.vaultAddress,refundType:"ORIGIN_CHAIN",recipient:input.recipient,recipientType:"DESTINATION_CHAIN",deadline})},fetcher);}

export async function submitAuroraPayoutDeposit(txHash:string,depositAddress:string,fetcher?:typeof fetch){return api("/api/deposit/submit/{apiKey}",{method:"POST",body:JSON.stringify({txHash,depositAddress})},fetcher);}

export async function getAuroraPayoutStatus(depositAddress:string,fetcher?:typeof fetch){return api<{status:"KNOWN_DEPOSIT_TX"|"PENDING_DEPOSIT"|"INCOMPLETE_DEPOSIT"|"PROCESSING"|"SUCCESS"|"REFUNDED"|"FAILED";swapDetails?:{amountOut?:string;amountOutFormatted?:string;destinationChainTxHashes?:Array<{hash:string;explorerUrl:string}>;refundReason?:string}}>(`/api/status/{apiKey}?depositAddress=${encodeURIComponent(depositAddress)}`,undefined,fetcher);}
