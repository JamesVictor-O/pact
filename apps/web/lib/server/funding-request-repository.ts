import "server-only";
import type { QueryResultRow } from "pg";
import { canonicalBytes32 } from "../agreement-typed-data";
import { hashCanonical } from "../agreements";
import type { DisplayCurrency, FundingRequest } from "../pact-types";
import { database, oneOrNull, transaction } from "./database";
import { recordConfirmedFundingReceipt } from "./funding-receipt-repository";
import {createPublicClient,decodeEventLog,http,parseAbiItem,type Address,type Hex} from "viem";

type RequestRow = QueryResultRow & {
  id:string;event_id:string;funding_source_id:string;public_slug:string;amount_minor:string;currency:DisplayCurrency;request_kind:"requested"|"public_contribution";
  status:FundingRequest["status"];onchain_request_id:Buffer|null;expires_at:Date|null;sent_at:Date|null;created_at:Date;updated_at:Date;
};
type PublicRow = RequestRow & {event_name:string;source_name:string;source_type:string;committed_amount_minor:string;received_amount_minor:string;vault_address:string|null;vault_status:string};
const major=(value:string|number)=>Number(value)/100;
const hex=(value:Buffer|null)=>value?`0x${value.toString("hex")}`:undefined;
const map=(row:RequestRow):FundingRequest=>({id:row.id,eventId:row.event_id,fundingSourceId:row.funding_source_id,publicSlug:row.public_slug,amount:major(row.amount_minor),currency:row.currency,requestKind:row.request_kind,status:row.status,onchainRequestId:hex(row.onchain_request_id),expiresAt:row.expires_at?.toISOString(),sentAt:row.sent_at?.toISOString(),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});

export type PublicFundingRequest={request:FundingRequest;eventName:string;sourceName:string;sourceType:string;committedAmount:number;receivedAmount:number;treasuryAddress?:string;settlementTokenAddress?:string;chainId:number};

export async function createFundingRequest(sourceId:string,userId:string,amount?:number){return transaction(async client=>{
  const source=await client.query<{id:string;event_id:string;name:string;committed_amount_minor:string;received_amount_minor:string;display_currency:DisplayCurrency;vault_status:string}>(`select f.id,f.event_id,f.name,f.committed_amount_minor,f.received_amount_minor,e.display_currency,e.vault_status from funding_sources f join events e on e.id=f.event_id where f.id=$1 and e.owner_user_id=$2 and f.cancelled_at is null for update`,[sourceId,userId]);
  const row=source.rows[0];if(!row)return null;
  if(row.vault_status!=="ready")throw new Error("The event account must be ready before you send a funding request");
  if(row.display_currency!=="USD")throw new Error("Crypto funding requests currently settle in USDC, so this event must use USD as its display currency");
  const open=await client.query<{amount_minor:string}>(`select coalesce(sum(amount_minor),0) amount_minor from funding_requests where funding_source_id=$1 and status in ('draft','sent','routing')`,[sourceId]);
  const remainingMinor=Number(row.committed_amount_minor)-Number(row.received_amount_minor)-Number(open.rows[0]?.amount_minor??0);
  const requestedMinor=amount===undefined?remainingMinor:Math.round(amount*100);
  if(!Number.isSafeInteger(requestedMinor)||requestedMinor<=0)throw new Error("Funding request amount must be greater than zero");
  if(requestedMinor>remainingMinor)throw new Error("Funding request exceeds the remaining commitment");
  const id=`funding_request_${crypto.randomUUID()}`,slug=crypto.randomUUID(),onchainId=canonicalBytes32(id),now=new Date().toISOString();
  const inserted=await client.query<RequestRow>(`insert into funding_requests(id,event_id,funding_source_id,public_slug,amount_minor,currency,status,onchain_request_id,created_by_user_id) values($1,$2,$3,$4,$5,$6,'sent',$7,$8) returning *`,[id,row.event_id,row.id,slug,requestedMinor,row.display_currency,Buffer.from(onchainId.slice(2),"hex"),userId]);
  const invoiceId=`invoice_${crypto.randomUUID()}`,invoiceNumber=`PACT-FUND-${Date.now().toString(36).toUpperCase()}`;
  const snapshot={invoiceNumber,direction:"receivable" as const,issuerName:"Pact event",recipientName:row.name,description:`Funding for ${row.name}`,amountMinor:requestedMinor,currency:row.display_currency,issuedOn:now.slice(0,10),fundingRequestId:id};
  const documentHash=hashCanonical(snapshot);
  await client.query(`insert into invoices(id,event_id,direction,funding_source_id,invoice_number,snapshot,amount_minor,currency,status,document_hash,created_at,updated_at) values($1,$2,'receivable',$3,$4,$5,$6,$7,'issued',$8,now(),now())`,[invoiceId,row.event_id,row.id,invoiceNumber,JSON.stringify(snapshot),requestedMinor,row.display_currency,Buffer.from(documentHash.slice(2),"hex")]);
  await client.query(`insert into financial_activity(event_id,actor_user_id,action,subject_type,subject_id,metadata) values($1,$2,'funding_request.sent','funding_request',$3,$4)`,[row.event_id,userId,id,JSON.stringify({fundingSourceId:sourceId,amountMinor:requestedMinor})]);
  return map(inserted.rows[0]!);
});}

export async function listFundingRequests(sourceId:string,userId:string){const rows=await database().query<RequestRow>(`select r.* from funding_requests r join events e on e.id=r.event_id where r.funding_source_id=$1 and e.owner_user_id=$2 order by r.created_at desc`,[sourceId,userId]);return rows.rows.map(map);}

export async function findPublicFundingRequest(slug:string):Promise<PublicFundingRequest|null>{const row=await oneOrNull<PublicRow>(`select r.*,e.name event_name,e.vault_address,e.vault_status,f.name source_name,f.source_type,f.committed_amount_minor,f.received_amount_minor from funding_requests r join events e on e.id=r.event_id join funding_sources f on f.id=r.funding_source_id where r.public_slug=$1 and r.request_kind='requested' and r.status not in ('cancelled')`,[slug]);if(!row)return null;return{request:map(row),eventName:row.event_name,sourceName:row.source_name,sourceType:row.source_type,committedAmount:major(row.committed_amount_minor),receivedAmount:major(row.received_amount_minor),treasuryAddress:row.vault_status==="ready"?row.vault_address??undefined:undefined,settlementTokenAddress:process.env.PACT_SETTLEMENT_TOKEN_ADDRESS,chainId:Number(process.env.MONAD_CHAIN_ID??10143)};}

const transferEvent=parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");
export async function reconcilePublicFundingReceipt(slug:string,transactionHash:string){
  if(!/^0x[0-9a-fA-F]{64}$/.test(transactionHash))throw new Error("Enter a valid transaction hash");
  const rpc=process.env.MONAD_RPC_URL,token=process.env.PACT_SETTLEMENT_TOKEN_ADDRESS as Address|undefined;
  if(!rpc||!token)throw new Error("Event settlement token is not configured");
  const request=await oneOrNull<RequestRow&{vault_address:string|null}>(`select r.*,e.vault_address from funding_requests r join events e on e.id=r.event_id where r.public_slug=$1 and r.status not in ('cancelled','refunded')`,[slug]);if(!request) return null;
  if(!request.vault_address)throw new Error("This event account is not ready yet");
  const client=createPublicClient({transport:http(rpc)}),receipt=await client.getTransactionReceipt({hash:transactionHash as Hex});if(receipt.status!=="success")throw new Error("The funding transaction did not succeed");
  const matched=receipt.logs.filter(log=>log.address.toLowerCase()===token.toLowerCase()).map(log=>{try{return{log,decoded:decodeEventLog({abi:[transferEvent],data:log.data,topics:log.topics})}}catch{return null}}).find(item=>item&&item.decoded.eventName==="Transfer"&&String(item.decoded.args.to).toLowerCase()===request.vault_address!.toLowerCase());
  if(!matched)throw new Error("This transaction does not contain a USDC transfer to this event account");
  const amountAtomic=BigInt(matched.decoded.args.value),decimals=Number(process.env.PACT_SETTLEMENT_TOKEN_DECIMALS??6);
  if(amountAtomic<=BigInt(0))throw new Error("The received amount is invalid");
  return transaction(async db=>{
    const recorded=await recordConfirmedFundingReceipt(db,{id:`receipt_${crypto.randomUUID()}`,fundingRequestId:request.id,eventId:request.event_id,fundingSourceId:request.funding_source_id,contributorAddress:String(matched.decoded.args.from),settlementTokenAddress:token,amountAtomic,tokenDecimals:decimals,chainId:Number(process.env.MONAD_CHAIN_ID??10143),transactionHash,logIndex:matched.log.logIndex,blockNumber:receipt.blockNumber});
    const total=await db.query<{received:string}>(`select coalesce(sum(amount_minor),0) received from funding_receipts where funding_request_id=$1 and status='confirmed'`,[request.id]);const fullyReceived=request.request_kind==="public_contribution"?BigInt(total.rows[0]?.received??0)>BigInt(0):BigInt(total.rows[0]?.received??0)>=BigInt(request.amount_minor);
    await db.query(`update funding_requests set status=$2,updated_at=now() where id=$1`,[request.id,fullyReceived?"received":"routing"]);
    if(fullyReceived&&request.request_kind==="requested")await db.query(`update invoices set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where funding_source_id=$1 and direction='receivable' and snapshot->>'fundingRequestId'=$2`,[request.funding_source_id,request.id]);
    return{transactionHash:transactionHash.toLowerCase(),amount:major(recorded.creditedMinor.toString()),status:fullyReceived?"received":"routing" as const};
  });
}
