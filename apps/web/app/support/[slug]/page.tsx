import Image from "next/image";
import {notFound} from "next/navigation";
import {HeartHandshake,LockKeyhole} from "lucide-react";
import type {Address} from "viem";
import {findPublicContributionPage} from "../../../lib/server/public-contribution-repository";
import {formatEventCurrency} from "../../../lib/funding";
import SponsorFundingClient from "../../fund/[slug]/SponsorFundingClient";

export default async function PublicContributionRoute({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,data=await findPublicContributionPage(slug);
  if(!data)notFound();
  return <main className="sponsor-funding-page public-contribution-page">
    <header><Image src="/pact-primary-logo.svg" width={142} height={42} alt="Pact"/></header>
    <section className="sponsor-funding-card">
      <p className="app-eyebrow">Support this event</p>
      <h1>Contribute to {data.eventName}</h1>
      <p className="sponsor-funding-intro">Send any amount from a supported network. Pact routes it into this event’s secure account and records it only after it arrives.</p>
      <div className="public-contribution-total"><HeartHandshake aria-hidden="true"/><span><small>Community support received</small><strong>{formatEventCurrency(data.page.receivedAmount,data.currency)}</strong></span></div>
      <div className="sponsor-route-state"><LockKeyhole aria-hidden="true"/><div><strong>One secure event account</strong><p>Your contribution joins this event’s available funding after onchain confirmation.</p></div></div>
      {data.treasuryAddress?<SponsorFundingClient slug={slug} treasuryAddress={data.treasuryAddress as Address} mode="contribution"/>:<div className="sponsor-payment-pending"><div><strong>Contributions are temporarily unavailable</strong><p>The organizer is finishing the event account.</p></div></div>}
      <p className="sponsor-funding-footnote">No account is required. Contributions are recorded independently and do not create a funding promise.</p>
    </section>
  </main>;
}
