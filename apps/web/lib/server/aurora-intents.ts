import "server-only";
import { AuroraHttpError, requestAurora } from "../aurora-http";

export const AURORA_DEPOSIT_CHAINS = ["evm","btc","sol","tron","near","stellar"] as const;
export type AuroraDepositChain = (typeof AURORA_DEPOSIT_CHAINS)[number];

export type AuroraPersistentAddress = {depositAddress:string;alreadyExists:boolean;memo?:string;correlationId?:string};
export type AuroraDepositObservation = {tx_hash:string;fromChain:string|null;destinationChain:string|null;asset_id:string|null;decimals:number|null;amount:string;from?:string;created_at:string;intents_account:string;deposit_address:string;recipient:string};
export type AuroraTransaction = {originAsset:string;destinationAsset:string;depositAddress:string;depositMemo:string|null;depositAddressAndMemo:string;recipient:string;status:"FAILED"|"INCOMPLETE_DEPOSIT"|"PENDING_DEPOSIT"|"PROCESSING"|"REFUNDED"|"SUCCESS";createdAt:string;intentHashes:string;originChainTxHashes:string[];destinationChainTxHashes:string[];amountIn:string;amountOut:string;senders:string[]};
export type AuroraToken = {assetId:string;blockchain:string};

export class AuroraIntentsError extends Error {
  readonly status:number;readonly retryAfter?:number;readonly correlationId?:string;
  constructor(message:string,status:number,retryAfter?:number,correlationId?:string){super(message);this.name="AuroraIntentsError";this.status=status;this.retryAfter=retryAfter;this.correlationId=correlationId;}
}

function settings(){const apiKey=process.env.AURORA_INTENTS_API_KEY?.trim();const baseUrl=(process.env.AURORA_INTENTS_BASE_URL??"https://intents-api.aurora.dev").replace(/\/$/,"");if(!apiKey)throw new AuroraIntentsError("Aurora Intents is not configured",503);return{apiKey,baseUrl};}

export function auroraAvailability(){const enabled=process.env.AURORA_INTENTS_ENABLED?.toLowerCase()==="true";const configured=Boolean(process.env.AURORA_INTENTS_API_KEY);const destinationChainId=Number(process.env.AURORA_DESTINATION_CHAIN_ID);const vaultChainId=Number(process.env.MONAD_CHAIN_ID??10143);const destinationToken=process.env.AURORA_DESTINATION_TOKEN_ADDRESS?.toLowerCase();const vaultToken=process.env.PACT_SETTLEMENT_TOKEN_ADDRESS?.toLowerCase();const chainMatches=Number.isSafeInteger(destinationChainId)&&destinationChainId===vaultChainId;const tokenMatches=Boolean(destinationToken&&vaultToken&&destinationToken===vaultToken);return{enabled:enabled&&configured&&chainMatches&&tokenMatches,configured,chainMatches,tokenMatches,destinationChain:process.env.AURORA_DESTINATION_CHAIN??"monad",destinationAsset:process.env.AURORA_DESTINATION_ASSET??"USDC",reason:!enabled?"Aurora routing is not enabled":!configured?"Aurora API key is missing":!chainMatches?"Aurora destination does not match the event-vault network":!tokenMatches?"Aurora destination token does not match the event-vault token":undefined};}

async function auroraFetch<T>(path:string,init:RequestInit={},fetcher:typeof fetch=fetch):Promise<T>{const {apiKey,baseUrl}=settings();try{return await requestAurora<T>({url:`${baseUrl}${path.replace("{apiKey}",encodeURIComponent(apiKey))}`,init,fetcher});}catch(error){if(error instanceof AuroraHttpError)throw new AuroraIntentsError(error.message,error.status,error.retryAfter,error.correlationId);throw error;}}

export async function createPersistentDepositAddress(input:{recipient:string;sender:string;depositChain:AuroraDepositChain},fetcher?:typeof fetch){const availability=auroraAvailability();if(!availability.enabled)throw new AuroraIntentsError(availability.reason??"Aurora routing is unavailable",503);return auroraFetch<AuroraPersistentAddress>("/api/persistent-deposit-address/{apiKey}",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...input,destinationChain:availability.destinationChain,destinationAsset:availability.destinationAsset,confidential:false})},fetcher);}

export async function getPersistentDepositStatus(address:string,type:"received"|"success"|"failed",fetcher?:typeof fetch){const params=new URLSearchParams({type,address,limit:"100",offset:"0"});return auroraFetch<{deposits:AuroraDepositObservation[]}>(`/api/persistent-deposit-status/{apiKey}?${params}`,{},fetcher);}

export async function getAuroraTransactionHistory(fetcher?:typeof fetch){const response=await auroraFetch<AuroraTransaction[]|{data:AuroraTransaction[]}>("/api/transactions/{apiKey}?numberOfTransactions=1000",{},fetcher);return Array.isArray(response)?response:response.data;}

export async function getAuroraTokenCatalog(fetcher?:typeof fetch){const response=await auroraFetch<{tokens:AuroraToken[]}>("/api/tokens/{apiKey}",{},fetcher);return response.tokens;}
