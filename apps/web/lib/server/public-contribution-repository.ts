import "server-only";
import type { QueryResultRow } from "pg";
import type { DisplayCurrency, PublicContributionPage } from "../pact-types";
import { database, oneOrNull, transaction } from "./database";

type PageRow=QueryResultRow&{event_id:string;funding_source_id:string;funding_request_id:string;public_slug:string;enabled:boolean;received_amount_minor:string;created_at:Date;updated_at:Date};
type PublicPageRow=PageRow&{event_name:string;event_date:string|Date;display_currency:DisplayCurrency;vault_address:string|null;vault_status:string};
const major=(value:string|number)=>Number(value)/100;
const map=(row:PageRow):PublicContributionPage=>({eventId:row.event_id,fundingSourceId:row.funding_source_id,fundingRequestId:row.funding_request_id,publicSlug:row.public_slug,enabled:row.enabled,receivedAmount:major(row.received_amount_minor),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});

export async function contributionPageForOwner(eventId:string,userId:string){const row=await oneOrNull<PageRow>(`select p.*,f.received_amount_minor from event_contribution_pages p join events e on e.id=p.event_id join funding_sources f on f.id=p.funding_source_id where p.event_id=$1 and e.owner_user_id=$2`,[eventId,userId]);return row?map(row):null;}

export async function enablePublicContributions(eventId:string,userId:string){return transaction(async client=>{
  const event=(await client.query<{id:string;display_currency:DisplayCurrency;vault_status:string}>(`select id,display_currency,vault_status from events where id=$1 and owner_user_id=$2 for update`,[eventId,userId])).rows[0];
  if(!event)return null;
  if(event.display_currency!=="USD")throw new Error("Public crypto contributions currently require a USD event");
  if(event.vault_status!=="ready")throw new Error("Set up the event account before enabling public contributions");
  const existing=(await client.query<PageRow>(`select p.*,f.received_amount_minor from event_contribution_pages p join funding_sources f on f.id=p.funding_source_id where p.event_id=$1 for update`,[eventId])).rows[0];
  if(existing){const updated=(await client.query<PageRow>(`update event_contribution_pages p set enabled=true,updated_at=now() from funding_sources f where p.event_id=$1 and f.id=p.funding_source_id returning p.*,f.received_amount_minor`,[eventId])).rows[0];return map(updated!);}
  const sourceId=`funding_${crypto.randomUUID()}`,requestId=`funding_request_${crypto.randomUUID()}`,slug=crypto.randomUUID();
  await client.query(`insert into funding_sources(id,event_id,source_type,name,committed_amount_minor,received_amount_minor,is_open_contribution,notes) values($1,$2,'donor','Community contributions',0,0,true,'Unsolicited and public event contributions')`,[sourceId,eventId]);
  await client.query(`insert into funding_requests(id,event_id,funding_source_id,public_slug,amount_minor,currency,status,request_kind,created_by_user_id,sent_at) values($1,$2,$3,$4,0,'USD','sent','public_contribution',$5,now())`,[requestId,eventId,sourceId,slug,userId]);
  const page=(await client.query<PageRow>(`insert into event_contribution_pages(event_id,funding_source_id,funding_request_id,public_slug) values($1,$2,$3,$4) returning *,0::bigint received_amount_minor`,[eventId,sourceId,requestId,slug])).rows[0]!;
  await client.query(`insert into financial_activity(event_id,actor_user_id,action,subject_type,subject_id,metadata) values($1,$2,'public_contributions.enabled','event',$1,$3)`,[eventId,userId,JSON.stringify({fundingSourceId:sourceId,fundingRequestId:requestId})]);
  return map(page);
});}

export async function disablePublicContributions(eventId:string,userId:string){const row=await oneOrNull<PageRow>(`update event_contribution_pages p set enabled=false,updated_at=now() from events e,funding_sources f where p.event_id=$1 and e.id=p.event_id and e.owner_user_id=$2 and f.id=p.funding_source_id returning p.*,f.received_amount_minor`,[eventId,userId]);return row?map(row):null;}

export async function findPublicContributionPage(slug:string){const row=await oneOrNull<PublicPageRow>(`select p.*,e.name event_name,e.event_date,e.display_currency,e.vault_address,e.vault_status,f.received_amount_minor from event_contribution_pages p join events e on e.id=p.event_id join funding_sources f on f.id=p.funding_source_id where p.public_slug=$1 and p.enabled=true`,[slug]);if(!row)return null;return{page:map(row),eventName:row.event_name,eventDate:row.event_date instanceof Date?row.event_date.toISOString().slice(0,10):String(row.event_date).slice(0,10),currency:row.display_currency,treasuryAddress:row.vault_status==="ready"?row.vault_address??undefined:undefined};}
