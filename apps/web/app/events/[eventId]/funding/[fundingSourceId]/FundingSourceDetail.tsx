"use client";

import Link from "next/link";
import { ArrowLeft, Ban, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { formatEventCurrency, formatFundingDate, FUNDING_STATUS_LABELS, FUNDING_TYPE_LABELS, getFundingSourceStatus } from "../../../../../lib/funding";
import { fundingRepository } from "../../../../../lib/pact-storage";
import type { FundingSource } from "../../../../../lib/pact-types";
import { useCurrentEvent } from "../../EventShell";

export default function FundingSourceDetail({ sourceId }: { sourceId: string }) {
  const event = useCurrentEvent();
  const [source, setSource] = useState<FundingSource | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    try {
      const stored = fundingRepository.findById(sourceId);
      if (!stored || stored.eventId !== event.id) {
        setStatus("missing");
        return;
      }
      setSource(stored);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [event.id, sourceId]);

  function cancelSource() {
    try {
      const updated = fundingRepository.cancel(sourceId);
      if (!updated) throw new Error("Funding source not found");
      setSource(updated);
      setConfirmingCancel(false);
    } catch {
      setActionError("We couldn’t cancel this funding source. Please try again.");
    }
  }

  if (status === "loading") return <div className="funding-detail-skeleton" aria-label="Loading funding source" />;
  if (status === "missing" || !source) return <section className="funding-error"><h1>Funding source not found</h1><p>It may have been removed or belong to another event.</p><Link className="app-secondary-button" href={`/events/${event.id}/funding`}>Back to funding</Link></section>;
  if (status === "error") return <section className="funding-error" role="alert"><h1>We couldn’t load this source.</h1><p>Return to the funding page and try again.</p><Link className="app-secondary-button" href={`/events/${event.id}/funding`}>Back to funding</Link></section>;

  const sourceStatus = getFundingSourceStatus(source);
  const stillExpected = Math.max(source.committedAmount - source.receivedAmount, 0);
  const unallocated = source.receivedAmount;

  return <div className="funding-detail-page">
    <Link className="app-back-link" href={`/events/${event.id}/funding`}><ArrowLeft aria-hidden="true" /> Back to funding</Link>
    <header className="funding-detail-header"><div><p className="app-eyebrow">{FUNDING_TYPE_LABELS[source.type]}</p><h1>{source.name}</h1><span className={`funding-status funding-status-${sourceStatus}`}>{FUNDING_STATUS_LABELS[sourceStatus]}</span></div><Link className="app-secondary-button" href={`/events/${event.id}/funding/${source.id}/edit`}><Pencil aria-hidden="true" /> Edit funding source</Link></header>

    <section className="source-financial-summary" aria-labelledby="source-summary-heading"><div className="summary-heading"><h2 id="source-summary-heading">Financial summary</h2><span>{event.displayCurrency}</span></div><div className="summary-grid">
      <article><p>Committed</p><strong>{formatEventCurrency(source.committedAmount, event.displayCurrency)}</strong><span>Original commitment</span></article>
      <article><p>Received</p><strong>{formatEventCurrency(source.receivedAmount, event.displayCurrency)}</strong><span>Actually received</span></article>
      <article><p>Still expected</p><strong>{formatEventCurrency(stillExpected, event.displayCurrency)}</strong><span>Remaining commitment</span></article>
      <article><p>Expected by</p><strong className="summary-date">{formatFundingDate(source.expectedDate, true)}</strong><span>{source.expectedDate ? "Planned arrival" : "No date set"}</span></article>
    </div></section>

    <section className="funding-detail-grid">
      <article className="allocation-preview"><header><div><h2>Where this funding goes</h2><p>Allocations will appear here when expense planning is available.</p></div><span>Planning view</span></header><div><span><strong>Unallocated</strong><small>Received funds not assigned to an expense</small></span><strong>{formatEventCurrency(unallocated, event.displayCurrency)}</strong></div></article>
      <aside className="source-details"><h2>Source details</h2><dl><div><dt>Type</dt><dd>{FUNDING_TYPE_LABELS[source.type]}</dd></div><div><dt>Expected date</dt><dd>{formatFundingDate(source.expectedDate, true)}</dd></div><div><dt>Last updated</dt><dd>{new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(source.updatedAt))}</dd></div>{source.notes && <div><dt>Notes</dt><dd>{source.notes}</dd></div>}</dl></aside>
    </section>

    <section className="source-actions" aria-labelledby="source-actions-heading"><div><h2 id="source-actions-heading">Source status</h2><p>Cancel this source if the remaining commitment is no longer expected. Funds already received remain recorded.</p></div>{sourceStatus !== "cancelled" && !confirmingCancel && <button className="destructive-text-button" type="button" onClick={() => setConfirmingCancel(true)}><Ban aria-hidden="true" /> Mark as cancelled</button>}{confirmingCancel && <div className="cancel-confirmation"><p>Stop counting this source as an active commitment?</p><div><button className="app-secondary-button" type="button" onClick={() => setConfirmingCancel(false)}>Keep active</button><button className="destructive-button" type="button" onClick={cancelSource}>Mark as cancelled</button></div></div>}{sourceStatus === "cancelled" && <span className="cancelled-note">This source is cancelled.</span>}{actionError && <p className="field-error" role="alert">{actionError}</p>}</section>
  </div>;
}
