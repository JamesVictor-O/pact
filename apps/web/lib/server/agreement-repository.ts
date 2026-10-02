import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { database, oneOrNull, transaction } from "./database";
import type { Invoice, PaymentAgreement, PayoutPreference, PayoutProfile } from "../pact-types";

type AgreementRow = QueryResultRow & {
  id: string; event_id: string; expense_id: string; organizer_user_id: string; payee_id: string; payee_email: string; payee_user_id: string | null;
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
export async function listAccessibleAgreements(userId:string,email:string) { const result=await database().query<AgreementRow>(`${agreementSelect} where organizer_user_id=$1 or payee_email=$2 order by created_at desc`,[userId,email]); return result.rows.map(mapAgreement); }
export async function findAccessibleAgreement(id:string,userId:string,email:string) { const row=await oneOrNull<AgreementRow>(`${agreementSelect} where id=$1 and (organizer_user_id=$2 or payee_email=$3)`,[id,userId,email]); return row?mapAgreement(row):null; }
export async function findOrganizerAgreementByExpense(expenseId:string,userId:string) { const row=await oneOrNull<AgreementRow>(`${agreementSelect} where expense_id=$1 and organizer_user_id=$2`,[expenseId,userId]); return row?mapAgreement(row):null; }
export async function invoiceForAgreement(id:string) { const row=await oneOrNull<InvoiceRow>(`select * from invoices where agreement_id=$1`,[id]); return row?mapInvoice(row):null; }
export async function accessibleInvoice(id:string,userId:string,email:string) { const row=await oneOrNull<InvoiceRow>(`select i.* from invoices i left join payment_agreements a on a.id=i.agreement_id where i.id=$1 and (a.organizer_user_id=$2 or a.payee_email=$3)`,[id,userId,email]); return row?mapInvoice(row):null; }
export async function payoutForAgreement(id:string) { const row=await oneOrNull<PayoutRow>(`select p.* from payout_profiles p join payment_agreements a on a.payee_user_id=p.user_id where a.id=$1`,[id]); return row?mapPayout(row):null; }

export type CreateAgreementBundle = { agreement:PaymentAgreement; invoice:Invoice; payeeName:string };
export async function createAgreementBundle(input:CreateAgreementBundle,userId:string) {
  return transaction(async(client)=>{
    const {agreement:a,invoice:i}=input;
    if(a.organizerUserId!==userId) throw new Error("Organizer identity mismatch");
    await client.query(`insert into payees(id,event_id,name,normalized_email,created_at,updated_at) values($1,$2,$3,$4,now(),now()) on conflict(event_id,normalized_email) do update set name=excluded.name,updated_at=now()`,[a.payeeId,a.eventId,input.payeeName,a.payeeEmail]);
    const payee=await client.query<{id:string}>(`select id from payees where event_id=$1 and normalized_email=$2`,[a.eventId,a.payeeEmail]);
    await client.query(`insert into payment_agreements(id,event_id,expense_id,organizer_user_id,payee_id,payee_email,total_amount_minor,currency,status,snapshot,agreement_hash,schedule_hash,registration_status,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,'not_started',now(),now()) on conflict(expense_id) do nothing`,[a.id,a.eventId,a.expenseId,userId,payee.rows[0]!.id,a.payeeEmail,a.totalAmountMinor,a.currency,JSON.stringify(a.snapshot),bytes(a.agreementHash),bytes(a.scheduleHash)]);
    await client.query(`insert into invoices(id,event_id,direction,agreement_id,invoice_number,snapshot,amount_minor,currency,status,document_hash,created_at,updated_at) values($1,$2,'payable',$3,$4,$5,$6,$7,'prepared',$8,now(),now()) on conflict(invoice_number) do nothing`,[i.id,i.eventId,a.id,i.invoiceNumber,JSON.stringify(i.snapshot),i.amountMinor,i.currency,bytes(i.documentHash)]);
    const row=await client.query<AgreementRow>(`${agreementSelect} where expense_id=$1`,[a.expenseId]);
    return mapAgreement(row.rows[0]!);
  });
}

export async function saveProposal(id:string,userId:string,address:string,signature:string,expiresAt:Date) { const row=await oneOrNull<AgreementRow>(`update payment_agreements set organizer_address=$3,organizer_signature=$4,proposal_expires_at=$5,status='awaiting_acceptance',updated_at=now() where id=$1 and organizer_user_id=$2 and status='draft' returning *`,[id,userId,address,bytes(signature),expiresAt]); return row?mapAgreement(row):null; }

export async function bindPactAccount(userId:string,address:string) {
  return transaction(async client=>{const existing=await client.query<{signing_address:string}>(`select signing_address from pact_accounts where user_id=$1 for update`,[userId]);if(existing.rows[0]&&existing.rows[0].signing_address.toLowerCase()!==address.toLowerCase())throw new Error("This Pact identity is already bound to another Mera account");await client.query(`insert into pact_accounts(user_id,signing_address,credential_metadata,created_at,updated_at) values($1,$2,$3,now(),now()) on conflict(user_id) do update set updated_at=now()`,[userId,address,JSON.stringify({provider:"mera",custody:"passkey-prf"})]);});
}
export async function pactAccountForUser(userId:string) { const row=await oneOrNull<{signing_address:string}>(`select signing_address from pact_accounts where user_id=$1`,[userId]);return row?{signingAddress:row.signing_address}:null; }

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
