import "server-only";

import { createPublicClient, createWalletClient, http, isAddress, parseAbi, verifyTypedData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalBytes32, eventAllocationTypes, eventPaymentReleaseTypes, eventPaymentRouteTypes, eventVaultDomain } from "../agreement-typed-data";
import type { Allocation, PaymentSettlement, VaultExecutionAuthorization, VaultExecutionChallenge } from "../pact-types";
import { database, oneOrNull, transaction } from "./database";
import { auroraPayoutAvailability, createAuroraPayoutQuote, getAuroraPayoutStatus, submitAuroraPayoutDeposit } from "./aurora-payout";

const vaultAbi=parseAbi([
  "function organizerNonce() view returns(uint256)",
  "function paymentAllocated(bytes32 paymentId) view returns(uint256)",
  "function paymentPaid(bytes32 paymentId) view returns(uint256)",
  "function allocate(bytes32 agreementId,bytes32 paymentId,uint256 amount,uint256 nonce,uint64 deadline,bytes organizerSignature)",
  "function release(bytes32 agreementId,bytes32 paymentId,address payoutAddress,uint256 amount,uint256 nonce,uint64 deadline,bytes organizerSignature)",
  "function routePayment(bytes32 agreementId,bytes32 paymentId,bytes32 routeId,address depositAddress,uint256 amount,uint256 nonce,uint64 deadline,bytes organizerSignature)",
]);

type ExecutionContext={
  event_id:string;owner_user_id:string;vault_address:string;organizer_address:string;display_currency:string;
  payment_id:string;payment_amount_minor:string;paid_amount_minor:string;processing_started_at:Date|null;payment_cancelled_at:Date|null;
  expense_cancelled_at:Date|null;agreement_id:string;agreement_status:string;invoice_status:string|null;
  payout_address:string|null;payout_status:string|null;destination_chain:string|null;destination_asset_id:string|null;destination_asset_symbol:string|null;destination_address:string|null;source_id:string|null;received_amount_minor:string|null;
  source_cancelled_at:Date|null;source_allocated_minor:string;payment_allocated_minor:string;
};

type AllocationRow={id:string;event_id:string;funding_source_id:string;payment_id:string;amount_minor:string;execution_status:Allocation["executionStatus"];transaction_hash:string|null;execution_error:string|null;created_at:Date};
type SettlementRow={id:string;event_id:string;agreement_id:string;payment_id:string;payout_address:string;settlement_token_address:string;amount_atomic:string;amount_minor:string;transaction_hash:string|null;status:PaymentSettlement["status"];settlement_mode:"direct"|"aurora";payout_route_quote_id:string|null;failure_message:string|null;confirmed_at:Date|null;created_at:Date};
type RouteRow={id:string;event_id:string;agreement_id:string;payment_id:string;vault_address:string;deposit_address:string;refund_address:string;recipient_address:string;origin_asset_id:string;destination_chain:string;destination_asset_id:string;destination_asset_symbol:string;amount_in_atomic:string;amount_out_atomic:string;minimum_amount_out_atomic:string;amount_out_formatted:string;minimum_amount_out_formatted:string;quote_deadline:Date;aurora_correlation_id:string|null;status:string;raw_quote:unknown;destination_transaction_hash:string|null;destination_explorer_url:string|null;last_error:string|null};

const allocationMap=(row:AllocationRow):Allocation=>({id:row.id,eventId:row.event_id,fundingSourceId:row.funding_source_id,paymentId:row.payment_id,amount:Number(row.amount_minor)/100,executionStatus:row.execution_status,transactionHash:row.transaction_hash??undefined,executionError:row.execution_error??undefined,createdAt:row.created_at.toISOString()});
const settlementMap=(row:SettlementRow):PaymentSettlement=>({id:row.id,eventId:row.event_id,agreementId:row.agreement_id,paymentId:row.payment_id,payoutAddress:row.payout_address,settlementTokenAddress:row.settlement_token_address,amountAtomic:row.amount_atomic,amount:Number(row.amount_minor)/100,transactionHash:row.transaction_hash??undefined,status:row.status,settlementMode:row.settlement_mode,payoutRouteQuoteId:row.payout_route_quote_id??undefined,failureMessage:row.failure_message??undefined,confirmedAt:row.confirmed_at?.toISOString(),createdAt:row.created_at.toISOString()});

function config(){
  const rpc=process.env.MONAD_RPC_URL,key=process.env.PACT_RELAYER_PRIVATE_KEY as Hex|undefined,token=process.env.PACT_SETTLEMENT_TOKEN_ADDRESS as Address|undefined;
  const chainId=Number(process.env.MONAD_CHAIN_ID??10143),decimals=Number(process.env.PACT_SETTLEMENT_TOKEN_DECIMALS??6);
  if(!rpc||!key||!token||!Number.isSafeInteger(chainId)||!Number.isInteger(decimals)||decimals<2)throw new Error("Event payment relayer is not configured");
  return{rpc,key,token,chainId,unit:BigInt(10)**BigInt(decimals-2)};
}

async function context(paymentId:string,userId:string,sourceId?:string){
  return oneOrNull<ExecutionContext>(`select e.id event_id,e.owner_user_id,e.vault_address,e.organizer_address,e.display_currency,
    p.id payment_id,p.amount_minor payment_amount_minor,p.paid_amount_minor,p.processing_started_at,p.cancelled_at payment_cancelled_at,x.cancelled_at expense_cancelled_at,
    a.id agreement_id,a.status agreement_status,i.status invoice_status,pp.payout_address,pp.verification_status payout_status,pp.destination_chain,pp.destination_asset_id,pp.destination_asset_symbol,pp.destination_address,
    f.id source_id,f.received_amount_minor,f.cancelled_at source_cancelled_at,
    coalesce((select sum(ax.amount_minor) from allocations ax where ax.funding_source_id=f.id and ax.reversed_at is null and ax.execution_status='confirmed'),0) source_allocated_minor,
    coalesce((select sum(ap.amount_minor) from allocations ap where ap.payment_id=p.id and ap.reversed_at is null and ap.execution_status='confirmed'),0) payment_allocated_minor
    from expense_payments p join expenses x on x.id=p.expense_id join events e on e.id=x.event_id
    join payment_agreements a on a.expense_id=x.id
    left join invoices i on i.agreement_id=a.id and i.direction='payable'
    left join payout_profiles pp on pp.user_id=a.payee_user_id
    left join funding_sources f on f.id=$3 and f.event_id=e.id
    where p.id=$1 and e.owner_user_id=$2`,[paymentId,userId,sourceId??null]);
}

async function nonceFor(vault:Address){const c=config();return createPublicClient({transport:http(c.rpc)}).readContract({address:vault,abi:vaultAbi,functionName:"organizerNonce"});}
function deadline(){return new Date(Date.now()+15*60*1000).toISOString();}
function challengeFrom(c:ExecutionContext,amountMinor:number,nonce:bigint,payoutAddress?:string):VaultExecutionChallenge{
  const cfg=config();return{vaultAddress:c.vault_address as Address,organizer:c.organizer_address as Address,agreementId:c.agreement_id,paymentId:c.payment_id,amount:amountMinor/100,amountAtomic:(BigInt(amountMinor)*cfg.unit).toString(),nonce:nonce.toString(),deadline:deadline(),payoutAddress:payoutAddress as Address|undefined};
}
function requireBase(c:ExecutionContext|null){
  if(!c)throw new Error("Payment not found");
  if(!c.vault_address||!c.organizer_address)throw new Error("The event account is not ready");
  if(c.display_currency!=="USD")throw new Error("Onchain payments currently require a USD event");
  if(c.agreement_status!=="active")throw new Error("The payment agreement must be active");
  if(c.payment_cancelled_at||c.expense_cancelled_at)throw new Error("Cancelled payments cannot move funds");
  return c;
}

export async function createAllocationChallenge(sourceId:string,paymentId:string,amount:number,userId:string){
  if(!Number.isFinite(amount)||amount<=0)throw new Error("Allocation amount must be greater than zero");
  const c=requireBase(await context(paymentId,userId,sourceId));
  if(!c.source_id||c.source_cancelled_at)throw new Error("The funding source is not available");
  const amountMinor=Math.round(amount*100),sourceAvailable=Number(c.received_amount_minor)-Number(c.source_allocated_minor),paymentGap=Number(c.payment_amount_minor)-Number(c.payment_allocated_minor);
  if(amountMinor>sourceAvailable)throw new Error("Allocation exceeds received and unallocated funds");
  if(amountMinor>paymentGap)throw new Error("Allocation exceeds this payment’s funding gap");
  return challengeFrom(c,amountMinor,await nonceFor(c.vault_address as Address));
}

async function validAuthorization(authorization:VaultExecutionAuthorization,kind:"allocation"|"release"){
  if(new Date(authorization.deadline).getTime()<=Date.now())throw new Error("This authorization has expired. Sign again to continue");
  const message={agreementId:canonicalBytes32(authorization.agreementId),paymentId:canonicalBytes32(authorization.paymentId),amount:BigInt(authorization.amountAtomic),nonce:BigInt(authorization.nonce),deadline:BigInt(Math.floor(new Date(authorization.deadline).getTime()/1000))};
  const domain=eventVaultDomain(config().chainId,authorization.vaultAddress);
  if(kind==="allocation")return verifyTypedData({address:authorization.organizer,domain,primaryType:"EventAllocation",types:eventAllocationTypes,message,signature:authorization.signature});
  if(!authorization.payoutAddress)throw new Error("The verified payout destination is missing");
  if(authorization.settlementMode==="aurora"){if(!authorization.payoutRouteQuoteId)throw new Error("The Aurora route is missing");return verifyTypedData({address:authorization.organizer,domain,primaryType:"EventPaymentRoute",types:eventPaymentRouteTypes,message:{...message,routeId:canonicalBytes32(authorization.payoutRouteQuoteId),depositAddress:authorization.payoutAddress},signature:authorization.signature});}
  return verifyTypedData({address:authorization.organizer,domain,primaryType:"EventPaymentRelease",types:eventPaymentReleaseTypes,message:{...message,payoutAddress:authorization.payoutAddress},signature:authorization.signature});
}

export async function executeAllocation(sourceId:string,paymentId:string,amount:number,userId:string,authorization:VaultExecutionAuthorization){
  const expected=await createAllocationChallenge(sourceId,paymentId,amount,userId);
  if(expected.vaultAddress.toLowerCase()!==authorization.vaultAddress.toLowerCase()||expected.organizer.toLowerCase()!==authorization.organizer.toLowerCase()||expected.agreementId!==authorization.agreementId||expected.paymentId!==authorization.paymentId||expected.amountAtomic!==authorization.amountAtomic||expected.nonce!==authorization.nonce)throw new Error("The allocation authorization no longer matches current financial state");
  if(!await validAuthorization(authorization,"allocation"))throw new Error("The allocation signature is invalid");
  const id=`allocation_${crypto.randomUUID()}`;
  const row=await transaction(async db=>{
    const existing=await db.query<AllocationRow>(`select * from allocations where event_id=(select event_id from funding_sources where id=$1) and organizer_nonce=$2`,[sourceId,authorization.nonce]);if(existing.rows[0])return existing.rows[0];
    const inserted=await db.query<AllocationRow>(`insert into allocations(id,event_id,funding_source_id,payment_id,amount_minor,created_by_user_id,agreement_id,amount_atomic,organizer_nonce,authorization_signature,authorization_deadline,execution_status) select $1,f.event_id,f.id,$2,$3,$4,$5,$6,$7,$8,$9,'authorization_signed' from funding_sources f where f.id=$10 returning *`,[id,paymentId,Math.round(amount*100),userId,authorization.agreementId,authorization.amountAtomic,authorization.nonce,Buffer.from(authorization.signature.slice(2),"hex"),authorization.deadline,sourceId]);
    if(!inserted.rows[0])throw new Error("Funding source not found");return inserted.rows[0];
  });
  return relayAllocation(row.id,userId);
}

export async function relayAllocation(id:string,userId:string){
  const row=await oneOrNull<AllocationRow&{vault_address:string;owner_user_id:string;agreement_id:string;amount_atomic:string;organizer_nonce:string;authorization_signature:Buffer;authorization_deadline:Date}>(`select a.*,e.vault_address,e.owner_user_id from allocations a join events e on e.id=a.event_id where a.id=$1 and e.owner_user_id=$2`,[id,userId]);
  if(!row)return null;if(row.execution_status==="confirmed")return allocationMap(row);
  try{const c=config(),pub=createPublicClient({transport:http(c.rpc)}),wallet=createWalletClient({account:privateKeyToAccount(c.key),transport:http(c.rpc)});let hash=row.transaction_hash as Hex|undefined;
    if(!hash){hash=await wallet.writeContract({chain:null,address:row.vault_address as Address,abi:vaultAbi,functionName:"allocate",args:[canonicalBytes32(row.agreement_id),canonicalBytes32(row.payment_id),BigInt(row.amount_atomic),BigInt(row.organizer_nonce),BigInt(Math.floor(row.authorization_deadline.getTime()/1000)),`0x${row.authorization_signature.toString("hex")}` as Hex]});await database().query(`update allocations set execution_status='submitted',transaction_hash=$2,execution_error=null,updated_at=now() where id=$1`,[id,hash]);}
    const receipt=await pub.waitForTransactionReceipt({hash,confirmations:Number(process.env.MONAD_CONFIRMATIONS??1),timeout:120_000});if(receipt.status!=="success")throw new Error("Allocation transaction reverted");
    const confirmed=await oneOrNull<AllocationRow>(`update allocations set execution_status='confirmed',confirmed_at=now(),execution_error=null,updated_at=now() where id=$1 returning *`,[id]);return allocationMap(confirmed!);
  }catch(error){const message=error instanceof Error?error.message:"Allocation failed";const failed=await oneOrNull<AllocationRow>(`update allocations set execution_status='failed',execution_error=$2,updated_at=now() where id=$1 returning *`,[id,message.slice(0,500)]);return allocationMap(failed!);}
}

export async function createPaymentChallenge(paymentId:string,userId:string){
  const c=requireBase(await context(paymentId,userId));
  if(c.invoice_status!=="confirmed")throw new Error("The payee invoice must be confirmed");
  if(c.payout_status!=="verified"||!c.payout_address)throw new Error("The payee payout destination must be verified");
  if(c.processing_started_at)throw new Error("This payment is already being processed");
  const remaining=Number(c.payment_amount_minor)-Number(c.paid_amount_minor);if(remaining<=0)throw new Error("This payment has already been paid");
  if(Number(c.payment_allocated_minor)<remaining)throw new Error("This payment must be fully funded before release");
  const nonce=await nonceFor(c.vault_address as Address),base=challengeFrom(c,remaining,nonce,c.payout_address);
  const routed=c.destination_chain?.toLowerCase()!=="monad"||c.destination_asset_id!=="monad:usdc";
  if(!routed)return{...base,settlementMode:"direct" as const};
  const available=auroraPayoutAvailability();if(!available.enabled)throw new Error(available.reason??"Cross-chain payouts are not available");
  if(!c.destination_asset_id||!c.destination_address||!c.destination_chain||!c.destination_asset_symbol)throw new Error("The payee payout preference is incomplete");
  const existing=await oneOrNull<RouteRow>(`select * from payout_route_quotes where payment_id=$1 and status='quoted' and quote_deadline>now()+interval '60 seconds' order by created_at desc limit 1`,[paymentId]);
  let route=existing;
  if(!route){const quote=await createAuroraPayoutQuote({amountAtomic:base.amountAtomic,vaultAddress:c.vault_address,destinationAsset:c.destination_asset_id,recipient:c.destination_address});const id=`route_${crypto.randomUUID()}`,q=quote.quote;route=await oneOrNull<RouteRow>(`insert into payout_route_quotes(id,event_id,agreement_id,payment_id,vault_address,deposit_address,refund_address,recipient_address,origin_asset_id,destination_chain,destination_asset_id,destination_asset_symbol,amount_in_atomic,amount_out_atomic,minimum_amount_out_atomic,amount_out_formatted,minimum_amount_out_formatted,quote_deadline,aurora_correlation_id,status,raw_quote) values($1,$2,$3,$4,$5,$6,$5,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'quoted',$19) returning *`,[id,c.event_id,c.agreement_id,c.payment_id,c.vault_address,q.depositAddress,c.destination_address,process.env.AURORA_PAYOUT_ORIGIN_ASSET_ID,c.destination_chain,c.destination_asset_id,c.destination_asset_symbol,q.amountIn,q.amountOut,q.minAmountOut,q.amountOutFormatted,q.minAmountOutFormatted??q.minimumAmountOutFormatted??q.minAmountOut,q.deadline,quote.correlationId??null,JSON.stringify(quote)]);}
  if(!route||!isAddress(route.deposit_address))throw new Error("Aurora returned an invalid route deposit address");
  return{...base,payoutAddress:route.deposit_address as Address,payoutRouteQuoteId:route.id,settlementMode:"aurora" as const,destinationChain:route.destination_chain,destinationAssetSymbol:route.destination_asset_symbol,expectedOutput:route.amount_out_formatted,minimumOutput:route.minimum_amount_out_formatted};
}

export async function executePayment(paymentId:string,userId:string,authorization:VaultExecutionAuthorization){
  const expected=await createPaymentChallenge(paymentId,userId);
  if(expected.vaultAddress.toLowerCase()!==authorization.vaultAddress.toLowerCase()||expected.organizer.toLowerCase()!==authorization.organizer.toLowerCase()||expected.agreementId!==authorization.agreementId||expected.paymentId!==authorization.paymentId||expected.amountAtomic!==authorization.amountAtomic||expected.nonce!==authorization.nonce||expected.payoutAddress?.toLowerCase()!==authorization.payoutAddress?.toLowerCase()||expected.settlementMode!==authorization.settlementMode||expected.payoutRouteQuoteId!==authorization.payoutRouteQuoteId)throw new Error("The payment authorization no longer matches current financial state");
  if(!await validAuthorization(authorization,"release"))throw new Error("The payment signature is invalid");
  const cfg=config(),id=`settlement_${crypto.randomUUID()}`;
  const settlement=await transaction(async db=>{const existing=await db.query<SettlementRow>(`select * from payment_settlements where payment_id=$1 and organizer_nonce=$2`,[paymentId,authorization.nonce]);if(existing.rows[0])return existing.rows[0];const inserted=await db.query<SettlementRow>(`insert into payment_settlements(id,event_id,agreement_id,payment_id,payout_address,settlement_token_address,amount_atomic,amount_minor,organizer_nonce,authorization_signature,authorization_deadline,status,settlement_mode,payout_route_quote_id) select $1,x.event_id,$2,p.id,$3,$4,$5,$6,$7,$8,$9,'authorization_signed',$10,$11 from expense_payments p join expenses x on x.id=p.expense_id where p.id=$12 returning *`,[id,authorization.agreementId,authorization.payoutAddress,cfg.token,authorization.amountAtomic,Math.round(authorization.amount*100),authorization.nonce,Buffer.from(authorization.signature.slice(2),"hex"),authorization.deadline,authorization.settlementMode??"direct",authorization.payoutRouteQuoteId??null,paymentId]);await db.query(`update expense_payments set processing_started_at=now(),updated_at=now() where id=$1`,[paymentId]);return inserted.rows[0]!;});
  return relayPayment(settlement.id,userId);
}

export async function relayPayment(id:string,userId:string){
  const row=await oneOrNull<SettlementRow&{vault_address:string;owner_user_id:string;organizer_nonce:string;authorization_signature:Buffer;authorization_deadline:Date}>(`select s.*,e.vault_address,e.owner_user_id from payment_settlements s join events e on e.id=s.event_id where s.id=$1 and e.owner_user_id=$2`,[id,userId]);if(!row)return null;if(row.status==="routing")return syncRoutedPayment(id,userId);if(row.status==="confirmed"||row.status==="delivered")return settlementMap(row);
  try{const c=config(),pub=createPublicClient({transport:http(c.rpc)}),wallet=createWalletClient({account:privateKeyToAccount(c.key),transport:http(c.rpc)});let hash=row.transaction_hash as Hex|undefined;
    if(!hash){const signature=`0x${row.authorization_signature.toString("hex")}` as Hex,common=[canonicalBytes32(row.agreement_id),canonicalBytes32(row.payment_id)] as const;hash=row.settlement_mode==="aurora"&&row.payout_route_quote_id?await wallet.writeContract({chain:null,address:row.vault_address as Address,abi:vaultAbi,functionName:"routePayment",args:[...common,canonicalBytes32(row.payout_route_quote_id),row.payout_address as Address,BigInt(row.amount_atomic),BigInt(row.organizer_nonce),BigInt(Math.floor(row.authorization_deadline.getTime()/1000)),signature]}):await wallet.writeContract({chain:null,address:row.vault_address as Address,abi:vaultAbi,functionName:"release",args:[...common,row.payout_address as Address,BigInt(row.amount_atomic),BigInt(row.organizer_nonce),BigInt(Math.floor(row.authorization_deadline.getTime()/1000)),signature]});await database().query(`update payment_settlements set status='submitted',transaction_hash=$2,failure_message=null,updated_at=now() where id=$1`,[id,hash]);}
    const receipt=await pub.waitForTransactionReceipt({hash,confirmations:Number(process.env.MONAD_CONFIRMATIONS??1),timeout:120_000});if(receipt.status!=="success")throw new Error("Payment transaction reverted");
    if(row.settlement_mode==="aurora"&&row.payout_route_quote_id){await submitAuroraPayoutDeposit(hash,row.payout_address);const routing=await oneOrNull<SettlementRow>(`update payment_settlements set status='routing',confirmed_at=now(),failure_message=null,updated_at=now() where id=$1 returning *`,[id]);await database().query(`update payout_route_quotes set status='routing',updated_at=now() where id=$1`,[row.payout_route_quote_id]);return settlementMap(routing!);}
    const confirmed=await transaction(async db=>{const updated=await db.query<SettlementRow>(`update payment_settlements set status='confirmed',confirmed_at=now(),failure_message=null,updated_at=now() where id=$1 and status<>'confirmed' returning *`,[id]);if(updated.rows[0]){await db.query(`update expense_payments set paid_amount_minor=least(amount_minor,paid_amount_minor+$2),processing_started_at=null,updated_at=now() where id=$1`,[row.payment_id,row.amount_minor]);await db.query(`update invoices set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where agreement_id=$1 and not exists(select 1 from expense_payments p join expenses x on x.id=p.expense_id where x.id=(select expense_id from payment_agreements where id=$1) and p.paid_amount_minor<p.amount_minor)`,[row.agreement_id]);}return updated.rows[0]??row;});return settlementMap(confirmed);
  }catch(error){const message=error instanceof Error?error.message:"Payment failed";const failed=await transaction(async db=>{const updated=await db.query<SettlementRow>(`update payment_settlements set status='failed',failure_message=$2,updated_at=now() where id=$1 returning *`,[id,message.slice(0,500)]);await db.query(`update expense_payments set processing_started_at=null,updated_at=now() where id=$1`,[row.payment_id]);return updated.rows[0]!;});return settlementMap(failed);}
}

export async function syncRoutedPayment(id:string,userId:string){const row=await oneOrNull<SettlementRow&{owner_user_id:string;deposit_address:string}>(`select s.*,e.owner_user_id,r.deposit_address from payment_settlements s join events e on e.id=s.event_id join payout_route_quotes r on r.id=s.payout_route_quote_id where s.id=$1 and e.owner_user_id=$2`,[id,userId]);if(!row)return null;if(row.settlement_mode!=="aurora"||!row.payout_route_quote_id)return settlementMap(row);if(["delivered","refunded","failed"].includes(row.status))return settlementMap(row);const remote=await getAuroraPayoutStatus(row.deposit_address),tx=remote.swapDetails?.destinationChainTxHashes?.[0];if(remote.status==="SUCCESS"){const delivered=await transaction(async db=>{const updated=await db.query<SettlementRow>(`update payment_settlements set status='delivered',confirmed_at=now(),failure_message=null,updated_at=now() where id=$1 and status<>'delivered' returning *`,[id]);await db.query(`update payout_route_quotes set status='delivered',destination_transaction_hash=$2,destination_explorer_url=$3,last_synced_at=now(),updated_at=now() where id=$1`,[row.payout_route_quote_id,tx?.hash??null,tx?.explorerUrl??null]);if(updated.rows[0])await db.query(`update expense_payments set paid_amount_minor=least(amount_minor,paid_amount_minor+$2),processing_started_at=null,updated_at=now() where id=$1`,[row.payment_id,row.amount_minor]);return updated.rows[0]??row;});return settlementMap(delivered);}if(remote.status==="REFUNDED"||remote.status==="FAILED"){const next=remote.status==="REFUNDED"?"refunded":"failed",message=remote.swapDetails?.refundReason??`Aurora route ${next}`;const updated=await oneOrNull<SettlementRow>(`update payment_settlements set status=$2,failure_message=$3,updated_at=now() where id=$1 returning *`,[id,next,message]);await database().query(`update payout_route_quotes set status=$2,last_error=$3,last_synced_at=now(),updated_at=now() where id=$1`,[row.payout_route_quote_id,next,message]);await database().query(`update expense_payments set processing_started_at=null,updated_at=now() where id=$1`,[row.payment_id]);return settlementMap(updated!);}await database().query(`update payout_route_quotes set last_synced_at=now(),updated_at=now() where id=$1`,[row.payout_route_quote_id]);return settlementMap(row);}

export async function paymentExecutionState(paymentId:string,userId:string){const rows=await database().query<SettlementRow>(`select s.* from payment_settlements s join events e on e.id=s.event_id where s.payment_id=$1 and e.owner_user_id=$2 order by s.created_at desc`,[paymentId,userId]);return rows.rows.map(settlementMap);}
