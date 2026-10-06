import Image from "next/image";
import {notFound} from "next/navigation";
import {CircleCheck,LockKeyhole} from "lucide-react";
import {findPublicFundingRequest} from "../../../lib/server/funding-request-repository";
import {formatEventCurrency} from "../../../lib/funding";
import SponsorFundingClient from "./SponsorFundingClient";
import type {Address} from "viem";

export default async function SponsorFundingPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const data=await findPublicFundingRequest(slug);
  if(!data)notFound();
  const configured=Boolean(data.treasuryAddress&&data.settlementTokenAddress);
  return <main className="sponsor-funding-page">
    <header><Image src="/pact-primary-logo.svg" width={142} height={42} alt="Pact"/></header>
    <section className="sponsor-funding-card">
      <p className="app-eyebrow">Funding request</p>
      <h1>Fund {data.eventName}</h1>
      <p className="sponsor-funding-intro">{data.sourceName} has been recorded as a source of funding for this event.</p>
      <div className="sponsor-funding-amount"><span>Amount requested</span><strong>{formatEventCurrency(data.request.amount,data.request.currency)}</strong><small>{data.request.currency}</small></div>
      <dl><div><dt>Event</dt><dd>{data.eventName}</dd></div><div><dt>Funding source</dt><dd>{data.sourceName}</dd></div><div><dt>Status</dt><dd>{data.request.status==="sent"?"Awaiting payment":data.request.status.replaceAll("_"," ")}</dd></div></dl>
      {configured?<>
        <div className="sponsor-route-state"><LockKeyhole aria-hidden="true"/><div><strong>Secure event account</strong><p>Your payment is recorded for this event after it arrives.</p></div></div>
        {data.request.status==="received"?<div className="sponsor-payment-success"><CircleCheck aria-hidden="true"/><span><strong>Funding received</strong><small>This request has already been paid.</small></span></div>:<SponsorFundingClient slug={slug} treasuryAddress={data.treasuryAddress as Address}/>}
      </>:<div className="sponsor-route-state is-pending"><CircleCheck aria-hidden="true"/><div><strong>The invoice is ready</strong><p>The organizer is finishing the secure event account. Do not send funds until its address appears here.</p></div></div>}
      <p className="sponsor-funding-footnote">Pact keeps committed money separate from money that has actually arrived.</p>
    </section>
  </main>;
}
