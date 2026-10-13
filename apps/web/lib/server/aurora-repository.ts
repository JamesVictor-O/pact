import "server-only";
import type { QueryResultRow } from "pg";
import { createPublicClient, decodeEventLog, http, parseAbiItem, TransactionReceiptNotFoundError, type Address, type Hex } from "viem";
import type { AuroraDepositRoute, FundingRequest } from "../pact-types";
import { observationBelongsToRoute } from "../aurora-observations";
import { chainFamily, transactionBelongsToRoute } from "../aurora-transactions";
import { database, oneOrNull, transaction } from "./database";
import { AURORA_DEPOSIT_CHAINS, auroraAvailability, createPersistentDepositAddress, getAuroraTokenCatalog, getAuroraTransactionHistory, getPersistentDepositStatus, type AuroraDepositChain, type AuroraDepositObservation, type AuroraTransaction } from "./aurora-intents";
import { recordConfirmedFundingReceipt } from "./funding-receipt-repository";

type RouteRow=QueryResultRow&{id:string;funding_request_id:string;event_id:string;deposit_chain:AuroraDepositChain;deposit_address:string;deposit_memo:string|null;destination_chain:string;destination_asset:string;recipient_address:string;status:AuroraDepositRoute["status"];last_error:string|null;last_synced_at:Date|null;created_at:Date;updated_at:Date};
type RequestContext=QueryResultRow&{id:string;event_id:string;funding_source_id:string;amount_minor:string;request_kind:"requested"|"public_contribution";status:FundingRequest["status"];vault_address:string|null;vault_status:string};
const mapRoute=(row:RouteRow):AuroraDepositRoute=>({id:row.id,fundingRequestId:row.funding_request_id,eventId:row.event_id,depositChain:row.deposit_chain,depositAddress:row.deposit_address,depositMemo:row.deposit_memo??undefined,destinationChain:row.destination_chain,destinationAsset:row.destination_asset,recipientAddress:row.recipient_address,status:row.status,lastError:row.last_error??undefined,lastSyncedAt:row.last_synced_at?.toISOString(),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});

async function requestContext(slug:string){return oneOrNull<RequestContext>(`select r.id,r.event_id,r.funding_source_id,r.amount_minor,r.request_kind,r.status,e.vault_address,e.vault_status from funding_requests r join events e on e.id=r.event_id where r.public_slug=$1 and r.status not in ('cancelled','refunded') and (r.request_kind='requested' or exists(select 1 from event_contribution_pages p where p.funding_request_id=r.id and p.enabled=true))`,[slug]);}
export async function listAuroraRoutes(slug:string){const context=await requestContext(slug);if(!context)return null;const rows=await database().query<RouteRow>(`select * from aurora_deposit_routes where funding_request_id=$1 order by created_at`,[context.id]);return{availability:auroraAvailability(),routes:rows.rows.map(mapRoute)};}
export async function createAuroraRoute(slug:string,depositChain:string){if(!AURORA_DEPOSIT_CHAINS.includes(depositChain as AuroraDepositChain))throw new Error("Choose a supported source network");const context=await requestContext(slug);if(!context)return null;if(context.vault_status!=="ready"||!context.vault_address)throw new Error("The event account is not ready");const existing=await oneOrNull<RouteRow>(`select * from aurora_deposit_routes where funding_request_id=$1 and deposit_chain=$2`,[context.id,depositChain]);if(existing)return mapRoute(existing);const availability=auroraAvailability();if(!availability.enabled)throw new Error(availability.reason??"Aurora routing is unavailable");const created=await createPersistentDepositAddress({recipient:context.vault_address,sender:context.id,depositChain:depositChain as AuroraDepositChain});try{const row=await oneOrNull<RouteRow>(`insert into aurora_deposit_routes(id,funding_request_id,event_id,deposit_chain,deposit_address,deposit_memo,destination_chain,destination_asset,recipient_address,sender_reference,already_existed,correlation_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,[`aurora_route_${crypto.randomUUID()}`,context.id,context.event_id,depositChain,created.depositAddress,created.memo??null,availability.destinationChain,availability.destinationAsset,context.vault_address,context.id,created.alreadyExists,created.correlationId??null]);return mapRoute(row!);}catch(error){const raced=await oneOrNull<RouteRow>(`select * from aurora_deposit_routes where funding_request_id=$1 and deposit_chain=$2`,[context.id,depositChain]);if(raced)return mapRoute(raced);throw error;}}

const transferEvent=parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");
async function recordObservations(route:RouteRow,type:"received"|"success"|"failed",observations:AuroraDepositObservation[]){for(const item of observations){await database().query(`insert into aurora_route_deposits(id,route_id,observation_type,transaction_hash,source_chain,destination_chain,asset_id,decimals,amount_atomic,sender_address,recipient_address,aurora_created_at,raw_payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(route_id,observation_type,transaction_hash) do update set raw_payload=excluded.raw_payload,updated_at=now()`,[`aurora_deposit_${crypto.randomUUID()}`,route.id,type,item.tx_hash.toLowerCase(),item.fromChain,item.destinationChain,item.asset_id,item.decimals,item.amount,item.from??null,item.recipient,item.created_at,JSON.stringify(item)]);}}
async function recordHistoryTransaction(route:RouteRow,item:AuroraTransaction,sourceChain:string){for(const hash of item.destinationChainTxHashes){await database().query(`insert into aurora_route_deposits(id,route_id,observation_type,transaction_hash,source_chain,destination_chain,asset_id,decimals,amount_atomic,sender_address,recipient_address,aurora_created_at,raw_payload) values($1,$2,'success',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(route_id,observation_type,transaction_hash) do update set raw_payload=excluded.raw_payload,updated_at=now()`,[`aurora_deposit_${crypto.randomUUID()}`,route.id,hash.toLowerCase(),sourceChain,route.destination_chain,item.destinationAsset,Number(process.env.PACT_SETTLEMENT_TOKEN_DECIMALS??6),item.amountOut,item.senders[0]??null,item.recipient,item.createdAt,JSON.stringify(item)]);}}
async function reconcileDestinationTransaction(route:RouteRow,context:RequestContext,transactionHash:string){const rpc=process.env.AURORA_DESTINATION_RPC_URL,token=process.env.AURORA_DESTINATION_TOKEN_ADDRESS as Address|undefined,chainId=Number(process.env.AURORA_DESTINATION_CHAIN_ID);if(!rpc||!token||!Number.isSafeInteger(chainId))throw new Error("Aurora destination verification is not configured");if(!/^0x[0-9a-fA-F]{64}$/.test(transactionHash))throw new Error("Aurora did not return a destination transaction hash");const client=createPublicClient({transport:http(rpc)});let receipt;try{receipt=await client.getTransactionReceipt({hash:transactionHash as Hex});}catch(error){if(error instanceof TransactionReceiptNotFoundError)return{confirmed:false,credited:false};throw error;}if(receipt.status!=="success")throw new Error("Aurora destination transaction did not succeed");const transfers=receipt.logs.filter(log=>log.address.toLowerCase()===token.toLowerCase()).map(log=>{try{return{log,decoded:decodeEventLog({abi:[transferEvent],data:log.data,topics:log.topics})}}catch{return null}}).filter(entry=>entry&&entry.decoded.eventName==="Transfer"&&String(entry.decoded.args.to).toLowerCase()===route.recipient_address.toLowerCase());if(!transfers.length)throw new Error("Aurora settlement did not transfer USDC to the event account");const decimals=Number(process.env.PACT_SETTLEMENT_TOKEN_DECIMALS??6);let credited=false;for(const matched of transfers){if(!matched)continue;const amountAtomic=BigInt(matched.decoded.args.value);const recorded=await transaction(async db=>recordConfirmedFundingReceipt(db,{id:`receipt_${crypto.randomUUID()}`,fundingRequestId:context.id,eventId:context.event_id,fundingSourceId:context.funding_source_id,contributorAddress:String(matched.decoded.args.from),settlementTokenAddress:token,amountAtomic,tokenDecimals:decimals,chainId,transactionHash,logIndex:matched.log.logIndex,blockNumber:receipt.blockNumber}));credited=credited||recorded.inserted;}return{confirmed:true,credited};}
async function reconcileSuccess(route:RouteRow,context:RequestContext,item:AuroraDepositObservation){return reconcileDestinationTransaction(route,context,item.tx_hash);}

async function isUnambiguousHistoryMatch(route:RouteRow,item:AuroraTransaction,originBlockchain:string){if(item.depositAddress.toLowerCase()===route.deposit_address.toLowerCase())return (item.depositMemo??"")===(route.deposit_memo??"");const candidates=await database().query<RouteRow>(`select r.* from aurora_deposit_routes r where r.event_id=$1 and lower(r.recipient_address)=lower($2) and lower(r.destination_asset)=lower($3) and r.deposit_chain=$4 and r.created_at<=$5 and (r.id=$6 or r.status<>'success')`,[route.event_id,route.recipient_address,route.destination_asset,chainFamily(originBlockchain),item.createdAt,route.id]);return candidates.rows.length===1&&candidates.rows[0]?.id===route.id;}
export async function syncAuroraRoute(slug:string,routeId:string){
  const context=await requestContext(slug);
  if(!context)return null;
  const route=await oneOrNull<RouteRow>(`select * from aurora_deposit_routes where id=$1 and funding_request_id=$2`,[routeId,context.id]);
  if(!route)return null;
  if(route.last_synced_at&&Date.now()-route.last_synced_at.getTime()<10_000)return mapRoute(route);
  try{
    const results=await Promise.allSettled([
      getPersistentDepositStatus(route.deposit_address,"received"),
      getPersistentDepositStatus(route.deposit_address,"success"),
      getPersistentDepositStatus(route.deposit_address,"failed"),
      getAuroraTransactionHistory(),
      getAuroraTokenCatalog(),
    ]);
    const value=<T>(index:number,fallback:T)=>results[index]?.status==="fulfilled"?(results[index] as PromiseFulfilledResult<T>).value:fallback;
    const receivedResponse=value(0,{deposits:[] as AuroraDepositObservation[]});
    const successResponse=value(1,{deposits:[] as AuroraDepositObservation[]});
    const failedResponse=value(2,{deposits:[] as AuroraDepositObservation[]});
    const history=value(3,[] as AuroraTransaction[]);
    const tokens=value(4,[] as Array<{assetId:string;blockchain:string}>);
    if(results.every(result=>result.status==="rejected")){
      const failure=results.find((result):result is PromiseRejectedResult=>result.status==="rejected");
      throw failure?.reason??new Error("Aurora reconciliation sources are unavailable");
    }

    const routeMatch={depositChain:route.deposit_chain,depositAddress:route.deposit_address,depositMemo:route.deposit_memo,destinationChain:route.destination_chain,destinationAsset:route.destination_asset,recipientAddress:route.recipient_address,createdAt:route.created_at};
    const received=receivedResponse.deposits.filter(item=>observationBelongsToRoute(item,"received",routeMatch));
    const success=successResponse.deposits.filter(item=>observationBelongsToRoute(item,"success",routeMatch));
    const failed=failedResponse.deposits.filter(item=>observationBelongsToRoute(item,"failed",routeMatch));
    await recordObservations(route,"received",received);
    await recordObservations(route,"success",success);
    await recordObservations(route,"failed",failed);

    const tokenChains=new Map(tokens.map(token=>[token.assetId.toLowerCase(),token.blockchain]));
    const historyMatches:Array<{item:AuroraTransaction;sourceChain:string}>=[];
    let ambiguousHistory=false;
    for(const item of history){
      const sourceChain=tokenChains.get(item.originAsset.toLowerCase());
      if(!transactionBelongsToRoute(item,routeMatch,sourceChain))continue;
      if(!await isUnambiguousHistoryMatch(route,item,sourceChain??"")){ambiguousHistory=true;continue;}
      historyMatches.push({item,sourceChain:sourceChain??route.deposit_chain});
    }

    let confirmed=0,credited=false;
    for(const item of success){const result=await reconcileSuccess(route,context,item);if(result.confirmed)confirmed++;credited=credited||result.credited;}
    for(const {item,sourceChain} of historyMatches){
      if(item.status==="SUCCESS"){
        await recordHistoryTransaction(route,item,sourceChain);
        for(const hash of item.destinationChainTxHashes){const result=await reconcileDestinationTransaction(route,context,hash);if(result.confirmed)confirmed++;credited=credited||result.credited;}
      }
    }

    const hasProcessing=received.length>0||historyMatches.some(({item})=>["PENDING_DEPOSIT","INCOMPLETE_DEPOSIT","PROCESSING"].includes(item.status));
    const hasFailure=failed.length>0||historyMatches.some(({item})=>["FAILED","REFUNDED"].includes(item.status));
    const totals=await database().query<{received:string}>(`select coalesce(sum(amount_minor),0) received from funding_receipts where funding_request_id=$1 and status='confirmed'`,[context.id]);
    const fullyReceived=context.request_kind==="public_contribution"?BigInt(totals.rows[0]?.received??0)>BigInt(0):BigInt(totals.rows[0]?.received??0)>=BigInt(context.amount_minor);
    const status:RouteRow["status"]=confirmed?"success":hasFailure?"failed":hasProcessing||success.length?"deposit_received":"ready";
    const pendingSettlement=success.length>confirmed||historyMatches.some(({item})=>item.status==="SUCCESS"&&item.destinationChainTxHashes.length===0);
    const lastError=ambiguousHistory?"Settlement detected but route attribution is ambiguous; no funds were credited":pendingSettlement?"Settlement detected; waiting for Monad confirmation":null;
    await database().query(`update aurora_deposit_routes set status=$2,last_synced_at=now(),last_error=$3,updated_at=now() where id=$1`,[route.id,status,lastError]);
    await database().query(`update funding_requests set status=$2,updated_at=now() where id=$1`,[context.id,fullyReceived?"received":hasProcessing||success.length||historyMatches.length?"routing":"sent"]);
    if(fullyReceived&&context.request_kind==="requested")await database().query(`update invoices set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where funding_source_id=$1 and direction='receivable' and snapshot->>'fundingRequestId'=$2`,[context.funding_source_id,context.id]);
    const updated=await oneOrNull<RouteRow>(`select * from aurora_deposit_routes where id=$1`,[route.id]);
    return updated?{...mapRoute(updated),credited}:null;
  }catch(error){
    const message=error instanceof Error?error.message:"Aurora status check failed";
    await database().query(`update aurora_deposit_routes set last_error=$2,last_synced_at=now(),updated_at=now() where id=$1`,[route.id,message.slice(0,500)]);
    throw error;
  }
}
