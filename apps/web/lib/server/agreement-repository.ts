import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { database, oneOrNull, transaction } from "./database";
import type { Invoice, PayeePayment, PayeeWorkspace, PaymentAgreement, PayoutPreference, PayoutProfile } from "../pact-types";

type AgreementRow = QueryResultRow & {
  id: string; event_id: string; network_chain_id:string; expense_id: string; organizer_user_id: string; payee_id: string; payee_email: string; payee_user_id: string | null;
  total_amount_minor: string; currency: string; status: PaymentAgreement["status"]; snapshot: PaymentAgreement["snapshot"];
  agreement_hash: Buffer; schedule_hash: Buffer; organizer_address: string | null; payee_address: string | null;
  organizer_signature: Buffer | null; payee_signature: Buffer | null; registration_status: PaymentAgreement["registrationStatus"];
  proposal_expires_at: Date | null; onchain_agreement_id: string | null; onchain_tx_hash: string | null; registration_error: string | null;
  accepted_at: Date | null; declined_at: Date | null; cancelled_at: Date | null; created_at: Date; updated_at: Date;
};
type InvoiceRow = QueryResultRow & { id:string; event_id:string; direction:Invoice["direction"]; funding_source_id:string|null; agreement_id:string|null; invoice_number:string; snapshot:Invoice["snapshot"]; amount_minor:string; currency:string; status:Invoice["status"]; document_hash:Buffer; confirmed_at:Date|null; paid_at:Date|null; created_at:Date; updated_at:Date };
type PayoutRow = QueryResultRow & { user_id:string; signing_address:string; payout_type:PayoutProfile["payoutType"]; payout_address:string; verification_status:PayoutProfile["verificationStatus"]; verified_at:Date|null;destination_chain:string;destination_asset_id:string;destination_asset_symbol:string;destination_asset_decimals:number;destination_address:string;destination_verification:PayoutProfile["destinationVerification"] };

const hex = (value: Buffer | null) => value ? `0x${value.toString("hex")}` : undefined;
const bytes = (value: string) => Buffer.from(value.replace(/^0x/, ""), "hex");
const iso = (value: Date | null) => value?.toISOString();

export function mapAgreement(row: AgreementRow): PaymentAgreement {
  return { id:row.id,eventId:row.event_id,expenseId:row.expense_id,organizerUserId:row.organizer_user_id,payeeId:row.payee_id,payeeEmail:row.payee_email,payeeUserId:row.payee_user_id??undefined,totalAmountMinor:Number(row.total_amount_minor),currency:row.currency as PaymentAgreement["currency"],status:row.status,snapshot:row.snapshot,agreementHash:hex(row.agreement_hash)!,scheduleHash:hex(row.schedule_hash)!,organizerAddress:row.organizer_address??undefined,payeeAddress:row.payee_address??undefined,organizerSignature:hex(row.organizer_signature),payeeSignature:hex(row.payee_signature),registrationStatus:row.registration_status,proposalExpiresAt:iso(row.proposal_expires_at),onchainAgreementId:row.onchain_agreement_id??undefined,onchainTxHash:row.onchain_tx_hash??undefined,registrationError:row.registration_error??undefined,acceptedAt:iso(row.accepted_at),declinedAt:iso(row.declined_at),cancelledAt:iso(row.cancelled_at),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString() };
}
export function mapInvoice(row: InvoiceRow): Invoice { return {id:row.id,eventId:row.event_id,direction:row.direction,fundingSourceId:row.funding_source_id??undefined,agreementId:row.agreement_id??undefined,invoiceNumber:row.invoice_number,snapshot:row.snapshot,amountMinor:Number(row.amount_minor),currency:row.currency as Invoice["currency"],status:row.status,documentHash:hex(row.document_hash)!,confirmedAt:iso(row.confirmed_at),paidAt:iso(row.paid_at),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()}; }
export function mapPayout(row: PayoutRow): PayoutProfile { return {userId:row.user_id,signingAddress:row.signing_address,payoutType:row.payout_type,payoutAddress:row.payout_address,verificationStatus:row.verification_status,verifiedAt:iso(row.verified_at),destinationChain:row.destination_chain,destinationAssetId:row.destination_asset_id,destinationAssetSymbol:row.destination_asset_symbol,destinationAssetDecimals:row.destination_asset_decimals,destinationAddress:row.destination_address,destinationVerification:row.destination_verification}; }

const agreementSelect = `select * from payment_agreements`;
const chainId=()=>Number(process.env.MONAD_CHAIN_ID);
export async function listAccessibleAgreements(userId:string,email:string) { const result=await database().query<AgreementRow>(`${agreementSelect} where network_chain_id=$3 and (organizer_user_id=$1 or payee_email=$2) order by created_at desc`,[userId,email,chainId()]); return result.rows.map(mapAgreement); }
type PayeePaymentRow=QueryResultRow&{id:string;agreement_id:string;event_id:string;event_name:string;agreement_title:string;label:string;currency:PayeePayment["currency"];amount_minor:string;funded_amount_minor:string;paid_amount_minor:string;due_date:string|Date|null;processing_started_at:Date|null;cancelled_at:Date|null};
const dateOnly=(value:string|Date|null)=>value?typeof value==="string"?value.slice(0,10):value.toISOString().slice(0,10):undefined;
export async function getPayeeWorkspace(userId:string,email:string):Promise<PayeeWorkspace>{
  const [agreements,invoices,payments,payout]=await Promise.all([
    database().query<AgreementRow>(`${agreementSelect} where network_chain_id=$2 and payee_email=$1 order by created_at desc`,[email,chainId()]),
    database().query<InvoiceRow>(`select i.* from invoices i join payment_agreements a on a.id=i.agreement_id where a.network_chain_id=$2 and a.payee_email=$1 order by i.created_at desc`,[email,chainId()]),
    database().query<PayeePaymentRow>(`select p.id,a.id agreement_id,a.event_id,a.snapshot->>'eventName' event_name,a.snapshot->>'title' agreement_title,p.label,a.currency,p.amount_minor,coalesce((select sum(al.amount_minor) from allocations al where al.payment_id=p.id and al.reversed_at is null and al.execution_status='confirmed'),0) funded_amount_minor,p.paid_amount_minor,p.due_date,p.processing_started_at,p.cancelled_at from payment_agreements a join expense_payments p on p.expense_id=a.expense_id where a.network_chain_id=$2 and a.payee_email=$1 order by p.due_date asc nulls last,p.created_at asc`,[email,chainId()]),
    oneOrNull<PayoutRow>(`select * from payout_profiles where user_id=$1`,[userId]),
  ]);
  return{agreements:agreements.rows.map(mapAgreement),invoices:invoices.rows.map(mapInvoice),payments:payments.rows.map(row=>({id:row.id,agreementId:row.agreement_id,eventId:row.event_id,eventName:row.event_name,agreementTitle:row.agreement_title,label:row.label,currency:row.currency,amountMinor:Number(row.amount_minor),fundedAmountMinor:Number(row.funded_amount_minor),paidAmountMinor:Number(row.paid_amount_minor),dueDate:dateOnly(row.due_date),processingStartedAt:iso(row.processing_started_at),cancelledAt:iso(row.cancelled_at)})),payout:payout?mapPayout(payout):null};
}
export async function findAccessibleAgreement(id:string,userId:string,email:string) { const row=await oneOrNull<AgreementRow>(`${agreementSelect} where id=$1 and network_chain_id=$4 and (organizer_user_id=$2 or payee_email=$3)`,[id,userId,email,chainId()]); return row?mapAgreement(row):null; }
export async function findOrganizerAgreementByExpense(expenseId:string,userId:string) { const row=await oneOrNull<AgreementRow>(`${agreementSelect} where expense_id=$1 and organizer_user_id=$2 and network_chain_id=$3`,[expenseId,userId,chainId()]); return row?mapAgreement(row):null; }
export async function invoiceForAgreement(id:string) { const row=await oneOrNull<InvoiceRow>(`select * from invoices where agreement_id=$1`,[id]); return row?mapInvoice(row):null; }
export async function accessibleInvoice(id:string,userId:string,email:string) { const row=await oneOrNull<InvoiceRow>(`select i.* from invoices i left join payment_agreements a on a.id=i.agreement_id where i.id=$1 and (a.organizer_user_id=$2 or a.payee_email=$3)`,[id,userId,email]); return row?mapInvoice(row):null; }
export async function payoutForAgreement(id:string) { const row=await oneOrNull<PayoutRow>(`select p.* from payout_profiles p join payment_agreements a on a.payee_user_id=p.user_id where a.id=$1`,[id]); return row?mapPayout(row):null; }
export async function payoutForUser(userId:string) { const row=await oneOrNull<PayoutRow>(`select * from payout_profiles where user_id=$1`,[userId]); return row?mapPayout(row):null; }

export type CreateAgreementBundle = { agreement:PaymentAgreement; invoice:Invoice; payeeName:string };
export async function createAgreementBundle(input:CreateAgreementBundle,userId:string) {
  return transaction(async(client)=>{
    const {agreement:a,invoice:i}=input;
    if(a.organizerUserId!==userId) throw new Error("Organizer identity mismatch");
    await client.query(`insert into payees(id,event_id,name,normalized_email,created_at,updated_at) values($1,$2,$3,$4,now(),now()) on conflict(event_id,normalized_email) do update set name=excluded.name,updated_at=now()`,[a.payeeId,a.eventId,input.payeeName,a.payeeEmail]);
    const payee=await client.query<{id:string}>(`select id from payees where event_id=$1 and normalized_email=$2`,[a.eventId,a.payeeEmail]);
    await client.query(`insert into payment_agreements(id,event_id,network_chain_id,expense_id,organizer_user_id,payee_id,payee_email,total_amount_minor,currency,status,snapshot,agreement_hash,schedule_hash,registration_status,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,'not_started',now(),now()) on conflict(expense_id) do nothing`,[a.id,a.eventId,chainId(),a.expenseId,userId,payee.rows[0]!.id,a.payeeEmail,a.totalAmountMinor,a.currency,JSON.stringify(a.snapshot),bytes(a.agreementHash),bytes(a.scheduleHash)]);
    await client.query(`insert into invoices(id,event_id,direction,agreement_id,invoice_number,snapshot,amount_minor,currency,status,document_hash,created_at,updated_at) values($1,$2,'payable',$3,$4,$5,$6,$7,'prepared',$8,now(),now()) on conflict(invoice_number) do nothing`,[i.id,i.eventId,a.id,i.invoiceNumber,JSON.stringify(i.snapshot),i.amountMinor,i.currency,bytes(i.documentHash)]);
    const row=await client.query<AgreementRow>(`${agreementSelect} where expense_id=$1`,[a.expenseId]);
    return mapAgreement(row.rows[0]!);
  });
}

export async function saveProposal(id:string,userId:string,address:string,signature:string,expiresAt:Date) { const row=await oneOrNull<AgreementRow>(`update payment_agreements set organizer_address=$3,organizer_signature=$4,proposal_expires_at=$5,status='awaiting_acceptance',updated_at=now() where id=$1 and organizer_user_id=$2 and status='draft' returning *`,[id,userId,address,bytes(signature),expiresAt]); return row?mapAgreement(row):null; }

export async function bindPactAccount(userId:string,address:string,credential?:{credentialId:string;transports?:readonly string[]}) {
  return transaction(async client=>{const existing=await client.query<{signing_address:string}>(`select signing_address from pact_accounts where user_id=$1 for update`,[userId]);if(existing.rows[0]&&existing.rows[0].signing_address.toLowerCase()!==address.toLowerCase())throw new Error("This Pact identity is already bound to another Mera account");const metadata={provider:"mera",custody:"passkey-prf",...(credential?{credential}:{})};await client.query(`insert into pact_accounts(user_id,signing_address,credential_metadata,created_at,updated_at) values($1,$2,$3,now(),now()) on conflict(user_id) do update set credential_metadata=pact_accounts.credential_metadata||excluded.credential_metadata,updated_at=now()`,[userId,address,JSON.stringify(metadata)]);});
}
export async function pactAccountForUser(userId:string) { const row=await oneOrNull<{signing_address:string;credential_metadata:{credential?:{credentialId?:unknown;transports?:unknown}}}>(`select signing_address,credential_metadata from pact_accounts where user_id=$1`,[userId]);if(!row)return null;const candidate=row.credential_metadata?.credential;const credential=candidate&&typeof candidate.credentialId==="string"?{credentialId:candidate.credentialId,...(Array.isArray(candidate.transports)&&candidate.transports.every(value=>typeof value==="string")?{transports:candidate.transports as string[]}:{})}:undefined;return{signingAddress:row.signing_address,credential}; }

export async function updatePayoutPreference(userId:string,payout:{type:PayoutProfile["payoutType"];address:string;preference:PayoutPreference}) {
  return transaction(async client=>{
    const current=await client.query<PayoutRow>(`select * from payout_profiles where user_id=$1 for update`,[userId]);
    if(!current.rows[0])return null;
    await client.query(`insert into payout_profile_revisions(id,user_id,payout_type,destination_chain,destination_asset_id,destination_asset_symbol,destination_asset_decimals,destination_address,destination_verification) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[`payout_revision_${crypto.randomUUID()}`,userId,payout.type,payout.preference.chain,payout.preference.assetId,payout.preference.assetSymbol,payout.preference.assetDecimals,payout.preference.address,payout.preference.verification]);
    const updated=await client.query<PayoutRow>(`update payout_profiles set payout_type=$2,payout_address=$3,verification_status='verified',verified_at=now(),destination_chain=$4,destination_asset_id=$5,destination_asset_symbol=$6,destination_asset_decimals=$7,destination_address=$8,destination_verification=$9,updated_at=now() where user_id=$1 returning *`,[userId,payout.type,payout.address,payout.preference.chain,payout.preference.assetId,payout.preference.assetSymbol,payout.preference.assetDecimals,payout.preference.address,payout.preference.verification]);
    return mapPayout(updated.rows[0]!);
  });
}

export async function saveAcceptance(id:string,email:string,userId:string,address:string,signature:string,payout:{type:PayoutProfile["payoutType"];address:string;preference:PayoutPreference}) {
  return transaction(async(client)=>{
    const result=await client.query<AgreementRow>(`select * from payment_agreements where id=$1 for update`,[id]); const current=result.rows[0];
    if(!current||current.payee_email!==email) return null;
    if(["acceptance_signed","registration_pending","active"].includes(current.status)) return mapAgreement(current);
    if(current.status!=="awaiting_acceptance") return null;
    await client.query(`insert into payout_profiles(user_id,signing_address,payout_type,payout_address,verification_status,verified_at,updated_at,destination_chain,destination_asset_id,destination_asset_symbol,destination_asset_decimals,destination_address,destination_verification) values($1,$2,$3,$4,'verified',now(),now(),$5,$6,$7,$8,$9,$10) on conflict(user_id) do update set signing_address=excluded.signing_address,payout_type=excluded.payout_type,payout_address=excluded.payout_address,verification_status='verified',verified_at=now(),updated_at=now(),destination_chain=excluded.destination_chain,destination_asset_id=excluded.destination_asset_id,destination_asset_symbol=excluded.destination_asset_symbol,destination_asset_decimals=excluded.destination_asset_decimals,destination_address=excluded.destination_address,destination_verification=excluded.destination_verification`,[userId,address,payout.type,payout.address,payout.preference.chain,payout.preference.assetId,payout.preference.assetSymbol,payout.preference.assetDecimals,payout.preference.address,payout.preference.verification]);
    await client.query(`update invoices set status='issued',updated_at=now() where agreement_id=$1 and status='prepared'`,[id]);
    const updated=await client.query<AgreementRow>(`update payment_agreements set payee_user_id=$2,payee_address=$3,payee_signature=$4,status='acceptance_signed',registration_status='acceptance_signed',accepted_at=coalesce(accepted_at,now()),registration_error=null,updated_at=now() where id=$1 returning *`,[id,userId,address,bytes(signature)]);
    return mapAgreement(updated.rows[0]!);
  });
}

export async function getRegistrationRecord(id:string,client?:PoolClient) { const db=client??database(); const result=await db.query<AgreementRow>(`${agreementSelect} where id=$1`,[id]); return result.rows[0]??null; }
