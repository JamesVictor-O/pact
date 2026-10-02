"use client";

import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, CircleDollarSign, Copy, Plus, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatEventCurrency, formatFundingDate, FUNDING_STATUS_LABELS, FUNDING_TYPE_LABELS, getFundingSourceStatus, getFundingSummary } from "../../../../lib/funding";
import { financialApi } from "../../../../lib/financial-api";
import type { FundingSource } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";
import { usePactAuth } from "../../../components/PactAuthProvider";
import { pactAccountAdapter } from "../../../../lib/pact-account-adapter";

export default function FundingPage() {
  const event = useCurrentEvent();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<FundingSource[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [copied,setCopied]=useState(false);
  const [vaultAction,setVaultAction]=useState<"idle"|"working"|"error">("idle");
  const {user}=usePactAuth();

  const loadSources = useCallback(async () => {
    setStatus("loading");try { setSources(await financialApi.listFunding(event.id));setStatus("ready"); } catch { setStatus("error"); }
  }, [event.id]);

  useEffect(() => {void loadSources()}, [loadSources]);

  if (status === "loading") return <div className="funding-page funding-loading" aria-label="Loading funding"><span /><span /><span /></div>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load funding.</h1><p>Your event is still safe. Try loading the funding sources again.</p><button className="app-secondary-button" type="button" onClick={()=>void loadSources()}>Try again</button></section>;

  const summary = getFundingSummary(sources,{allocated:sources.reduce((sum,source)=>sum+(source.allocatedAmount??0),0)});
  const summaryItems = [
    { label: "Committed", value: summary.committed, note: "Across active sources" },
    { label: "Received", value: summary.received, note: "Money actually received" },
    { label: "Still expected", value: summary.stillExpected, note: "Committed minus received" },
    { label: "Available", value: summary.available, note: "Received minus allocated" },
  ];
  const networkLabel=Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??10143)===10143?"Monad Testnet":"Monad";
  async function setupVault(){if(!user)return;setVaultAction("working");try{await pactAccountAdapter.ensureAccount(user);const deadline=new Date(Date.now()+7*24*60*60*1000).toISOString();const signed=await pactAccountAdapter.signEventVault(user.email,event.id,deadline);await financialApi.retryEventVault(event.id,{eventId:event.id,organizer:signed.address,deadline,signature:signed.signature});window.location.reload();}catch{setVaultAction("error");}}

  return <div className="funding-page">
    {(searchParams.get("added") === "1" || searchParams.get("updated") === "1") && <div className="app-banner app-banner-success" role="status"><Check aria-hidden="true" /><span><strong>Funding source {searchParams.get("updated") === "1" ? "updated" : "added"}.</strong> Your funding position now reflects the latest amounts.</span></div>}
    <header className="funding-header"><div><p className="app-eyebrow">Event finances</p><h1>Funding</h1><p>Track who is funding this event, what they committed, and what has actually arrived.</p></div><Link className="app-primary-button" href={`/events/${event.id}/funding/new`}><Plus aria-hidden="true" /> Add funding source</Link></header>

    <section className={`event-vault-card ${event.vaultStatus!=="ready"?"is-pending":""}`} aria-labelledby="event-vault-heading">
      <div className="event-vault-intro"><span className="event-vault-icon"><ShieldCheck aria-hidden="true" /></span><div><div className="event-vault-kicker"><p className="app-eyebrow">Event collection account</p>{event.vaultStatus==="ready"&&<span className="event-vault-status"><CheckCircle2 aria-hidden="true"/> Ready</span>}</div><h2 id="event-vault-heading">{event.vaultStatus==="ready"?"Receive event funding in USDC":event.vaultStatus==="not_started"?"Set up this event’s USDC account":"Finalizing the event account"}</h2><p>{event.vaultStatus==="ready"?"Every sponsor route settles into this one event-owned account.":"Funding requests stay disabled until the dedicated onchain account is confirmed."}</p></div></div>
      {event.vaultAddress?<div className="event-vault-details"><dl><div><dt>Network</dt><dd>{networkLabel}</dd></div><div><dt>Asset</dt><dd>USDC</dd></div></dl><div className="event-vault-address"><span>Receiving address</span><code>{event.vaultAddress}</code><button className="app-secondary-button" type="button" onClick={async()=>{await navigator.clipboard.writeText(event.vaultAddress!);setCopied(true);window.setTimeout(()=>setCopied(false),1500)}} aria-live="polite"><Copy aria-hidden="true"/>{copied?"Address copied":"Copy address"}</button></div></div>:<div className="event-vault-setup"><p>{event.vaultStatus==="not_started"?"Create a permanent account for this event before sending funding links.":"The signed setup is safe. Try finalizing again if this state does not clear."}</p><button className="app-secondary-button" type="button" disabled={vaultAction==="working"} aria-busy={vaultAction==="working"} onClick={()=>void setupVault()}>{vaultAction==="working"?"Finalizing…":event.vaultStatus==="not_started"?"Set up account":"Try again"}</button></div>}
      {vaultAction==="error"&&<p className="event-vault-error field-error" role="alert">Pact couldn’t finalize the event account. Your event is safe—try again.</p>}
    </section>

    <section className="funding-summary" aria-labelledby="funding-summary-heading">
      <div className="summary-heading"><h2 id="funding-summary-heading">Funding position</h2><span>{event.displayCurrency}</span></div>
      <div className="summary-grid">{summaryItems.map((item) => <article key={item.label}><p>{item.label}</p><strong>{formatEventCurrency(item.value, event.displayCurrency)}</strong><span>{item.note}</span></article>)}</div>
    </section>

    <section className="funding-sources-section" aria-labelledby="funding-sources-heading">
      <header><div><h2 id="funding-sources-heading">Funding sources</h2><p>Track every sponsor, partner, organizer contribution, and expected source of funds for this event.</p></div><span>{sources.length} {sources.length === 1 ? "source" : "sources"}</span></header>
      {sources.length === 0 ? <div className="funding-empty"><span><CircleDollarSign aria-hidden="true" /></span><h3>No funding sources yet</h3><p>Add sponsors, organizer funds, ticket revenue, or other expected sources so Pact can track what has been promised and what has actually arrived.</p><Link className="app-primary-button" href={`/events/${event.id}/funding/new`}>Add funding source <ArrowRight aria-hidden="true" /></Link></div> : <div className="funding-table-wrap"><div className="funding-table" aria-label="Funding sources">
        <div className="funding-table-head" aria-hidden="true"><span>Funding source</span><span>Type</span><span>Committed</span><span>Received</span><span>Expected</span><span>Status</span><span /></div>
        {sources.map((source) => {
          const sourceStatus = getFundingSourceStatus(source);
          return <Link className="funding-table-row" href={`/events/${event.id}/funding/${source.id}`} key={source.id} aria-label={`View ${source.name}, ${FUNDING_STATUS_LABELS[sourceStatus]}`}>
            <span className="funding-source-name"><strong>{source.name}</strong><small>{source.notes || "Financial source"}</small></span>
            <span data-label="Type">{FUNDING_TYPE_LABELS[source.type]}</span>
            <span data-label="Committed">{formatEventCurrency(source.committedAmount, event.displayCurrency)}</span>
            <span data-label="Received">{formatEventCurrency(source.receivedAmount, event.displayCurrency)}</span>
            <span data-label="Expected">{formatFundingDate(source.expectedDate)}</span>
            <span data-label="Status"><i className={`funding-status funding-status-${sourceStatus}`}>{FUNDING_STATUS_LABELS[sourceStatus]}</i></span>
            <ArrowRight aria-hidden="true" />
          </Link>;
        })}
      </div></div>}
    </section>
  </div>;
}
