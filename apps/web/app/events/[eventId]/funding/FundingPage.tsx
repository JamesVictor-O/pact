"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatEventCurrency, formatFundingDate, FUNDING_STATUS_LABELS, FUNDING_TYPE_LABELS, getFundingSourceStatus, getFundingSummary } from "../../../../lib/funding";
import { fundingRepository } from "../../../../lib/pact-storage";
import type { FundingSource } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";

export default function FundingPage() {
  const event = useCurrentEvent();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<FundingSource[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadSources = useCallback(() => {
    try {
      setSources(fundingRepository.listByEvent(event.id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [event.id]);

  useEffect(() => loadSources(), [loadSources]);

  if (status === "loading") return <div className="funding-page funding-loading" aria-label="Loading funding"><span /><span /><span /></div>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load funding.</h1><p>Your event is still safe. Try loading the funding sources again.</p><button className="app-secondary-button" type="button" onClick={loadSources}>Try again</button></section>;

  const summary = getFundingSummary(sources);
  const summaryItems = [
    { label: "Committed", value: summary.committed, note: "Across active sources" },
    { label: "Received", value: summary.received, note: "Money actually received" },
    { label: "Still expected", value: summary.stillExpected, note: "Committed minus received" },
    { label: "Available", value: summary.available, note: "Received minus allocated" },
  ];

  return <div className="funding-page">
    {(searchParams.get("added") === "1" || searchParams.get("updated") === "1") && <div className="app-banner app-banner-success" role="status"><Check aria-hidden="true" /><span><strong>Funding source {searchParams.get("updated") === "1" ? "updated" : "added"}.</strong> Your funding position now reflects the latest amounts.</span></div>}
    <header className="funding-header"><div><p className="app-eyebrow">Event finances</p><h1>Funding</h1><p>Track who is funding this event, what they committed, and what has actually arrived.</p></div><Link className="app-primary-button" href={`/events/${event.id}/funding/new`}><Plus aria-hidden="true" /> Add funding source</Link></header>

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
